/* Read-only checks after 005_sdo_dclr_sdpo_forward.sql and 006_sdo_dclr_sdpo_logins.sql. Changes nothing.
   Every row should say OK; a FAIL row names what is missing.

   No USE line: connect to the app database first.
     Server: sqlcmd -S <server> -d JanshikayatDB -E -C -f 65001 -W -i 007_verify_sdo_dclr_sdpo.sql
     Local:  sqlcmd -S .\SQLEXPRESS -d JansikayatDB -E -C -f 65001 -W -i 007_verify_sdo_dclr_sdpo.sql */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.Mst_SDPO_Office', 'U') IS NULL OR OBJECT_ID('dbo.vw_Office_Hierarchy', 'V') IS NULL
BEGIN
    RAISERROR('005_sdo_dclr_sdpo_forward.sql has not run in this database.', 16, 1) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

DECLARE @c TABLE (Seq int IDENTITY, [Check] nvarchar(200), Expected nvarchar(50), Actual nvarchar(50), Ok bit);

INSERT INTO @c ([Check], Expected, Actual, Ok)
SELECT v.Name, v.Expected, v.Actual, IIF(v.Expected = v.Actual, 1, 0)
FROM (VALUES
    (N'Office kinds 6 / 7 / 8 in Mst_Regional_Office (inactive for Admin)', N'3',
        CAST((SELECT COUNT(*) FROM dbo.Mst_Regional_Office WHERE Office_Id IN (6, 7, 8) AND Is_Active = 0) AS nvarchar(50))),
    (N'Roles SDO / DCLR / SDPO in Mst_Role', N'3',
        CAST((SELECT COUNT(*) FROM dbo.Mst_Role WHERE Role IN ('SDO', 'DCLR', 'SDPO')) AS nvarchar(50))),
    (N'SDO offices (one per subdivision)', CAST((SELECT COUNT(*) FROM dbo.SubDivisions) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.Mst_SDO_Office) AS nvarchar(50))),
    (N'DCLR offices (one per subdivision)', CAST((SELECT COUNT(*) FROM dbo.SubDivisions) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.Mst_DCLR_Office) AS nvarchar(50))),
    (N'DSP / SDPO offices', N'159', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office) AS nvarchar(50))),
    (N'Police stations mapped to an SDPO', N'1192', CAST((SELECT COUNT(*) FROM dbo.Mst_Thana_SDPO) AS nvarchar(50))),
    (N'DM offices with no SDO / DCLR under them', N'0',
        CAST((SELECT COUNT(*) FROM dbo.Mst_DM_Office d WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_SDO_Office s WHERE s.Dist_Code = d.Dist_Code)) AS nvarchar(50))),
    (N'SP offices with no SDPO under them', N'0',
        CAST((SELECT COUNT(*) FROM dbo.Mst_SP_Office p WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_SDPO_Office s WHERE s.SP_Code = p.SP_Code)) AS nvarchar(50))),
    (N'SDPOs whose SP office does not exist', N'0',
        CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office s WHERE NOT EXISTS (SELECT 1 FROM dbo.Mst_SP_Office p WHERE p.SP_Code = s.SP_Code)) AS nvarchar(50))),
    (N'SDPOs under SP West Champaran (203)', N'3', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office WHERE SP_Code = 203) AS nvarchar(50))),
    (N'SDPOs under SP Bagaha (241): Bagaha, Ramnagar', N'2', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office WHERE SP_Code = 241) AS nvarchar(50))),
    (N'SDPOs under SP Bhagalpur (224)', N'5', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office WHERE SP_Code = 224) AS nvarchar(50))),
    (N'SDPOs under SP Naugachia (242): Naugachhia', N'1', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office WHERE SP_Code = 242) AS nvarchar(50))),
    (N'Tbl_Applicant_Reforward.ParentReforwardId column', N'1',
        CAST(IIF(COL_LENGTH('dbo.Tbl_Applicant_Reforward', 'ParentReforwardId') IS NULL, 0, 1) AS nvarchar(50))),
    (N'Reforward receivers allow SDO / DCLR / SDPO', N'1',
        CAST(IIF(EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Applicant_Reforward_To' AND definition LIKE '%(8)%'), 1, 0) AS nvarchar(50))),
    (N'vw_Office_Unit lists SDO + DCLR + SDPO offices',
        CAST((SELECT COUNT(*) FROM dbo.Mst_SDO_Office) + (SELECT COUNT(*) FROM dbo.Mst_DCLR_Office) + (SELECT COUNT(*) FROM dbo.Mst_SDPO_Office) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.vw_Office_Unit WHERE Office_Id IN (6, 7, 8)) AS nvarchar(50))),
    (N'Logins: SDO', CAST((SELECT COUNT(*) FROM dbo.Mst_SDO_Office) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.Tbl_UserLogin WHERE Office_Id = 6) AS nvarchar(50))),
    (N'Logins: DCLR', CAST((SELECT COUNT(*) FROM dbo.Mst_DCLR_Office) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.Tbl_UserLogin WHERE Office_Id = 7) AS nvarchar(50))),
    (N'Logins: DSP / SDPO', CAST((SELECT COUNT(*) FROM dbo.Mst_SDPO_Office) AS nvarchar(50)),
        CAST((SELECT COUNT(*) FROM dbo.Tbl_UserLogin WHERE Office_Id = 8) AS nvarchar(50))),
    (N'New logins whose role does not match their office', N'0',
        CAST((SELECT COUNT(*) FROM dbo.Tbl_UserLogin t JOIN dbo.Mst_Role r ON r.Id = t.Role
              WHERE t.Office_Id IN (6, 7, 8)
                AND r.Role <> CASE t.Office_Id WHEN 6 THEN 'SDO' WHEN 7 THEN 'DCLR' ELSE 'SDPO' END) AS nvarchar(50)))
) v (Name, Expected, Actual);

SELECT IIF(Ok = 1, 'OK', 'FAIL') AS Result, [Check], Expected, Actual FROM @c ORDER BY Seq;
SELECT IIF(MIN(CAST(Ok AS int)) = 1, 'ALL OK', 'SOMETHING FAILED: see the FAIL rows above') AS Summary FROM @c;
GO
SET NOEXEC OFF;
GO
