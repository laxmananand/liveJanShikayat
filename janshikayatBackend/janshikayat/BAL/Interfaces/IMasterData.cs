using janshikayat.DAL.Entities;
using System.Reflection;

namespace janshikayat.BAL.Interfaces
{
    public interface IMasterData
    {
       
        List<MstCommissionaryDistrict> GetDistrict();
        List<Block> GetBlock(int district_code);
        List<MstPanchayat> GetPanchayat(int district_code, int block_code);
        List<MstVillageMaster> GetVillage(int districtCode, int blockCode, int panchayatCode);
        List<MstDepartment> GetDepartment();
        List<Forwarded_To_sub> GetForwarded_To_sub(int id);
        List<MstCategory> GetForwarded();
        List<MstCategory> GetCategories();
        List<MstBranch> GetBranchesByCategory(int categoryId);
        List<MstComplainSubType> GetComplainSubTypes(long complainId);
        List<MstPrashakha> GetPrashakhas();
    }
}
