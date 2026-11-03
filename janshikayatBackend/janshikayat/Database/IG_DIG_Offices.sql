-- IG (Office_Id 3) / DIG (Office_Id 4) officers for the forward popup, both under Regional Office (Category_Id 5).
-- Mst_IG_DIG_Office : 38 districts, each with its zone, range and range head
-- vw_Office_Unit    : one row per range (4 IG, 8 DIG), Unit_Code = Range_Code, so the popup lists each officer once
-- Run after Regional_Office_Category.sql, and again after re-running District_Administration_Offices.sql
-- (that script redefines vw_Office_Unit without this table). Then run SP_Offices.sql, which has the full view.
-- Safe to re-run.

USE Jansikayat_DB;
GO

IF OBJECT_ID('dbo.Mst_IG_DIG_Office', 'U') IS NULL
    CREATE TABLE dbo.Mst_IG_DIG_Office (
        Dist_Code     INT           NOT NULL CONSTRAINT PK_Mst_IG_DIG_Office PRIMARY KEY,
        Category_Id   INT           NOT NULL CONSTRAINT FK_Mst_IG_DIG_Office_Category REFERENCES dbo.Mst_Category(Category_Id),
        Office_Id     INT           NOT NULL CONSTRAINT FK_Mst_IG_DIG_Office_Office REFERENCES dbo.Mst_Regional_Office(Office_Id),
        Zone_Code     INT           NOT NULL,
        Zone_Name     NVARCHAR(100) NOT NULL,
        Range_Code    INT           NOT NULL,
        Range_Name    NVARCHAR(100) NOT NULL,
        District_Name NVARCHAR(100) NOT NULL,
        Head          NVARCHAR(200) NOT NULL
    );
GO

MERGE dbo.Mst_IG_DIG_Office AS t
USING (VALUES (209, 3, 1, N'Darbhanga zone',   1,  N'Purnea Range',    N'ARARIA',          N'I.G. PURNEA RANGE, PURNEA'),
              (210, 3, 1, N'Darbhanga zone',   1,  N'Purnea Range',    N'KISHANGANJ',      N'I.G. PURNEA RANGE, PURNEA'),
              (211, 3, 1, N'Darbhanga zone',   1,  N'Purnea Range',    N'PURNIA',          N'I.G. PURNEA RANGE, PURNEA'),
              (212, 3, 1, N'Darbhanga zone',   1,  N'Purnea Range',    N'KATIHAR',         N'I.G. PURNEA RANGE, PURNEA'),
              (221, 4, 1, N'Darbhanga zone',   7,  N'Mithila Range',   N'SAMASTIPUR',      N'D.I.G. MITHILA RANGE, DARBHANGA'),
              (207, 4, 1, N'Darbhanga zone',   7,  N'Mithila Range',   N'MADHUBANI',       N'D.I.G. MITHILA RANGE, DARBHANGA'),
              (215, 4, 1, N'Darbhanga zone',   7,  N'Mithila Range',   N'DARBHANGA',       N'D.I.G. MITHILA RANGE, DARBHANGA'),
              (213, 4, 1, N'Darbhanga zone',   10, N'Kosi Range',      N'MADHEPURA',       N'D.I.G. KOSI RANGE, SAHARSA'),
              (214, 4, 1, N'Darbhanga zone',   10, N'Kosi Range',      N'SAHARSA',         N'D.I.G. KOSI RANGE, SAHARSA'),
              (208, 4, 1, N'Darbhanga zone',   10, N'Kosi Range',      N'SUPAUL',          N'D.I.G. KOSI RANGE, SAHARSA'),
              (235, 3, 2, N'Patna Zone',       2,  N'Magadh Range',    N'AURANGABAD',      N'I.G. MAGADH RANGE, GAYA JI'),
              (237, 3, 2, N'Patna Zone',       2,  N'Magadh Range',    N'NAWADA',          N'I.G. MAGADH RANGE, GAYA JI'),
              (236, 3, 2, N'Patna Zone',       2,  N'Magadh Range',    N'GAYA',            N'I.G. MAGADH RANGE, GAYA JI'),
              (240, 3, 2, N'Patna Zone',       2,  N'Magadh Range',    N'ARAWAL',          N'I.G. MAGADH RANGE, GAYA JI'),
              (239, 3, 2, N'Patna Zone',       2,  N'Magadh Range',    N'JEHANABAD',       N'I.G. MAGADH RANGE, GAYA JI'),
              (233, 4, 2, N'Patna Zone',       6,  N'Shahabad Range',  N'KAIMUR (BHABUA)', N'DIG, SHAHABAD RANGE, DEHRI ON SON'),
              (234, 4, 2, N'Patna Zone',       6,  N'Shahabad Range',  N'ROHTAS',          N'DIG, SHAHABAD RANGE, DEHRI ON SON'),
              (231, 4, 2, N'Patna Zone',       6,  N'Shahabad Range',  N'BHOJPUR',         N'DIG, SHAHABAD RANGE, DEHRI ON SON'),
              (232, 4, 2, N'Patna Zone',       6,  N'Shahabad Range',  N'BUXAR',           N'DIG, SHAHABAD RANGE, DEHRI ON SON'),
              (230, 3, 2, N'Patna Zone',       12, N'Central Range',   N'PATNA',           N'IG, CENTRAL RANGE, PATNA'),
              (229, 3, 2, N'Patna Zone',       12, N'Central Range',   N'NALANDA',         N'IG, CENTRAL RANGE, PATNA'),
              (203, 4, 3, N'Muzaffarpur zone', 3,  N'Champaran Range', N'PACHIM CHAMPARAN', N'DIG CHAMPARAN RANGE, BETTIAH'),
              (204, 4, 3, N'Muzaffarpur zone', 3,  N'Champaran Range', N'PURBI CHAMPARAN', N'DIG CHAMPARAN RANGE, BETTIAH'),
              (205, 4, 3, N'Muzaffarpur zone', 11, N'Tirhut Range',    N'SHEOHAR',         N'DIG TIRHUT RANGE, MUZAFFARPUR'),
              (206, 4, 3, N'Muzaffarpur zone', 11, N'Tirhut Range',    N'SITAMARHI',       N'DIG TIRHUT RANGE, MUZAFFARPUR'),
              (216, 4, 3, N'Muzaffarpur zone', 11, N'Tirhut Range',    N'MUZAFFARPUR',     N'DIG TIRHUT RANGE, MUZAFFARPUR'),
              (220, 4, 3, N'Muzaffarpur zone', 11, N'Tirhut Range',    N'VAISHALI',        N'DIG TIRHUT RANGE, MUZAFFARPUR'),
              (217, 4, 3, N'Muzaffarpur zone', 8,  N'Saran Range',     N'GOPALGANJ',       N'D.I.G SARAN RANGE, SARAN'),
              (219, 4, 3, N'Muzaffarpur zone', 8,  N'Saran Range',     N'SARAN',           N'D.I.G SARAN RANGE, SARAN'),
              (218, 4, 3, N'Muzaffarpur zone', 8,  N'Saran Range',     N'SIWAN',           N'D.I.G SARAN RANGE, SARAN'),
              (224, 3, 4, N'Bhagalpur zone',   4,  N'Eastern Range',   N'BHAGALPUR',       N'IG, EASTERN REGION, BHAGALPUR'),
              (225, 3, 4, N'Bhagalpur zone',   4,  N'Eastern Range',   N'BANKA',           N'IG, EASTERN REGION, BHAGALPUR'),
              (222, 4, 4, N'Bhagalpur zone',   5,  N'Begusarai Range', N'BEGUSARAI',       N'DIG BEGUSARI RANGE, BEGUSARAI'),
              (223, 4, 4, N'Bhagalpur zone',   5,  N'Begusarai Range', N'KHAGARIA',        N'DIG BEGUSARI RANGE, BEGUSARAI'),
              (238, 4, 4, N'Bhagalpur zone',   9,  N'Munger Range',    N'JAMUI',           N'DIG MUNGER RANGE, MUNGER'),
              (227, 4, 4, N'Bhagalpur zone',   9,  N'Munger Range',    N'LAKHISARAI',      N'DIG MUNGER RANGE, MUNGER'),
              (228, 4, 4, N'Bhagalpur zone',   9,  N'Munger Range',    N'SEIKHPURA',       N'DIG MUNGER RANGE, MUNGER'),
              (226, 4, 4, N'Bhagalpur zone',   9,  N'Munger Range',    N'MUNGER',          N'DIG MUNGER RANGE, MUNGER')
      ) AS s(Dist_Code, Office_Id, Zone_Code, Zone_Name, Range_Code, Range_Name, District_Name, Head)
ON t.Dist_Code = s.Dist_Code
WHEN MATCHED THEN UPDATE SET Category_Id = 5, Office_Id = s.Office_Id, Zone_Code = s.Zone_Code, Zone_Name = s.Zone_Name,
                             Range_Code = s.Range_Code, Range_Name = s.Range_Name, District_Name = s.District_Name, Head = s.Head
WHEN NOT MATCHED THEN INSERT (Dist_Code, Category_Id, Office_Id, Zone_Code, Zone_Name, Range_Code, Range_Name, District_Name, Head)
                      VALUES (s.Dist_Code, 5, s.Office_Id, s.Zone_Code, s.Zone_Name, s.Range_Code, s.Range_Name, s.District_Name, s.Head);
GO

-- Every office under a regional office, in one shape (used by the forward popup and its save check)
CREATE OR ALTER VIEW dbo.vw_Office_Unit AS
    SELECT Office_Id, Division_Code AS Unit_Code, Head AS Unit_Name FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT Office_Id, Dist_Code, Head FROM dbo.Mst_DM_Office
    UNION ALL
    SELECT DISTINCT Office_Id, Range_Code, Head FROM dbo.Mst_IG_DIG_Office;
GO

-- Verify
SELECT Office_Id, COUNT(*) AS Units FROM dbo.vw_Office_Unit GROUP BY Office_Id ORDER BY Office_Id;
SELECT Office_Id, Unit_Code, Unit_Name FROM dbo.vw_Office_Unit WHERE Office_Id IN (3, 4) ORDER BY Office_Id, Unit_Code;
GO
