using Dapper;
using janshikayat.BAL.Interfaces;
using janshikayat.DAL.Entities;
using janshikayat.Data;

namespace janshikayat.BAL.Services
{
    public class MasterData: IMasterData
    {
        private readonly DapperContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public MasterData(IConfiguration config, DapperContext context, IHttpContextAccessor httpContextAccessor)
        {
            _config = config;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }
        public List<MstCommissionaryDistrict> GetDistrict()
        {
            using var conn = _context.CreateConnection();

            var sql = "SELECT * FROM mst_Commissionary_Districts order by DISTRICTNAME ";

            var result = conn.Query<MstCommissionaryDistrict>(sql);

            return result.ToList();
        }
        public List<Block> GetBlock(int district_code)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@DistCode", district_code);           
            var sql = "select * from Blocks  where DistCode=@DistCode order by BlockName";           
            var result = conn.Query<Block>(
              sql,
               parameters
           ).ToList();
            return result.ToList();
        }
        public List<MstPanchayat> GetPanchayat(int district_code, int block_code)
        {
            using var conn = _context.CreateConnection();

            var sql = "SELECT * FROM mst_Panchayats where DistrictCode=@DistrictCode and BlockCode=@BlockCode order by PanchayatName";
            var parameters = new DynamicParameters();
            parameters.Add("@DistrictCode", district_code);
            parameters.Add("@BlockCode", block_code);
            var result = conn.Query<MstPanchayat>(sql,parameters).ToList();
            return result.ToList();
        }
        public List<MstVillageMaster> GetVillage(int districtCode, int blockCode, int panchayatCode)
        {
            using var conn = _context.CreateConnection();
            string sql = @" select v.* from mst_VillageMaster v 
  inner join PanchayatVillage p on p.VillageCode=v.VILLCODE and v.BLOCKCODE=p.BlockCode and p.DistrictCode=v.DISTCODE
  where p.PanchayatCode=@PanchayatCode and p.BlockCode=@BlockCode and p.DistrictCode=@DistrictCode
  order by v.VILLNAME";
            var parameters = new DynamicParameters();
            parameters.Add("@PanchayatCode", panchayatCode);
            parameters.Add("@BlockCode", blockCode);
            parameters.Add("@DistrictCode", districtCode);

            return conn.Query<MstVillageMaster>(
                sql,
                parameters
            ).ToList();
        }

        public List<MstDepartment> GetDepartment()
        {
            using var conn = _context.CreateConnection();

            var sql = "SELECT * FROM Mst_Departments order by DepartmentName ";

            var result = conn.Query<MstDepartment>(sql);

            return result.ToList();
        }

        public List<MstCategory> GetForwarded()
        {
            using var conn = _context.CreateConnection();

            var sql = "select AutoId,Category from Mst_Category order by Category";

            var result = conn.Query<MstCategory>(sql);

            return result.ToList();
        }
        public List<Forwarded_To_sub> GetForwarded_To_sub(int a)
        {
            using var conn = _context.CreateConnection();

            var sql = "";
            if (a == 1)
            {
                sql = " select AutoId as Id ,UserName as Name from Tbl_UserLogin where Role=3";
            }
            if (a==2)
            {
                sql = "SELECT  [DepartmentId] as Id,[DepartmentName] as Name FROM [Jansikayat_DB].[dbo].[Mst_Departments] order by DepartmentName";
            }
            if (a == 3)
            {
                sql = " select AutoId as Id ,UserName as Name from Tbl_UserLogin where Role=1";
            }




            var result = conn.Query<Forwarded_To_sub>(sql);

            return result.ToList();
        }
    }
}
