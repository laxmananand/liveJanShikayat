using System;
using System.Security.Cryptography;
using System.IO;
public class Encryptor
{
    DESCryptoServiceProvider key = new DESCryptoServiceProvider();
    public static string PrivateKey = "LlU9JJLJAu8=";
    public Encryptor()
    {
    }
    public Encryptor(string Key)
    {
        key.IV = Convert.FromBase64String("x7hkVXoObeI=");
        key.Key = Convert.FromBase64String(Key);

    }
    public string Encrypt(string PlainText)
    {
        MemoryStream ms = new MemoryStream();
        CryptoStream encStream = new CryptoStream(ms, key.CreateEncryptor(), CryptoStreamMode.Write);
        StreamWriter sw = new StreamWriter(encStream);
        sw.WriteLine(PlainText);
        sw.Close();
        encStream.Close();
        byte[] buffer = ms.ToArray();
        ms.Close();

        return Convert.ToBase64String(buffer);
    }
    public string Decrypt(string CypherText)
    {
        byte[] bText = Convert.FromBase64String(CypherText);
        MemoryStream ms = new MemoryStream(bText);
        CryptoStream encStream = new CryptoStream(ms, key.CreateDecryptor(), CryptoStreamMode.Read);
        StreamReader sr = new StreamReader(encStream);
        string val = sr.ReadLine();
        sr.Close();
        encStream.Close();
        ms.Close();
        return val;
    }



    public string Decrypt(string textToDecrypt, string curkey)
    {
        try
        {
            if (textToDecrypt == "")
            {
                return "";
            }
            RijndaelManaged rijndaelCipher = new RijndaelManaged();
            rijndaelCipher.Mode = CipherMode.CBC;
            rijndaelCipher.Padding = PaddingMode.PKCS7;

            rijndaelCipher.KeySize = 0x80;
            rijndaelCipher.BlockSize = 0x80;
            byte[] encryptedData = Convert.FromBase64String(textToDecrypt);
            byte[] pwdBytes = System.Text.Encoding.UTF8.GetBytes(curkey);
            byte[] keyBytes = new byte[0x10];
            int len = pwdBytes.Length;
            if (len > keyBytes.Length)
            {
                len = keyBytes.Length;
            }
            Array.Copy(pwdBytes, keyBytes, len);
            rijndaelCipher.Key = keyBytes;
            rijndaelCipher.IV = keyBytes;
            byte[] plainText = rijndaelCipher.CreateDecryptor().TransformFinalBlock(encryptedData, 0, encryptedData.Length);
            return System.Text.Encoding.UTF8.GetString(plainText);
        }
        catch (Exception ex)
        {
            return "";
        }
    }

    public string Encrypt(string textToEncrypt, string curkey)
    {
        try
        {
            RijndaelManaged rijndaelCipher = new RijndaelManaged();
            rijndaelCipher.Mode = CipherMode.CBC;
            rijndaelCipher.Padding = PaddingMode.PKCS7;

            rijndaelCipher.KeySize = 0x80;
            rijndaelCipher.BlockSize = 0x80;
            byte[] pwdBytes = System.Text.Encoding.UTF8.GetBytes(curkey);
            byte[] keyBytes = new byte[0x10];
            int len = pwdBytes.Length;
            if (len > keyBytes.Length)
            {
                len = keyBytes.Length;
            }
            Array.Copy(pwdBytes, keyBytes, len);
            rijndaelCipher.Key = keyBytes;
            rijndaelCipher.IV = keyBytes;
            ICryptoTransform transform = rijndaelCipher.CreateEncryptor();
            byte[] plainText = System.Text.Encoding.UTF8.GetBytes(textToEncrypt);
            return Convert.ToBase64String(transform.TransformFinalBlock(plainText, 0, plainText.Length));
        }
        catch (Exception ex)
        {
            return "";
        }
    }

}