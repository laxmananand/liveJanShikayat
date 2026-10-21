using janshikayat.BAL.Interfaces;
using janshikayat.BAL.Services;
using janshikayat.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

            var saved = _IComplain.ForwardApplicant(request, userId, ip);
            if (saved == null)
            {
                return NotFound(new { status = "false", message = "Application not found." });
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

        // Every logged-in role (Admin, Saction, Branch) can add remarks
        [Authorize]
        [HttpPost("add-remark")]
        public IActionResult AddRemark([FromBody] ApplicantRemarkRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Remark))
            {
                return BadRequest(new { status = "false", message = "Remark is required." });
            }
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var role = User.FindFirstValue(ClaimTypes.Role);
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            var saved = _IComplain.AddRemark(request, userId, role, ip);
            if (saved == null)
            {
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

    }
}
