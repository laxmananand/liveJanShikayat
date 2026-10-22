using janshikayat.Models;

namespace janshikayat.BAL.Interfaces
{
    public interface IComplain
    {
        (long Flag, string Message, string? ApplicationNo) SaveApplicant(TblApplicantDetails applicant, string DocumentPath);
        IEnumerable<ApplicantDetailsDto> GetApplicants();
        IEnumerable<ApplicantDetailsDto> GetApplicantstatus(ApplicantDetailsDtoRequestParam request);
        ApplicantForwardDto? ForwardApplicant(ApplicantForwardRequest request, string forwardedBy, string? ip);
        IEnumerable<ApplicantForwardDto> GetForwards();
        bool IsForwarded(long applicantId);
        IEnumerable<ApplicantForwardDto> GetLatestForwards(bool all, long? branchId, int? prashakhaId);
        ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip);
        IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId);
    }
}
