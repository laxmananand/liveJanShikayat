/* Renames the Police HQ branch login (Role Branch, Branch_Id 1 = Mst_Branch "Police HQ") from Police to PoliceHQ,
   so the username matches the branch name shown everywhere else ("पुलिस मुख्यालय / Police HQ").

   The username is also kept as text on the history rows that login wrote (remarks, closures, forwards,
   entries). Those are renamed too: remark lists find the writer's office by joining RemarkBy to Tbl_UserLogin.UserName.
   Password, mobile number and everything else on the login stay as they are.

   One transaction: all or nothing. Safe to run more than once (does nothing once the login is PoliceHQ).
   Stops if a login named PoliceHQ already exists for something else.

   No USE line: connect to the app database first.
     sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 015_rename_police_login.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Tbl_UserLogin', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Old varchar(100) = 'Police', @New varchar(100) = 'PoliceHQ';
    DECLARE @BranchRole int = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'Branch');

    IF EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin WHERE UserName = @New AND NOT (Role = @BranchRole AND Branch_Id = 1))
        THROW 50001, 'A login named PoliceHQ already exists for something other than the Police HQ branch. Nothing was changed.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin WHERE UserName = @Old AND Role = @BranchRole AND Branch_Id = 1)
    BEGIN
        COMMIT TRANSACTION;
        PRINT '015: no login named Police for the Police HQ branch (already renamed?). Nothing was changed.';
    END
    ELSE
    BEGIN
        UPDATE dbo.Tbl_UserLogin SET UserName = @New WHERE UserName = @Old AND Role = @BranchRole AND Branch_Id = 1;

        UPDATE dbo.Tbl_Applicant_Remarks   SET RemarkBy    = @New WHERE RemarkBy    = @Old;
        DECLARE @remarks int = @@ROWCOUNT;
        UPDATE dbo.Tbl_Applicant_Closure   SET ClosedBy    = @New WHERE ClosedBy    = @Old;
        DECLARE @closures int = @@ROWCOUNT;
        UPDATE dbo.Tbl_Applicant_Forward   SET ForwardedBy = @New WHERE ForwardedBy = @Old;
        UPDATE dbo.Tbl_Applicant_Reforward SET ForwardedBy = @New WHERE ForwardedBy = @Old;
        UPDATE dbo.Tbl_Applicant_Details   SET CreatedBy   = @New WHERE CreatedBy   = @Old;
        UPDATE dbo.tbl_Application_Forwarded_details SET CreatedBy    = @New WHERE CreatedBy    = @Old;
        UPDATE dbo.tbl_Application_Forwarded_details SET Forwarded_By = @New WHERE Forwarded_By = @Old;

        COMMIT TRANSACTION;
        PRINT CONCAT('015 done: login Police renamed to PoliceHQ (', @remarks, ' remark(s), ', @closures, ' closure(s) relabelled).');
    END
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('015 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

SELECT t.UserName, r.Role, b.Branch_Eng
FROM dbo.Tbl_UserLogin t
JOIN dbo.Mst_Role r ON r.Id = t.Role
LEFT JOIN dbo.Mst_Branch b ON b.Complain_id = t.Branch_Id
WHERE r.Role = 'Branch' AND t.Branch_Id = 1;
GO
SET NOEXEC OFF;
GO
