/* Deployment check for 001_entry_page_location.sql and 002_regional_reforward.sql.
   Read-only: it changes nothing, so it can be run any number of times, before or after the other scripts.
     - Before 001/002: every "Prerequisite" row must be OK. If one is MISSING, do not run 001/002.
     - After 001/002:  every row must be OK.
   Run in SSMS (F5, nothing selected) or: sqlcmd -S <server> -E -C -f 65001 -i 003_verify_deploy.sql */
USE JansikayatDB;
GO
SET NOCOUNT ON;
GO

SELECT c.Step, c.Item,
       CASE WHEN c.Present = 1 THEN 'OK' ELSE 'MISSING' END AS Status
FROM (VALUES
    /* Prerequisites: must already exist on the server (used by the new API and by 001/002) */
    (1, 'Prerequisite', 'Table SubDivisions',                     IIF(OBJECT_ID('dbo.SubDivisions', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table mst_Wards',                        IIF(OBJECT_ID('dbo.mst_Wards', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table PanchayatVillage',                 IIF(OBJECT_ID('dbo.PanchayatVillage', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Blocks',                           IIF(OBJECT_ID('dbo.Blocks', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table mst_Panchayats',                   IIF(OBJECT_ID('dbo.mst_Panchayats', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table mst_VillageMaster',                IIF(OBJECT_ID('dbo.mst_VillageMaster', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table mst_Commissionary_Districts',      IIF(OBJECT_ID('dbo.mst_Commissionary_Districts', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table mst_thana',                        IIF(OBJECT_ID('dbo.mst_thana', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Mst_Regional_Office',              IIF(OBJECT_ID('dbo.Mst_Regional_Office', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Mst_DM_Office',                    IIF(OBJECT_ID('dbo.Mst_DM_Office', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Mst_SP_Office',                    IIF(OBJECT_ID('dbo.Mst_SP_Office', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'View vw_Office_Unit',                    IIF(OBJECT_ID('dbo.vw_Office_Unit', 'V') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Tbl_Applicant_Details',            IIF(OBJECT_ID('dbo.Tbl_Applicant_Details', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Tbl_Applicant_Forward',            IIF(OBJECT_ID('dbo.Tbl_Applicant_Forward', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Table Tbl_Applicant_Closure',            IIF(OBJECT_ID('dbo.Tbl_Applicant_Closure', 'U') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Column Tbl_Applicant_Forward.OfficeUnitLabel', IIF(COL_LENGTH('dbo.Tbl_Applicant_Forward', 'OfficeUnitLabel') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Column Mst_DM_Office.Division_Code',     IIF(COL_LENGTH('dbo.Mst_DM_Office', 'Division_Code') IS NULL, 0, 1)),
    (1, 'Prerequisite', 'Column Mst_SP_Office.Range_Code',        IIF(COL_LENGTH('dbo.Mst_SP_Office', 'Range_Code') IS NULL, 0, 1)),

    /* Added by 001_entry_page_location.sql */
    (2, '001', 'Column Tbl_Applicant_Details.SubDivision',        IIF(COL_LENGTH('dbo.Tbl_Applicant_Details', 'SubDivision') IS NULL, 0, 1)),
    (2, '001', 'Column Tbl_Applicant_Details.AreaType',           IIF(COL_LENGTH('dbo.Tbl_Applicant_Details', 'AreaType') IS NULL, 0, 1)),
    (2, '001', 'Column Tbl_Applicant_Details.Ward',               IIF(COL_LENGTH('dbo.Tbl_Applicant_Details', 'Ward') IS NULL, 0, 1)),
    (2, '001', 'Column Tbl_Applicant_Details.Mohalla',            IIF(COL_LENGTH('dbo.Tbl_Applicant_Details', 'Mohalla') IS NULL, 0, 1)),
    (2, '001', 'sp_InsertApplicantDetails has @Mohalla parameter',
        IIF(EXISTS (SELECT 1 FROM sys.parameters WHERE object_id = OBJECT_ID('dbo.sp_InsertApplicantDetails') AND name = '@Mohalla'), 1, 0)),
    (2, '001', 'usp_getApplicant returns Mohalla',
        IIF(OBJECT_DEFINITION(OBJECT_ID('dbo.usp_getApplicant')) LIKE '%Mohalla%', 1, 0)),
    (2, '001', 'mst_thana has the 12 added police stations',
        IIF((SELECT COUNT(*) FROM dbo.mst_thana WHERE PS_Code IN (5102056, 5108025, 5108026, 5115026, 5115027, 5115028,
                                                                 5115029, 5115030, 5115031, 5130070, 5133041, 5802065)) = 12, 1, 0)),
    (2, '001', 'Index IX_mst_Wards_Panchayat',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_Wards') AND name = 'IX_mst_Wards_Panchayat'), 1, 0)),
    (2, '001', 'Index IX_PanchayatVillage_Panchayat',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PanchayatVillage') AND name = 'IX_PanchayatVillage_Panchayat'), 1, 0)),
    (2, '001', 'Index IX_VillageMaster_VILLCODE',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_VillageMaster') AND name = 'IX_VillageMaster_VILLCODE'), 1, 0)),
    (2, '001', 'Index IX_Panchayats_PanchayatCode',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.mst_Panchayats') AND name = 'IX_Panchayats_PanchayatCode'), 1, 0)),
    (2, '001', 'Old table MstThanaMapping removed',               IIF(OBJECT_ID('dbo.MstThanaMapping') IS NULL, 1, 0)),

    /* Added by 002_regional_reforward.sql */
    (3, '002', 'Table Tbl_Applicant_Reforward',                   IIF(OBJECT_ID('dbo.Tbl_Applicant_Reforward', 'U') IS NULL, 0, 1)),
    (3, '002', 'Index UX_Applicant_Reforward_Applicant_To',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward') AND name = 'UX_Applicant_Reforward_Applicant_To'), 1, 0)),
    (3, '002', 'Index IX_Applicant_Reforward_To',
        IIF(EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Tbl_Applicant_Reforward') AND name = 'IX_Applicant_Reforward_To'), 1, 0))
) c(SortOrder, Step, Item, Present)
ORDER BY c.SortOrder, c.Present, c.Item;
GO
