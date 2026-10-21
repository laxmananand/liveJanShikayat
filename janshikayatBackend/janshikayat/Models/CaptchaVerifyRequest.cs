namespace janshikayat.Models
{
    public class CaptchaResponse
    {
        public string CaptchaId { get; set; }
        public string CaptchaImage { get; set; }
    }
    public class CaptchaVerifyRequest
    {
        public string CaptchaId { get; set; } = string.Empty;

        public string CaptchaCode { get; set; } = string.Empty;
    }
}
