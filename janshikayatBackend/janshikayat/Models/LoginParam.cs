namespace janshikayat.Models
{
    public class LoginParam
    {
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string CaptchaId { get; set; } = string.Empty;
        public string CaptchaCode { get; set; } = string.Empty;
    }
}
