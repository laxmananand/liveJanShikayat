using janshikayat.Models;

namespace janshikayat.BAL.Interfaces
{
    public interface IComplain
    {
        (long Flag, string Message, string? ApplicationNo) SaveApplicant(TblApplicantDetails applicant, string DocumentPath);
        IEnumerable<ApplicantDetailsDto> GetApplicants();
        IEnumerable<ApplicantDetailsDto> GetApplicantstatus(ApplicantDetailsDtoRequestParam request);
        ApplicantForwardDto? ForwardApplicant(ApplicantForwardRequest request, string forwardedBy, string? ip);
        IEnumerable<ApplicantForwardDto> GetForwards(string adminRole);
        bool IsForwarded(long applicantId);
        IEnumerable<ApplicantForwardDto> GetLatestForwards(AccessScope scope, string adminRole);
        ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip, string? documentPath,
                                      int? writerOfficeId, int? writerUnitCode);
        IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId);
        IEnumerable<ForwardHopDto> GetForwardHistory(long applicantId);
        string? GetRemarkDocumentPath(long remarkId);
        IEnumerable<ApplicationResponseDto> GetResponses(AccessScope scope, string adminRole);
        int GetUnseenResponseCount(AccessScope scope, string adminRole);
        void MarkResponsesSeen(long applicantId, AccessScope scope, string adminRole);
        bool IsClosed(long applicantId);
        ApplicationClosureDto? GetClosure(long applicantId);
        bool CanClose(long applicantId, AccessScope scope);
        ApplicationClosureDto? CloseApplication(ApplicationCloseRequest request, string closedBy, string? ip);
        (string? ApplicationNo, string? MobileNumber, string? MobileNumber2) GetSmsContact(long applicantId);
        PublicTrackingDto? TrackApplication(string applicationNo, string adminRole);
        IEnumerable<PendencyRowDto> GetPendencyReport(PendencyReportRequest request, AccessScope scope, string adminRole);
        IEnumerable<ReforwardTargetDto> GetReforwardTargets(long applicantId, int fromOfficeId, int fromUnitCode);
        IReadOnlyList<(int OfficeId, int UnitCode)> GetReforwardedOffices(long applicantId);
        IReadOnlyList<ReforwardDto>? Reforward(ReforwardRequest request, int fromOfficeId, int fromUnitCode, string forwardedBy, string? ip);
        IEnumerable<PendencyApplicationDto> GetPendencyApplications(PendencyReportRequest request, AccessScope scope, string adminRole);
    }
}
