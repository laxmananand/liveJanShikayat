-- Optional PDF attached to a remark (e.g. a report the branch adds while replying to Admin).
-- Holds the stored file name under RemarkDocuments/ (outside wwwroot, served only to logged-in users).
-- Safe to re-run: the column is added only if it does not exist yet.

USE Jansikayat_DB;
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Remarks', 'DocumentPath') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Remarks ADD DocumentPath VARCHAR(300) NULL;
GO
