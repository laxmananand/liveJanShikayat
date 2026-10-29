-- District Administration (Mst_Category.Category_Id = 2) forwards go to a regional office first,
-- then (for Commissioner / DM) to one office of that kind, then the usual branch -> complaint type.
-- Mst_Regional_Office  : Commissioner, DM, IG, DIG, SP          (Category_Id -> Mst_Category.Category_Id)
-- Mst_Commissioner     : 9 divisional commissioners             (Office_Id 1)
-- Mst_DM_Office        : 38 district DM offices                 (Office_Id 2; Division_Code -> Mst_Commissioner)
-- Tbl_Applicant_Forward.OfficeId / OfficeLabel / OfficeUnitCode / OfficeUnitLabel -> what was chosen when forwarding
-- IG / DIG / SP have no office list yet, so they go straight to the branch; to give one a list,
-- add a table for it and UNION it into vw_Office_Unit (the popup and the save check then require an officer).
-- Safe to re-run: tables/columns are created only if missing; rows are upserted.
-- Commissionary / IG / DIG now sit under Regional Office (5): re-run Regional_Office_Category.sql after this script.

USE Jansikayat_DB;
GO

IF OBJECT_ID('dbo.Mst_Regional_Office', 'U') IS NULL
    CREATE TABLE dbo.Mst_Regional_Office (
        Office_Id       INT           NOT NULL CONSTRAINT PK_Mst_Regional_Office PRIMARY KEY,
        Category_Id     INT           NOT NULL CONSTRAINT FK_Mst_Regional_Office_Category REFERENCES dbo.Mst_Category(Category_Id),
        Regional_Office NVARCHAR(200) NOT NULL,
        Unique_Code     VARCHAR(20)   NOT NULL,
        Is_Active       BIT           NOT NULL CONSTRAINT DF_Mst_Regional_Office_Is_Active DEFAULT 1
    );
GO

IF OBJECT_ID('dbo.Mst_Commissioner', 'U') IS NULL
    CREATE TABLE dbo.Mst_Commissioner (
        Division_Code INT           NOT NULL CONSTRAINT PK_Mst_Commissioner PRIMARY KEY,
        Category_Id   INT           NOT NULL CONSTRAINT FK_Mst_Commissioner_Category REFERENCES dbo.Mst_Category(Category_Id),
        Office_Id     INT           NOT NULL CONSTRAINT FK_Mst_Commissioner_Office REFERENCES dbo.Mst_Regional_Office(Office_Id),
        Division_Name NVARCHAR(100) NOT NULL,
        Head          NVARCHAR(200) NOT NULL
    );
GO

IF OBJECT_ID('dbo.Mst_DM_Office', 'U') IS NULL
    CREATE TABLE dbo.Mst_DM_Office (
        Dist_Code     INT           NOT NULL CONSTRAINT PK_Mst_DM_Office PRIMARY KEY,
        Category_Id   INT           NOT NULL CONSTRAINT FK_Mst_DM_Office_Category REFERENCES dbo.Mst_Category(Category_Id),
        Office_Id     INT           NOT NULL CONSTRAINT FK_Mst_DM_Office_Office REFERENCES dbo.Mst_Regional_Office(Office_Id),
        Division_Code INT           NOT NULL CONSTRAINT FK_Mst_DM_Office_Division REFERENCES dbo.Mst_Commissioner(Division_Code),
        Division_Name NVARCHAR(100) NOT NULL,
        District_Name NVARCHAR(100) NOT NULL,
        Head          NVARCHAR(200) NOT NULL,
        Range_Code    INT           NULL
    );
GO

-- SP is listed with Category_Id 4 (Department) in the source sheet; it belongs to District Administration (2)
MERGE dbo.Mst_Regional_Office AS t
USING (VALUES (1, 2, N'Commissionary', 'Com'),
              (2, 2, N'District Magistrate', 'D.M'),
              (3, 2, N'Inspector General of Police', 'IG'),
              (4, 2, N'Deputy Inspector General of Police', 'DIG'),
              (5, 2, N'Superintendent of Police', 'S.P')
      ) AS s(Office_Id, Category_Id, Regional_Office, Unique_Code)
ON t.Office_Id = s.Office_Id
WHEN MATCHED THEN UPDATE SET Category_Id = s.Category_Id, Regional_Office = s.Regional_Office, Unique_Code = s.Unique_Code
WHEN NOT MATCHED THEN INSERT (Office_Id, Category_Id, Regional_Office, Unique_Code)
                      VALUES (s.Office_Id, s.Category_Id, s.Regional_Office, s.Unique_Code);
GO

MERGE dbo.Mst_Commissioner AS t
USING (VALUES (1, N'PATNA',     N'Commissioner Patna'),
              (2, N'TIRHUT',    N'Commissioner Tirhut'),
              (3, N'SARAN',     N'Commissioner Saran'),
              (4, N'DARBHANGA', N'Commissioner Darbhanga'),
              (5, N'KOSHI',     N'Commissioner Koshi'),
              (6, N'PURNIA',    N'Commissioner Purnia'),
              (7, N'BHAGALPUR', N'Commissioner Bhagalpur'),
              (8, N'MUNGER',    N'Commissioner Munger'),
              (9, N'MAGADH',    N'Commissioner Magadh')
      ) AS s(Division_Code, Division_Name, Head)
ON t.Division_Code = s.Division_Code
WHEN MATCHED THEN UPDATE SET Category_Id = 2, Office_Id = 1, Division_Name = s.Division_Name, Head = s.Head
WHEN NOT MATCHED THEN INSERT (Division_Code, Category_Id, Office_Id, Division_Name, Head)
                      VALUES (s.Division_Code, 2, 1, s.Division_Name, s.Head);
GO

MERGE dbo.Mst_DM_Office AS t
USING (VALUES (203, 2, N'TIRHUT',    N'W CHAMPARAN', N'DM Office, West Champaran', 3),
              (204, 2, N'TIRHUT',    N'E CHAMPARAN', N'DM Office, East Champaran', 3),
              (205, 2, N'TIRHUT',    N'SHEOHAR',     N'DM Office, Sheohar',        11),
              (206, 2, N'TIRHUT',    N'SITAMARHI',   N'DM Office, Sitamarhi',      11),
              (207, 4, N'DARBHANGA', N'MADHUBANI',   N'DM Office, Madhubani',      7),
              (208, 5, N'KOSHI',     N'SUPAUL',      N'DM Office, Supaul',         10),
              (209, 6, N'PURNIA',    N'ARARIA',      N'DM Office, Araria',         1),
              (210, 6, N'PURNIA',    N'KISHANGANJ',  N'DM Office, Kishanganj',     1),
              (211, 6, N'PURNIA',    N'PURNIA',      N'DM Office, Purnia',         1),
              (212, 6, N'PURNIA',    N'KATIHAR',     N'DM Office, Katihar',        1),
              (213, 5, N'KOSHI',     N'MADHEPURA',   N'DM Office, Madhepura',      10),
              (214, 5, N'KOSHI',     N'SAHARSA',     N'DM Office, Saharsa',        10),
              (215, 4, N'DARBHANGA', N'DARBHANGA',   N'DM Office, Darbhanga',      7),
              (216, 2, N'TIRHUT',    N'MUZAFFARPUR', N'DM Office, Muzaffarpur',    11),
              (217, 3, N'SARAN',     N'GOPALGANJ',   N'DM Office, Gopalganj',      8),
              (218, 3, N'SARAN',     N'SIWAN',       N'DM Office, Siwan',          8),
              (219, 3, N'SARAN',     N'SARAN',       N'DM Office, Saran(Chhapra)', 8),
              (220, 2, N'TIRHUT',    N'VAISHALI',    N'DM Office, Vaishali',       11),
              (221, 4, N'DARBHANGA', N'SAMASTIPUR',  N'DM Office, Samastipur',     7),
              (222, 8, N'MUNGER',    N'BEGUSARAI',   N'DM Office, Begusarai',      5),
              (223, 8, N'MUNGER',    N'KHAGARIA',    N'DM Office, Khagaria',       5),
              (224, 7, N'BHAGALPUR', N'BHAGALPUR',   N'DM Office, Bhagalpur',      4),
              (225, 7, N'BHAGALPUR', N'BANKA',       N'DM Office, Banka',          4),
              (226, 8, N'MUNGER',    N'MUNGER',      N'DM Office, Munger',         9),
              (227, 8, N'MUNGER',    N'LAKHISARAI',  N'DM Office, Lakhisarai',     9),
              (228, 8, N'MUNGER',    N'SHEIKHPURA',  N'DM Office, Sheikhpura',     9),
              (229, 1, N'PATNA',     N'NALANDA',     N'DM Office, Nalanda',        12),
              (230, 1, N'PATNA',     N'PATNA',       N'DM Office, Patna',          12),
              (231, 1, N'PATNA',     N'BHOJPUR',     N'DM Office, Bhojpur',        6),
              (232, 1, N'PATNA',     N'BUXAR',       N'DM Office, Buxar',          6),
              (233, 1, N'PATNA',     N'KAIMUR',      N'DM Office, Kaimur',         6),
              (234, 1, N'PATNA',     N'ROHTAS',      N'DM Office, Rohtas',         6),
              (235, 9, N'MAGADH',    N'AURANGABAD',  N'DM Office, Aurangabad',     2),
              (236, 9, N'MAGADH',    N'GAYA',        N'DM Office, Gaya',           2),
              (237, 9, N'MAGADH',    N'NAWADA',      N'DM Office, Nawada',         2),
              (238, 8, N'MUNGER',    N'JAMUI',       N'DM Office, Jamui',          9),
              (239, 9, N'MAGADH',    N'JEHANABAD',   N'DM Office, Jehanabad',      2),
              (240, 9, N'MAGADH',    N'ARWAL',       N'DM Office, Arwal',          2)
      ) AS s(Dist_Code, Division_Code, Division_Name, District_Name, Head, Range_Code)
ON t.Dist_Code = s.Dist_Code
WHEN MATCHED THEN UPDATE SET Category_Id = 2, Office_Id = 2, Division_Code = s.Division_Code, Division_Name = s.Division_Name,
                             District_Name = s.District_Name, Head = s.Head, Range_Code = s.Range_Code
WHEN NOT MATCHED THEN INSERT (Dist_Code, Category_Id, Office_Id, Division_Code, Division_Name, District_Name, Head, Range_Code)
                      VALUES (s.Dist_Code, 2, 2, s.Division_Code, s.Division_Name, s.District_Name, s.Head, s.Range_Code);
GO

-- Every office under a regional office, in one shape (used by the forward popup and its save check)
CREATE OR ALTER VIEW dbo.vw_Office_Unit AS
    SELECT Office_Id, Division_Code AS Unit_Code, Head AS Unit_Name FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT Office_Id, Dist_Code, Head FROM dbo.Mst_DM_Office;
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Forward', 'OfficeId') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Forward ADD OfficeId INT NULL, OfficeLabel NVARCHAR(200) NULL,
                                              OfficeUnitCode INT NULL, OfficeUnitLabel NVARCHAR(300) NULL;
GO

-- Verify
SELECT * FROM dbo.Mst_Regional_Office ORDER BY Office_Id;
SELECT * FROM dbo.Mst_Commissioner ORDER BY Division_Code;
SELECT COUNT(*) AS DM_Offices FROM dbo.Mst_DM_Office;
GO
