-- Role-based access: forwarding (Admin only) and remarks (all logged-in users) on applications.
-- Roles already exist in Mst_Role (1 = Saction, 2 = Admin, 3 = Branch); no change needed there.
-- Safe to re-run: each table is created only if it does not exist yet.

USE Jansikayat_DB;
GO

-- Every forwarding of an application; the latest row per ApplicantId is its current forward.
IF OBJECT_ID('dbo.Tbl_Applicant_Forward', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_Applicant_Forward
    (
        ID                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tbl_Applicant_Forward PRIMARY KEY,
        ApplicantId        BIGINT        NOT NULL CONSTRAINT FK_Applicant_Forward_Applicant
                                                  REFERENCES dbo.Tbl_Applicant_Details(ID),
        CategoryId         VARCHAR(50)   NOT NULL,
        CategoryLabel      NVARCHAR(200) NOT NULL,
        BranchId           VARCHAR(50)   NOT NULL,
        BranchLabel        NVARCHAR(300) NOT NULL,
        ComplaintTypeId    VARCHAR(50)   NOT NULL,
        ComplaintTypeLabel NVARCHAR(300) NOT NULL,
        Remarks            NVARCHAR(500) NULL,
        ForwardedBy        VARCHAR(100)  NOT NULL,
        ForwardedIp        VARCHAR(50)   NULL,
        ForwardedDate      DATETIME      NOT NULL CONSTRAINT DF_Applicant_Forward_Date DEFAULT GETDATE()
    );
    CREATE INDEX IX_Applicant_Forward_ApplicantId ON dbo.Tbl_Applicant_Forward(ApplicantId);
END
GO

-- Remarks any logged-in user (Admin, Saction, Branch) adds on an application.
IF OBJECT_ID('dbo.Tbl_Applicant_Remarks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_Applicant_Remarks
    (
        ID           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tbl_Applicant_Remarks PRIMARY KEY,
        ApplicantId  BIGINT         NOT NULL CONSTRAINT FK_Applicant_Remarks_Applicant
                                             REFERENCES dbo.Tbl_Applicant_Details(ID),
        Remark       NVARCHAR(1000) NOT NULL,
        RemarkBy     VARCHAR(100)   NOT NULL,
        RemarkByRole VARCHAR(50)    NULL,
        CreatedIp    VARCHAR(50)    NULL,
        CreatedDate  DATETIME       NOT NULL CONSTRAINT DF_Applicant_Remarks_Date DEFAULT GETDATE()
    );
    CREATE INDEX IX_Applicant_Remarks_ApplicantId ON dbo.Tbl_Applicant_Remarks(ApplicantId);
END
GO
