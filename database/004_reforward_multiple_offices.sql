/* Regional officers (Commissioner / IG / DIG) may now forward one application onward to several DM and SP offices,
   not just one DM and one SP. The same office still cannot receive the same application twice.
   Replaces the unique index (ApplicantId, ToOfficeId) with (ApplicantId, ToOfficeId, ToOfficeUnitCode).
   Needs 002_regional_reforward.sql first. Safe to run more than once. No data is changed.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 004_reforward_multiple_offices.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 004_reforward_multiple_offices.sql
   In SSMS pick the database in the toolbar drop-down before pressing F5. */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Tbl_Applicant_Reforward', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 002_regional_reforward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

-- New rule first, so there is never a moment without a duplicate guard
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Applicant_Reforward_Applicant_To_Unit' AND object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward'))
    CREATE UNIQUE INDEX UX_Applicant_Reforward_Applicant_To_Unit
        ON dbo.Tbl_Applicant_Reforward (ApplicantId, ToOfficeId, ToOfficeUnitCode);

-- Old rule: one DM and one SP per application
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Applicant_Reforward_Applicant_To' AND object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward'))
    DROP INDEX UX_Applicant_Reforward_Applicant_To ON dbo.Tbl_Applicant_Reforward;

COMMIT TRANSACTION;
GO

PRINT '004 done: an application can now be forwarded to several DM / SP offices (once per office).';
GO
SET NOEXEC OFF;
GO
