/* Entry page location fields: subdivision, area type, ward, mohalla.
   Safe to run more than once. Existing rows of mst_thana are not changed.
   Run in SSMS or: sqlcmd -S <server> -E -C -f 65001 -b -i 001_entry_page_location.sql */
USE JansikayatDB;
GO
/* Saved with each procedure. sqlcmd defaults QUOTED_IDENTIFIER to OFF, which breaks writes to tables with filtered indexes. */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* 1. Police stations present in LandDisputeDB but missing here */
INSERT INTO dbo.mst_thana (District,District_code,Subdivision_Name,Subdivision_Code,Police_Station,PS_Code,Circle_Code,Circle_Name,Range_id,Range_Name,Remarks,UpdateDate,UpdateIp,UpdateUserId)
SELECT v.District,v.District_code,v.Subdivision_Name,v.Subdivision_Code,v.Police_Station,v.PS_Code,v.Circle_Code,v.Circle_Name,v.Range_id,v.Range_Name,v.Remarks,v.UpdateDate,v.UpdateIp,v.UpdateUserId
FROM (VALUES
  (N'BEGUSARAI',222,N'BEGUSARAI',22201,N'Chakiya',5102056,1312,N'Barauni',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'KHAGARIA',223,N'GOGRI',22302,N'Bharatkhand',5108025,1327,N'Gogri',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'KHAGARIA',223,N'GOGRI',22302,N'Paura',5108026,1327,N'Gogri',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'MADHEPURA',21301,N'Bharahi',5115026,1161,N'Madhepura',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'MADHEPURA',21301,N'Parmanandpur',5115027,1161,N'Madhepura',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'MADHEPURA',21301,N'Bhatni',5115028,1161,N'Madhepura',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'MADHEPURA',21301,N'Belari',5115029,1161,N'Madhepura',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'UDAKISHUNGANJ',21302,N'Phulaut',5115030,1170,N'Chausa',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'MADHEPURA',213,N'UDAKISHUNGANJ',21302,N'Arrar',5115031,1167,N'Kishanganj',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'KATIHAR',212,N'KATIHAR',21201,N'Semapur',5130070,1151,N'Katihar',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'SAMASTIPUR',221,N'ROSERA',22103,N'Larjhaghat',5133041,1303,N'Bithan',NULL,NULL,NULL,NULL,NULL,NULL),
  (N'LAKHISARAI',227,N'LAKHISARAI',22701,N'Singh Chak',5802065,1369,N'Chanan*',NULL,NULL,NULL,NULL,NULL,NULL)
) v(District,District_code,Subdivision_Name,Subdivision_Code,Police_Station,PS_Code,Circle_Code,Circle_Name,Range_id,Range_Name,Remarks,UpdateDate,UpdateIp,UpdateUserId)
WHERE NOT EXISTS (SELECT 1 FROM dbo.mst_thana t WHERE t.PS_Code = v.PS_Code);
GO

/* 2. The थाना dropdown lists the police stations of the selected district (mst_thana.District_code).
   The block-wise mapping table from an earlier version of this script is not used. */
IF OBJECT_ID('dbo.MstThanaMapping') IS NOT NULL
    DROP TABLE dbo.MstThanaMapping;
GO

/* Indexes for the ward and village dropdowns, so each call does not scan a large table. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_Wards') AND name = 'IX_mst_Wards_Panchayat')
    CREATE INDEX IX_mst_Wards_Panchayat ON dbo.mst_Wards (PANCHAYATCODE, DISTCODE, WARDCODE) INCLUDE (WARDNAME);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PanchayatVillage') AND name = 'IX_PanchayatVillage_Panchayat')
    CREATE INDEX IX_PanchayatVillage_Panchayat ON dbo.PanchayatVillage (PanchayatCode, DistrictCode, BlockCode) INCLUDE (VillageCode);
/* Village and panchayat name lookups used by the application list (usp_getApplicant) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_VillageMaster') AND name = 'IX_VillageMaster_VILLCODE')
    CREATE INDEX IX_VillageMaster_VILLCODE ON dbo.mst_VillageMaster (VILLCODE) INCLUDE (BLOCKCODE, DISTCODE, VILLNAME);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_Panchayats') AND name = 'IX_Panchayats_PanchayatCode')
    CREATE INDEX IX_Panchayats_PanchayatCode ON dbo.mst_Panchayats (PanchayatCode) INCLUDE (BlockCode, DistrictCode, PanchayatName);
GO

/* 3. New location columns (nullable: applications saved earlier stay valid) */
IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'SubDivision') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Details ADD SubDivision bigint NULL;
IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'AreaType') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Details ADD AreaType char(1) NULL;
IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'Ward') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Details ADD Ward bigint NULL;
IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'Mohalla') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Details ADD Mohalla nvarchar(200) NULL;
GO

/* 4. Save procedure */
CREATE OR ALTER PROCEDURE [dbo].[sp_InsertApplicantDetails]
    @Applicant_Name NVARCHAR(255),
    @Father_Husband_Name NVARCHAR(255) = NULL,
    @Mobile_Number VARCHAR(10),
    @Mobile_Number2 VARCHAR(10) = NULL,
    @Address NVARCHAR(255) = NULL,
    @Pin_Code VARCHAR(6) = NULL,
    @Email_Id VARCHAR(50) = NULL,
    @Application_Date DATETIME = NULL,
    @Village BIGINT = NULL,
    @Panchayat INT = NULL,
    @Block INT = NULL,
    @District INT = NULL,
    @Thana BIGINT = NULL,
    @SubDivision BIGINT = NULL,
    @AreaType CHAR(1) = NULL,
    @Ward BIGINT = NULL,
    @Mohalla NVARCHAR(200) = NULL,
    @DocumentPath VARCHAR(200) = NULL,
    @Application_Source VARCHAR(50) = NULL,
    @CreatedBy VARCHAR(50) = NULL,
    @CreatedIp VARCHAR(50) = NULL,
    @Is_Active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    declare @NewID BIGINT = 0,
    @Message NVARCHAR(500) = '',
    @Application_No VARCHAR(30) = NULL,
    @Prefix VARCHAR(9),
    @Serial INT

    BEGIN TRY
        IF @Application_Date IS NULL
            SET @Application_Date = GETDATE();

        IF @Application_Source IS NULL OR LTRIM(RTRIM(@Application_Source)) = ''
            SET @Application_Source = 'Offline';

        SET @Prefix = 'JS' + RIGHT('000' + CAST(ISNULL(@District, 0) AS VARCHAR(10)), 3)
                           + RIGHT('0000' + CAST(ISNULL(@Block, 0) AS VARCHAR(10)), 4);

        BEGIN TRANSACTION;

        -- UPDLOCK + HOLDLOCK: two finalises in the same block cannot take the same serial
        SELECT @Serial = ISNULL(MAX(CAST(SUBSTRING(Application_No, 10, 10) AS INT)), 0) + 1
        FROM [dbo].[Tbl_Applicant_Details] WITH (UPDLOCK, HOLDLOCK)
        WHERE Application_No LIKE @Prefix + '%' AND LEN(Application_No) >= 13;

        -- 4 digits up to 9999, then the serial just grows (10000, 10001, ...)
        SET @Application_No = @Prefix + CASE WHEN @Serial > 9999 THEN CAST(@Serial AS VARCHAR(10))
                                             ELSE RIGHT('0000' + CAST(@Serial AS VARCHAR(10)), 4) END;

        INSERT INTO [dbo].[Tbl_Applicant_Details]
        (
            [Applicant_Name], [Father_Husband_Name], [Mobile_Number], [Mobile_Number2], [Address], [Pin_Code], [Email_Id],
            [Application_Date], [Village], [Panchayat], [Block], [District], [Thana],
            [SubDivision], [AreaType], [Ward], [Mohalla],
            [DocumentPath], [Application_Source], [Application_No], [CreatedDate], [CreatedBy], [CreatedIp], [Is_Active]
        )
        VALUES
        (
            @Applicant_Name, @Father_Husband_Name, @Mobile_Number, @Mobile_Number2, @Address, @Pin_Code, @Email_Id,
            @Application_Date, @Village, @Panchayat, @Block, @District, @Thana,
            @SubDivision, @AreaType, @Ward, @Mohalla,
            @DocumentPath, @Application_Source, @Application_No, GETDATE(), @CreatedBy, @CreatedIp, @Is_Active
        );

        SET @NewID = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SET @Message = 'Applicant details saved successfully.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @NewID = 0;
        SET @Application_No = NULL;
        SET @Message = ERROR_MESSAGE();
    END CATCH

    select @NewID as Flag, @Message as Message, @Application_No as Application_No
END
GO

/* 5. List procedure. OUTER APPLY: mst_VillageMaster repeats some rows, which must not repeat an application */
CREATE OR ALTER PROC dbo.usp_getApplicant
AS
BEGIN
    SELECT t.ID, t.Application_No, t.Applicant_Name, t.Father_Husband_Name, t.Mobile_Number, t.Mobile_Number2, t.Address,
           t.Pin_Code, t.Email_Id, t.Application_Date, ISNULL(v.VILLNAME, '') AS VILLNAME,
           ISNULL(pt.PanchayatName, '') AS PanchayatName, ISNULL(b.BlockName, '') AS BlockName,
           ISNULL(d.DISTRICTNAME, '') AS DISTRICTNAME, t.DocumentPath, t.Application_Source,
           ISNULL(t.Thana, 0) AS Thana, ISNULL(th.Police_Station, '') AS Police_Station,
           ISNULL(sd.Sd_Name_En, '') AS SubDivisionName, ISNULL(CAST(t.AreaType AS varchar(1)), '') AS AreaType,
           ISNULL(w.WARDNAME, '') AS WardName, ISNULL(t.Mohalla, '') AS Mohalla
    FROM Tbl_Applicant_Details t
    -- LEFT JOINs: optional fields are NULL, and a missing master row must never hide an application
    LEFT JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    LEFT JOIN SubDivisions sd ON sd.Sd_Code2 = t.SubDivision
    LEFT JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    OUTER APPLY (SELECT TOP 1 x.VILLNAME FROM mst_VillageMaster x
                 WHERE x.VILLCODE = t.Village AND x.BLOCKCODE = t.Block AND x.DISTCODE = t.District) v
    LEFT JOIN mst_Wards w ON w.WARDCODE = t.Ward AND w.PANCHAYATCODE = t.Panchayat AND w.DISTCODE = t.District
    LEFT JOIN mst_thana th ON th.PS_Code = t.Thana
    WHERE t.Is_Active = 1
    ORDER BY t.ID DESC
END
GO

SELECT (SELECT COUNT(*) FROM dbo.mst_thana) AS mst_thana_rows,
       COL_LENGTH('dbo.Tbl_Applicant_Details', 'Mohalla') AS mohalla_column_bytes;
GO
