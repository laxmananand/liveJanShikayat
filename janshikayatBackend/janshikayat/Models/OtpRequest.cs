namespace janshikayat.Models
{
    // POST /Auth/otp/send and POST /Auth/mobile/send-otp (logged in)
    public class OtpSendRequest
    {
        public string MobileNo { get; set; } = string.Empty;
    }

    // POST /Auth/otp/verify and POST /Auth/mobile/verify
    public class OtpVerifyRequest
    {
        public string MobileNo { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }
}
