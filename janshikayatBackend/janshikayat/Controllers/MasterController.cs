using janshikayat.BAL.Interfaces;
using janshikayat.DAL.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace janshikayat.Controllers
{
   
    [ApiController]
    [Route("[controller]")]
    public class MasterController : Controller
    {
        private readonly IMasterData _MasterData;
        private readonly IConfiguration _configuration;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public MasterController(IConfiguration configuration, IMasterData MasterData, IHttpContextAccessor httpContextAccessor)
        {
            _configuration = configuration;
            _MasterData = MasterData;
            _httpContextAccessor = httpContextAccessor;
        }
        //[Authorize] // TEMP: disabled for testing
        [HttpPost("get-district")]
        public IActionResult GetDistrict()
        {
            var response = new Dictionary<string, string>();
            var data = _MasterData.GetDistrict();
            if (data == null)
            {
                response["status"] = "false";
                response["message"] = "No data found";
                return Ok(response);
            }
            var re = (new
            {
                status = "true",
                message = "Success",
                data = data
            });
            return Ok(re);
        }
        //[Authorize] // TEMP: disabled for testing
        [HttpPost("get-block")]
        public IActionResult GetBlock(int District_Code)
        {
            var response = new Dictionary<string, string>();

            var data = _MasterData.GetBlock(District_Code);

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

        //[Authorize] // TEMP: disabled for testing
        [HttpPost("get-panchayat")]
        public IActionResult GetPanchayat(int District_Code, int Block_code)
        {
            var response = new Dictionary<string, string>();
            var data = _MasterData.GetPanchayat(District_Code, Block_code);
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
        //[Authorize] // TEMP: disabled for testing
        [HttpPost("get-village")]
        public IActionResult GetVillage(int District_Code, int Block_code,int PanchayatCode)
        {
            var data = _MasterData.GetVillage( District_Code,Block_code,PanchayatCode);
            if (data == null || data.Count == 0)
            {
                return Ok(new
                {
                    status = "false",
                    message = "No data found",
                    data = new List<MstVillageMaster>()
                });
            }
            return Ok(new
            {
                status = "true",
                message = "Success",
                data = data
            });
        }

        //[Authorize] // TEMP: disabled for testing
        [HttpPost("get-thana")]
        public IActionResult GetThana(int District_Code)
        {
            var response = new Dictionary<string, string>();

            var data = _MasterData.GetThana(District_Code);

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

        [HttpPost("get-department")]
        public IActionResult GetDepartment()
        {
            var response = new Dictionary<string, string>();
            var data = _MasterData.GetDepartment();
            if (data == null)
            {
                response["status"] = "false";
                response["message"] = "No data found";
                return Ok(response);
            }
            var re = (new
            {
                status = "true",
                message = "Success",
                data = data
            });
            return Ok(re);
        }


        [HttpPost("get-forwarded")]
        public IActionResult GetForwarded()
        {
            var response = new Dictionary<string, string>();
            var data = _MasterData.GetForwarded();
            if (data == null)
            {
                response["status"] = "false";
                response["message"] = "No data found";
                return Ok(response);
            }
            var re = (new
            {
                status = "true",
                message = "Success",
                data = data
            });
            return Ok(re);
        }

        // Forward popup cascade: category -> branch -> complaint type
        [HttpPost("get-category")]
        public IActionResult GetCategory()
        {
            return Ok(new { status = "true", message = "Success", data = _MasterData.GetCategories() });
        }

        [HttpPost("get-branch-by-category")]
        public IActionResult GetBranchByCategory(int CategoryId)
        {
            return Ok(new { status = "true", message = "Success", data = _MasterData.GetBranchesByCategory(CategoryId) });
        }

        [HttpPost("get-complain-sub-type")]
        public IActionResult GetComplainSubType(long ComplainId)
        {
            return Ok(new { status = "true", message = "Success", data = _MasterData.GetComplainSubTypes(ComplainId) });
        }

        [HttpPost("get-prashakha")]
        public IActionResult GetPrashakha()
        {
            return Ok(new { status = "true", message = "Success", data = _MasterData.GetPrashakhas() });
        }

        [HttpPost("get-forward-sub-master")]
        public IActionResult GetForwardsubmaster(int a)
        {
            var response = new Dictionary<string, string>();
            var data = _MasterData.GetForwarded_To_sub(a);
            if (data == null)
            {
                response["status"] = "false";
                response["message"] = "No data found";
                return Ok(response);
            }
            var re = (new
            {
                status = "true",
                message = "Success",
                data = data
            });
            return Ok(re);
        }
    }
}
