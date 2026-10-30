using janshikayat.BAL.Interfaces;
using janshikayat.Models;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;


namespace janshikayat.Controllers
{

    [ApiController]
    [Route("[controller]")]
    public class AuthController : Controller
    {
        private readonly IAuthService _IAuthService;
        private readonly IConfiguration _configuration;
        
        private readonly IHttpContextAccessor _httpContextAccessor;
        private static readonly Dictionary<string, string> CaptchaStore = new();
        public AuthController(IConfiguration configuration, IAuthService IAuthService, IHttpContextAccessor httpContextAccessor)
        {
            _configuration = configuration;
            _IAuthService = IAuthService;
            _httpContextAccessor = httpContextAccessor;
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
