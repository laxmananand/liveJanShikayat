-- Pendency Report (पेंडेंसी रिपोर्ट): Commissioner and DM logins, so each office sees only its own applications.
--   Mst_Role                    : Commissioner, DM (added by name if missing)
--   Tbl_UserLogin.Office_Id     -> Mst_Regional_Office.Office_Id (1 = Commissionary, 2 = District Magistrate)
--   Tbl_UserLogin.Office_Unit_Code -> vw_Office_Unit.Unit_Code (Mst_Commissioner.Division_Code / Mst_DM_Office.Dist_Code)
-- Report scope (ApplicantController / Complain.ScopeFilter):
--   Admin          : every application
--   Branch login   : forwarded to its branch (Branch_Id)
--   Prashakha login: forwarded to its Prashakha (Prashakha_Id)
--   Commissioner   : forwarded to that Commissioner, or to a DM office in its division
--   DM             : forwarded to that DM office
-- Logins created here: Com-<DIVISION> (9) and DM-<DISTRICT> (38), default password Bihar@123 (change after first use).
-- Run after District_Administration_Offices.sql and Regional_Office_Category.sql. Safe to re-run.

USE Jansikayat_DB;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'Commissioner')
    INSERT INTO dbo.Mst_Role (Role, RoleDesc) VALUES ('Commissioner', 'Divisional Commissioner');
IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'DM')
    INSERT INTO dbo.Mst_Role (Role, RoleDesc) VALUES ('DM', 'District Magistrate');
GO

IF COL_LENGTH('dbo.Tbl_UserLogin', 'Office_Id') IS NULL
    ALTER TABLE dbo.Tbl_UserLogin ADD Office_Id INT NULL
        CONSTRAINT FK_Tbl_UserLogin_Office_Id REFERENCES dbo.Mst_Regional_Office(Office_Id);
GO

IF COL_LENGTH('dbo.Tbl_UserLogin', 'Office_Unit_Code') IS NULL
    ALTER TABLE dbo.Tbl_UserLogin ADD Office_Unit_Code INT NULL;
GO

-- Password column holds Encryptor(Encryptor.PrivateKey).Encrypt("Bihar@123")
DECLARE @DefaultPassword VARCHAR(100) = 'JbsZ/laBgFS236LdRsrhew==';
DECLARE @CommissionerRole INT = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'Commissioner');
DECLARE @DmRole INT = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'DM');

-- Existing logins keep their password; only the role / office mapping is refreshed
;WITH logins AS
(
    SELECT 'Com-' + REPLACE(Division_Name, ' ', '-') AS UserName, @CommissionerRole AS Role, 1 AS Office_Id, Division_Code AS Unit_Code
    FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT 'DM-' + REPLACE(District_Name, ' ', '-'), @DmRole, 2, Dist_Code
    FROM dbo.Mst_DM_Office
)
MERGE dbo.Tbl_UserLogin AS t
USING logins AS s ON t.UserName = s.UserName
WHEN MATCHED THEN UPDATE SET Role = s.Role, Office_Id = s.Office_Id, Office_Unit_Code = s.Unit_Code,
                             Branch_Id = NULL, Prashakha_Id = NULL
WHEN NOT MATCHED THEN INSERT (UserName, Password, Role, IsActive, Office_Id, Office_Unit_Code)
                      VALUES (s.UserName, @DefaultPassword, s.Role, 1, s.Office_Id, s.Unit_Code);
GO

-- Report filters group by these columns
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Applicant_Forward_Office')
    CREATE INDEX IX_Applicant_Forward_Office ON dbo.Tbl_Applicant_Forward(OfficeId, OfficeUnitCode);
GO

-- Verify
SELECT u.AutoId, u.UserName, r.Role, u.Office_Id, u.Office_Unit_Code, ou.Unit_Name
FROM dbo.Tbl_UserLogin u
JOIN dbo.Mst_Role r ON r.Id = u.Role
LEFT JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = u.Office_Id AND ou.Unit_Code = u.Office_Unit_Code
WHERE u.Office_Id IS NOT NULL
ORDER BY u.Office_Id, u.Office_Unit_Code;
GO
