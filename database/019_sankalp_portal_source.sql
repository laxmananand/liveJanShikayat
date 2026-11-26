/* Replaces the application source "CM Dashboard" with "Sankalp Portal".

   After this the allowed sources are exactly:
     CPGRAMS, Sankalp Portal, Sahyog Portal, PMO Grievance Portal, Offline, Other
   These must match the entry form (entry-page.component.ts applicationSources) and the backend check
   (TblApplicantDetails.cs Application_Source RegularExpression). Run this BEFORE deploying that code,
   otherwise saving with "Sankalp Portal" fails on the CHECK constraint.

   What it does:
     1. Creates dbo.Mst_Source if it is missing, renames "CM Dashboard" to "Sankalp Portal" in it,
        and adds any of the six sources that are missing.
     2. Relabels saved applications from "CM Dashboard" to "Sankalp Portal".
     3. Recreates CK_Applicant_Details_Application_Source with the six sources.
   If a saved application has a source outside the six, it lists them and stops without changing anything.

   To undo: swap 'Sankalp Portal' back to 'CM Dashboard' in steps 1-3 (and in the code).

   Safe to run more than once.

   No USE line: connect to the app database first.
     sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 019_sankalp_portal_source.sql */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;  -- needed to update Tbl_Applicant_Details (it has an index that requires it)
SET ANSI_NULLS ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB') OR OBJECT_ID('dbo.Tbl_Applicant_Details', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

-- Stop early if saved applications use a source that will not be allowed
IF EXISTS (SELECT 1 FROM dbo.Tbl_Applicant_Details
           WHERE Application_Source NOT IN ('CPGRAMS', 'Sankalp Portal', 'CM Dashboard', 'Sahyog Portal',
                                            'PMO Grievance Portal', 'Offline', 'Other'))
BEGIN
    SELECT Application_Source, COUNT(*) AS Applications
    FROM dbo.Tbl_Applicant_Details
    WHERE Application_Source NOT IN ('CPGRAMS', 'Sankalp Portal', 'CM Dashboard', 'Sahyog Portal',
                                     'PMO Grievance Portal', 'Offline', 'Other')
    GROUP BY Application_Source;
    RAISERROR('The applications above have a source outside the allowed list. Fix them first. Nothing was changed.', 16, 1) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Mst_Source', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Mst_Source (
        Source_ID FLOAT NULL,
        Source    NVARCHAR(255) NULL
    );
    PRINT '019: created dbo.Mst_Source.';
END
GO

BEGIN TRANSACTION;

-- 1. Source master
UPDATE dbo.Mst_Source SET Source = 'Sankalp Portal' WHERE LTRIM(RTRIM(Source)) = 'CM Dashboard';
PRINT CONCAT('019: ', @@ROWCOUNT, ' Mst_Source row(s) renamed CM Dashboard -> Sankalp Portal.');

DECLARE @want TABLE (Id FLOAT, Source NVARCHAR(255));
INSERT INTO @want (Id, Source) VALUES
    (1, 'CPGRAMS'), (2, 'Sankalp Portal'), (3, 'Sahyog Portal'),
    (4, 'PMO Grievance Portal'), (5, 'Offline'), (6, 'Other');

DECLARE @id FLOAT, @src NVARCHAR(255);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT w.Id, w.Source FROM @want w
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_Source s WHERE LTRIM(RTRIM(s.Source)) = w.Source)
    ORDER BY w.Id;
OPEN c;
FETCH NEXT FROM c INTO @id, @src;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- Keep the usual id when it is free, otherwise take the next one
    IF EXISTS (SELECT 1 FROM dbo.Mst_Source WHERE Source_ID = @id)
        SELECT @id = ISNULL(MAX(Source_ID), 0) + 1 FROM dbo.Mst_Source;
    INSERT INTO dbo.Mst_Source (Source_ID, Source) VALUES (@id, @src);
    PRINT CONCAT('019: added source ', @src, ' (id ', @id, ').');
    FETCH NEXT FROM c INTO @id, @src;
END
CLOSE c;
DEALLOCATE c;

-- 2 + 3. Saved applications and the CHECK constraint
IF OBJECT_ID('dbo.CK_Applicant_Details_Application_Source', 'C') IS NOT NULL
    ALTER TABLE dbo.Tbl_Applicant_Details DROP CONSTRAINT CK_Applicant_Details_Application_Source;

UPDATE dbo.Tbl_Applicant_Details SET Application_Source = 'Sankalp Portal' WHERE Application_Source = 'CM Dashboard';
PRINT CONCAT('019: ', @@ROWCOUNT, ' application(s) relabelled CM Dashboard -> Sankalp Portal.');

ALTER TABLE dbo.Tbl_Applicant_Details WITH CHECK
    ADD CONSTRAINT CK_Applicant_Details_Application_Source CHECK (
        Application_Source IN ('CPGRAMS', 'Sankalp Portal', 'Sahyog Portal', 'PMO Grievance Portal', 'Offline', 'Other'));

COMMIT TRANSACTION;
GO

-- Result
SELECT Source_ID, Source FROM dbo.Mst_Source ORDER BY Source_ID;
SELECT definition FROM sys.check_constraints WHERE name = 'CK_Applicant_Details_Application_Source';
PRINT '019 done.';
GO
SET NOEXEC OFF;
GO
