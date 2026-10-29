-- "Regional Office" category (Mst_Category.Category_Id = 5) in the forward popup.
--   Commissionary (1), IG (3), DIG (4) move from District Administration (2) to Regional Office (5);
--   District Magistrate (2) and SP (5) stay under District Administration.
--   Regional Office forwards work like District Administration: office -> officer (when it has a list) -> branch -> complaint type.
-- Mst_Branch.Regional_Categ: branches offered under Regional Office (same as District Administration: 9, 10, 12-15).
-- Run after Category_Branch_Mapping.sql and District_Administration_Offices.sql. Safe to re-run.

USE Jansikayat_DB;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Mst_Category WHERE Category_Id = 5)
    INSERT INTO dbo.Mst_Category (AutoId, Category_Id, Category)
    VALUES ((SELECT ISNULL(MAX(AutoId), 0) + 1 FROM dbo.Mst_Category), 5, 'Regional Office');
GO

IF COL_LENGTH('dbo.Mst_Branch', 'Regional_Categ') IS NULL
    ALTER TABLE dbo.Mst_Branch ADD Regional_Categ INT NULL
        CONSTRAINT FK_Mst_Branch_Regional_Categ REFERENCES dbo.Mst_Category(Category_Id);
GO

UPDATE dbo.Mst_Branch SET Regional_Categ = 5    WHERE Complain_id IN (9, 10, 12, 13, 14, 15);
UPDATE dbo.Mst_Branch SET Regional_Categ = NULL WHERE Complain_id NOT IN (9, 10, 12, 13, 14, 15);
GO

UPDATE dbo.Mst_Regional_Office SET Category_Id = 5 WHERE Office_Id IN (1, 3, 4);
UPDATE dbo.Mst_Regional_Office SET Category_Id = 2 WHERE Office_Id IN (2, 5);
-- The 9 divisional commissioners belong to Commissionary, so they follow it
UPDATE dbo.Mst_Commissioner SET Category_Id = 5;
GO

-- Verify
SELECT AutoId, Category_Id, Category FROM dbo.Mst_Category ORDER BY Category_Id;
SELECT o.Office_Id, o.Regional_Office, o.Category_Id, c.Category
FROM dbo.Mst_Regional_Office o JOIN dbo.Mst_Category c ON c.Category_Id = o.Category_Id
ORDER BY o.Office_Id;
SELECT Complain_id, Branch_Eng, Home_Categ, Section_Categ, District_Categ, Regional_Categ
FROM dbo.Mst_Branch ORDER BY Complain_id;
GO
