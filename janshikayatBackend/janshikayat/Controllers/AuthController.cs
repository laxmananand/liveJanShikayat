using janshikayat.BAL.Interfaces;
using janshikayat.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.RateLimiting;
using janshikayat.Infrastructure;


namespace janshikayat.Controllers
{

    [ApiController]
    [Route("[controller]")]
    public class AuthController : Controller
    {
        private readonly IAuthService _IAuthService;
        private readonly IConfiguration _configuration;
        
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly MobileSevaOtpSender _smsSender;
        private readonly OtpCodeStore _otpStore;
        private static readonly Dictionary<string, string> CaptchaStore = new();
        public AuthController(IConfiguration configuration, IAuthService IAuthService, IHttpContextAccessor httpContextAccessor,
            MobileSevaOtpSender smsSender, OtpCodeStore otpStore)
        {
            _configuration = configuration;
            _IAuthService = IAuthService;
            _httpContextAccessor = httpContextAccessor;
            _smsSender = smsSender;
            _otpStore = otpStore;
        }
        [HttpGet("generate-captcha")]
        public IActionResult GenerateCaptcha()
        {
            string captchaId = Guid.NewGuid().ToString();

            string captchaText = _IAuthService.GenerateCaptchaText(6);

            CaptchaStore[captchaId] = captchaText;

            string svg = _IAuthService.GenerateCaptchaSvg(captchaText);

            string base64 = Convert.ToBase64String(
                Encoding.UTF8.GetBytes(svg)
            );

            return Ok(new
            {
                status = true,
                captchaId = captchaId,
                captchaImage = "data:image/svg+xml;base64," + base64
            });
        }
        [HttpPost("verify-captcha")]
        public IActionResult VerifyCaptcha([FromBody] CaptchaVerifyRequest model)
        {
            if (model == null ||
                string.IsNullOrWhiteSpace(model.CaptchaId) ||
                string.IsNullOrWhiteSpace(model.CaptchaCode))
            {
                return Ok(new
                {
                    status = false,
                    message = "Captcha is required."
                });
            }

            if (!CaptchaStore.TryGetValue(model.CaptchaId, out string? captchaText))
            {
                return Ok(new
                {
                    status = false,
                    message = "Captcha expired or invalid."
                });
            }

            if (!string.Equals(
                    captchaText,
                    model.CaptchaCode,
                    StringComparison.Ordinal))
            {
                return Ok(new
                {
                    status = false,
                    message = "Invalid captcha."
                });
            }

            // Remove captcha after successful verification
            CaptchaStore.Remove(model.CaptchaId);

            return Ok(new
            {
                status = true,
                message = "Captcha verified successfully."
            });
        }

        // ================= LOGIN =================
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginParam model)
        {
            if (model == null ||
                string.IsNullOrWhiteSpace(model.UserName) ||
                string.IsNullOrWhiteSpace(model.Password))
            {
                return Ok(new
                {
                    status = false,
                    message = "Username and password are required."
                });
            }

            // 1) Captcha check
            if (string.IsNullOrWhiteSpace(model.CaptchaId) ||
                string.IsNullOrWhiteSpace(model.CaptchaCode))
            {
                return Ok(new
                {
                    status = false,
                    message = "Captcha is required."
                });
            }

            if (!CaptchaStore.TryGetValue(model.CaptchaId, out string? captchaText))
            {
                return Ok(new
                {
                    status = false,
                    message = "Captcha expired or invalid."
                });
            }

            if (!string.Equals(
                    captchaText,
                    model.CaptchaCode,
                    StringComparison.Ordinal))
            {
                return Ok(new
                {
                    status = false,
                    message = "Invalid captcha."
                });
            }

            // consume captcha
            CaptchaStore.Remove(model.CaptchaId);

            // 2) Authenticate
            var result = _IAuthService.Login(model);
            if (result == null)
            {
                return Ok(new
                {
                    status = false,
                    message = "Invalid username or password."
                });
            }

            return Ok(new
            {
                status = true,
                message = "Login successful.",
                data = result
            });
        }

        // ================= OTP LOGIN =================
        // SMS template in Otp:Sms:Templates (appsettings.json), registered on DLT; used for login and for verifying a new number
        private const string OtpSmsTemplate = "LoginOtp";

        // Policy name registered in Program.cs
        public const string OtpSendRateLimit = "OtpSend";

        [HttpPost("otp/send")]
        [EnableRateLimiting(OtpSendRateLimit)]
        public async Task<IActionResult> SendLoginOtp([FromBody] OtpSendRequest model, CancellationToken cancellationToken)
        {
            var mobile = NormalizeMobile(model?.MobileNo);
            if (mobile == null)
                return Ok(new { status = false, message = "Enter a valid 10-digit mobile number." });

            // No captcha here: SMS flooding is held back by the per-IP rate limit and the 60 s wait per number
            var users = _IAuthService.CountUsersWithMobile(mobile);
            if (users == 0)
                return Ok(new { status = false, message = "This mobile number is not registered with any login." });
            if (users > 1)
                return Ok(new { status = false, message = "This mobile number is linked to more than one login. Please sign in with username and password." });

            return await SendOtp(LoginOtpKey(mobile), mobile, cancellationToken);
        }

        [HttpPost("otp/verify")]
        public IActionResult VerifyLoginOtp([FromBody] OtpVerifyRequest model)
        {
            var mobile = NormalizeMobile(model?.MobileNo);
            if (mobile == null || string.IsNullOrWhiteSpace(model!.Otp))
                return Ok(new { status = false, message = "Mobile number and OTP are required." });

            var otpError = CheckOtp(LoginOtpKey(mobile), model.Otp);
            if (otpError != null)
                return Ok(new { status = false, message = otpError });

            var result = _IAuthService.LoginWithMobile(mobile);
            if (result == null)
                return Ok(new { status = false, message = "No single login found for this mobile number." });

            return Ok(new { status = true, message = "Login successful.", data = result });
        }

        // ================= ADD MOBILE (after login, when Tbl_UserLogin.MobileNo is missing) =================
        [HttpPost("mobile/send-otp")]
        [Authorize]
        [EnableRateLimiting(OtpSendRateLimit)]
        public async Task<IActionResult> SendMobileOtp([FromBody] OtpSendRequest model, CancellationToken cancellationToken)
        {
            var userName = CurrentUserName();
            if (userName == null)
                return Unauthorized(new { status = false, message = "Unauthorized." });

            var mobile = NormalizeMobile(model?.MobileNo);
            if (mobile == null)
                return Ok(new { status = false, message = "Enter a valid 10-digit mobile number." });

            // One number per login, so that OTP login always finds exactly one user
            if (_IAuthService.CountUsersWithMobile(mobile, userName) > 0)
                return Ok(new { status = false, message = "This mobile number is already linked to another login." });

            return await SendOtp(LinkOtpKey(userName, mobile), mobile, cancellationToken);
        }

        [HttpPost("mobile/verify")]
        [Authorize]
        public IActionResult VerifyMobileOtp([FromBody] OtpVerifyRequest model)
        {
            var userName = CurrentUserName();
            if (userName == null)
                return Unauthorized(new { status = false, message = "Unauthorized." });

            var mobile = NormalizeMobile(model?.MobileNo);
            if (mobile == null || string.IsNullOrWhiteSpace(model!.Otp))
                return Ok(new { status = false, message = "Mobile number and OTP are required." });

            var otpError = CheckOtp(LinkOtpKey(userName, mobile), model.Otp);
            if (otpError != null)
                return Ok(new { status = false, message = otpError });

            // Checked again: another login may have taken the number while the OTP was on its way
            if (_IAuthService.CountUsersWithMobile(mobile, userName) > 0)
                return Ok(new { status = false, message = "This mobile number is already linked to another login." });

            if (!_IAuthService.UpdateMobile(userName, mobile))
                return Ok(new { status = false, message = "The mobile number could not be saved." });

            return Ok(new { status = true, message = "Mobile number verified and saved." });
        }

        private static string LoginOtpKey(string mobile) => "otp:login:" + mobile;
        private static string LinkOtpKey(string userName, string mobile) => $"otp:link:{userName}:{mobile}";

        private string? CurrentUserName() =>
            User.FindFirst("LOGIN_ID")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        // 10 digits without +91 or a leading 0 (spaces and dashes ignored); null when it is not a mobile number
        private static string? NormalizeMobile(string? mobileNo)
        {
            var digits = new string((mobileNo ?? "").Where(char.IsAsciiDigit).ToArray());
            if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
            else if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
            return digits.Length == 10 && digits[0] >= '6' ? digits : null;
        }

        private async Task<IActionResult> SendOtp(string key, string mobile, CancellationToken cancellationToken)
        {
            if (!_smsSender.CanSend)
                return Ok(new { status = false, message = "OTP service is not available right now. Please sign in with username and password." });

            var code = _otpStore.Issue(key, _smsSender.DummyCode, out var retryAfter);
            if (code == null)
                return Ok(new { status = false, message = $"Please wait {retryAfter} seconds before asking for a new OTP.", retryAfter });

            if (!await _smsSender.SendAsync(mobile, code, OtpSmsTemplate, cancellationToken))
            {
                _otpStore.Remove(key);
                return Ok(new { status = false, message = "The OTP could not be sent. Please try again." });
            }

            return Ok(new
            {
                status = true,
                message = $"OTP sent to XXXXXX{mobile[6..]}.",
                expiresIn = (int)OtpCodeStore.Lifetime.TotalSeconds,
                retryAfter = (int)OtpCodeStore.ResendAfter.TotalSeconds
            });
        }

        private string? CheckOtp(string key, string otp) => _otpStore.Verify(key, otp) switch
        {
            OtpCheck.Valid => null,
            OtpCheck.Wrong => "Incorrect OTP.",
            _ => "OTP expired or too many wrong attempts. Please request a new OTP."
        };

        // ================= LOGOUT =================
        [HttpPost("logout")]
        //[Authorize] // TEMP: disabled for testing
        public IActionResult Logout()
        {
            var userName = User.FindFirst("LOGIN_ID")?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(userName))
            {
                return Unauthorized(new
                {
                    status = false,
                    message = "Unauthorized."
                });
            }

            var ok = _IAuthService.Logout(userName);

            return Ok(new
            {
                status = ok,
                message = ok ? "Logged out successfully." : "Logout failed."
            });
        }
    }
}
