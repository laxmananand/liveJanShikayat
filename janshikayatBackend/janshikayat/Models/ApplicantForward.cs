using System.ComponentModel.DataAnnotations;

namespace janshikayat.Models
{
    // Admin only: forward an application (category → branch → complaint type)
    public class ApplicantForwardRequest
    {
        [Range(1, long.MaxValue)]
        public long ApplicantId { get; set; }
        [Required, StringLength(50)]
        public string CategoryId { get; set; } = string.Empty;
        [Required, StringLength(200)]
        public string CategoryLabel { get; set; } = string.Empty;
        [Required, StringLength(50)]
        public string BranchId { get; set; } = string.Empty;
        [Required, StringLength(300)]
        public string BranchLabel { get; set; } = string.Empty;
        [Required, StringLength(50)]
        public string ComplaintTypeId { get; set; } = string.Empty;
        [Required, StringLength(300)]
        public string ComplaintTypeLabel { get; set; } = string.Empty;
        [StringLength(500)]
        public string? Remarks { get; set; }
        // Required when the category is Section (Mst_Prashakha.ID)
        public int? PrashakhaId { get; set; }
        [StringLength(200)]
        public string? PrashakhaLabel { get; set; }
        // Required when the category is District Administration (Mst_Regional_Office / vw_Office_Unit)
        public int? OfficeId { get; set; }
        [StringLength(200)]
        public string? OfficeLabel { get; set; }
        public int? OfficeUnitCode { get; set; }
        [StringLength(300)]
        public string? OfficeUnitLabel { get; set; }
    }
    public class ApplicantForwardDto
    {
        public long ApplicantId { get; set; }
        public string CategoryId { get; set; }
        public string CategoryLabel { get; set; }
        public string BranchId { get; set; }
        public string BranchLabel { get; set; }
        public string ComplaintTypeId { get; set; }
        public string ComplaintTypeLabel { get; set; }
        public string? Remarks { get; set; }
        public string ForwardedBy { get; set; }
        public DateTime ForwardedAt { get; set; }
        public int? PrashakhaId { get; set; }
        public string? PrashakhaLabel { get; set; }
        public int? OfficeId { get; set; }
        public string? OfficeLabel { get; set; }
        public int? OfficeUnitCode { get; set; }
        public string? OfficeUnitLabel { get; set; }
        // Closed by Admin (Tbl_Applicant_Closure): status Disposed instead of Pending
        public bool IsDisposed { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? ClosedBy { get; set; }
        public string? ClosureRemarks { get; set; }
    }

    // Admin only: close a forwarded application, which moves it from Pending to Disposed
    public class ApplicationCloseRequest
    {
        [Range(1, long.MaxValue)]
        public long ApplicantId { get; set; }
        [StringLength(1000)]
        public string? Remarks { get; set; }
    }
    public class ApplicationClosureDto
    {
        public long ApplicantId { get; set; }
        public string? ClosureRemarks { get; set; }
        public string ClosedBy { get; set; }
        public DateTime ClosedAt { get; set; }
    }

    // Admin's Responses page: one forwarded application that the receiving office has replied to
    public class ApplicationResponseDto
    {
        public long ApplicantId { get; set; }
        public string CategoryLabel { get; set; }
        public string BranchLabel { get; set; }
        public string ComplaintTypeLabel { get; set; }
        public string? PrashakhaLabel { get; set; }
        public string? OfficeLabel { get; set; }
        public string? OfficeUnitLabel { get; set; }
        public DateTime ForwardedAt { get; set; }
        // Remarks by roles other than Admin; Unseen = not yet opened by Admin
        public int ResponseCount { get; set; }
        public int UnseenCount { get; set; }
        public DateTime LastResponseAt { get; set; }
        public string LastRemark { get; set; }
        public string LastRemarkBy { get; set; }
        public string? LastRemarkByRole { get; set; }
        public bool IsDisposed { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? ClosedBy { get; set; }
        public string? ClosureRemarks { get; set; }
    }

    // Public (citizen) tracking by Application_No: workflow status only, never personal details
    public class PublicTrackingDto
    {
        public string ComplaintNumber { get; set; } = string.Empty;
        // Pending -> ForwardedToDepartment -> ActionTaken (office replied) -> Disposed (closed by Admin)
        public string Status { get; set; } = string.Empty;
        public DateTime RegisteredAt { get; set; }
        public DateTime LastUpdatedAt { get; set; }
        public string? DepartmentName { get; set; }
        public string? DepartmentNameHindi { get; set; }
        public DateTime? ClosedAt { get; set; }
        public List<PublicTimelineEntryDto> Timeline { get; set; } = new();
    }
    public class PublicTimelineEntryDto
    {
        public string Status { get; set; } = string.Empty;
        public DateTime At { get; set; }
    }

    // Any logged-in user: add / view remarks on an application
    public class ApplicantRemarkRequest
    {
        [Range(1, long.MaxValue)]
        public long ApplicantId { get; set; }
        [Required, StringLength(1000)]
        public string Remark { get; set; } = string.Empty;
        // Optional PDF attached to the remark
        public IFormFile? Document { get; set; }
    }
    public class ApplicantRemarkDto
    {
        public long ID { get; set; }
        public long ApplicantId { get; set; }
        public string Remark { get; set; }
        public string RemarkBy { get; set; }
        public string? RemarkByRole { get; set; }
        public DateTime CreatedDate { get; set; }
        // True when a PDF is attached; fetch it from get-remark-document/{ID}
        public bool HasDocument { get; set; }
    }
}
