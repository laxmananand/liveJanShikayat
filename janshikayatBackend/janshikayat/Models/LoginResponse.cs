namespace janshikayat.Models
{
    public class LoginResponse
    {
        public string AuthToken { get; set; }
        public string userid { get; set; }
        public string username { get; set; }

        public string ROLE { get; set; }
        // Mst_Branch.Complain_id for branch logins; null for everyone else
        public long? branchId { get; set; }
        // Mst_Prashakha.ID for Prashakha logins; null for everyone else
        public int? prashakhaId { get; set; }

    }
}
