/* Responses for DM / SP: a remark by an office below a DM / SP (SDO, DCLR, DSP/SDPO, CO, थाना) is also a response
   to that DM / SP, shown on its "प्राप्त प्रतिवेदन" page with its own "new" badge (Admin keeps seeing every response).

   Tbl_Applicant_Remarks gets:
     NotifyOfficeId / NotifyUnitCode : the DM (2) / SP (5) the remark is for; NULL for remarks by Admin, branches,
                                       sections, Commissioner / IG / DIG / DM / SP themselves
     SeenByNotifyOfficeDate          : when that DM / SP opened it (like SeenByAdminDate for Admin)
   dbo.fn_Remark_NotifyOffice(ApplicantId, writer Office_Id, writer Unit_Code) finds that DM / SP: it walks up the
   application's forward chain from the forward that reached the writer (Tbl_Applicant_Reforward.ParentReforwardId)
   to the first hop sent by a DM / SP. E.g. CO Araria <- SDO Araria <- DM Araria: the remark goes to DM Araria.
   The backend fills the columns when a remark is saved; this script fills them for remarks already there.

   Safe to run more than once. Needs 010_co_thana_forward.sql first.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 012_dm_sp_responses.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 012_dm_sp_responses.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Tbl_Applicant_Remarks', 'U') IS NULL
   OR COL_LENGTH('dbo.Tbl_Applicant_Reforward', 'ParentReforwardId') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 010_co_thana_forward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

/* ---------- Step 1: columns ---------- */
BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.Tbl_Applicant_Remarks', 'NotifyOfficeId') IS NULL
        ALTER TABLE dbo.Tbl_Applicant_Remarks ADD NotifyOfficeId int NULL;
    IF COL_LENGTH('dbo.Tbl_Applicant_Remarks', 'NotifyUnitCode') IS NULL
        ALTER TABLE dbo.Tbl_Applicant_Remarks ADD NotifyUnitCode int NULL;
    IF COL_LENGTH('dbo.Tbl_Applicant_Remarks', 'SeenByNotifyOfficeDate') IS NULL
        ALTER TABLE dbo.Tbl_Applicant_Remarks ADD SeenByNotifyOfficeDate datetime NULL;

    COMMIT TRANSACTION;
    PRINT 'Step 1 done: Tbl_Applicant_Remarks.NotifyOfficeId / NotifyUnitCode / SeenByNotifyOfficeDate.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e1 nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('Step 1 failed and was rolled back; later steps were skipped: %s', 16, 1, @e1) WITH NOWAIT;
    SET NOEXEC ON;
END CATCH
GO

/* ---------- Step 2: the DM / SP above a writer (CREATE OR ALTER: same definition on every run) ---------- */
CREATE OR ALTER FUNCTION dbo.fn_Remark_NotifyOffice (@ApplicantId bigint, @OfficeId int, @UnitCode int)
RETURNS TABLE
AS RETURN
    WITH up AS (
        -- The forward that brought the application to the writer (an office reaches an application once)
        SELECT rf.ParentReforwardId, rf.FromOfficeId, rf.FromOfficeUnitCode, 0 AS Depth
        FROM dbo.Tbl_Applicant_Reforward rf
        WHERE rf.ApplicantId = @ApplicantId AND rf.ToOfficeId = @OfficeId AND rf.ToOfficeUnitCode = @UnitCode
        UNION ALL
        SELECT p.ParentReforwardId, p.FromOfficeId, p.FromOfficeUnitCode, up.Depth + 1
        FROM dbo.Tbl_Applicant_Reforward p
        JOIN up ON p.ID = up.ParentReforwardId
    )
    SELECT TOP 1 FromOfficeId AS NotifyOfficeId, FromOfficeUnitCode AS NotifyUnitCode
    FROM up
    WHERE FromOfficeId IN (2, 5)
    ORDER BY Depth;
GO

/* ---------- Step 3: remarks already saved, and an index for the DM / SP pages ---------- */
BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE m SET m.NotifyOfficeId = n.NotifyOfficeId, m.NotifyUnitCode = n.NotifyUnitCode
    FROM dbo.Tbl_Applicant_Remarks m
    CROSS APPLY (SELECT TOP 1 u.Office_Id, u.Office_Unit_Code FROM dbo.Tbl_UserLogin u WHERE u.UserName = m.RemarkBy) w
    CROSS APPLY dbo.fn_Remark_NotifyOffice(m.ApplicantId, w.Office_Id, w.Office_Unit_Code) n
    WHERE m.NotifyOfficeId IS NULL AND w.Office_Id IN (6, 7, 8, 9, 10);
    PRINT CONCAT('Step 3: ', @@ROWCOUNT, ' existing remark(s) linked to their DM / SP.');

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Applicant_Remarks_Notify'
                     AND object_id = OBJECT_ID('dbo.Tbl_Applicant_Remarks'))
        CREATE INDEX IX_Applicant_Remarks_Notify
            ON dbo.Tbl_Applicant_Remarks (NotifyOfficeId, NotifyUnitCode, ApplicantId)
            INCLUDE (SeenByNotifyOfficeDate, CreatedDate);

    COMMIT TRANSACTION;
    PRINT 'Step 3 done.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e3 nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('Step 3 failed and was rolled back: %s', 16, 1, @e3) WITH NOWAIT;
    SET NOEXEC ON;
END CATCH
GO

PRINT '012 done: remarks from SDO / DCLR / SDPO / CO / थाना now reach their DM / SP.';
GO
SET NOEXEC OFF;
GO
