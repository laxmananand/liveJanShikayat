using janshikayat.BAL.Interfaces;
using janshikayat.BAL.Services;
using janshikayat.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Reflection;
using System.Security.Claims;

namespace janshikayat.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ApplicantController : Controller
    {
        private readonly IComplain _IComplain;
        private readonly IConfiguration _configuration;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ApplicantController(IConfiguration configuration, IComplain IComplain, IHttpContextAccessor httpContextAccessor)
        {
            _configuration = configuration;
            _IComplain = IComplain;
            _httpContextAccessor = httpContextAccessor;
        }
        // Mst_Role.Role name carried in the JWT role claim; only this role may create or forward applications
        private const string AdminRole = "Admin";

        [Authorize(Roles = AdminRole)]
        [HttpPost("save-janshikayat_applicant-details")]
        public IActionResult SaveApplicant([FromForm] TblApplicantDetails applicant)
        {
            if (applicant == null)
            {
                return BadRequest(new { Flag = 0, Message = "Invalid applicant data." });
            }
             var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            applicant.CreatedBy = userId;

            string photoPath = "";
            if (applicant.Applicants_Photograph != null)
            {
                long maxSize = 200 * 1024;
                if (applicant.Applicants_Photograph.Length > maxSize)
                {
                    return BadRequest(new
                    {
                        status = "false",
                        message = "Profile photo size should be less than 200 KB"
                    });
                }
                string folder = Path.Combine(Directory.GetCurrentDirectory(),
                                             "wwwroot",
                                             "janshikayatDocument");
                if (!Directory.Exists(folder))
                    Directory.CreateDirectory(folder);
                string fileName = Guid.NewGuid() +
                                  Path.GetExtension(applicant.Applicants_Photograph.FileName);
                string fullPath = Path.Combine(folder, fileName);
                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    applicant.Applicants_Photograph.CopyTo(stream);
                }

                photoPath = "/janshikayatDocument/" + fileName;
            }
            // Capture IP address optionally
            applicant.CreatedIp = HttpContext.Connection.RemoteIpAddress?.ToString();

            var (flag, message, applicationNo) = _IComplain.SaveApplicant(applicant, photoPath);

            if (flag > 0)
            {
                return Ok(new { Flag = flag, Message = message, ApplicationNo = applicationNo });
            }
            else
            {
                return StatusCode(500, new { Flag = flag, Message = message });
            }
        }

        //[Authorize] // TEMP: disabled for testing
        [HttpGet("get-all")]
        public IActionResult GetApplicants()
        {
            var applicants = _IComplain.GetApplicants();
            return Ok(applicants);
        }


        [HttpPost("get-all-applicant-status")]
        public IActionResult GetApplicantsByDistrict([FromForm] ApplicantDetailsDtoRequestParam request)
        {
           

            var response = new Dictionary<string, string>();

            var data = _IComplain.GetApplicantstatus(request);

            if (data == null || !data.Any())
            {
                response["status"] = "false";
                response["message"] = "No data found";
                return Ok(response);
            }
            var re = new
            {
                status = "true",
                message = "Success",
                data = data
            };
            return Ok(re);


        }

        [Authorize(Roles = AdminRole)]
        [HttpPost("forward-applicant")]
        public IActionResult ForwardApplicant([FromBody] ApplicantForwardRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            // Forwarding is one-time: a forwarded application is locked
            const string lockedMessage = "Application is already forwarded and cannot be forwarded again.";
            if (_IComplain.IsForwarded(request.ApplicantId))
            {
                return Conflict(new { status = "false", message = lockedMessage });
            }

            ApplicantForwardDto? saved;
            try
            {
                saved = _IComplain.ForwardApplicant(request, userId, ip);
            }
            catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
            {
                // Another forward of the same application won the race (unique index)
                return Conflict(new { status = "false", message = lockedMessage });
            }
            if (saved == null)
            {
                return NotFound(new { status = "false", message = "Application, branch, complaint type, Prashakha or office not found." });
            }
            return Ok(new { status = "true", message = "Application forwarded.", data = saved });
        }

        // Every logged-in role can see where applications were forwarded
        [Authorize]
        [HttpGet("get-forwards")]
        public IActionResult GetForwards()
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetForwards() });
        }

        // Forwarded Applications page: Admin sees every forwarded application; any other login
        // those forwarded to its branch (Branch_Id) or, for Section forwards, to its Prashakha (Prashakha_Id)
        [Authorize]
        [HttpGet("get-my-forwards")]
        public IActionResult GetMyForwards()
        {
            if (User.IsInRole(AdminRole))
                return Ok(new { status = "true", message = "Success", data = _IComplain.GetLatestForwards(true, null, null) });

            long? branchId = long.TryParse(User.FindFirstValue("BranchId"), out var b) ? b : null;
            int? prashakhaId = int.TryParse(User.FindFirstValue("PrashakhaId"), out var p) ? p : null;
            if (branchId == null && prashakhaId == null)
                return Ok(new { status = "true", message = "Success", data = Array.Empty<ApplicantForwardDto>() });

            return Ok(new { status = "true", message = "Success", data = _IComplain.GetLatestForwards(false, branchId, prashakhaId) });
        }

        // Every logged-in role (Admin, Saction, Branch) can add remarks
        [Authorize]
        [HttpPost("add-remark")]
        public IActionResult AddRemark([FromForm] ApplicantRemarkRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Remark))
            {
                return BadRequest(new { status = "false", message = "Remark is required." });
            }
            if (_IComplain.IsClosed(request.ApplicantId))
            {
                return Conflict(new { status = "false", message = DisposedMessage });
            }

            string? documentPath = null;
            if (request.Document != null)
            {
                if (request.Document.Length > MaxRemarkDocumentSize)
                {
                    return BadRequest(new { status = "false", message = "PDF size should be less than 5 MB." });
                }
                if (!IsPdf(request.Document))
                {
                    return BadRequest(new { status = "false", message = "Only PDF files can be attached." });
                }
                if (!Directory.Exists(RemarkDocumentFolder))
                    Directory.CreateDirectory(RemarkDocumentFolder);
                documentPath = Guid.NewGuid() + ".pdf";
                using (var stream = new FileStream(Path.Combine(RemarkDocumentFolder, documentPath), FileMode.Create))
                {
                    request.Document.CopyTo(stream);
                }
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var role = User.FindFirstValue(ClaimTypes.Role);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            var saved = _IComplain.AddRemark(request, userId, role, ip, documentPath);
            if (saved == null)
            {
                // Nothing references the uploaded file, so it is removed again
                if (documentPath != null)
                    System.IO.File.Delete(Path.Combine(RemarkDocumentFolder, documentPath));
                return NotFound(new { status = "false", message = "Application not found." });
            }
            return Ok(new { status = "true", message = "Remark added.", data = saved });
        }

        [Authorize]
        [HttpGet("get-remarks/{applicantId:long}")]
        public IActionResult GetRemarks(long applicantId)
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetRemarks(applicantId) });
        }

        // PDF attached to a remark; served only to logged-in users (the folder is outside wwwroot)
        [Authorize]
        [HttpGet("get-remark-document/{remarkId:long}")]
        public IActionResult GetRemarkDocument(long remarkId)
        {
            var documentPath = _IComplain.GetRemarkDocumentPath(remarkId);
            var fullPath = documentPath == null ? null : Path.Combine(RemarkDocumentFolder, Path.GetFileName(documentPath));
            if (fullPath == null || !System.IO.File.Exists(fullPath))
            {
                return NotFound(new { status = "false", message = "Document not found." });
            }
            return PhysicalFile(fullPath, "application/pdf");
        }

        // Responses page: forwarded applications the receiving office has replied to (remarks by non-Admin roles)
        [Authorize(Roles = AdminRole)]
        [HttpGet("get-responses")]
        public IActionResult GetResponses()
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetResponses(AdminRole) });
        }

        // Sidebar badge: pending applications with a reply Admin has not opened yet
        [Authorize(Roles = AdminRole)]
        [HttpGet("get-unseen-response-count")]
        public IActionResult GetUnseenResponseCount()
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetUnseenResponseCount(AdminRole) });
        }

        [Authorize(Roles = AdminRole)]
        [HttpPost("mark-responses-seen/{applicantId:long}")]
        public IActionResult MarkResponsesSeen(long applicantId)
        {
            _IComplain.MarkResponsesSeen(applicantId, AdminRole);
            return Ok(new { status = "true", message = "Marked as seen." });
        }

        // Closing is one-time and moves the application from Pending to Disposed; no remarks can be added after it
        [Authorize(Roles = AdminRole)]
        [HttpPost("close-application")]
        public IActionResult CloseApplication([FromBody] ApplicationCloseRequest request)
        {
            if (_IComplain.IsClosed(request.ApplicantId))
            {
                return Conflict(new { status = "false", message = DisposedMessage });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            ApplicationClosureDto? saved;
            try
            {
                saved = _IComplain.CloseApplication(request, userId, ip);
            }
            catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
            {
                // Another close of the same application won the race (unique index)
                return Conflict(new { status = "false", message = DisposedMessage });
            }
            if (saved == null)
            {
                return NotFound(new { status = "false", message = "Application not found or not forwarded yet." });
            }
            return Ok(new { status = "true", message = "Application closed.", data = saved });
        }

        // Citizen portal (landing page): live status of an application by its number. No login needed, so it
        // returns workflow status only (no name, mobile or address) and is rate limited per IP against number guessing.
        [AllowAnonymous]
        [EnableRateLimiting(PublicTrackRateLimit)]
        [HttpGet("track/{applicationNo}")]
        public IActionResult TrackApplication(string applicationNo)
        {
            // Older numbers were shown with dashes / spaces (JS-2026-0001); stored numbers have neither
            var number = new string(applicationNo.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
            var tracked = number.Length is > 0 and <= 30 ? _IComplain.TrackApplication(number, AdminRole) : null;
            if (tracked == null)
            {
                return NotFound(new { status = "false", message = "Application not found." });
            }
            return Ok(new { status = "true", message = "Success", data = tracked });
        }

        // Policy name registered in Program.cs
        public const string PublicTrackRateLimit = "PublicTrack";

        private const string DisposedMessage = "Application is already closed (disposed).";

        private const long MaxRemarkDocumentSize = 5 * 1024 * 1024;
        private static readonly string RemarkDocumentFolder = Path.Combine(Directory.GetCurrentDirectory(), "RemarkDocuments");

        // Checks the extension and the "%PDF" signature, so a renamed file is rejected
        private static bool IsPdf(IFormFile file)
        {
            if (!string.Equals(Path.GetExtension(file.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
                return false;
            var header = new byte[4];
            using var stream = file.OpenReadStream();
            return stream.Read(header, 0, 4) == 4 && header.SequenceEqual("%PDF"u8.ToArray());
        }

    }
}
