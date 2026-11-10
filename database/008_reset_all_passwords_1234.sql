/* Sets the password of EVERY login in Tbl_UserLogin to 1234
   (stored encrypted the way Encryptor.cs does: Fyue8t3OLVc=, same value 006 uses).

   Before changing anything, the old passwords are copied to dbo.Tbl_UserLogin_PwdBackup_20261109
   (AutoId, UserName, Password), so they can be put back:
     UPDATE t SET t.Password = b.Password
     FROM dbo.Tbl_UserLogin t JOIN dbo.Tbl_UserLogin_PwdBackup_20261109 b ON b.AutoId = t.AutoId;
   If the backup table already exists (script run before), it is kept as is and not overwritten.

   One transaction: all or nothing. Safe to run more than once.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 008_reset_all_passwords_1234.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 008_reset_all_passwords_1234.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Tbl_UserLogin', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Password varchar(100) = 'Fyue8t3OLVc=';  -- 1234

    IF OBJECT_ID('dbo.Tbl_UserLogin_PwdBackup_20261109', 'U') IS NULL
    BEGIN
        SELECT AutoId, UserName, Password
        INTO dbo.Tbl_UserLogin_PwdBackup_20261109
        FROM dbo.Tbl_UserLogin;
        PRINT CONCAT('Backed up ', @@ROWCOUNT, ' passwords to dbo.Tbl_UserLogin_PwdBackup_20261109.');
    END
    ELSE
        PRINT 'Backup table dbo.Tbl_UserLogin_PwdBackup_20261109 already exists: kept as is.';

    UPDATE dbo.Tbl_UserLogin
    SET Password = @Password
    WHERE Password IS NULL OR Password <> @Password;
    PRINT CONCAT('Passwords changed to 1234: ', @@ROWCOUNT, ' logins.');

    COMMIT TRANSACTION;

    SELECT COUNT(*) AS TotalLogins,
           SUM(CASE WHEN Password = @Password THEN 1 ELSE 0 END) AS LoginsWith1234
    FROM dbo.Tbl_UserLogin;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @msg nvarchar(4000) = ERROR_MESSAGE();
    RAISERROR('Failed, nothing was changed: %s', 16, 1, @msg);
END CATCH
GO

SET NOEXEC OFF;
GO
