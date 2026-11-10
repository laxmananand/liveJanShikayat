/* Logins for the offices added by 010_co_thana_forward.sql (run that first):
     CO-<ANCHAL>   e.g. CO-RAMNAGAR, CO-PATNA-SADAR          (one per anchal, vw_CO_Office, 535)
     THANA-<PS>    e.g. THANA-SIKANDARA, THANA-BADHARI-O-P   (one per police station under an SDPO, vw_Thana_Office)
   A name used by more than one office gets the district added (CO-RAMNAGAR-W-CHAMPARAN, THANA-SC-ST-THANA-PATNA);
   if that still repeats, the code is added too. Spaces / . / ( ) / * become "-". Login is not case-sensitive.
   The full office name is shown after login (vw_Office_Unit).

   Password for every new login: 1234 (stored encrypted the way Encryptor.cs does: Fyue8t3OLVc=).
   No mobile number is saved, so each officer is asked to verify one by OTP on first login.

   Only adds logins that do not exist yet; an existing login is never changed. Safe to run more than once.
   One transaction: all or nothing. Stops if a name it would create already belongs to a different office.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 011_co_thana_logins.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 011_co_thana_logins.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.vw_CO_Office', 'V') IS NULL
   OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'CO')
   OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'Thana')
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 010_co_thana_forward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Password varchar(100) = 'Fyue8t3OLVc=';  -- 1234

    -- Raw names: office kind, unit code, name, district
    DECLARE @raw TABLE (Office_Id int, Unit_Code int, Prefix varchar(10), Name nvarchar(200), District nvarchar(200),
                        PRIMARY KEY (Office_Id, Unit_Code));
    INSERT INTO @raw
    SELECT 9, CAST(b.BlockCode AS int), 'CO', b.BlockName, d.DISTRICTNAME
    FROM dbo.Blocks b
    LEFT JOIN dbo.mst_Commissionary_Districts d ON d.DISTRICTCODE = b.DistCode
    UNION ALL
    SELECT 10, o.PS_Code, 'THANA', t.Police_Station, t.District
    FROM dbo.vw_Thana_Office o
    JOIN dbo.mst_thana t ON t.PS_Code = o.PS_Code;

    -- Login-safe text: upper case, letters / digits joined by single "-"
    DECLARE @clean TABLE (Office_Id int, Unit_Code int, Prefix varchar(10), Name varchar(150), District varchar(100),
                          PRIMARY KEY (Office_Id, Unit_Code));
    INSERT INTO @clean
    SELECT r.Office_Id, r.Unit_Code, r.Prefix, n.V, dd.V
    FROM @raw r
    CROSS APPLY (SELECT UPPER(LTRIM(RTRIM(
                     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                         r.Name, CHAR(13), ' '), CHAR(10), ' '), CHAR(9), ' '), '.', ' '), '*', ' '), '/', ' '), '(', ' '), ')', ' '), '&', ' ')
                 ))) AS S) s
    CROSS APPLY (SELECT UPPER(LTRIM(RTRIM(
                     REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(r.District, ''), '.', ' '), '(', ' '), ')', ' '), '/', ' ')
                 ))) AS S) ds
    -- spaces -> "-", then squeeze repeats
    CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(s.S, ' ', '-'), '--', '-'), '--', '-'), '--', '-') AS V) n
    CROSS APPLY (SELECT REPLACE(REPLACE(REPLACE(ds.S, ' ', '-'), '--', '-'), '--', '-') AS V) dd;

    DECLARE @wanted TABLE (UserName varchar(100) PRIMARY KEY, RoleName varchar(50) NOT NULL, Office_Id int NOT NULL, Unit_Code int NOT NULL);

    WITH a AS (
        SELECT c.*, c.Prefix + '-' + c.Name AS N1,
               c.Prefix + '-' + c.Name + CASE WHEN c.District = '' THEN '' ELSE '-' + c.District END AS N2
        FROM @clean c
    ), b AS (
        SELECT a.*, COUNT(*) OVER (PARTITION BY a.N1) AS C1, COUNT(*) OVER (PARTITION BY a.N2) AS C2 FROM a
    )
    INSERT INTO @wanted (UserName, RoleName, Office_Id, Unit_Code)
    SELECT LEFT(CASE WHEN C1 = 1 THEN N1
                     WHEN C2 = 1 THEN N2
                     ELSE N2 + '-' + CAST(Unit_Code AS varchar(12)) END, 100),
           CASE Office_Id WHEN 9 THEN 'CO' ELSE 'Thana' END, Office_Id, Unit_Code
    FROM b;

    -- A UserName already used by a different office would log that person into the wrong office: stop instead
    IF EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t JOIN @wanted w ON w.UserName = t.UserName
               WHERE ISNULL(t.Office_Id, -1) <> w.Office_Id OR ISNULL(t.Office_Unit_Code, -1) <> w.Unit_Code)
        THROW 50010, 'A UserName this script would create already belongs to another login. Nothing was changed.', 1;

    -- One login per office: an office that already has a login (under any name) is left as it is
    INSERT INTO dbo.Tbl_UserLogin (UserName, Password, MobileNo, Email, Role, IsActive, Branch_Id, Prashakha_Id, Office_Id, Office_Unit_Code)
    SELECT w.UserName, @Password, NULL, NULL, r.Id, 1, NULL, NULL, w.Office_Id, w.Unit_Code
    FROM @wanted w
    JOIN dbo.Mst_Role r ON r.Role = w.RoleName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t
                      WHERE t.UserName = w.UserName
                         OR (t.Office_Id = w.Office_Id AND t.Office_Unit_Code = w.Unit_Code));

    DECLARE @added int = @@ROWCOUNT;
    DECLARE @total int = (SELECT COUNT(*) FROM @wanted);
    COMMIT TRANSACTION;

    PRINT CONCAT('011 done: ', @added, ' login(s) added (', @total - @added, ' already existed and were left as they are).');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('011 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

-- The list to hand out: who logs in where
SELECT r.Role, t.UserName, ou.Unit_Name AS Office
FROM dbo.Tbl_UserLogin t
JOIN dbo.Mst_Role r ON r.Id = t.Role
JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = t.Office_Id AND ou.Unit_Code = t.Office_Unit_Code
WHERE t.Office_Id IN (9, 10)
ORDER BY t.Office_Id, ou.Unit_Name;
GO
SET NOEXEC OFF;
GO
