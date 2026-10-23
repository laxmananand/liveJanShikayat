namespace janshikayat.DAL.Entities
{
    public class Block
    {
        public int? DistCode { get; set; }
        public int? SubDivCode { get; set; }
        public int? BlockCode { get; set; }
        public int? BlockCodeOld { get; set; }
        public string BlockName { get; set; }
        public string BlockNameHN { get; set; }
        public string Unique_Block_Code { get; set; }
        public int? DistCodeOld { get; set; }
        public int? SubDivCodeOld { get; set; }
        public string ContactNo { get; set; }
        public string LGBlkCode { get; set; }
        public string LGDCode { get; set; }
    }
    public class MstCommissionaryDistrict
    {
        public int? STATECODE { get; set; }
        public int? DIVISIONCODE { get; set; }
        public string DIVISIONAME { get; set; }
        public int? DISTRICTCODE { get; set; }
        public string DISTRICTNAME { get; set; }
        public string UNIQUEDIVISIONCODE { get; set; }
        public string RangeCode { get; set; }
    }

public class MstPanchayat
    {
        public int? PanchayatCode { get; set; }
        public string PanchayatName { get; set; }
        public string PanchayatNameHnd { get; set; }
        public int? BlockCode { get; set; }
        public int? StateCode { get; set; }
        public int? DistrictCode { get; set; }
        public string AreaType { get; set; }
        public string ULB_Type { get; set; }
    }
    public class MstVillageMaster
    {
        public int? VILLCODE { get; set; }
        public string VILLNAME { get; set; }
        public int? DISTCODE { get; set; }
        public int? BLOCKCODE { get; set; }
        public int? VILLCODE2001 { get; set; }
        public int? STATECODE { get; set; }
        public int? DTC2001 { get; set; }
        public int? Status { get; set; }
    }

    public class Thana
    {
        public string District { get; set; }
        public long? District_code { get; set; }
        public string Subdivision_Name { get; set; }
        public long? Subdivision_Code { get; set; }
        public string Police_Station { get; set; }
        public long PS_Code { get; set; } // Not nullable in your image
        public long? Circle_Code { get; set; }
        public string Circle_Name { get; set; }
        public long? Range_id { get; set; }
        public string Range_Name { get; set; }
        public string Remarks { get; set; }
        public DateTime? UpdateDate { get; set; }
        public string Updatelp { get; set; }
        public string UpdateUserld { get; set; }
    }

}
