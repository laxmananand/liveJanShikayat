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
                @"SELECT ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                         ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedDate AS ForwardedAt,
                         PrashakhaId, PrashakhaLabel, OfficeId, OfficeLabel, OfficeUnitCode, OfficeUnitLabel
                  FROM Tbl_Applicant_Forward
                  ORDER BY ForwardedDate, ID");
        }

        // Latest forward per application, newest first.
        // all = true: every forward (Admin); otherwise those sent to the user's branch or to the user's Prashakha.
        public IEnumerable<ApplicantForwardDto> GetLatestForwards(bool all, long? branchId, int? prashakhaId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantForwardDto>(
                @"SELECT ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                         ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedDate AS ForwardedAt,
                         PrashakhaId, PrashakhaLabel, OfficeId, OfficeLabel, OfficeUnitCode, OfficeUnitLabel
                  FROM (SELECT f.*, ROW_NUMBER() OVER (PARTITION BY f.ApplicantId ORDER BY f.ForwardedDate DESC, f.ID DESC) AS rn
                        FROM Tbl_Applicant_Forward f) x
                  WHERE x.rn = 1
                    AND (@All = 1
                         OR (@BranchId IS NOT NULL AND x.BranchId = CAST(@BranchId AS VARCHAR(50)))
                         OR (@PrashakhaId IS NOT NULL AND x.PrashakhaId = @PrashakhaId))
                  ORDER BY x.ForwardedDate DESC, x.ID DESC",
                new { All = all, BranchId = branchId, PrashakhaId = prashakhaId });
        }

        // Returns null when the application does not exist (or is inactive)
        public ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ApplicantId", request.ApplicantId);
            parameters.Add("@Remark", request.Remark.Trim());
            parameters.Add("@RemarkBy", remarkBy);
            parameters.Add("@RemarkByRole", role);
            parameters.Add("@CreatedIp", ip);

            return conn.QueryFirstOrDefault<ApplicantRemarkDto>(
                @"INSERT INTO Tbl_Applicant_Remarks (ApplicantId, Remark, RemarkBy, RemarkByRole, CreatedIp)
                  OUTPUT inserted.ID, inserted.ApplicantId, inserted.Remark, inserted.RemarkBy,
                         inserted.RemarkByRole, inserted.CreatedDate
                  SELECT @ApplicantId, @Remark, @RemarkBy, @RemarkByRole, @CreatedIp
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)",
                parameters);
        }

        public IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantRemarkDto>(
                @"SELECT ID, ApplicantId, Remark, RemarkBy, RemarkByRole, CreatedDate
                  FROM Tbl_Applicant_Remarks
                  WHERE ApplicantId = @ApplicantId
                  ORDER BY CreatedDate, ID",
                new { ApplicantId = applicantId });
        }
    }
}
