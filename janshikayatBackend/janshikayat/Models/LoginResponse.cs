namespace janshikayat.Models
{
    public class LoginResponse
    {
        public string AuthToken { get; set; } = string.Empty;
        public string userid { get; set; } = string.Empty;
        public string username { get; set; } = string.Empty;

        public string ROLE { get; set; } = string.Empty;
        // Mst_Branch.Complain_id for branch logins; null for everyone else
        public long? branchId { get; set; }
        // Mst_Prashakha.ID for Prashakha logins; null for everyone else
        public int? prashakhaId { get; set; }
        // Mst_Regional_Office.Office_Id and vw_Office_Unit.Unit_Code for Commissioner / DM / IG / DIG / SP logins; null for everyone else
        public int? officeId { get; set; }
        public int? officeUnitCode { get; set; }
        // True when Tbl_UserLogin.MobileNo is empty or not a 10-digit number: the login page then asks for one (skippable)
        public bool mobileRequired { get; set; }

    }
}
