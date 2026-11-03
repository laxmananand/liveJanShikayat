-- SP (Office_Id 5) officers for the forward popup, under District Administration (Category_Id 2).
-- Mst_SP_Office  : 40 SPs, one per district plus Bagaha (West Champaran) and Naugachia (Bhagalpur)
-- SP_Code        : the district code for the 38 district SPs; 241 / 242 for the two with no district of their own
-- Dist_Code      : the district the SP falls under (-> Mst_DM_Office), so 203 and 224 each have two SPs
-- vw_Office_Unit : Unit_Code = SP_Code
-- Run last, after IG_DIG_Offices.sql: this script's vw_Office_Unit is the full one, and the earlier scripts redefine
-- the view without the later tables. Safe to re-run.

USE Jansikayat_DB;
GO

IF OBJECT_ID('dbo.Mst_SP_Office', 'U') IS NULL
    CREATE TABLE dbo.Mst_SP_Office (
        SP_Code       INT           NOT NULL CONSTRAINT PK_Mst_SP_Office PRIMARY KEY,
        Category_Id   INT           NOT NULL CONSTRAINT FK_Mst_SP_Office_Category REFERENCES dbo.Mst_Category(Category_Id),
        Office_Id     INT           NOT NULL CONSTRAINT FK_Mst_SP_Office_Office REFERENCES dbo.Mst_Regional_Office(Office_Id),
        Dist_Code     INT           NOT NULL CONSTRAINT FK_Mst_SP_Office_District REFERENCES dbo.Mst_DM_Office(Dist_Code),
        Division_Code INT           NOT NULL CONSTRAINT FK_Mst_SP_Office_Division REFERENCES dbo.Mst_Commissioner(Division_Code),
        Division_Name NVARCHAR(100) NOT NULL,
        District_Name NVARCHAR(100) NOT NULL,
        Head          NVARCHAR(200) NOT NULL,
        Range_Code    INT           NULL
    );
GO

-- The 38 district SPs follow Mst_DM_Office, with "DM Office" in the head replaced by "SP Office"
MERGE dbo.Mst_SP_Office AS t
USING (SELECT Dist_Code AS SP_Code, Dist_Code, Division_Code, Division_Name, District_Name,
              REPLACE(Head, N'DM Office', N'SP Office') AS Head, Range_Code
       FROM dbo.Mst_DM_Office
       UNION ALL
       SELECT 241, 203, 2, N'TIRHUT',    N'W CHAMPARAN', N'SP Office, Bagaha',    3
       UNION ALL
       SELECT 242, 224, 7, N'BHAGALPUR', N'BHAGALPUR',   N'SP Office, Naugachia', 4
      ) AS s
ON t.SP_Code = s.SP_Code
WHEN MATCHED THEN UPDATE SET Category_Id = 2, Office_Id = 5, Dist_Code = s.Dist_Code, Division_Code = s.Division_Code,
                             Division_Name = s.Division_Name, District_Name = s.District_Name, Head = s.Head, Range_Code = s.Range_Code
WHEN NOT MATCHED THEN INSERT (SP_Code, Category_Id, Office_Id, Dist_Code, Division_Code, Division_Name, District_Name, Head, Range_Code)
                      VALUES (s.SP_Code, 2, 5, s.Dist_Code, s.Division_Code, s.Division_Name, s.District_Name, s.Head, s.Range_Code);
GO

-- Every office under a regional office, in one shape (used by the forward popup and its save check)
CREATE OR ALTER VIEW dbo.vw_Office_Unit AS
    SELECT Office_Id, Division_Code AS Unit_Code, Head AS Unit_Name FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT Office_Id, Dist_Code, Head FROM dbo.Mst_DM_Office
    UNION ALL
    SELECT DISTINCT Office_Id, Range_Code, Head FROM dbo.Mst_IG_DIG_Office
    UNION ALL
    SELECT Office_Id, SP_Code, Head FROM dbo.Mst_SP_Office;
GO

-- Verify
SELECT Office_Id, COUNT(*) AS Units FROM dbo.vw_Office_Unit GROUP BY Office_Id ORDER BY Office_Id;
SELECT Unit_Code, Unit_Name FROM dbo.vw_Office_Unit WHERE Office_Id = 5 ORDER BY Unit_Code;
GO
