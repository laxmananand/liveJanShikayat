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

        // Returns null when the application does not exist (or is inactive)
        public ApplicantForwardDto? ForwardApplicant(ApplicantForwardRequest request, string forwardedBy, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters(request);
            parameters.Add("@ForwardedBy", forwardedBy);
            parameters.Add("@ForwardedIp", ip);

            return conn.QueryFirstOrDefault<ApplicantForwardDto>(
                @"INSERT INTO Tbl_Applicant_Forward
                       (ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                        ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedIp)
                  OUTPUT inserted.ApplicantId, inserted.CategoryId, inserted.CategoryLabel, inserted.BranchId,
                         inserted.BranchLabel, inserted.ComplaintTypeId, inserted.ComplaintTypeLabel,
                         inserted.Remarks, inserted.ForwardedBy, inserted.ForwardedDate AS ForwardedAt
                  SELECT @ApplicantId, @CategoryId, @CategoryLabel, @BranchId, @BranchLabel,
                         @ComplaintTypeId, @ComplaintTypeLabel, @Remarks, @ForwardedBy, @ForwardedIp
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)",
                parameters);
        }

        // Oldest first, so the last row per application is its latest forward
        public IEnumerable<ApplicantForwardDto> GetForwards()
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantForwardDto>(
                @"SELECT ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                         ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedDate AS ForwardedAt
                  FROM Tbl_Applicant_Forward
                  ORDER BY ForwardedDate, ID");
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
