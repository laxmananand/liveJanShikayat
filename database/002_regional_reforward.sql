/* Regional officers (Commissioner / IG / DIG) forward an application they received onward to the DM and / or SP
   of their jurisdiction. One row per onward forward; at most one DM and one SP per application.
   Safe to run more than once. Existing tables are not changed.
   Run in SSMS or: sqlcmd -S <server> -E -C -f 65001 -b -i 002_regional_reforward.sql */
USE JansikayatDB;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.Tbl_Applicant_Reforward') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_Applicant_Reforward
    (
        ID                 bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tbl_Applicant_Reforward PRIMARY KEY,
        ApplicantId        bigint        NOT NULL,
        -- The forward (Admin -> regional office) this one continues
        ForwardId          bigint        NOT NULL,
        -- Sender: Mst_Regional_Office.Office_Id 1 (Commissioner), 3 (IG) or 4 (DIG) and its vw_Office_Unit.Unit_Code
        FromOfficeId       int           NOT NULL,
        FromOfficeUnitCode int           NOT NULL,
        FromOfficeLabel    nvarchar(300) NOT NULL,
        -- Receiver: 2 (DM, Mst_DM_Office.Dist_Code) or 5 (SP, Mst_SP_Office.SP_Code)
        ToOfficeId         int           NOT NULL,
        ToOfficeUnitCode   int           NOT NULL,
        ToOfficeLabel      nvarchar(300) NOT NULL,
        Remarks            nvarchar(500) NULL,
        ForwardedBy        varchar(100)  NOT NULL,
        ForwardedIp        varchar(50)   NULL,
        ForwardedDate      datetime      NOT NULL CONSTRAINT DF_Applicant_Reforward_Date DEFAULT (GETDATE()),
        CONSTRAINT CK_Applicant_Reforward_To CHECK (ToOfficeId IN (2, 5))
    );
END
GO

-- One DM and one SP per application
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Applicant_Reforward_Applicant_To' AND object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward'))
    CREATE UNIQUE INDEX UX_Applicant_Reforward_Applicant_To ON dbo.Tbl_Applicant_Reforward (ApplicantId, ToOfficeId);
GO

-- DM / SP logins look up what was forwarded to them
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Applicant_Reforward_To' AND object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward'))
    CREATE INDEX IX_Applicant_Reforward_To ON dbo.Tbl_Applicant_Reforward (ToOfficeId, ToOfficeUnitCode) INCLUDE (ApplicantId);
GO
