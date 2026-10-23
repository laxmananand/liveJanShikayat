-- Police station (thana) on applications.
--   Tbl_Applicant_Details.Thana holds mst_thana.PS_Code (unique); 0 / NULL = not selected (optional, like Village).
--   sp_InsertApplicantDetails saves it; usp_getApplicant / usp_getApplicantstatus return Thana + Police_Station.
-- Safe to re-run.
-- QUOTED_IDENTIFIER must be ON when the procedures are created: SQL Server stores it with each procedure,
-- and inserts into Tbl_Applicant_Details (filtered index UX_Applicant_Details_Application_No) fail without it.
-- sqlcmd defaults it to OFF, so run with:  sqlcmd -I -i Thana.sql

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE Jansikayat_DB;
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'Thana') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Details ADD Thana BIGINT NULL;
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
    @Thana BIGINT = NULL,
    @DocumentPath VARCHAR(200) = NULL,
    @Application_Source VARCHAR(50) = NULL,
    @CreatedBy VARCHAR(50) = NULL,
    @CreatedIp VARCHAR(50) = NULL,
    @Is_Active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

	declare   @NewID BIGINT =0,
    @Message NVARCHAR(500) ='',
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
            [Thana],
            [DocumentPath],
            [Application_Source],
            [Application_No],
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
            @Thana,
            @DocumentPath,
            @Application_Source,
            @Application_No,
            GETDATE(),
            @CreatedBy,
            @CreatedIp,
            @Is_Active
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

	select @NewID as Flag,@Message  as Message, @Application_No as Application_No
END
GO

CREATE OR ALTER PROC usp_getApplicant
AS
BEGIN
    SELECT t.ID, t.Application_No, t.Applicant_Name, t.Father_Husband_Name, t.Mobile_Number, t.Mobile_Number2, t.Address,
           t.Pin_Code, t.Email_Id, t.Application_Date, ISNULL(v.VILLNAME, '') AS VILLNAME,
           ISNULL(pt.PanchayatName, '') AS PanchayatName, ISNULL(b.BlockName, '') AS BlockName,
           ISNULL(d.DISTRICTNAME, '') AS DISTRICTNAME, t.DocumentPath, t.Application_Source,
           ISNULL(t.Thana, 0) AS Thana, ISNULL(th.Police_Station, '') AS Police_Station
    FROM Tbl_Applicant_Details t
    -- LEFT JOINs: village / thana are optional (saved as 0), and a missing master row must never hide an application
    LEFT JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    LEFT JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    LEFT JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
    LEFT JOIN mst_thana th ON th.PS_Code = t.Thana
    WHERE t.Is_Active = 1
    ORDER BY t.ID DESC
END
GO

-- @Application_No: look up one application by its tracking number ('' = all)
CREATE OR ALTER PROC usp_getApplicantstatus
    @District int = 0,
    @Id bigint = 0,
    @status varchar(100) = '',
    @Application_No varchar(30) = ''
AS
BEGIN
    SELECT t.ID, t.Application_No, t.Applicant_Name, t.Father_Husband_Name, t.Mobile_Number, t.Mobile_Number2, t.Address,
           t.Pin_Code, t.Email_Id, t.Application_Date, ISNULL(v.VILLNAME, '') AS VILLNAME,
           ISNULL(pt.PanchayatName, '') AS PanchayatName, ISNULL(b.BlockName, '') AS BlockName,
           ISNULL(d.DISTRICTNAME, '') AS DISTRICTNAME, t.DocumentPath, t.Application_Source,
           ISNULL(t.Thana, 0) AS Thana, ISNULL(th.Police_Station, '') AS Police_Station
    FROM Tbl_Applicant_Details t
    -- LEFT JOINs: village / thana are optional (saved as 0), and a missing master row must never hide an application
    LEFT JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    LEFT JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    LEFT JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
    LEFT JOIN mst_thana th ON th.PS_Code = t.Thana
    WHERE t.Is_Active = 1
      AND (t.District = @District OR @District = 0)
      AND (t.ID = @Id OR @Id = 0)
      AND (t.Status = @status OR @status = '')
      AND (t.Application_No = @Application_No OR ISNULL(@Application_No, '') = '')
    ORDER BY t.ID DESC
END
GO
