using janshikayat.DAL.Entities;
using System.Reflection;

namespace janshikayat.BAL.Interfaces
{
    public interface IMasterData
    {
       
        List<MstCommissionaryDistrict> GetDistrict();
        List<MstSubDivision> GetSubDivision(int district_code);
        List<Block> GetBlock(int district_code, long? sub_div_code = null);
        List<MstPanchayat> GetPanchayat(int district_code, int block_code, string? area_type = null);
        List<MstVillageMaster> GetVillage(int districtCode, int blockCode, int panchayatCode);
        List<MstWard> GetWard(int district_code, int panchayat_code);
        List<Thana> GetThanaByBlock(int block_code);
        List<MstDepartment> GetDepartment();
        List<Forwarded_To_sub> GetForwarded_To_sub(int id);
        List<MstCategory> GetForwarded();
        List<MstCategory> GetCategories();
        List<MstBranch> GetBranchesByCategory(int categoryId);
        List<MstComplainSubType> GetComplainSubTypes(long complainId);
        List<MstPrashakha> GetPrashakhas();
        List<MstRegionalOffice> GetRegionalOffices(int categoryId);
        List<MstOfficeUnit> GetOfficeUnits(int officeId);
        List<Thana> GetThana(int district_code);
    }
}
