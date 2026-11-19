/* Renames office kind 5 (Mst_Regional_Office, District Administration) from "Superintendent of Police" to
   "Senior Superintendent of Police/Superintendent of Police", as listed in the forward popup's office step.

   Code identifies offices by Office_Id, never by this name. Forwards already saved keep the label they were
   saved with (Tbl_Applicant_Forward.OfficeLabel).

   Safe to run more than once.

   No USE line: connect to the app database first.
     sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 017_rename_sp_office.sql */
SET NOCOUNT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Mst_Regional_Office', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

UPDATE dbo.Mst_Regional_Office
SET Regional_Office = N'Senior Superintendent of Police/Superintendent of Police'
WHERE Office_Id = 5 AND Unique_Code = 'S.P'
  AND Regional_Office <> N'Senior Superintendent of Police/Superintendent of Police';

PRINT CONCAT('017 done: ', @@ROWCOUNT, ' row(s) renamed.');
GO

SELECT Office_Id, Regional_Office FROM dbo.Mst_Regional_Office WHERE Category_Id = 2 AND Is_Active = 1 ORDER BY Office_Id;
GO
SET NOEXEC OFF;
GO
