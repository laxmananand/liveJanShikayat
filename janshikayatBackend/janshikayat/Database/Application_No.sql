-- Application No: generated when an application is finalised, used everywhere to track it.
-- Format: 'JS' + District code (3 digits) + Block code (4) + serial within that block
--   e.g. District 230, Block 1414, 1st application -> JS23014140001
--   The serial is 4 digits up to 9999, then simply keeps counting: ...9999 -> ...10000 -> ...10001
-- Safe to re-run: the column/index are added only if missing; procedures are re-created with CREATE OR ALTER.

USE Jansikayat_DB;
GO

-- Required by the filtered unique index, and by every procedure that writes to the table
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Details', 'Application_No') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_Applicant_Details ADD Application_No VARCHAR(30) NULL;
END
GO

-- Number applications that have no number yet (or one in the old format without 'JS'),
-- in ID order per block, continuing after the highest serial already used in that block
;WITH pending AS
(
    SELECT t.Application_No,
           'JS' + RIGHT('000' + CAST(ISNULL(t.District, 0) AS VARCHAR(10)), 3)
                + RIGHT('0000' + CAST(ISNULL(t.Block, 0) AS VARCHAR(10)), 4) AS Prefix,
           ROW_NUMBER() OVER (PARTITION BY t.District, t.Block ORDER BY t.ID) AS Seq
    FROM dbo.Tbl_Applicant_Details t
    WHERE t.Application_No IS NULL OR t.Application_No NOT LIKE 'JS%'
),
numbered AS
(
    SELECT p.Application_No, p.Prefix,
           p.Seq + ISNULL((SELECT MAX(CAST(SUBSTRING(x.Application_No, 10, 10) AS INT))
                           FROM dbo.Tbl_Applicant_Details x
                           WHERE x.Application_No LIKE p.Prefix + '%' AND LEN(x.Application_No) >= 13), 0) AS Serial
    FROM pending p
)
UPDATE numbered
SET Application_No = Prefix + CASE WHEN Serial > 9999 THEN CAST(Serial AS VARCHAR(10))
                                   ELSE RIGHT('0000' + CAST(Serial AS VARCHAR(10)), 4) END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Applicant_Details_Application_No')
    CREATE UNIQUE INDEX UX_Applicant_Details_Application_No
        ON dbo.Tbl_Applicant_Details(Application_No) WHERE Application_No IS NOT NULL;
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
           ISNULL(d.DISTRICTNAME, '') AS DISTRICTNAME, t.DocumentPath, t.Application_Source
    FROM Tbl_Applicant_Details t
    -- LEFT JOINs: village is optional (saved as 0), and a missing master row must never hide an application
    LEFT JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    LEFT JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    LEFT JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
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
           ISNULL(d.DISTRICTNAME, '') AS DISTRICTNAME, t.DocumentPath, t.Application_Source
    FROM Tbl_Applicant_Details t
    -- LEFT JOINs: village is optional (saved as 0), and a missing master row must never hide an application
    LEFT JOIN mst_Commissionary_Districts d ON d.DISTRICTCODE = t.District
    LEFT JOIN Blocks b ON b.BlockCode = t.Block AND b.DistCode = t.District
    LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = t.Panchayat AND pt.BlockCode = t.Block AND pt.DistrictCode = t.District
    LEFT JOIN mst_VillageMaster v ON v.VILLCODE = t.Village AND v.BLOCKCODE = t.Block AND v.DISTCODE = t.District
    WHERE t.Is_Active = 1
      AND (t.District = @District OR @District = 0)
      AND (t.ID = @Id OR @Id = 0)
      AND (t.Status = @status OR @status = '')
      AND (t.Application_No = @Application_No OR ISNULL(@Application_No, '') = '')
    ORDER BY t.ID DESC
END
GO
