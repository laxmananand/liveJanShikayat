-- The four application statuses: Registered -> Forwarded -> Pending -> Disposed.
-- No status is stored, so no table changes and no data migration are needed. Each one follows from the workflow's rows:
--   Registered: in Tbl_Applicant_Details, no Tbl_Applicant_Forward row
--   Forwarded : forwarded, no reply from the receiving office
--   Pending   : the office replied (a Tbl_Applicant_Remarks row by a role other than Admin), waiting for Admin to close it
--   Disposed  : closed by Admin (a Tbl_Applicant_Closure row)
-- The same rule is in Complain.StatusCase (backend). Tbl_Applicant_Details.Status is not used by anything any more.
-- This script only makes usp_getApplicantstatus filter by that rule (it compared @status with the unused column,
-- which is always NULL). Run after Thana.sql and Application_Closure.sql. Safe to re-run.

USE Jansikayat_DB;
GO

-- @Application_No: look up one application by its tracking number ('' = all)
-- @status: Registered | Forwarded | Pending | Disposed ('' = all)
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
    LEFT JOIN Tbl_Applicant_Forward f ON f.ApplicantId = t.ID
    LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = t.ID
    OUTER APPLY (SELECT MIN(m.CreatedDate) AS FirstResponseAt
                 FROM Tbl_Applicant_Remarks m
                 WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> 'Admin') r
    WHERE t.Is_Active = 1
      AND (t.District = @District OR @District = 0)
      AND (t.ID = @Id OR @Id = 0)
      AND (@status = ''
           OR @status = CASE WHEN c.ID IS NOT NULL THEN 'Disposed'
                             WHEN f.ID IS NULL THEN 'Registered'
                             WHEN r.FirstResponseAt IS NOT NULL THEN 'Pending'
                             ELSE 'Forwarded' END)
      AND (t.Application_No = @Application_No OR ISNULL(@Application_No, '') = '')
    ORDER BY t.ID DESC
END
GO
