/* Logins for the offices added by 005_sdo_dclr_sdpo_forward.sql (run that first):
     SDO-<SUBDIVISION>   e.g. SDO-KAHALGAON, SDO-MUZAFFARPUR-EAST   (Mst_SDO_Office, 102)
     DCLR-<SUBDIVISION>  e.g. DCLR-KAHALGAON                        (Mst_DCLR_Office, 102)
     SDPO-<name>         e.g. SDPO-Bagaha, DSP-Purnia, SDPO-Sadar-1-Purnia (Mst_SDPO_Office, 159; a name used in more
                         than one district gets the district added; same naming as 009_rename_sdpo_logins.sql)
   The full office name is shown after login (vw_Office_Unit).

   Password for every new login: 1234 (Tbl_UserLogin.Password holds it encrypted the way Encryptor.cs does: Fyue8t3OLVc=).
   No mobile number is saved, so each officer is asked to verify one by OTP on first login.
   Ask them to change the password after first login.

   Only adds logins that do not exist yet: an existing login (same UserName) is never changed, so this never resets a
   password someone has already changed. Safe to run more than once. One transaction: all or nothing.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 006_sdo_dclr_sdpo_logins.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 006_sdo_dclr_sdpo_logins.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Mst_SDPO_Office', 'U') IS NULL
   OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'SDPO')
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 005_sdo_dclr_sdpo_forward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Password varchar(100) = 'Fyue8t3OLVc=';  -- 1234

    -- Every login this script is responsible for
    DECLARE @wanted TABLE (UserName varchar(100) PRIMARY KEY, RoleName varchar(50) NOT NULL, Office_Id int NOT NULL, Unit_Code int NOT NULL);

    INSERT INTO @wanted (UserName, RoleName, Office_Id, Unit_Code)
    SELECT 'SDO-' + u.Name, 'SDO', 6, o.SD_Code
    FROM dbo.Mst_SDO_Office o
    JOIN dbo.SubDivisions s ON s.Sd_Code2 = o.SD_Code
    CROSS APPLY (SELECT UPPER(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.Sd_Name_En)), ' ', '-'), '(', '-'), ')', '')) AS Name) u
    UNION ALL
    SELECT 'DCLR-' + u.Name, 'DCLR', 7, o.SD_Code
    FROM dbo.Mst_DCLR_Office o
    JOIN dbo.SubDivisions s ON s.Sd_Code2 = o.SD_Code
    CROSS APPLY (SELECT UPPER(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.Sd_Name_En)), ' ', '-'), '(', '-'), ')', '')) AS Name) u
    UNION ALL
    SELECT u.UserName, 'SDPO', 8, u.SDPO_Code
    FROM (
        -- Same naming as 009_rename_sdpo_logins.sql (SDPO-Bagaha, DSP-Purnia, SDPO-Sadar-1-Purnia, SDPO-Jehanabad-1)
        SELECT b.SDPO_Code, b.Prefix + '-' +
               CASE WHEN b.Base NOT LIKE '%[^0-9]%' THEN b.District + '-' + b.Base
                    WHEN COUNT(*) OVER (PARTITION BY b.Prefix, b.Base) > 1 THEN b.Base + '-' + b.District
                    ELSE b.Base END AS UserName
        FROM (
            SELECT n.SDPO_Code, n.Prefix, n.District,
                   CASE WHEN LEFT(n.Base0, 1) = '-' THEN STUFF(n.Base0, 1, 1, '') ELSE n.Base0 END AS Base
            FROM (
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
            ) n
        ) b
    ) u;

    -- A UserName already used by a different office would log that person into the wrong office: stop instead
    IF EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t JOIN @wanted w ON w.UserName = t.UserName
               WHERE ISNULL(t.Office_Id, -1) <> w.Office_Id OR ISNULL(t.Office_Unit_Code, -1) <> w.Unit_Code)
        THROW 50010, 'A UserName this script would create already belongs to another office. Nothing was changed.', 1;

    INSERT INTO dbo.Tbl_UserLogin (UserName, Password, MobileNo, Email, Role, IsActive, Branch_Id, Prashakha_Id, Office_Id, Office_Unit_Code)
    SELECT w.UserName, @Password, NULL, NULL, r.Id, 1, NULL, NULL, w.Office_Id, w.Unit_Code
    FROM @wanted w
    JOIN dbo.Mst_Role r ON r.Role = w.RoleName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t WHERE t.UserName = w.UserName);

    DECLARE @added int = @@ROWCOUNT;
    DECLARE @total int = (SELECT COUNT(*) FROM @wanted);
    COMMIT TRANSACTION;

    PRINT CONCAT('006 done: ', @added, ' login(s) added (', @total - @added, ' already existed and were left as they are).');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('006 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

-- The list to hand out: who logs in where
SELECT r.Role, t.UserName, ou.Unit_Name AS Office
FROM dbo.Tbl_UserLogin t
JOIN dbo.Mst_Role r ON r.Id = t.Role
JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = t.Office_Id AND ou.Unit_Code = t.Office_Unit_Code
WHERE t.Office_Id IN (6, 7, 8)
ORDER BY t.Office_Id, ou.Unit_Name;
GO
SET NOEXEC OFF;
GO
