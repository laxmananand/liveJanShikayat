// OtpCodeStore.cs: the OTPs waiting to be entered, kept in memory (one server) with an expiry, a
// resend cooldown and a limit on wrong tries. Only the SHA-256 of each code is kept.

using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace janshikayat.Infrastructure;

public enum OtpCheck
{
    Valid,
    Wrong,
    /// <summary>No OTP was sent, it ran out, it was already used, or too many wrong tries.</summary>
    Expired
}

public sealed class OtpCodeStore(IMemoryCache cache)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);
    private const int MaxWrongTries = 5;

    private sealed class Entry
    {
        public required byte[] Hash { get; init; }
        public required DateTimeOffset SentAt { get; init; }
        public int WrongTries { get; set; }
    }

    /// <summary>
    /// A new OTP for key (the dummy code on a developer's PC, otherwise random), replacing any earlier
    /// one; null with the seconds to wait when the last one was sent less than ResendAfter ago.
    /// </summary>
    public string? Issue(string key, string? dummyCode, out int retryAfterSeconds)
    {
        retryAfterSeconds = 0;
        lock (cache)
        {
            if (cache.TryGetValue(key, out Entry? last) && last is not null)
            {
                var wait = last.SentAt + ResendAfter - DateTimeOffset.UtcNow;
                if (wait > TimeSpan.Zero)
                {
                    retryAfterSeconds = (int)Math.Ceiling(wait.TotalSeconds);
                    return null;
                }
            }

            var code = dummyCode ?? RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            cache.Set(key, new Entry { Hash = Hash(code), SentAt = DateTimeOffset.UtcNow }, Lifetime);
            return code;
        }
    }

    /// <summary>Forgets the OTP for key, so a code that could not be sent does not block a resend.</summary>
    public void Remove(string key)
    {
        lock (cache) cache.Remove(key);
    }

    /// <summary>Checks code against the OTP for key; a valid code is used up.</summary>
    public OtpCheck Verify(string key, string code)
    {
        lock (cache)
        {
            if (!cache.TryGetValue(key, out Entry? entry) || entry is null)
                return OtpCheck.Expired;

            if (CryptographicOperations.FixedTimeEquals(entry.Hash, Hash(code ?? "")))
            {
                cache.Remove(key);
                return OtpCheck.Valid;
            }

            if (++entry.WrongTries >= MaxWrongTries)
            {
                cache.Remove(key);
                return OtpCheck.Expired;
            }
            return OtpCheck.Wrong;
        }
    }

    private static byte[] Hash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim()));
}
