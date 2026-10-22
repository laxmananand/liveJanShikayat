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
    // Mst_Branch row offered for a category (Home_Categ / Section_Categ / Department_Categ)
    public class MstBranch
    {
        public long Complain_id { get; set; }
        public string? Branch_Eng { get; set; }
        public string? Branch_Hindi { get; set; }
    }
    public class MstComplainSubType
    {
        public long Sub_Type_id { get; set; }
        public long Complain_Id { get; set; }
        public string? Sub_Type { get; set; }
    }
}
