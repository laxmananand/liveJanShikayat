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
        public string? Category { get; set; }
    }
}
