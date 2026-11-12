/* Department forwarding + the logins that receive it.

   1. Office kind 11 = Department (Mst_Regional_Office, inactive so it is never offered as an office step), and
      vw_Office_Unit gets the departments as office kind 11 (Unit_Code = Mst_Departments.DepartmentId), so a
      department's name shows as the writer's office on remarks / closures, like every other office.
   2. One login per department (Mst_Departments, 51):  DEPT-<NAME>   e.g. DEPT-AGRICULTURE, DEPT-BC-EBC-WELFARE
      Role Department, Office_Id 11, Office_Unit_Code = DepartmentId. Admin's "Department" forward now saves
      OfficeId 11 / OfficeUnitCode = DepartmentId, and only that department's login sees and closes it.
   3. The four HQ branches that had no login (Mst_Branch.Complain_id 16-19, Home category):
        BPBCC (16 Bihar Police Building Construction Corporation), FSL (17), BPSSC (18), CSBC (19)
      Role Branch, Branch_Id = Complain_id (same as the eight existing branch logins).

   Password for every new login: 1234 (stored encrypted the way Encryptor.cs does: Fyue8t3OLVc=).
   No mobile number is saved, so each officer is asked to verify one by OTP on first login.

   Only adds logins that do not exist yet; an existing login is never changed. Safe to run more than once.
   The logins are added in one transaction: all or nothing. Stops if a name it would create belongs to another login.
   Needs 010 (vw_CO_Office / vw_Thana_Office in vw_Office_Unit).

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 013_department_branch_logins.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 013_department_branch_logins.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Mst_Departments', 'U') IS NULL
   OR OBJECT_ID('dbo.vw_CO_Office', 'V') IS NULL
   OR OBJECT_ID('dbo.vw_Thana_Office', 'V') IS NULL
   OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'Department')
   OR NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'Branch')
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 010_co_thana_forward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

-- 1. Departments as office kind 11 (the rest is the view as 010 left it)
CREATE OR ALTER VIEW dbo.vw_Office_Unit AS
    SELECT Office_Id, Division_Code AS Unit_Code, Head AS Unit_Name FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT Office_Id, Dist_Code, Head FROM dbo.Mst_DM_Office
    UNION ALL
    SELECT DISTINCT Office_Id, Range_Code, Head FROM dbo.Mst_IG_DIG_Office
    UNION ALL
    SELECT Office_Id, SP_Code, Head FROM dbo.Mst_SP_Office
    UNION ALL
    SELECT 6, SD_Code, Head FROM dbo.Mst_SDO_Office
    UNION ALL
    SELECT 7, SD_Code, Head FROM dbo.Mst_DCLR_Office
    UNION ALL
    SELECT 8, SDPO_Code, Head FROM dbo.Mst_SDPO_Office
    UNION ALL
    SELECT 9, CO_Code, Head FROM dbo.vw_CO_Office
    UNION ALL
    SELECT 10, PS_Code, Head FROM dbo.vw_Thana_Office
    UNION ALL
    SELECT 11, CAST(DepartmentId AS int), DepartmentName FROM dbo.Mst_Departments WHERE DepartmentId IS NOT NULL;
GO

-- 2 + 3. Logins
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Password varchar(100) = 'Fyue8t3OLVc=';  -- 1234

    -- Office kind 11 (Tbl_UserLogin.Office_Id has a foreign key to it). Office_Id must mean the same thing everywhere.
    IF EXISTS (SELECT 1 FROM dbo.Mst_Regional_Office WHERE Office_Id = 11 AND Unique_Code <> 'DEPT')
        THROW 50001, 'Mst_Regional_Office.Office_Id 11 is already used by another office kind. Nothing was changed.', 1;

    -- Is_Active = 0: never listed in the forward popup's office step; Admin picks a department under "Department"
    INSERT INTO dbo.Mst_Regional_Office (Office_Id, Category_Id, Regional_Office, Unique_Code, Is_Active)
    SELECT 11, c.Category_Id, N'Department', 'DEPT', 0
    FROM dbo.Mst_Category c
    WHERE c.Category = 'Department'
      AND NOT EXISTS (SELECT 1 FROM dbo.Mst_Regional_Office o WHERE o.Office_Id = 11);

    IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Regional_Office WHERE Office_Id = 11)
        THROW 50002, 'Could not add office kind 11 (no "Department" row in Mst_Category). Nothing was changed.', 1;

    DECLARE @wanted TABLE (UserName varchar(100) PRIMARY KEY, RoleName varchar(50) NOT NULL,
                           Office_Id int NULL, Unit_Code int NULL, Branch_Id bigint NULL);

    -- Departments: upper case, letters / digits joined by single "-"
    INSERT INTO @wanted (UserName, RoleName, Office_Id, Unit_Code)
    SELECT LEFT('DEPT-' + REPLACE(REPLACE(REPLACE(REPLACE(s.S, ' ', '-'), '--', '-'), '--', '-'), '--', '-'), 100),
           'Department', 11, CAST(d.DepartmentId AS int)
    FROM dbo.Mst_Departments d
    CROSS APPLY (SELECT UPPER(LTRIM(RTRIM(
                     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(d.DepartmentName, ',', ' '), '&', ' '), '.', ' '), '(', ' '), ')', ' '), '/', ' ')
                 ))) AS S) s
    WHERE d.DepartmentId IS NOT NULL;

    -- Branches without a login
    INSERT INTO @wanted (UserName, RoleName, Branch_Id)
    SELECT v.UserName, 'Branch', v.Complain_id
    FROM (VALUES ('BPBCC', 16), ('FSL', 17), ('BPSSC', 18), ('CSBC', 19)) v (UserName, Complain_id)
    WHERE EXISTS (SELECT 1 FROM dbo.Mst_Branch b WHERE b.Complain_id = v.Complain_id);

    -- A UserName already used by a different login would log that person into the wrong place: stop instead
    IF EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t JOIN @wanted w ON w.UserName = t.UserName
               WHERE ISNULL(t.Office_Id, -1) <> ISNULL(w.Office_Id, -1)
                  OR ISNULL(t.Office_Unit_Code, -1) <> ISNULL(w.Unit_Code, -1)
                  OR ISNULL(t.Branch_Id, -1) <> ISNULL(w.Branch_Id, -1))
        THROW 50010, 'A UserName this script would create already belongs to another login. Nothing was changed.', 1;

    -- One login per department / branch: one that already has a login (under any name) is left as it is
    INSERT INTO dbo.Tbl_UserLogin (UserName, Password, MobileNo, Email, Role, IsActive, Branch_Id, Prashakha_Id, Office_Id, Office_Unit_Code)
    SELECT w.UserName, @Password, NULL, NULL, r.Id, 1, w.Branch_Id, NULL, w.Office_Id, w.Unit_Code
    FROM @wanted w
    JOIN dbo.Mst_Role r ON r.Role = w.RoleName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Tbl_UserLogin t
                      WHERE t.UserName = w.UserName
                         OR (w.Office_Id IS NOT NULL AND t.Office_Id = w.Office_Id AND t.Office_Unit_Code = w.Unit_Code)
                         OR (w.Branch_Id IS NOT NULL AND t.Role = r.Id AND t.Branch_Id = w.Branch_Id));

    DECLARE @added int = @@ROWCOUNT;
    DECLARE @total int = (SELECT COUNT(*) FROM @wanted);
    COMMIT TRANSACTION;

    PRINT CONCAT('013 done: ', @added, ' login(s) added (', @total - @added, ' already existed and were left as they are).');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('013 failed and was rolled back: %s', 16, 1, @e) WITH NOWAIT;
END CATCH
GO

-- The list to hand out: who logs in where
SELECT r.Role, t.UserName, COALESCE(ou.Unit_Name, b.Branch_Eng) AS Office
FROM dbo.Tbl_UserLogin t
JOIN dbo.Mst_Role r ON r.Id = t.Role
LEFT JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = t.Office_Id AND ou.Unit_Code = t.Office_Unit_Code
LEFT JOIN dbo.Mst_Branch b ON t.Office_Id IS NULL AND b.Complain_id = t.Branch_Id
WHERE t.Office_Id = 11 OR (r.Role = 'Branch')
ORDER BY r.Role, t.UserName;
GO
SET NOEXEC OFF;
GO
