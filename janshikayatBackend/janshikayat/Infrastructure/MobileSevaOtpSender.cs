// MobileSevaOtpSender.cs: sends OTPs and notifications by SMS through the government's Mobile Seva SMS
// gateway (msdgweb.mgov.gov.in), with DLT-registered templates. Needs ASP.NET Core on .NET 8 or later.
//
// Setup
//   Program.cs:  builder.Services.AddMobileSevaOtp();
//
//   appsettings.json (the header and templates are your own, as registered on DLT):
//     "Otp": {
//       "Sms": {
//         "Header": "ABCDEF",
//         "Gateway": { "Url": "https://msdgweb.mgov.gov.in/esms/sendsmsrequestDLT" },
//         "Templates": {
//           "Login": { "TemplateId": "1007...", "Text": "{#var#} is your OTP to login ..." },
//           "ApplicationRegistered": { "TemplateId": "1007...", "Text": "आपका आवेदन, आवेदन संख्या {#var#} के साथ ..." }
//         }
//       }
//     }
//
//   The gateway's Username, Password and SecureKey are secrets: keep them out of appsettings.json.
//     On your PC:     dotnet user-secrets set "Otp:Sms:Gateway:Username" "..."   (and Password, SecureKey)
//     On the server:  environment variables Otp__Sms__Gateway__Username, __Password, __SecureKey
//
//   appsettings.Development.json, to log in on your PC without an SMS:  "Otp": { "DummyCode": "123456" }
//
// Use
//   OTP:
//     if (!sender.CanSend) { ... tell the user OTPs cannot be sent now ... }
//     var code = sender.DummyCode ?? RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
//     ... save the code (or its hash) with an expiry ...
//     if (!await sender.SendAsync("9876543210", code, "Login", cancellationToken)) { ... not sent ... }
//   Notification (English or Hindi):
//     await sender.SendMessageAsync("9876543210", "JS12345", "ApplicationRegistered", cancellationToken);

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace janshikayat.Infrastructure;

public static class MobileSevaOtpServiceCollectionExtensions
{
    /// <summary>Registers MobileSevaOtpSender and the HttpClient it calls the gateway with.</summary>
    public static IServiceCollection AddMobileSevaOtp(this IServiceCollection services)
    {
        services.AddSingleton<MobileSevaOtpSender>();
        services.AddHttpClient(MobileSevaOtpSender.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(20));

        return services;
    }
}

/// <summary>
/// Sends an OTP or a notification to a mobile number by SMS, through the government's Mobile Seva SMS
/// gateway (Otp:Sms:Gateway). Its Username, Password and SecureKey are secrets, so they come from
/// user-secrets or environment variables and never from appsettings.json. Without all three no
/// SMS can reach the user; CanSend is then false, so the API can say so instead of letting the
/// user wait for an SMS that will not come.
/// An SMS is accepted by the operators only as the exact text of a template registered on DLT
/// under the sender header Otp:Sms:Header, with the value in place of its one variable ({#var#}),
/// and only with that template's id. Each template is in Otp:Sms:Templates under a name of your
/// choosing; a changed text is a new template with a new id, so the two are changed together there.
/// On a developer's PC (Development) with Otp:DummyCode set, every OTP is that code and no SMS is
/// sent, even when the gateway's secrets are there; a published copy ignores Otp:DummyCode.
/// </summary>
public sealed partial class MobileSevaOtpSender(IConfiguration configuration, IHostEnvironment environment, IHttpClientFactory httpClientFactory, ILogger<MobileSevaOtpSender> logger)
{
    /// <summary>The HttpClient the gateway is called with (AddMobileSevaOtp).</summary>
    public const string HttpClientName = "MobileSevaSms";

    private readonly string header = ReadHeader(configuration);
    private readonly Dictionary<string, SmsTemplate> templates = ReadTemplates(configuration);
    private readonly (string? DummyCode, SmsGateway? Gateway) mode = ReadMode(configuration, environment, logger);

    /// <summary>
    /// The fixed OTP of a developer's PC, which should be stored instead of a random one; null
    /// everywhere else, so that a published copy always sends a random OTP by SMS.
    /// </summary>
    public string? DummyCode => mode.DummyCode;

    /// <summary>False when an SMS could not reach the user, so no OTP should be made.</summary>
    public bool CanSend => mode.DummyCode is not null || mode.Gateway is not null;

    /// <summary>
    /// Sends the OTP to a 10-digit mobile number (no +91 or 0) with the template named
    /// templateName in Otp:Sms:Templates; false when the gateway did not take the SMS, so it will
    /// not arrive.
    /// </summary>
    public Task<bool> SendAsync(string mobileNumber, string code, string templateName, CancellationToken cancellationToken)
        => SendTemplateAsync(mobileNumber, code, templateName, isOtp: true, cancellationToken);

    /// <summary>
    /// Sends a notification (not an OTP), such as an application number, to a 10-digit mobile number
    /// with the template named templateName in Otp:Sms:Templates; false when the gateway did not take
    /// the SMS. A template with Hindi (non-ASCII) text goes as a Unicode SMS.
    /// </summary>
    public Task<bool> SendMessageAsync(string mobileNumber, string value, string templateName, CancellationToken cancellationToken)
        => SendTemplateAsync(mobileNumber, value, templateName, isOtp: false, cancellationToken);

    private async Task<bool> SendTemplateAsync(string mobileNumber, string value, string templateName, bool isOtp, CancellationToken cancellationToken)
    {
        if (mobileNumber is not { Length: 10 } || !mobileNumber.All(char.IsAsciiDigit))
        {
            throw new ArgumentException("The mobile number must be 10 digits, without +91 or 0.", nameof(mobileNumber));
        }

        if (!templates.TryGetValue(templateName, out var template))
        {
            throw new ArgumentException($"Otp:Sms:Templates has no template {templateName}.", nameof(templateName));
        }

        var message = Variable().Replace(template.Text, value.Replace("$", "$$"), 1);

        if (mode.DummyCode is not null)
        {
            logger.LogInformation("Development: no SMS sent to {MobileNumber} ({Template}): {Message}",
                mobileNumber, templateName, isOtp ? "dummy OTP" : message);
            return true;
        }

        var gateway = mode.Gateway;
        if (gateway is null)
        {
            throw new InvalidOperationException("No SMS gateway is configured, so the SMS cannot be sent.");
        }

        // Hindi text goes as a Unicode message, each character written as &#code; (the gateway's
        // format); an OTP as an OTP message (priority route), and other text as a single message.
        var unicode = !Ascii.IsValid(message);
        var content = unicode ? string.Concat(message.Select(c => $"&#{(int)c};")) : message;
        var serviceType = (unicode, isOtp) switch
        {
            (true, true) => "unicodeotpmsg",
            (true, false) => "unicodemsg",
            (false, true) => "otpmsg",
            (false, false) => "singlemsg"
        };

        // The password goes as its SHA-1, and key proves the SecureKey without sending it: the
        // SHA-512 of username, sender header, content and SecureKey written one after the other.
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["username"] = gateway.Username,
            ["password"] = gateway.PasswordHash,
            ["smsservicetype"] = serviceType,
            ["content"] = content,
            ["mobileno"] = mobileNumber,
            ["senderid"] = header,
            ["key"] = Hex(SHA512.HashData(Encoding.UTF8.GetBytes(gateway.Username + header + content + gateway.SecureKey))),
            ["templateid"] = template.TemplateId
        });

        string reply;
        try
        {
            using var response = await httpClientFactory.CreateClient(HttpClientName).PostAsync(gateway.Url, form, cancellationToken);
            reply = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();
        }
        catch (Exception exception) when (exception is HttpRequestException
                                          || exception is TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "The SMS gateway could not be reached; no SMS sent to {MobileNumber} ({Template})", mobileNumber, templateName);
            return false;
        }

        // The gateway answers "402,MsgID = ..." when it has taken the SMS, and another code when not
        // (401 for a wrong username or password, for instance).
        if (reply.StartsWith("402", StringComparison.Ordinal))
        {
            logger.LogInformation("SMS sent to {MobileNumber} ({Template}): {Reply}", mobileNumber, templateName, reply);
            return true;
        }

        logger.LogError("The SMS gateway did not send the SMS to {MobileNumber} ({Template}): {Reply}",
            mobileNumber, templateName, reply.Length > 300 ? reply[..300] : reply);

        return false;
    }

    /// <summary>A DLT template variable, such as {#var#} or {#num#}.</summary>
    [GeneratedRegex(@"\{#\w+#\}")]
    private static partial Regex Variable();

    private static string ReadHeader(IConfiguration configuration)
    {
        var header = configuration["Otp:Sms:Header"];

        return header is { Length: 6 } && header.All(char.IsAsciiLetterOrDigit)
            ? header
            : throw new InvalidOperationException("Otp:Sms:Header must be the 6-character sender header registered on DLT.");
    }

    private static Dictionary<string, SmsTemplate> ReadTemplates(IConfiguration configuration)
    {
        var templates = configuration.GetSection("Otp:Sms:Templates").GetChildren()
            .ToDictionary(section => section.Key, ReadTemplate, StringComparer.OrdinalIgnoreCase);

        return templates.Count > 0
            ? templates
            : throw new InvalidOperationException("Otp:Sms:Templates must have at least one template registered on DLT.");
    }

    private static SmsTemplate ReadTemplate(IConfigurationSection section)
    {
        var templateId = section["TemplateId"];
        var text = section["Text"];

        if (string.IsNullOrEmpty(templateId) || !templateId.All(char.IsAsciiDigit))
        {
            throw new InvalidOperationException($"{section.Path}:TemplateId must be the template id given by DLT, in digits.");
        }

        // The OTP or the application number is the template's one variable.
        if (text is null || Variable().Count(text) != 1)
        {
            throw new InvalidOperationException($"{section.Path}:Text must be the registered template text, with one variable such as {{#var#}} where the value goes.");
        }

        return new SmsTemplate(templateId, text);
    }

    /// <summary>
    /// The dummy OTP on a developer's PC, and then no gateway; otherwise the gateway. Otp:DummyCode
    /// outside Development is a mistake in the settings: it is logged and has no effect.
    /// </summary>
    private static (string? DummyCode, SmsGateway? Gateway) ReadMode(IConfiguration configuration, IHostEnvironment environment, ILogger logger)
    {
        var dummyCode = configuration["Otp:DummyCode"]?.Trim();

        if (!string.IsNullOrEmpty(dummyCode))
        {
            if (!environment.IsDevelopment())
            {
                logger.LogWarning("Otp:DummyCode is ignored in {Environment}; OTPs are sent by SMS.", environment.EnvironmentName);
            }
            else
            {
                if (dummyCode.Length != 6 || !dummyCode.All(char.IsAsciiDigit))
                {
                    throw new InvalidOperationException("Otp:DummyCode must be 6 digits.");
                }

                logger.LogWarning("Development: every OTP is the dummy code from Otp:DummyCode; no SMS is sent.");
                return (dummyCode, null);
            }
        }

        return (null, ReadGateway(configuration, logger));
    }

    /// <summary>The gateway, or null (logged) when its Username, Password and SecureKey are not all configured.</summary>
    private static SmsGateway? ReadGateway(IConfiguration configuration, ILogger logger)
    {
        var section = configuration.GetSection("Otp:Sms:Gateway");
        var username = section["Username"]?.Trim();
        var password = section["Password"];
        var secureKey = section["SecureKey"]?.Trim();

        string[] missing = [.. new[] { ("Username", username), ("Password", password), ("SecureKey", secureKey) }
            .Where(setting => string.IsNullOrWhiteSpace(setting.Item2))
            .Select(setting => setting.Item1)];

        if (missing.Length > 0)
        {
            logger.LogWarning("No SMS can be sent: Otp:Sms:Gateway has no {Missing}.", string.Join(" or ", missing));
            return null;
        }

        // The password and the key travel to the gateway, so only over https.
        if (!Uri.TryCreate(section["Url"], UriKind.Absolute, out var url) || url.Scheme != Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException("Otp:Sms:Gateway:Url must be the https address of the SMS gateway.");
        }

        var passwordHash = Hex(SHA1.HashData(Encoding.UTF8.GetBytes(password!)));

        return new SmsGateway(url, username!, passwordHash, secureKey!);
    }

    /// <summary>Lowercase hex, as the gateway expects (Convert.ToHexStringLower is .NET 9 only).</summary>
    private static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

    private sealed record SmsTemplate(string TemplateId, string Text);

    private sealed record SmsGateway(Uri Url, string Username, string PasswordHash, string SecureKey);
}
