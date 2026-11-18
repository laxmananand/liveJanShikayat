// CaptchaStore.cs: captchas waiting to be answered, kept in memory (one server) with an expiry. Each captcha
// can be checked only once, right or wrong, so a script cannot keep guessing the same one.

using Microsoft.Extensions.Caching.Memory;

namespace janshikayat.Infrastructure;

public sealed class CaptchaStore(IMemoryCache cache)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private static string Key(string captchaId) => "captcha:" + captchaId;

    public void Add(string captchaId, string text) => cache.Set(Key(captchaId), text, Lifetime);

    /// <summary>
    /// Null when the answer is right; otherwise the message to show. The captcha is used up either way.
    /// </summary>
    public string? Consume(string? captchaId, string? answer)
    {
        if (string.IsNullOrWhiteSpace(captchaId) || string.IsNullOrWhiteSpace(answer))
            return "Captcha is required.";

        string? text;
        lock (cache)
        {
            if (!cache.TryGetValue(Key(captchaId), out text))
                text = null;
            cache.Remove(Key(captchaId));
        }

        if (text == null)
            return "Captcha expired or invalid.";
        return string.Equals(text, answer, StringComparison.Ordinal) ? null : "Invalid captcha.";
    }
}

// Wrong passwords per username: after MaxFailures within Window the username is locked for Window,
// so a password cannot be guessed by trying many (the captcha alone does not stop a script).
public sealed class LoginAttemptStore(IMemoryCache cache)
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    private const int MaxFailures = 5;

    private sealed class Entry
    {
        public int Failures { get; set; }
        public DateTimeOffset? LockedUntil { get; set; }
    }

    private static string Key(string userName) => "login-fail:" + userName.Trim().ToUpperInvariant();

    /// <summary>Minutes left on the lock, or 0 when the username may try.</summary>
    public int LockedMinutes(string userName)
    {
        lock (cache)
        {
            if (cache.TryGetValue(Key(userName), out Entry? e) && e?.LockedUntil is { } until)
            {
                var left = until - DateTimeOffset.UtcNow;
                if (left > TimeSpan.Zero)
                    return (int)Math.Ceiling(left.TotalMinutes);
            }
            return 0;
        }
    }

    public void Fail(string userName)
    {
        lock (cache)
        {
            var key = Key(userName);
            if (!cache.TryGetValue(key, out Entry? e) || e is null || e.LockedUntil < DateTimeOffset.UtcNow)
                e = new Entry();
            e.Failures++;
            if (e.Failures >= MaxFailures)
                e.LockedUntil = DateTimeOffset.UtcNow + Window;
            cache.Set(key, e, Window);
        }
    }

    public void Succeed(string userName)
    {
        lock (cache) cache.Remove(Key(userName));
    }
}
