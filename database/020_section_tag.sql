/* Section tagging (Principal Secretary's meeting): when Admin forwards an application to a district-level / regional
   authority (DM, SP, Commissioner, IG, DIG), it may also tag the concerned section of the Home Department
   (Mst_Prashakha, e.g. Special(Prashakha-C) for Kabristan). The tagged section's login (Prashakha-C) then sees the
   application in its Forwarded Applications list and Pendency Report, to monitor its status and follow up with the
   district. The section only views it: the DM / SP still acts on it and closes it.

   One row per (application, section). Saved together with the forward by the API, never changed afterwards.

   Safe to run more than once.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 020_section_tag.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JanshikayatDB -E -C -f 65001 -b -i 020_section_tag.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Tbl_Applicant_Forward', 'U') IS NULL
   OR OBJECT_ID('dbo.Mst_Prashakha', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Tbl_Applicant_Section_Tag', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tbl_Applicant_Section_Tag (
        ID             bigint IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Applicant_Section_Tag PRIMARY KEY,
        ApplicantId    bigint        NOT NULL CONSTRAINT FK_Applicant_Section_Tag_Applicant REFERENCES dbo.Tbl_Applicant_Details (ID),
        PrashakhaId    int           NOT NULL,   -- Mst_Prashakha.ID (a float there, so no foreign key)
        PrashakhaLabel nvarchar(200) NOT NULL,
        TaggedBy       varchar(100)  NOT NULL,
        TaggedIp       varchar(50)   NULL,
        TaggedDate     datetime      NOT NULL CONSTRAINT DF_Applicant_Section_Tag_TaggedDate DEFAULT (GETDATE())
    );
    CREATE UNIQUE INDEX UX_Applicant_Section_Tag ON dbo.Tbl_Applicant_Section_Tag (ApplicantId, PrashakhaId);
    -- A section's list: its tagged applications
    CREATE INDEX IX_Applicant_Section_Tag_Prashakha ON dbo.Tbl_Applicant_Section_Tag (PrashakhaId) INCLUDE (ApplicantId);
    PRINT '020 done: Tbl_Applicant_Section_Tag created.';
END
ELSE
    PRINT '020: Tbl_Applicant_Section_Tag already exists, nothing changed.';
GO
SET NOEXEC OFF;
GO
