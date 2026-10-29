namespace janshikayat.Models
{
    // Which applications a login may see, built from its JWT claims (Tbl_UserLogin mappings).
    // Admin: all. Branch / Prashakha / Commissioner / DM: only the applications forwarded to that office.
    public class AccessScope
    {
        public bool All { get; set; }
        public long? BranchId { get; set; }
        public int? PrashakhaId { get; set; }
        // Mst_Regional_Office.Office_Id (1 = Commissionary, 2 = District Magistrate) and its vw_Office_Unit.Unit_Code
        public int? OfficeId { get; set; }
        public int? OfficeUnitCode { get; set; }

        public bool IsEmpty => !All && BranchId == null && PrashakhaId == null && (OfficeId == null || OfficeUnitCode == null);
    }

    // Pendency Report drill-down: district -> block -> thana -> panchayat, then the applications.
    // A null code is "any"; Thana / Panchayat 0 = applications saved without one.
    public class PendencyReportRequest
    {
        // district | block | thana | panchayat (grouping of the counts)
        public string Level { get; set; } = "district";
        public int? District { get; set; }
        public long? Block { get; set; }
        public long? Thana { get; set; }
        public long? Panchayat { get; set; }
        // Application_Date range, both ends inclusive
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        // Application list only: '' = all, unforwarded | pending | disposed
        public string? Status { get; set; }
    }

    public class PendencyRowDto
    {
        public long Code { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Total { get; set; }
        // Not forwarded yet (only Admin can have these)
        public int Unforwarded { get; set; }
        // Forwarded, not closed
        public int Pending { get; set; }
        // Closed by Admin (Tbl_Applicant_Closure)
        public int Disposed { get; set; }
    }

    public class PendencyApplicationDto
    {
        public long ApplicantId { get; set; }
        public string? ApplicationNo { get; set; }
        public string ApplicantName { get; set; } = string.Empty;
        public string? FatherHusbandName { get; set; }
        public string? MobileNumber { get; set; }
        public DateTime? ApplicationDate { get; set; }
        public string DistrictName { get; set; } = string.Empty;
        public string BlockName { get; set; } = string.Empty;
        public string PanchayatName { get; set; } = string.Empty;
        public string VillageName { get; set; } = string.Empty;
        public string PoliceStation { get; set; } = string.Empty;
        public string? CategoryLabel { get; set; }
        public string? BranchLabel { get; set; }
        public string? ComplaintTypeLabel { get; set; }
        public string? PrashakhaLabel { get; set; }
        public string? OfficeLabel { get; set; }
        public string? OfficeUnitLabel { get; set; }
        public DateTime? ForwardedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        // Unforwarded | Pending | Disposed
        public string Status { get; set; } = string.Empty;
        // Days since the application was received, up to today or its closure
        public int PendingDays { get; set; }
    }
}
