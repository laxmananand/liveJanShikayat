using janshikayat.BAL.Interfaces;
using janshikayat.BAL.Services;
using janshikayat.Infrastructure;
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
        private readonly MobileSevaOtpSender _smsSender;
        private readonly ILogger<ApplicantController> _logger;

        public ApplicantController(IConfiguration configuration, IComplain IComplain, IHttpContextAccessor httpContextAccessor,
            MobileSevaOtpSender smsSender, ILogger<ApplicantController> logger)
        {
            _configuration = configuration;
            _IComplain = IComplain;
            _httpContextAccessor = httpContextAccessor;
            _smsSender = smsSender;
            _logger = logger;
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
            applicant.NormalizeLocation();

            string photoPath = "";
            if (applicant.Applicants_Photograph != null)
            {
                long maxSize = 5 * 1024 * 1024;
                if (applicant.Applicants_Photograph.Length > maxSize)
                {
                    return BadRequest(new
                    {
                        status = "false",
                        message = "Document size should be less than 5 MB"
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
                NotifyApplicant(applicant.Mobile_Number, applicant.Mobile_Number2, applicationNo, RegisteredSmsTemplate);
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
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetForwards(AdminRole) });
        }

        // Forwarded Applications page: Admin sees every forwarded application; any other login those forwarded to
        // its branch (Branch_Id), its Prashakha (Prashakha_Id) or its Commissioner / DM office (Office_Id / Office_Unit_Code)
        [Authorize]
        [HttpGet("get-my-forwards")]
        public IActionResult GetMyForwards()
        {
            var scope = CurrentScope();
            if (scope.IsEmpty)
                return Ok(new { status = "true", message = "Success", data = Array.Empty<ApplicantForwardDto>() });

            return Ok(new { status = "true", message = "Success", data = _IComplain.GetLatestForwards(scope, AdminRole) });
        }

        // Pendency Report: counts per district / block / thana / panchayat, each login within its own hierarchy
        [Authorize]
        [HttpGet("pendency-report")]
        public IActionResult GetPendencyReport([FromQuery] PendencyReportRequest request)
        {
            var scope = CurrentScope();
            var data = scope.IsEmpty ? Enumerable.Empty<PendencyRowDto>() : _IComplain.GetPendencyReport(request, scope, AdminRole);
            return Ok(new { status = "true", message = "Success", data });
        }

        // Pendency Report: the applications behind a count (same filters, plus Status)
        [Authorize]
        [HttpGet("pendency-applications")]
        public IActionResult GetPendencyApplications([FromQuery] PendencyReportRequest request)
        {
            var scope = CurrentScope();
            var data = scope.IsEmpty ? Enumerable.Empty<PendencyApplicationDto>() : _IComplain.GetPendencyApplications(request, scope, AdminRole);
            return Ok(new { status = "true", message = "Success", data });
        }

        // Offices this application may be forwarded onward to: Commissioner / IG / DIG -> DM / SP of its division /
        // range, DM -> SDO / DCLR of its district, SP -> DSP / SDPO of its police district, SDO / DCLR -> CO of its
        // subdivision, DSP / SDPO -> थाना under it
        [Authorize]
        [HttpGet("reforward-targets/{applicantId:long}")]
        public IActionResult GetReforwardTargets(long applicantId)
        {
            var scope = CurrentScope();
            if (!OfficeKind.CanForwardOnward(scope.OfficeId) || scope.OfficeUnitCode == null)
                return StatusCode(403, new { status = "false", message = ReforwardForbiddenMessage });

            var data = _IComplain.GetReforwardTargets(applicantId, scope.OfficeId!.Value, scope.OfficeUnitCode.Value);
            return Ok(new { status = "true", message = "Success", data });
        }

        // Forward a received application onward to one or more offices under the sender (see GetReforwardTargets).
        // It can be sent again later to other offices, but never twice to the same office.
        [Authorize]
        [HttpPost("reforward-applicant")]
        public IActionResult ReforwardApplicant([FromBody] ReforwardRequest request)
        {
            var scope = CurrentScope();
            if (!OfficeKind.CanForwardOnward(scope.OfficeId) || scope.OfficeUnitCode == null)
                return StatusCode(403, new { status = "false", message = ReforwardForbiddenMessage });

            var targets = request.Targets();
            if (targets.Count == 0)
                return BadRequest(new { status = "false", message = "Select an office." });

            if (_IComplain.IsClosed(request.ApplicantId))
                return Conflict(new { status = "false", message = DisposedMessage });

            const string alreadyMessage = "Application is already forwarded to this office and cannot be forwarded again.";
            var sent = _IComplain.GetReforwardedOffices(request.ApplicantId);
            if (targets.Any(sent.Contains))
                return Conflict(new { status = "false", message = alreadyMessage });

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            IReadOnlyList<ReforwardDto>? saved;
            try
            {
                saved = _IComplain.Reforward(request, scope.OfficeId!.Value, scope.OfficeUnitCode.Value, userId, ip);
            }
            catch (Microsoft.Data.SqlClient.SqlException ex) when (ex.Number is 2601 or 2627)
            {
                // Another onward forward to the same office won the race (unique index)
                return Conflict(new { status = "false", message = alreadyMessage });
            }
            if (saved == null)
            {
                return NotFound(new { status = "false", message = "Application not forwarded to your office, or the selected office is not under your office." });
            }
            return Ok(new { status = "true", message = "Application forwarded.", data = saved });
        }

        private const string ReforwardForbiddenMessage =
            "Only Commissioner, IG, DIG (to DM / SP), DM (to SDO / DCLR), SP (to DSP / SDPO), SDO / DCLR (to CO) and DSP / SDPO (to Thana) logins can forward onward.";

        // What the logged-in user may see, from the claims AuthService puts in the JWT
        private AccessScope CurrentScope()
        {
            if (User.IsInRole(AdminRole))
                return new AccessScope { All = true };

            return new AccessScope
            {
                BranchId = long.TryParse(User.FindFirstValue("BranchId"), out var b) ? b : null,
                PrashakhaId = int.TryParse(User.FindFirstValue("PrashakhaId"), out var p) ? p : null,
                OfficeId = int.TryParse(User.FindFirstValue("OfficeId"), out var o) ? o : null,
                OfficeUnitCode = int.TryParse(User.FindFirstValue("OfficeUnitCode"), out var u) ? u : null
            };
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

            // An office below a DM / SP (SDO / DCLR / SDPO / CO / थाना) also answers to that DM / SP
            var scope = CurrentScope();
            var belowDistrict = scope.OfficeId is OfficeKind.SubDivisionalOfficer or OfficeKind.Dclr or OfficeKind.Sdpo
                                               or OfficeKind.CircleOfficer or OfficeKind.Thana;
            var saved = _IComplain.AddRemark(request, userId, role, ip, documentPath,
                                             belowDistrict ? scope.OfficeId : null, belowDistrict ? scope.OfficeUnitCode : null);
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

        // The whole forward chain of an application (Admin -> office -> DM / SP -> ...), for the details popup
        [Authorize]
        [HttpGet("forward-history/{applicantId:long}")]
        public IActionResult GetForwardHistory(long applicantId)
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetForwardHistory(applicantId) });
        }

        // Closure of an application for the Track popup (data null while it is open)
        [Authorize]
        [HttpGet("closure/{applicantId:long}")]
        public IActionResult GetClosure(long applicantId)
        {
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetClosure(applicantId) });
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

        // Responses page: forwarded applications with replies. Admin: remarks by any non-Admin role; DM / SP: remarks
        // by the offices under it in that application's chain (SDO / DCLR / SDPO / CO / थाना)
        [Authorize]
        [HttpGet("get-responses")]
        public IActionResult GetResponses()
        {
            var scope = ResponsesScope();
            if (scope == null)
                return StatusCode(403, new { status = "false", message = ResponsesForbiddenMessage });
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetResponses(scope, AdminRole) });
        }

        // Sidebar badge: pending applications with a reply this login (Admin / DM / SP) has not opened yet
        [Authorize]
        [HttpGet("get-unseen-response-count")]
        public IActionResult GetUnseenResponseCount()
        {
            var scope = ResponsesScope();
            if (scope == null)
                return StatusCode(403, new { status = "false", message = ResponsesForbiddenMessage });
            return Ok(new { status = "true", message = "Success", data = _IComplain.GetUnseenResponseCount(scope, AdminRole) });
        }

        [Authorize]
        [HttpPost("mark-responses-seen/{applicantId:long}")]
        public IActionResult MarkResponsesSeen(long applicantId)
        {
            var scope = ResponsesScope();
            if (scope == null)
                return StatusCode(403, new { status = "false", message = ResponsesForbiddenMessage });
            _IComplain.MarkResponsesSeen(applicantId, scope, AdminRole);
            return Ok(new { status = "true", message = "Marked as seen." });
        }

        // Admin, or a DM / SP login (with its office unit); null for everyone else
        private AccessScope? ResponsesScope()
        {
            var scope = CurrentScope();
            if (scope.All)
                return scope;
            return OfficeKind.CanCloseApplications(scope.OfficeId) && scope.OfficeUnitCode != null ? scope : null;
        }

        private const string ResponsesForbiddenMessage = "Only Admin, DM and SP logins have a Responses page.";

        // Closing is one-time and moves the application to Disposed; no remarks or forwards can be added after it.
        // The DM / SP it reached closes it when Admin sent it to a regional office or a DM / SP; a forward to a
        // branch / section / department is closed by that login. Admin cannot close (IComplain.CanClose).
        [Authorize]
        [HttpPost("close-application")]
        public IActionResult CloseApplication([FromBody] ApplicationCloseRequest request)
        {
            if (_IComplain.IsClosed(request.ApplicantId))
            {
                return Conflict(new { status = "false", message = DisposedMessage });
            }
            if (!_IComplain.CanClose(request.ApplicantId, CurrentScope()))
            {
                return StatusCode(403, new
                {
                    status = "false",
                    message = "यह आवेदन केवल वही शाखा / प्रशाखा / विभाग या जिलाधिकारी (DM) / पुलिस अधीक्षक (SP) बंद कर सकते हैं जिन्हें यह अग्रेषित किया गया है। / Only the branch / section / department or DM / SP this application was forwarded to can close it."
                });
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
            var contact = _IComplain.GetSmsContact(request.ApplicantId);
            NotifyApplicant(contact.MobileNumber, contact.MobileNumber2, contact.ApplicationNo, ClosedSmsTemplate);

            return Ok(new { status = "true", message = "Application closed.", data = saved });
        }

        // Citizen portal (landing page): live status of an application by its number. No login needed, so it
        // returns workflow status and applicant name only (no mobile or address) and is rate limited per IP against number guessing.
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

        // SMS templates in Otp:Sms:Templates (appsettings.json), registered on DLT
        private const string RegisteredSmsTemplate = "ApplicationRegistered";
        private const string ClosedSmsTemplate = "ApplicationClosed";

        // SMS with the application number to the applicant's mobile (the second one when the first is missing
        // or not 10 digits). Sent in the background so a slow gateway does not hold up the response; a failed
        // or skipped SMS is only logged, since the application itself is already saved.
        private void NotifyApplicant(string? mobileNumber, string? mobileNumber2, string? applicationNo, string templateName)
        {
            var mobile = new[] { mobileNumber, mobileNumber2 }
                .Select(m => m?.Trim())
                .FirstOrDefault(m => m is { Length: 10 } && m.All(char.IsAsciiDigit));

            if (mobile == null || string.IsNullOrEmpty(applicationNo))
            {
                _logger.LogInformation("No {Template} SMS for application {ApplicationNo}: no valid mobile number.", templateName, applicationNo);
                return;
            }
            if (!_smsSender.CanSend)
            {
                _logger.LogWarning("No {Template} SMS for application {ApplicationNo}: the SMS gateway is not configured.", templateName, applicationNo);
                return;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    await _smsSender.SendMessageAsync(mobile, applicationNo, templateName, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "{Template} SMS for application {ApplicationNo} failed.", templateName, applicationNo);
                }
            });
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
