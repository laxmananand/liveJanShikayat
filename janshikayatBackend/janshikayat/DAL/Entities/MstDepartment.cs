namespace janshikayat.DAL.Entities
{
    public class MstDepartment
    {
        public double? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string? Email { get; set; }
        public string? Email2 { get; set; }
    }
    public class Forwarded_To_sub
    {
        public int? Id { get; set; }
        public string? Name { get; set; }
       
    }
    public class MstCategory
    {
        public long AutoId { get; set; }
        public int? Category_Id { get; set; }
        public string? Category { get; set; }
    }
    // Mst_Branch row offered for a category (Home_Categ / Section_Categ / District_Categ)
    public class MstBranch
    {
        public long Complain_id { get; set; }
        public string? Branch_Eng { get; set; }
        public string? Branch_Hindi { get; set; }
    }
    // Section forwards also go to one Prashakha (its login sees the application)
    public class MstPrashakha
    {
        public int ID { get; set; }
        public string? Name { get; set; }
    }
    // District Administration forwards first pick a regional office (Commissioner, DM, IG, DIG, SP)
    public class MstRegionalOffice
    {
        public int Office_Id { get; set; }
        public int Category_Id { get; set; }
        public string? Regional_Office { get; set; }
        public string? Unique_Code { get; set; }
    }
    // One office under a regional office (vw_Office_Unit: a Commissioner division or a DM district)
    public class MstOfficeUnit
    {
        public int Unit_Code { get; set; }
        public string? Unit_Name { get; set; }
    }
    public class MstComplainSubType
    {
        public long Sub_Type_id { get; set; }
        public long Complain_Id { get; set; }
        public string? Sub_Type { get; set; }
    }
}
