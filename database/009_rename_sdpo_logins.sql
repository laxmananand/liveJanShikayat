/* Renames the SDPO logins made by 006 from the office code to the office name:
     SDPO-1001 -> SDPO-Bagaha        (S.D.P.O Bagaha)
     SDPO-1002 -> SDPO-Ramnagar      (S.D.P.O Ramnagar)
     SDPO-1032 -> DSP-Purnia         (D.S.P Purnia: offices named D.S.P get DSP-)
   Rules:
     - "S.D.P.O"/"S.D.PO" -> SDPO-, "D.S.P" -> DSP-; spaces become "-", " & " becomes "-" (D.S.P Law & Order -> DSP-Law-Order).
     - A name used by more than one office gets the district added: S.D.P.O Sadar-1 in Purnia -> SDPO-Sadar-1-Purnia.
     - A name that is only a number gets the district in front: S.D.P.O-1 (Jehanabad) -> SDPO-Jehanabad-1.
   Login is not case-sensitive, so SDPO-BAGAHA also works.

   Only logins still called SDPO-<code> for that office are renamed; password, mobile and office are not touched.
   The complaint history columns that hold the login name (ForwardedBy, RemarkBy, ClosedBy, CreatedBy, ...) are renamed too,
   so remarks and forwards keep showing the right office.
   Users who are logged in keep working until their session ends; after that they sign in with the new name.

   Safe to run more than once (second run changes nothing). One transaction: all or nothing.
   Stops without changing anything if a new name is already used by a different login.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 009_rename_sdpo_logins.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 009_rename_sdpo_logins.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Mst_SDPO_Office', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 005 and 006. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @map TABLE (SDPO_Code int PRIMARY KEY, OldUserName varchar(100) NOT NULL UNIQUE, NewUserName varchar(100) NOT NULL UNIQUE);

    -- Same naming as 006
    WITH n AS (
        SELECT o.SDPO_Code,
               CASE WHEN o.SDPO_Name LIKE 'D.S.P%' THEN 'DSP' ELSE 'SDPO' END AS Prefix,
               REPLACE(REPLACE(LTRIM(RTRIM(
                   CASE WHEN o.SDPO_Name LIKE 'S.D.P.O%' THEN STUFF(o.SDPO_Name, 1, 7, '')
                        WHEN o.SDPO_Name LIKE 'S.D.PO%'  THEN STUFF(o.SDPO_Name, 1, 6, '')
                        WHEN o.SDPO_Name LIKE 'D.S.P%'   THEN STUFF(o.SDPO_Name, 1, 5, '')
                        ELSE o.SDPO_Name END)), ' & ', '-'), ' ', '-') AS Base0,
               REPLACE(LTRIM(RTRIM(LEFT(d.D, CHARINDEX('(', d.D + '(') - 1))), ' ', '-') AS District
        FROM dbo.Mst_SDPO_Office o
        CROSS APPLY (SELECT LTRIM(RIGHT(o.Head, CHARINDEX(',', REVERSE(o.Head)) - 1)) AS D) d
    ), b AS (
        SELECT SDPO_Code, Prefix, District,
               CASE WHEN LEFT(Base0, 1) = '-' THEN STUFF(Base0, 1, 1, '') ELSE Base0 END AS Base
        FROM n
    )
    INSERT INTO @map (SDPO_Code, OldUserName, NewUserName)
    SELECT SDPO_Code,
           'SDPO-' + CAST(SDPO_Code AS varchar(10)),
           Prefix + '-' +
           CASE WHEN Base NOT LIKE '%[^0-9]%' THEN District + '-' + Base
                WHEN COUNT(*) OVER (PARTITION BY Prefix, Base) > 1 THEN Base + '-' + District
                ELSE Base END
    FROM b;

    -- Only the old-style logins that still belong to their SDPO office
    DELETE m FROM @map m
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t
                      WHERE t.UserName = m.OldUserName AND t.Office_Id = 8 AND t.Office_Unit_Code = m.SDPO_Code);

    IF EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t JOIN @map m ON m.NewUserName = t.UserName)
        THROW 50020, 'A new SDPO/DSP login name is already used by another login. Nothing was changed.', 1;

    UPDATE t SET t.UserName = m.NewUserName
    FROM dbo.Tbl_UserLogin t JOIN @map m ON m.OldUserName = t.UserName
    WHERE t.Office_Id = 8 AND t.Office_Unit_Code = m.SDPO_Code;
    DECLARE @renamed int = @@ROWCOUNT;

    -- History that stores the login name
    UPDATE x SET x.ClosedBy    = m.NewUserName FROM dbo.Tbl_Applicant_Closure x  JOIN @map m ON m.OldUserName = x.ClosedBy;
    UPDATE x SET x.CreatedBy   = m.NewUserName FROM dbo.Tbl_Applicant_Details x  JOIN @map m ON m.OldUserName = x.CreatedBy;
    UPDATE x SET x.ForwardedBy = m.NewUserName FROM dbo.Tbl_Applicant_Forward x  JOIN @map m ON m.OldUserName = x.ForwardedBy;
    UPDATE x SET x.ForwardedBy = m.NewUserName FROM dbo.Tbl_Applicant_Reforward x JOIN @map m ON m.OldUserName = x.ForwardedBy;
    UPDATE x SET x.RemarkBy    = m.NewUserName FROM dbo.Tbl_Applicant_Remarks x  JOIN @map m ON m.OldUserName = x.RemarkBy;
    UPDATE x SET x.CreatedBy   = m.NewUserName FROM dbo.tbl_Application_Forwarded_details x JOIN @map m ON m.OldUserName = x.CreatedBy;
    UPDATE x SET x.Forwarded_By = m.NewUserName FROM dbo.tbl_Application_Forwarded_details x JOIN @map m ON m.OldUserName = x.Forwarded_By;

    COMMIT TRANSACTION;
    PRINT CONCAT('009 done: ', @renamed, ' SDPO login(s) renamed.');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('009 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

-- The list to hand out
SELECT t.UserName, ou.Unit_Name AS Office
FROM dbo.Tbl_UserLogin t
JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = t.Office_Id AND ou.Unit_Code = t.Office_Unit_Code
WHERE t.Office_Id = 8
ORDER BY t.Office_Unit_Code;
GO
SET NOEXEC OFF;
GO
