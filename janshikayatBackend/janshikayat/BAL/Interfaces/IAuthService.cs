using janshikayat.Models;
namespace janshikayat.BAL.Interfaces
{
    public interface IAuthService
    {
        string GenerateCaptchaText(int length);
        string GenerateCaptchaSvg(string captchaText);
        //LoginResponse Login(string userid, string password);
        LoginResponse Login(LoginParam param);
        int CountUsersWithMobile(string mobileNo, string? exceptUserName = null);
        LoginResponse? LoginWithMobile(string mobileNo);
        bool UpdateMobile(string userName, string mobileNo);
        bool Logout(string userName);
    }
}
