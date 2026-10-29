using janshikayat.BAL.Interfaces;
using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using janshikayat.Models;
using janshikayat.Data;
using Microsoft.AspNetCore.Mvc;

namespace janshikayat.BAL.Services
{
   
    public class Complain : IComplain
    {
        private readonly DapperContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IWebHostEnvironment _environment;

        public Complain(IConfiguration config, DapperContext context, IHttpContextAccessor httpContextAccessor, IWebHostEnvironment environment)
        {
            _config = config;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _environment = environment;
        }

        public (long Flag, string Message, string? ApplicationNo) SaveApplicant(TblApplicantDetails applicant,string DocumentPath)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@Applicant_Name", applicant.Applicant_Name);
            parameters.Add("@Father_Husband_Name", applicant.Father_Husband_Name);
            parameters.Add("@Mobile_Number", applicant.Mobile_Number);
            parameters.Add("@Mobile_Number2", applicant.Mobile_Number2);
            parameters.Add("@Address", applicant.Address);
            parameters.Add("@Pin_Code", applicant.Pin_Code);
            parameters.Add("@Email_Id", applicant.Email_Id);
            parameters.Add("@Application_Date", applicant.Application_Date);
            parameters.Add("@Village", applicant.Village);
            parameters.Add("@Panchayat", applicant.Panchayat);
            parameters.Add("@Block", applicant.Block);
            parameters.Add("@District", applicant.District);
            parameters.Add("@Thana", applicant.Thana);
            parameters.Add("@DocumentPath", DocumentPath);
            parameters.Add("@Application_Source", applicant.Application_Source);
            parameters.Add("@CreatedBy", applicant.CreatedBy);
            parameters.Add("@CreatedIp", applicant.CreatedIp);
            parameters.Add("@Is_Active", applicant.Is_Active ?? true);
            var result = conn.QueryFirstOrDefault<(long Flag, string Message, string? ApplicationNo)>(
                "sp_InsertApplicantDetails",
                parameters,
                commandType: CommandType.StoredProcedure
            );

            return result;
        }
        public IEnumerable<ApplicantDetailsDto> GetApplicants()
        {
            using var conn = _context.CreateConnection();

            var applicants = conn.Query<ApplicantDetailsDto>(
                "usp_getApplicant",
                commandType: CommandType.StoredProcedure
            );


            foreach (var item in applicants)
            {
                item.DocumentPath =
                    ConvertFileToBase64(item.DocumentPath);
            }
            return applicants;
        }
        public string? ConvertFileToBase64(string? filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                return null;

            try
            {
                // Remove starting /
                filePath = filePath.TrimStart('/');

                // wwwroot/BiharStateDisability/filename.pdf
                string fullPath = Path.Combine(
                    _environment.WebRootPath,
                    filePath.Replace("/", Path.DirectorySeparatorChar.ToString())
                );

                if (!System.IO.File.Exists(fullPath))
                    return null;

                byte[] fileBytes = System.IO.File.ReadAllBytes(fullPath);

                string extension = Path.GetExtension(fullPath).ToLowerInvariant();

                string contentType = extension switch
                {
                    ".pdf" => "application/pdf",
                    ".jpg" => "image/jpeg",
                    ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".gif" => "image/gif",
                    _ => "application/octet-stream"
                };

                return $"data:{contentType};base64,{Convert.ToBase64String(fileBytes)}";
            }
            catch
            {
                return null;
            }
        }

        public IEnumerable<ApplicantDetailsDto> GetApplicantstatus(ApplicantDetailsDtoRequestParam request)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@District", request.District);
            parameters.Add("@Id", request.ID);
            parameters.Add("@status", request.Status);
            parameters.Add("@Application_No", request.Application_No);

            var applicants = conn.Query<ApplicantDetailsDto>(
                "usp_getApplicantstatus",
                param: parameters,
                commandType: CommandType.StoredProcedure
            );


            foreach (var item in applicants)
            {
                item.DocumentPath =
                    ConvertFileToBase64(item.DocumentPath);
            }
            return applicants;
        }

        // Returns null when the application does not exist (or is inactive), or the
        // branch / complaint type does not match the Mst_Category -> Mst_Branch -> Mst_Complain_Sub_Type mapping
        public ApplicantForwardDto? ForwardApplicant(ApplicantForwardRequest request, string forwardedBy, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters(request);
            parameters.Add("@ForwardedBy", forwardedBy);
            parameters.Add("@ForwardedIp", ip);

            return conn.QueryFirstOrDefault<ApplicantForwardDto>(
                @"INSERT INTO Tbl_Applicant_Forward
                       (ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                        ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedIp,
                        PrashakhaId, PrashakhaLabel, OfficeId, OfficeLabel, OfficeUnitCode, OfficeUnitLabel)
                  OUTPUT inserted.ApplicantId, inserted.CategoryId, inserted.CategoryLabel, inserted.BranchId,
                         inserted.BranchLabel, inserted.ComplaintTypeId, inserted.ComplaintTypeLabel,
                         inserted.Remarks, inserted.ForwardedBy, inserted.ForwardedDate AS ForwardedAt,
                         inserted.PrashakhaId, inserted.PrashakhaLabel,
                         inserted.OfficeId, inserted.OfficeLabel, inserted.OfficeUnitCode, inserted.OfficeUnitLabel
                  SELECT @ApplicantId, @CategoryId, @CategoryLabel, @BranchId, @BranchLabel,
                         @ComplaintTypeId, @ComplaintTypeLabel, @Remarks, @ForwardedBy, @ForwardedIp,
                         @PrashakhaId, @PrashakhaLabel, @OfficeId, @OfficeLabel, @OfficeUnitCode, @OfficeUnitLabel
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND EXISTS (SELECT 1 FROM Mst_Branch b
                                WHERE b.Complain_id = TRY_CAST(@BranchId AS BIGINT) AND b.Is_Active = 1
                                  AND TRY_CAST(@CategoryId AS INT) IN (b.Home_Categ, b.Section_Categ, b.District_Categ))
                    AND EXISTS (SELECT 1 FROM Mst_Complain_Sub_Type s
                                WHERE s.Sub_Type_id = TRY_CAST(@ComplaintTypeId AS BIGINT)
                                  AND s.Complain_Id = TRY_CAST(@BranchId AS BIGINT))
                    -- Section needs a valid Prashakha; other categories must not carry one
                    AND (CASE WHEN EXISTS (SELECT 1 FROM Mst_Category c
                                           WHERE c.Category_Id = TRY_CAST(@CategoryId AS INT) AND c.Category = 'Section')
                              THEN CASE WHEN EXISTS (SELECT 1 FROM Mst_Prashakha p WHERE CAST(p.ID AS INT) = @PrashakhaId) THEN 1 ELSE 0 END
                              ELSE CASE WHEN @PrashakhaId IS NULL THEN 1 ELSE 0 END
                         END) = 1
                    -- District Administration needs a regional office of that category, plus one of its offices
                    -- when it has a list (IG / DIG / SP have none yet); other categories must not carry either
                    AND (CASE WHEN EXISTS (SELECT 1 FROM Mst_Category c
                                           WHERE c.Category_Id = TRY_CAST(@CategoryId AS INT) AND c.Category = 'District Administration')
                              THEN CASE WHEN EXISTS (SELECT 1 FROM Mst_Regional_Office o
                                                     WHERE o.Office_Id = @OfficeId AND o.Is_Active = 1
                                                       AND o.Category_Id = TRY_CAST(@CategoryId AS INT)
                                                       AND (CASE WHEN EXISTS (SELECT 1 FROM vw_Office_Unit u WHERE u.Office_Id = o.Office_Id)
                                                                 THEN CASE WHEN EXISTS (SELECT 1 FROM vw_Office_Unit u
                                                                                        WHERE u.Office_Id = o.Office_Id AND u.Unit_Code = @OfficeUnitCode)
                                                                           THEN 1 ELSE 0 END
                                                                 ELSE CASE WHEN @OfficeUnitCode IS NULL THEN 1 ELSE 0 END
                                                            END) = 1) THEN 1 ELSE 0 END
                              ELSE CASE WHEN @OfficeId IS NULL AND @OfficeUnitCode IS NULL THEN 1 ELSE 0 END
                         END) = 1",
                parameters);
        }

        // An application is forwarded only once (UX_Applicant_Forward_ApplicantId)
        public bool IsForwarded(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<bool>(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM Tbl_Applicant_Forward WHERE ApplicantId = @ApplicantId) THEN 1 ELSE 0 END",
                new { ApplicantId = applicantId });
        }

        // Oldest first, so the last row per application is its latest forward
        public IEnumerable<ApplicantForwardDto> GetForwards()
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantForwardDto>(
                @"SELECT f.ApplicantId, f.CategoryId, f.CategoryLabel, f.BranchId, f.BranchLabel,
                         f.ComplaintTypeId, f.ComplaintTypeLabel, f.Remarks, f.ForwardedBy, f.ForwardedDate AS ForwardedAt,
                         f.PrashakhaId, f.PrashakhaLabel, f.OfficeId, f.OfficeLabel, f.OfficeUnitCode, f.OfficeUnitLabel,
                         " + ClosureColumns + @"
                  FROM Tbl_Applicant_Forward f
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = f.ApplicantId
                  ORDER BY f.ForwardedDate, f.ID");
        }

        // Latest forward per application, newest first.
        // all = true: every forward (Admin); otherwise those sent to the user's branch or to the user's Prashakha.
        public IEnumerable<ApplicantForwardDto> GetLatestForwards(bool all, long? branchId, int? prashakhaId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantForwardDto>(
                @"SELECT x.ApplicantId, x.CategoryId, x.CategoryLabel, x.BranchId, x.BranchLabel,
                         x.ComplaintTypeId, x.ComplaintTypeLabel, x.Remarks, x.ForwardedBy, x.ForwardedDate AS ForwardedAt,
                         x.PrashakhaId, x.PrashakhaLabel, x.OfficeId, x.OfficeLabel, x.OfficeUnitCode, x.OfficeUnitLabel,
                         " + ClosureColumns + @"
                  FROM (SELECT f.*, ROW_NUMBER() OVER (PARTITION BY f.ApplicantId ORDER BY f.ForwardedDate DESC, f.ID DESC) AS rn
                        FROM Tbl_Applicant_Forward f) x
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = x.ApplicantId
                  WHERE x.rn = 1
                    AND (@All = 1
                         OR (@BranchId IS NOT NULL AND x.BranchId = CAST(@BranchId AS VARCHAR(50)))
                         OR (@PrashakhaId IS NOT NULL AND x.PrashakhaId = @PrashakhaId))
                  ORDER BY x.ForwardedDate DESC, x.ID DESC",
                new { All = all, BranchId = branchId, PrashakhaId = prashakhaId });
        }

        // Returns null when the application does not exist (or is inactive)
        public ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip, string? documentPath)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ApplicantId", request.ApplicantId);
            parameters.Add("@Remark", request.Remark.Trim());
            parameters.Add("@RemarkBy", remarkBy);
            parameters.Add("@RemarkByRole", role);
            parameters.Add("@CreatedIp", ip);
            parameters.Add("@DocumentPath", documentPath);

            return conn.QueryFirstOrDefault<ApplicantRemarkDto>(
                @"INSERT INTO Tbl_Applicant_Remarks (ApplicantId, Remark, RemarkBy, RemarkByRole, CreatedIp, DocumentPath)
                  OUTPUT inserted.ID, inserted.ApplicantId, inserted.Remark, inserted.RemarkBy,
                         inserted.RemarkByRole, inserted.CreatedDate,
                         CAST(CASE WHEN inserted.DocumentPath IS NULL THEN 0 ELSE 1 END AS BIT) AS HasDocument
                  SELECT @ApplicantId, @Remark, @RemarkBy, @RemarkByRole, @CreatedIp, @DocumentPath
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND NOT EXISTS (SELECT 1 FROM Tbl_Applicant_Closure WHERE ApplicantId = @ApplicantId)",
                parameters);
        }

        public IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantRemarkDto>(
                @"SELECT ID, ApplicantId, Remark, RemarkBy, RemarkByRole, CreatedDate,
                         CAST(CASE WHEN DocumentPath IS NULL THEN 0 ELSE 1 END AS BIT) AS HasDocument
                  FROM Tbl_Applicant_Remarks
                  WHERE ApplicantId = @ApplicantId
                  ORDER BY CreatedDate, ID",
                new { ApplicantId = applicantId });
        }

        // Stored file name of the PDF attached to a remark, or null when there is none
        public string? GetRemarkDocumentPath(long remarkId)
        {
            using var conn = _context.CreateConnection();

            return conn.QueryFirstOrDefault<string?>(
                "SELECT DocumentPath FROM Tbl_Applicant_Remarks WHERE ID = @ID",
                new { ID = remarkId });
        }

        // Public tracking: null when no active application has this number.
        // Each workflow step that has happened becomes a timeline entry; the last one is the current status.
        public PublicTrackingDto? TrackApplication(string applicationNo, string adminRole)
        {
            using var conn = _context.CreateConnection();

            var row = conn.QueryFirstOrDefault<PublicTrackingRow>(
                @"SELECT d.Application_No, d.CreatedDate,
                         f.ForwardedDate, f.BranchLabel, f.PrashakhaLabel, f.OfficeLabel, f.OfficeUnitLabel,
                         r.FirstResponseAt, c.ClosedDate
                  FROM Tbl_Applicant_Details d
                  LEFT JOIN Tbl_Applicant_Forward f ON f.ApplicantId = d.ID
                  OUTER APPLY (SELECT MIN(m.CreatedDate) AS FirstResponseAt
                               FROM Tbl_Applicant_Remarks m
                               WHERE m.ApplicantId = d.ID AND ISNULL(m.RemarkByRole, '') <> @AdminRole) r
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = d.ID
                  WHERE d.Application_No = @ApplicationNo AND d.Is_Active = 1",
                new { ApplicationNo = applicationNo, AdminRole = adminRole });
            if (row == null)
                return null;

            var registeredAt = row.CreatedDate ?? DateTime.Now;
            var timeline = new List<PublicTimelineEntryDto> { new() { Status = "Pending", At = registeredAt } };
            if (row.ForwardedDate != null)
                timeline.Add(new() { Status = "ForwardedToDepartment", At = row.ForwardedDate.Value });
            if (row.ForwardedDate != null && row.FirstResponseAt != null)
                timeline.Add(new() { Status = "ActionTaken", At = row.FirstResponseAt.Value });
            if (row.ClosedDate != null)
                timeline.Add(new() { Status = "Disposed", At = row.ClosedDate.Value });

            var office = row.OfficeUnitLabel ?? row.OfficeLabel ?? row.PrashakhaLabel;
            return new PublicTrackingDto
            {
                ComplaintNumber = row.Application_No,
                Status = timeline[^1].Status,
                RegisteredAt = registeredAt,
                LastUpdatedAt = timeline[^1].At,
                DepartmentName = row.BranchLabel == null ? null : office == null ? row.BranchLabel : $"{row.BranchLabel} • {office}",
                ClosedAt = row.ClosedDate,
                Timeline = timeline
            };
        }

        private class PublicTrackingRow
        {
            public string Application_No { get; set; } = string.Empty;
            public DateTime? CreatedDate { get; set; }
            public DateTime? ForwardedDate { get; set; }
            public string? BranchLabel { get; set; }
            public string? PrashakhaLabel { get; set; }
            public string? OfficeLabel { get; set; }
            public string? OfficeUnitLabel { get; set; }
            public DateTime? FirstResponseAt { get; set; }
            public DateTime? ClosedDate { get; set; }
        }

        // Closure fields for a query that LEFT JOINs Tbl_Applicant_Closure as c
        private const string ClosureColumns =
            @"CAST(CASE WHEN c.ID IS NULL THEN 0 ELSE 1 END AS BIT) AS IsDisposed,
              c.ClosedDate AS ClosedAt, c.ClosedBy, c.ClosureRemarks";

        // Forwarded applications with at least one reply (a remark by a role other than Admin).
        // Pending ones first, each group with the latest reply first.
        public IEnumerable<ApplicationResponseDto> GetResponses(string adminRole)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicationResponseDto>(
                @"SELECT f.ApplicantId, f.CategoryLabel, f.BranchLabel, f.ComplaintTypeLabel,
                         f.PrashakhaLabel, f.OfficeLabel, f.OfficeUnitLabel, f.ForwardedDate AS ForwardedAt,
                         r.ResponseCount, r.UnseenCount, r.LastResponseAt,
                         lr.Remark AS LastRemark, lr.RemarkBy AS LastRemarkBy, lr.RemarkByRole AS LastRemarkByRole,
                         " + ClosureColumns + @"
                  FROM Tbl_Applicant_Forward f
                  CROSS APPLY (SELECT COUNT(*) AS ResponseCount,
                                      SUM(CASE WHEN m.SeenByAdminDate IS NULL THEN 1 ELSE 0 END) AS UnseenCount,
                                      MAX(m.CreatedDate) AS LastResponseAt
                               FROM Tbl_Applicant_Remarks m
                               WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> @AdminRole) r
                  OUTER APPLY (SELECT TOP 1 m.Remark, m.RemarkBy, m.RemarkByRole
                               FROM Tbl_Applicant_Remarks m
                               WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> @AdminRole
                               ORDER BY m.CreatedDate DESC, m.ID DESC) lr
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = f.ApplicantId
                  WHERE r.ResponseCount > 0
                  ORDER BY CASE WHEN c.ID IS NULL THEN 0 ELSE 1 END, r.LastResponseAt DESC",
                new { AdminRole = adminRole });
        }

        // Pending applications with a reply Admin has not opened yet (the sidebar badge)
        public int GetUnseenResponseCount(string adminRole)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<int>(
                @"SELECT COUNT(DISTINCT m.ApplicantId)
                  FROM Tbl_Applicant_Remarks m
                  JOIN Tbl_Applicant_Forward f ON f.ApplicantId = m.ApplicantId
                  WHERE m.SeenByAdminDate IS NULL AND ISNULL(m.RemarkByRole, '') <> @AdminRole
                    AND NOT EXISTS (SELECT 1 FROM Tbl_Applicant_Closure c WHERE c.ApplicantId = m.ApplicantId)",
                new { AdminRole = adminRole });
        }

        public void MarkResponsesSeen(long applicantId, string adminRole)
        {
            using var conn = _context.CreateConnection();

            conn.Execute(
                @"UPDATE Tbl_Applicant_Remarks SET SeenByAdminDate = GETDATE()
                  WHERE ApplicantId = @ApplicantId AND SeenByAdminDate IS NULL AND ISNULL(RemarkByRole, '') <> @AdminRole",
                new { ApplicantId = applicantId, AdminRole = adminRole });
        }

        // An application is closed only once (UX_Applicant_Closure_ApplicantId)
        public bool IsClosed(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<bool>(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM Tbl_Applicant_Closure WHERE ApplicantId = @ApplicantId) THEN 1 ELSE 0 END",
                new { ApplicantId = applicantId });
        }

        // Returns null when the application does not exist (or is inactive) or has not been forwarded
        public ApplicationClosureDto? CloseApplication(ApplicationCloseRequest request, string closedBy, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ApplicantId", request.ApplicantId);
            parameters.Add("@ClosureRemarks", string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim());
            parameters.Add("@ClosedBy", closedBy);
            parameters.Add("@ClosedIp", ip);

            return conn.QueryFirstOrDefault<ApplicationClosureDto>(
                @"INSERT INTO Tbl_Applicant_Closure (ApplicantId, ClosureRemarks, ClosedBy, ClosedIp)
                  OUTPUT inserted.ApplicantId, inserted.ClosureRemarks, inserted.ClosedBy, inserted.ClosedDate AS ClosedAt
                  SELECT @ApplicantId, @ClosureRemarks, @ClosedBy, @ClosedIp
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND EXISTS (SELECT 1 FROM Tbl_Applicant_Forward WHERE ApplicantId = @ApplicantId)",
                parameters);
        }
    }
}
