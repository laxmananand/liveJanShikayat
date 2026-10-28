-- Closing (disposing) forwarded applications, and Admin's notifications of replies from the receiving offices.
-- An application with a row in Tbl_Applicant_Closure is "Disposed"; without one it is still "Pending".
-- A reply is a remark on a forwarded application by any role other than Admin; SeenByAdminDate is set when
-- Admin opens it from the प्राप्त प्रतिवेदन (Responses) page, so unseen replies drive the sidebar badge.
-- Safe to re-run: each object is created only if it does not exist yet.

USE Jansikayat_DB;
GO

IF OBJECT_ID('dbo.Tbl_Applicant_Closure', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_Applicant_Closure
    (
        ID             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tbl_Applicant_Closure PRIMARY KEY,
        ApplicantId    BIGINT         NOT NULL CONSTRAINT FK_Applicant_Closure_Applicant
                                               REFERENCES dbo.Tbl_Applicant_Details(ID),
        ClosureRemarks NVARCHAR(1000) NULL,
        ClosedBy       VARCHAR(100)   NOT NULL,
        ClosedIp       VARCHAR(50)    NULL,
        ClosedDate     DATETIME       NOT NULL CONSTRAINT DF_Applicant_Closure_Date DEFAULT GETDATE()
    );
END
GO

-- An application is closed only once.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Applicant_Closure_ApplicantId')
    CREATE UNIQUE INDEX UX_Applicant_Closure_ApplicantId ON dbo.Tbl_Applicant_Closure(ApplicantId);
GO

IF COL_LENGTH('dbo.Tbl_Applicant_Remarks', 'SeenByAdminDate') IS NULL
    ALTER TABLE dbo.Tbl_Applicant_Remarks ADD SeenByAdminDate DATETIME NULL;
GO
