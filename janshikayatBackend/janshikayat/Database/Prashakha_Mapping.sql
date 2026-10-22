-- Section forwards go to a Prashakha (Mst_Prashakha) as well as a branch.
-- Tbl_UserLogin.Prashakha_Id    -> Mst_Prashakha.ID (matched by name: login "Prashakha-1" = Mst_Prashakha "Prashakha-1")
-- Tbl_Applicant_Forward.PrashakhaId / PrashakhaLabel -> the Prashakha chosen when forwarding under Section
-- Mst_Prashakha.ID is a nullable float without a primary key, so no FK; the backend checks the id exists.
-- Safe to re-run: columns are added only if missing; updates are idempotent.

USE Jansikayat_DB;
GO

IF COL_LENGTH('dbo.Tbl_UserLogin', 'Prashakha_Id') IS NULL
    ALTER TABLE dbo.Tbl_UserLogin ADD Prashakha_Id INT NULL;
GO

UPDATE u
SET Prashakha_Id = CAST(p.ID AS INT)
FROM dbo.Tbl_UserLogin u
JOIN dbo.Mst_Prashakha p ON p.Name = u.UserName;

UPDATE u
SET Prashakha_Id = NULL
FROM dbo.Tbl_UserLogin u
WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_Prashakha p WHERE p.Name = u.UserName);
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Forward', 'PrashakhaId') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Forward ADD PrashakhaId INT NULL, PrashakhaLabel NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Applicant_Forward_PrashakhaId')
    CREATE INDEX IX_Applicant_Forward_PrashakhaId ON dbo.Tbl_Applicant_Forward(PrashakhaId);
GO

-- Verify
SELECT u.AutoId, u.UserName, u.Prashakha_Id, p.Name
FROM dbo.Tbl_UserLogin u
LEFT JOIN dbo.Mst_Prashakha p ON CAST(p.ID AS INT) = u.Prashakha_Id
WHERE u.Prashakha_Id IS NOT NULL
ORDER BY u.Prashakha_Id;
GO
