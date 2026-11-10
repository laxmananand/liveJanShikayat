/* Fourth forward level: SDO / DCLR -> CO (अंचल अधिकारी) of their subdivision, DSP / SDPO -> थाना under it.

   Adds two office kinds (Mst_Regional_Office 9 = CO, 10 = THANA) and their roles (Mst_Role CO / Thana), lets
   Tbl_Applicant_Reforward carry forwards to them, and adds them to vw_Office_Unit / vw_Office_Hierarchy:
     CO    = one per anchal (Blocks.BlockCode, the same code Tbl_Applicant_Details.Block holds), under BOTH the SDO and
             the DCLR of its subdivision (Blocks.SubDivCode). An application reaches a CO only once: whichever of SDO /
             DCLR sends first (UX_Applicant_Reforward_Applicant_To_Unit).
     THANA = one per police station (mst_thana.PS_Code, as in Tbl_Applicant_Details.Thana), under its SDPO
             (Mst_Thana_SDPO from 005). Police stations with no SDPO there are not reachable yet.
   CO / थाना are the last level: they receive, add remarks (optional PDF up to 5 MB) and cannot forward further.
   No office lists are copied: the views read Blocks and mst_thana, which this database already has.

   Logins are in 011_co_thana_logins.sql.

   Every step is its own transaction and checks whether it already ran: safe to run more than once. If a step fails,
   it is rolled back completely and no later step runs (SET NOEXEC ON); fix the cause and run the whole file again.
   Needs 005_sdo_dclr_sdpo_forward.sql first.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -b -i 010_co_thana_forward.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -b -i 010_co_thana_forward.sql */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('JanshikayatDB', 'JansikayatDB')
   OR OBJECT_ID('dbo.Mst_SDPO_Office', 'U') IS NULL
   OR OBJECT_ID('dbo.Mst_Thana_SDPO', 'U') IS NULL
   OR OBJECT_ID('dbo.vw_Office_Hierarchy', 'V') IS NULL
   OR OBJECT_ID('dbo.Blocks', 'U') IS NULL
   OR OBJECT_ID('dbo.mst_thana', 'U') IS NULL
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR('Connected to %s: run this in the Jan Shikayat app database, after 005_sdo_dclr_sdpo_forward.sql. Nothing was changed.', 16, 1, @db) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

/* ---------- Step 1: office kinds and roles ---------- */
BEGIN TRY
    BEGIN TRANSACTION;

    -- Office_Id must mean the same thing everywhere: stop if 9 / 10 are already used for something else
    IF EXISTS (SELECT 1 FROM dbo.Mst_Regional_Office o
               JOIN (VALUES (9, 'CO'), (10, 'THANA')) v (Office_Id, Unique_Code) ON v.Office_Id = o.Office_Id
               WHERE o.Unique_Code <> v.Unique_Code)
        THROW 50001, 'Mst_Regional_Office.Office_Id 9 or 10 is already used by another office kind.', 1;

    -- Is_Active = 0: reached only through an SDO / DCLR / SDPO, never picked by Admin's forward popup
    INSERT INTO dbo.Mst_Regional_Office (Office_Id, Category_Id, Regional_Office, Unique_Code, Is_Active)
    SELECT v.Office_Id, 2, v.Name, v.Unique_Code, 0
    FROM (VALUES (9, N'Circle Officer', 'CO'),
                 (10, N'Police Station', 'THANA')) v (Office_Id, Name, Unique_Code)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_Regional_Office o WHERE o.Office_Id = v.Office_Id);

    -- The role name is what the JWT carries and the frontend maps
    INSERT INTO dbo.Mst_Role (Role, RoleDesc)
    SELECT v.Role, v.RoleDesc
    FROM (VALUES ('CO', 'Circle Officer (Anchal Adhikari)'),
                 ('Thana', 'Police Station (Thana)')) v (Role, RoleDesc)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_Role r WHERE r.Role = v.Role);

    COMMIT TRANSACTION;
    PRINT 'Step 1 done: office kinds 9 (CO), 10 (THANA) and their roles.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e1 nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('Step 1 failed and was rolled back; later steps were skipped: %s', 16, 1, @e1) WITH NOWAIT;
    SET NOEXEC ON;
END CATCH
GO

/* ---------- Step 2: Tbl_Applicant_Reforward accepts CO / THANA as receivers ---------- */
BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Applicant_Reforward_To'
                 AND parent_object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward')
                 AND definition NOT LIKE '%(10)%')
        ALTER TABLE dbo.Tbl_Applicant_Reforward DROP CONSTRAINT CK_Applicant_Reforward_To;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Applicant_Reforward_To'
                     AND parent_object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward'))
        ALTER TABLE dbo.Tbl_Applicant_Reforward WITH CHECK
            ADD CONSTRAINT CK_Applicant_Reforward_To CHECK (ToOfficeId IN (2, 5, 6, 7, 8, 9, 10));

    COMMIT TRANSACTION;
    PRINT 'Step 2 done: Tbl_Applicant_Reforward receivers 9 / 10.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @e2 nvarchar(2048) = ERROR_MESSAGE();
    RAISERROR('Step 2 failed and was rolled back; later steps were skipped: %s', 16, 1, @e2) WITH NOWAIT;
    SET NOEXEC ON;
END CATCH
GO

/* ---------- Step 3: views (CREATE OR ALTER: re-running replaces them with the same definition) ---------- */

-- CO offices: one per anchal, e.g. "CO Office, Ramnagar, W CHAMPARAN"
CREATE OR ALTER VIEW dbo.vw_CO_Office AS
    SELECT CAST(b.BlockCode AS int) AS CO_Code, CAST(b.SubDivCode AS int) AS SD_Code, b.DistCode AS Dist_Code,
           CAST(N'CO Office, ' + LTRIM(RTRIM(b.BlockName))
                + ISNULL(N', ' + LTRIM(RTRIM(d.DISTRICTNAME)), N'') AS nvarchar(200)) AS Head
    FROM dbo.Blocks b
    LEFT JOIN dbo.mst_Commissionary_Districts d ON d.DISTRICTCODE = b.DistCode;
GO

-- Police stations reachable from an SDPO, e.g. "Thana Sikandara, Jamui"
CREATE OR ALTER VIEW dbo.vw_Thana_Office AS
    SELECT CAST(t.PS_Code AS int) AS PS_Code, ts.SDPO_Code,
           CAST(N'Thana ' + LTRIM(RTRIM(REPLACE(REPLACE(t.Police_Station, CHAR(13), ' '), CHAR(10), ' ')))
                + ISNULL(N', ' + LTRIM(RTRIM(t.District)), N'') AS nvarchar(200)) AS Head
    FROM dbo.mst_thana t
    JOIN dbo.Mst_Thana_SDPO ts ON ts.PS_Code = t.PS_Code;
GO

-- Every office under a regional office, in one shape (forward popup, its save check, remark writer's office)
CREATE OR ALTER VIEW dbo.vw_Office_Unit AS
    SELECT Office_Id, Division_Code AS Unit_Code, Head AS Unit_Name FROM dbo.Mst_Commissioner
    UNION ALL
    SELECT Office_Id, Dist_Code, Head FROM dbo.Mst_DM_Office
    UNION ALL
    SELECT DISTINCT Office_Id, Range_Code, Head FROM dbo.Mst_IG_DIG_Office
    UNION ALL
    SELECT Office_Id, SP_Code, Head FROM dbo.Mst_SP_Office
    UNION ALL
    SELECT 6, SD_Code, Head FROM dbo.Mst_SDO_Office
    UNION ALL
    SELECT 7, SD_Code, Head FROM dbo.Mst_DCLR_Office
    UNION ALL
    SELECT 8, SDPO_Code, Head FROM dbo.Mst_SDPO_Office
    UNION ALL
    SELECT 9, CO_Code, Head FROM dbo.vw_CO_Office
    UNION ALL
    SELECT 10, PS_Code, Head FROM dbo.vw_Thana_Office;
GO

-- Which office each office may forward to: each office with the office directly above it.
-- A CO has two rows (under the SDO and under the DCLR of its subdivision).
CREATE OR ALTER VIEW dbo.vw_Office_Hierarchy AS
    SELECT 6 AS Office_Id, SD_Code AS Unit_Code, Head AS Unit_Name, 2 AS Parent_Office_Id, Dist_Code AS Parent_Unit_Code
    FROM dbo.Mst_SDO_Office
    UNION ALL
    SELECT 7, SD_Code, Head, 2, Dist_Code FROM dbo.Mst_DCLR_Office
    UNION ALL
    SELECT 8, SDPO_Code, Head, 5, SP_Code FROM dbo.Mst_SDPO_Office
    UNION ALL
    SELECT 9, c.CO_Code, c.Head, 6, c.SD_Code FROM dbo.vw_CO_Office c
    WHERE EXISTS (SELECT 1 FROM dbo.Mst_SDO_Office o WHERE o.SD_Code = c.SD_Code)
    UNION ALL
    SELECT 9, c.CO_Code, c.Head, 7, c.SD_Code FROM dbo.vw_CO_Office c
    WHERE EXISTS (SELECT 1 FROM dbo.Mst_DCLR_Office o WHERE o.SD_Code = c.SD_Code)
    UNION ALL
    SELECT 10, PS_Code, Head, 8, SDPO_Code FROM dbo.vw_Thana_Office;
GO

-- What was added
SELECT 'CO offices' AS Item, COUNT(*) AS Rows FROM dbo.vw_CO_Office
UNION ALL SELECT 'CO under SDO', COUNT(*) FROM dbo.vw_Office_Hierarchy WHERE Office_Id = 9 AND Parent_Office_Id = 6
UNION ALL SELECT 'CO under DCLR', COUNT(*) FROM dbo.vw_Office_Hierarchy WHERE Office_Id = 9 AND Parent_Office_Id = 7
UNION ALL SELECT 'Thana under SDPO', COUNT(*) FROM dbo.vw_Office_Hierarchy WHERE Office_Id = 10
UNION ALL SELECT 'Thanas with no SDPO (not reachable)', COUNT(*) FROM dbo.mst_thana t
          WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_Thana_SDPO ts WHERE ts.PS_Code = t.PS_Code);
GO

PRINT '010 done: SDO / DCLR can forward to CO, DSP / SDPO to थाना. Next: 011_co_thana_logins.sql.';
GO
SET NOEXEC OFF;
GO
