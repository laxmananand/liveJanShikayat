-- Application Source (CPGRAMS / CM Dashboard / Sahyog Portal / PMO Grievance Portal / Offline / Other)
-- chosen on the entry form, stored per application for source-wise reports.
-- Safe to re-run: the column is added only if missing; procedures are re-created with CREATE OR ALTER.

USE Jansikayat_DB;
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'Application_Source') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_Applicant_Details
        ADD Application_Source VARCHAR(50) NOT NULL
            CONSTRAINT DF_Applicant_Details_Application_Source DEFAULT 'Offline' WITH VALUES;
END
GO

IF OBJECT_ID('dbo.CK_Applicant_Details_Application_Source', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_Applicant_Details
        ADD CONSTRAINT CK_Applicant_Details_Application_Source
            CHECK (Application_Source IN ('CPGRAMS', 'CM Dashboard', 'Sahyog Portal', 'PMO Grievance Portal', 'Offline', 'Other'));
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Applicant_Details_Application_Source')
    CREATE INDEX IX_Applicant_Details_Application_Source ON dbo.Tbl_Applicant_Details(Application_Source);
GO

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
    @DocumentPath VARCHAR(200) = NULL,
    @Application_Source VARCHAR(50) = NULL,
    @CreatedBy VARCHAR(50) = NULL,
    @CreatedIp VARCHAR(50) = NULL,
    @Is_Active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
	declare   @NewID BIGINT =0,
    @Message NVARCHAR(500) =''
        IF @Application_Date IS NULL
            SET @Application_Date = GETDATE();

        IF @Application_Source IS NULL OR LTRIM(RTRIM(@Application_Source)) = ''
            SET @Application_Source = 'Offline';

        INSERT INTO [dbo].[Tbl_Applicant_Details]
        (
            [Applicant_Name],
            [Father_Husband_Name],
            [Mobile_Number],
            [Mobile_Number2],
            [Address],
            [Pin_Code],
            [Email_Id],
            [Application_Date],
            [Village],
            [Panchayat],
            [Block],
            [District],
            [DocumentPath],
            [Application_Source],
            [CreatedDate],
            [CreatedBy],
            [CreatedIp],
            [Is_Active]
        )
        VALUES
        (
            @Applicant_Name,
            @Father_Husband_Name,
            @Mobile_Number,
            @Mobile_Number2,
            @Address,
            @Pin_Code,
            @Email_Id,
            @Application_Date,
            @Village,
            @Panchayat,
            @Block,
            @District,
            @DocumentPath,
            @Application_Source,
            GETDATE(),
            @CreatedBy,
            @CreatedIp,
            @Is_Active
        );

        SET @NewID = SCOPE_IDENTITY();
        SET @Message = 'Applicant details saved successfully.';
    END TRY
    BEGIN CATCH
        SET @NewID = 0;
        SET @Message = ERROR_MESSAGE();
    END CATCH

	select @NewID as Flag,@Message  as Message
END
GO

CREATE OR ALTER PROC usp_getApplicant
AS
BEGIN
    SELECT t.ID, t.Applicant_Name, t.Father_Husband_Name, t.Mobile_Number, t.Mobile_Number2, t.Address,
           t.Pin_Code, t.Email_Id, t.Application_Date, v.VILLNAME, pt.PanchayatName, b.BlockName,
           d.DISTRICTNAME, t.DocumentPath, t.Application_Source
    FROM Tbl_Applicant_Details t
    INNER JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    INNER JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    INNER JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    INNER JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
    WHERE t.Is_Active = 1
    ORDER BY t.ID DESC
END
GO

CREATE OR ALTER PROC usp_getApplicantstatus
    @District int = 0,
    @Id bigint = 0,
    @status varchar(100) = ''
AS
BEGIN
    SELECT t.ID, t.Applicant_Name, t.Father_Husband_Name, t.Mobile_Number, t.Mobile_Number2, t.Address,
           t.Pin_Code, t.Email_Id, t.Application_Date, v.VILLNAME, pt.PanchayatName, b.BlockName,
           d.DISTRICTNAME, t.DocumentPath, t.Application_Source
    FROM Tbl_Applicant_Details t
    INNER JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    INNER JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    INNER JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    INNER JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
    WHERE t.Is_Active = 1
      AND (t.District = @District OR @District = 0)
      AND (t.ID = @Id OR @Id = 0)
      AND (t.Status = @status OR @status = '')
    ORDER BY t.ID DESC
END
GO

-- Example report: application count per source (optionally filter by Application_Date range)
-- SELECT Application_Source, COUNT(*) AS Total
-- FROM Tbl_Applicant_Details WHERE Is_Active = 1
-- GROUP BY Application_Source ORDER BY Total DESC;
