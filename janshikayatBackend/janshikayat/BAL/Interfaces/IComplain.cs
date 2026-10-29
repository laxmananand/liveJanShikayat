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
        IEnumerable<ApplicantForwardDto> GetLatestForwards(AccessScope scope);
        ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip, string? documentPath);
        IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId);
        string? GetRemarkDocumentPath(long remarkId);
        IEnumerable<ApplicationResponseDto> GetResponses(string adminRole);
        int GetUnseenResponseCount(string adminRole);
        void MarkResponsesSeen(long applicantId, string adminRole);
        bool IsClosed(long applicantId);
        ApplicationClosureDto? CloseApplication(ApplicationCloseRequest request, string closedBy, string? ip);
        PublicTrackingDto? TrackApplication(string applicationNo, string adminRole);
        IEnumerable<PendencyRowDto> GetPendencyReport(PendencyReportRequest request, AccessScope scope);
        IEnumerable<PendencyApplicationDto> GetPendencyApplications(PendencyReportRequest request, AccessScope scope);
    }
}
