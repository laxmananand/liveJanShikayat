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
    }

    // Any logged-in user: add / view remarks on an application
    public class ApplicantRemarkRequest
    {
        [Range(1, long.MaxValue)]
        public long ApplicantId { get; set; }
        [Required, StringLength(1000)]
        public string Remark { get; set; } = string.Empty;
    }
    public class ApplicantRemarkDto
    {
        public long ID { get; set; }
        public long ApplicantId { get; set; }
        public string Remark { get; set; }
        public string RemarkBy { get; set; }
        public string? RemarkByRole { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}
