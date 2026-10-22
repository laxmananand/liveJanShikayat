-- Category_Id on Mst_Category, Home/Section/District category columns on Mst_Branch,
-- and Branch_Id on Tbl_UserLogin.
-- Category_Id: Home = 1, District Administration = 2, Section = 3, Department = 4
-- Home (1)                                -> branches 1-8
-- Section (3) + District Administration (2) -> branches 9, 10, 12-15
-- J.P SENANI (11)                          -> no category for now
-- Safe to re-run: columns/constraints are added only if missing; updates are idempotent.

USE Jansikayat_DB;
GO

IF COL_LENGTH('dbo.Mst_Category', 'Category_Id') IS NULL
    ALTER TABLE dbo.Mst_Category ADD Category_Id INT NULL;
GO

-- Set by name in one statement, so the unique key and FKs are checked only once the swap is complete
UPDATE dbo.Mst_Category
SET Category_Id = CASE Category
                      WHEN 'Home' THEN 1
                      WHEN 'District Administration' THEN 2
                      WHEN 'Section' THEN 3
                      WHEN 'Department' THEN 4
                  END
WHERE Category IN ('Home', 'District Administration', 'Section', 'Department');
GO

IF OBJECT_ID('dbo.UQ_Mst_Category_Category_Id', 'UQ') IS NULL
    ALTER TABLE dbo.Mst_Category ADD CONSTRAINT UQ_Mst_Category_Category_Id UNIQUE (Category_Id);
GO

IF COL_LENGTH('dbo.Mst_Branch', 'Home_Categ') IS NULL
    ALTER TABLE dbo.Mst_Branch ADD Home_Categ INT NULL
        CONSTRAINT FK_Mst_Branch_Home_Categ REFERENCES dbo.Mst_Category(Category_Id);
GO

IF COL_LENGTH('dbo.Mst_Branch', 'Section_Categ') IS NULL
    ALTER TABLE dbo.Mst_Branch ADD Section_Categ INT NULL
        CONSTRAINT FK_Mst_Branch_Section_Categ REFERENCES dbo.Mst_Category(Category_Id);
GO

-- Older builds named this column Department_Categ
IF COL_LENGTH('dbo.Mst_Branch', 'Department_Categ') IS NOT NULL AND COL_LENGTH('dbo.Mst_Branch', 'District_Categ') IS NULL
    EXEC sp_rename 'dbo.Mst_Branch.Department_Categ', 'District_Categ', 'COLUMN';
IF OBJECT_ID('dbo.FK_Mst_Branch_Department_Categ', 'F') IS NOT NULL
    EXEC sp_rename 'dbo.FK_Mst_Branch_Department_Categ', 'FK_Mst_Branch_District_Categ', 'OBJECT';
GO

IF COL_LENGTH('dbo.Mst_Branch', 'District_Categ') IS NULL
    ALTER TABLE dbo.Mst_Branch ADD District_Categ INT NULL
        CONSTRAINT FK_Mst_Branch_District_Categ REFERENCES dbo.Mst_Category(Category_Id);
GO

UPDATE dbo.Mst_Branch
SET Home_Categ = 1, Section_Categ = NULL, District_Categ = NULL
WHERE Complain_id BETWEEN 1 AND 8;

UPDATE dbo.Mst_Branch
SET Home_Categ = NULL, Section_Categ = 3, District_Categ = 2
WHERE Complain_id IN (9, 10, 12, 13, 14, 15);

UPDATE dbo.Mst_Branch
SET Home_Categ = NULL, Section_Categ = NULL, District_Categ = NULL
WHERE Complain_id = 11;
GO

-- Branch login -> Mst_Branch, so an application forwarded to a branch reaches that branch's login.
-- Only the Branch-role logins are mapped for now; all other logins stay NULL.
IF COL_LENGTH('dbo.Tbl_UserLogin', 'Branch_Id') IS NULL
    ALTER TABLE dbo.Tbl_UserLogin ADD Branch_Id BIGINT NULL
        CONSTRAINT FK_Tbl_UserLogin_Branch_Id REFERENCES dbo.Mst_Branch(Complain_id);
GO

UPDATE u
SET Branch_Id = m.Branch_Id
FROM dbo.Tbl_UserLogin u
JOIN (VALUES ('Police', 1), ('Prosecution', 2), ('Prison', 3), ('Homeguard', 4),
             ('FireService', 5), ('SoldierWelfare', 6), ('Probation', 7), ('HumanRights', 8)
     ) AS m(UserName, Branch_Id) ON m.UserName = u.UserName;

UPDATE dbo.Tbl_UserLogin
SET Branch_Id = NULL
WHERE UserName NOT IN ('Police', 'Prosecution', 'Prison', 'Homeguard',
                       'FireService', 'SoldierWelfare', 'Probation', 'HumanRights');
GO

-- Verify
SELECT u.AutoId, u.UserName, u.Role, u.Branch_Id, b.Branch_Eng
FROM dbo.Tbl_UserLogin u
LEFT JOIN dbo.Mst_Branch b ON b.Complain_id = u.Branch_Id
WHERE u.Branch_Id IS NOT NULL
ORDER BY u.Branch_Id;
SELECT AutoId, Category_Id, Category FROM dbo.Mst_Category ORDER BY Category_Id;
SELECT Complain_id, Branch_Eng, Branch_Hindi, Home_Categ, Section_Categ, District_Categ
FROM dbo.Mst_Branch ORDER BY Complain_id;
GO
