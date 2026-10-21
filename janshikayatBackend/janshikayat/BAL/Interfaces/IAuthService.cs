using janshikayat.Models;
namespace janshikayat.BAL.Interfaces
{
    public interface IAuthService
    {
        string GenerateCaptchaText(int length);
        string GenerateCaptchaSvg(string captchaText);
        //LoginResponse Login(string userid, string password);
        LoginResponse Login(LoginParam param);
        bool Logout(string userName);
    }
}
