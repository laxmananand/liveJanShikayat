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

        public List<Thana> GetThana(int district_code)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@DistCode", district_code);
            var sql = "select* from mst_thana where District_Code = @DistCode order by Police_Station";
            var result = conn.Query<Thana>(
              sql,
               parameters
           ).ToList();
            return result.ToList();
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
        public List<MstCategory> GetCategories()
        {
            using var conn = _context.CreateConnection();

            var sql = "select AutoId, Category_Id, Category from Mst_Category order by Category_Id";

            return conn.Query<MstCategory>(sql).ToList();
        }

        // A branch can sit under several categories (e.g. Section and Department)
        public List<MstBranch> GetBranchesByCategory(int categoryId)
        {
            using var conn = _context.CreateConnection();

            var sql = @"select Complain_id, Branch_Eng, Branch_Hindi from Mst_Branch
                        where Is_Active = 1
                          and (Home_Categ = @CategoryId or Section_Categ = @CategoryId or District_Categ = @CategoryId)
                        order by Complain_id";

            return conn.Query<MstBranch>(sql, new { CategoryId = categoryId }).ToList();
        }

        public List<MstComplainSubType> GetComplainSubTypes(long complainId)
        {
            using var conn = _context.CreateConnection();

            var sql = "select Sub_Type_id, Complain_Id, Sub_Type from Mst_Complain_Sub_Type where Complain_Id = @ComplainId order by Sub_Type_id";

            return conn.Query<MstComplainSubType>(sql, new { ComplainId = complainId }).ToList();
        }

        // Mst_Prashakha.ID is a float; ordered by ID so Prashakha-1..17 come before A..Y
        public List<MstPrashakha> GetPrashakhas()
        {
            using var conn = _context.CreateConnection();

            var sql = "select CAST(ID AS INT) AS ID, Name from Mst_Prashakha where ID is not null order by ID";

            return conn.Query<MstPrashakha>(sql).ToList();
        }

        public List<MstRegionalOffice> GetRegionalOffices(int categoryId)
        {
            using var conn = _context.CreateConnection();

            var sql = @"select Office_Id, Category_Id, Regional_Office, Unique_Code from Mst_Regional_Office
                        where Category_Id = @CategoryId and Is_Active = 1
                        order by Office_Id";

            return conn.Query<MstRegionalOffice>(sql, new { CategoryId = categoryId }).ToList();
        }

        // Empty for an office whose list is not loaded yet (IG / DIG / SP)
        public List<MstOfficeUnit> GetOfficeUnits(int officeId)
        {
            using var conn = _context.CreateConnection();

            var sql = "select Unit_Code, Unit_Name from vw_Office_Unit where Office_Id = @OfficeId order by Unit_Code";

            return conn.Query<MstOfficeUnit>(sql, new { OfficeId = officeId }).ToList();
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
