using Dapper;
using janshikayat.BAL.Interfaces;
using janshikayat.Data;
using janshikayat.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace janshikayat.BAL.Services
{
    public class AuthService:IAuthService
    {
        private readonly DapperContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpContextAccessor _httpContextAccessor;
       
        private readonly IWebHostEnvironment _environment;
        public string aeskey = "";
        public string Token = "";

        public AuthService(IConfiguration config, DapperContext context,
                           IHttpContextAccessor httpContextAccessor,
                           IWebHostEnvironment environment)
        {
            _config = config;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            
            _environment = environment;
        }

        public string GenerateCaptchaText(int length)
        {           
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            Random random = new Random();
            StringBuilder result = new StringBuilder();
            for (int i = 0; i < length; i++)
            {
                result.Append(
                    chars[random.Next(chars.Length)]
                );
            }
            return result.ToString();
        }


        public string GenerateCaptchaSvg(string captchaText)
        {
            Random random = new Random();

            StringBuilder svg = new StringBuilder();

            svg.AppendLine(
                "<svg xmlns=\"http://www.w3.org/2000/svg\" " +
                "width=\"220\" height=\"80\">"
            );

            // Background
            svg.AppendLine(
                "<rect width=\"220\" height=\"80\" " +
                "fill=\"white\"/>"
            );

            // Border
            svg.AppendLine(
                "<rect x=\"1\" y=\"1\" width=\"218\" height=\"78\" " +
                "fill=\"none\" stroke=\"black\" stroke-width=\"2\"/>"
            );

            // Random lines
            for (int i = 0; i < 8; i++)
            {
                int x1 = random.Next(0, 220);
                int y1 = random.Next(0, 80);

                int x2 = random.Next(0, 220);
                int y2 = random.Next(0, 80);

                svg.AppendLine(
                    $"<line x1=\"{x1}\" y1=\"{y1}\" " +
                    $"x2=\"{x2}\" y2=\"{y2}\" " +
                    "stroke=\"gray\" stroke-width=\"1\"/>"
                );
            }

            // CAPTCHA text
            svg.AppendLine(
                "<text x=\"25\" y=\"52\" " +
                "font-family=\"Arial\" " +
                "font-size=\"36\" " +
                "font-weight=\"bold\" " +
                "fill=\"black\" " +
                "letter-spacing=\"5\">"
            );

            svg.AppendLine(captchaText);

            svg.AppendLine("</text>");

            // Random dots
            for (int i = 0; i < 30; i++)
            {
                int x = random.Next(0, 220);
                int y = random.Next(0, 80);

                svg.AppendLine(
                    $"<circle cx=\"{x}\" cy=\"{y}\" " +
                    "r=\"1.5\" fill=\"gray\"/>"
                );
            }

            svg.AppendLine("</svg>");

            return svg.ToString();
        }



        public string GetClientIpAddress()
        {
            var ipAddress = _httpContextAccessor.HttpContext?
                .Connection
                .RemoteIpAddress;

            if (ipAddress == null) return string.Empty;

            try { return ipAddress.MapToIPv4().ToString(); }
            catch { return ipAddress.ToString(); }
        }
        public LoginResponse Login(LoginParam param)
        {
            if (param == null ||
                string.IsNullOrWhiteSpace(param.UserName) ||
                string.IsNullOrWhiteSpace(param.Password))
                return null;

            using var conn = _context.CreateConnection();

            var encryptor = new Encryptor(Encryptor.PrivateKey);
            string decryptedPassword = encryptor.Encrypt(param.Password ?? "");

            var parameters = new DynamicParameters();
            parameters.Add("@UserName", param.UserName);
            parameters.Add("@Password", decryptedPassword);    
            // Role name comes from Mst_Role (Tbl_UserLogin.Role holds Mst_Role.Id)
            var user = conn.QueryFirstOrDefault<UserLoginRow>(
                @"SELECT TOP 1
                       t.AutoId, t.UserName, t.Password,
                       t.MobileNo, t.Email, t.Role AS RoleId, r.Role AS RoleName, t.IsActive, t.Branch_Id AS BranchId, t.Prashakha_Id AS PrashakhaId
                  FROM Tbl_UserLogin t
                  LEFT JOIN Mst_Role r ON t.Role = r.Id
                  WHERE t.UserName = @UserName AND t.Password = @Password",
                parameters

                );
            // Wrong username/password: let the controller return its "invalid login" response instead of crashing
            if (user == null)
                return null;

            string roleStr = user.RoleName ?? "";
            // 5) Generate JWT
            var token = GenerateJwtToken(user.UserName, roleStr, user.BranchId, user.PrashakhaId);
            return new LoginResponse
            {
                AuthToken = token,
                userid = user.UserName,
                username = user.UserName,
                ROLE = roleStr,
                branchId = user.BranchId,
                prashakhaId = user.PrashakhaId
            };
        }

    
        public bool Logout(string userName)
        {
           
            return !string.IsNullOrWhiteSpace(userName);
        }

     
        private string GenerateJwtToken(string LOGIN_ID, string role = null, long? branchId = null, int? prashakhaId = null)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, LOGIN_ID),
                new Claim("LOGIN_ID", LOGIN_ID),
                new Claim("role", role)
            };

            if (!string.IsNullOrWhiteSpace(role))
                claims.Add(new Claim(ClaimTypes.Role, role));

            // Tbl_UserLogin.Branch_Id -> Mst_Branch.Complain_id; decides which forwarded applications the user sees
            if (branchId.HasValue)
                claims.Add(new Claim("BranchId", branchId.Value.ToString()));

            // Tbl_UserLogin.Prashakha_Id -> Mst_Prashakha.ID; Section forwards to that Prashakha reach this login
            if (prashakhaId.HasValue)
                claims.Add(new Claim("PrashakhaId", prashakhaId.Value.ToString()));

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_config["Jwt:Key"]));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(
                    Convert.ToInt32(_config["Jwt:ExpiryMinutes"])),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // ================= Dapper row model =================
        private class UserLoginRow
        {
            public long AutoId { get; set; }
            public string UserName { get; set; }
            public string Password { get; set; }
            public string MobileNo { get; set; }
            public string Email { get; set; }
            public int? RoleId { get; set; }
            public string? RoleName { get; set; }
            public bool? IsActive { get; set; }
            public long? BranchId { get; set; }
            public int? PrashakhaId { get; set; }
        }
    }
}
