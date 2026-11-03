-- IG, DIG and SP logins, so each officer sees the applications forwarded to them (Complain.ScopeFilter).
--   Mst_Role                       : IG, DIG, SP (added by name if missing)
--   Tbl_UserLogin.Office_Id        -> Mst_Regional_Office.Office_Id (3 = IG, 4 = DIG, 5 = SP)
--   Tbl_UserLogin.Office_Unit_Code -> vw_Office_Unit.Unit_Code (Mst_IG_DIG_Office.Range_Code / Mst_SP_Office.SP_Code)
-- Logins created here: IG-<RANGE> (4), DIG-<RANGE> (8) and SP-<DISTRICT> (40, plus SP-BAGAHA and SP-NAUGACHIA among them),
-- default password 123 (for local testing; use a stronger one before going live).
-- Run after IG_DIG_Offices.sql and SP_Offices.sql. Safe to re-run.

USE Jansikayat_DB;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'IG')
    INSERT INTO dbo.Mst_Role (Role, RoleDesc) VALUES ('IG', 'Inspector General of Police');
IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'DIG')
    INSERT INTO dbo.Mst_Role (Role, RoleDesc) VALUES ('DIG', 'Deputy Inspector General of Police');
IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Role WHERE Role = 'SP')
    INSERT INTO dbo.Mst_Role (Role, RoleDesc) VALUES ('SP', 'Superintendent of Police');
GO

-- Password column holds Encryptor(Encryptor.PrivateKey).Encrypt("123")
DECLARE @DefaultPassword VARCHAR(100) = 'tv3MYjWZp90=';
DECLARE @IgRole INT = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'IG');
DECLARE @DigRole INT = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'DIG');
DECLARE @SpRole INT = (SELECT Id FROM dbo.Mst_Role WHERE Role = 'SP');

-- Existing logins keep their password; only the role / office mapping is refreshed
;WITH logins AS
(
    SELECT DISTINCT CASE Office_Id WHEN 3 THEN 'IG-' ELSE 'DIG-' END + UPPER(REPLACE(Range_Name, ' Range', '')) AS UserName,
           CASE Office_Id WHEN 3 THEN @IgRole ELSE @DigRole END AS Role, Office_Id, Range_Code AS Unit_Code
    FROM dbo.Mst_IG_DIG_Office
    UNION ALL
    -- Bagaha / Naugachia share a district with another SP, so they are named from their own office
    SELECT 'SP-' + CASE WHEN SP_Code = Dist_Code THEN REPLACE(District_Name, ' ', '-')
                        ELSE UPPER(REPLACE(Head, 'SP Office, ', '')) END,
           @SpRole, Office_Id, SP_Code
    FROM dbo.Mst_SP_Office
)
MERGE dbo.Tbl_UserLogin AS t
USING logins AS s ON t.UserName = s.UserName
WHEN MATCHED THEN UPDATE SET Role = s.Role, Office_Id = s.Office_Id, Office_Unit_Code = s.Unit_Code,
                             Branch_Id = NULL, Prashakha_Id = NULL
WHEN NOT MATCHED THEN INSERT (UserName, Password, Role, IsActive, Office_Id, Office_Unit_Code)
                      VALUES (s.UserName, @DefaultPassword, s.Role, 1, s.Office_Id, s.Unit_Code);
GO

-- Verify
SELECT u.UserName, r.Role, u.Office_Id, u.Office_Unit_Code, ou.Unit_Name
FROM dbo.Tbl_UserLogin u
JOIN dbo.Mst_Role r ON r.Id = u.Role
LEFT JOIN dbo.vw_Office_Unit ou ON ou.Office_Id = u.Office_Id AND ou.Unit_Code = u.Office_Unit_Code
WHERE u.Office_Id IN (3, 4, 5)
ORDER BY u.Office_Id, u.Office_Unit_Code;
GO
