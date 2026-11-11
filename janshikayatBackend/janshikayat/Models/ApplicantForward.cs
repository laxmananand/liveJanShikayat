using System.ComponentModel.DataAnnotations;

namespace janshikayat.Models
{
    // The statuses of an application, in workflow order. They are not stored: each one follows from the rows
    // the workflow writes, so a status can never disagree with them (Complain.StatusCase):
    //   Registered: saved in Tbl_Applicant_Details, not forwarded yet
    //   Forwarded : has a Tbl_Applicant_Forward row, the receiving office has not replied
    //   Pending   : the office replied (a Tbl_Applicant_Remarks row by a non-Admin role), waiting for Admin to close it
    //   Disposed  : closed by the DM / SP, or by the branch / section for a branch / section forward (never Admin)
    //               (a Tbl_Applicant_Closure row)
    public static class ApplicationStatus
    {
        public const string Registered = "Registered";
        public const string Forwarded = "Forwarded";
        public const string Pending = "Pending";
        public const string Disposed = "Disposed";
    }

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
        public string CategoryId { get; set; } = string.Empty;
        public string CategoryLabel { get; set; } = string.Empty;
        public string BranchId { get; set; } = string.Empty;
        public string BranchLabel { get; set; } = string.Empty;
        public string ComplaintTypeId { get; set; } = string.Empty;
        public string ComplaintTypeLabel { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public string ForwardedBy { get; set; } = string.Empty;
        public DateTime ForwardedAt { get; set; }
        public int? PrashakhaId { get; set; }
        public string? PrashakhaLabel { get; set; }
        public int? OfficeId { get; set; }
        public string? OfficeLabel { get; set; }
        public int? OfficeUnitCode { get; set; }
        public string? OfficeUnitLabel { get; set; }
        // Forwarded, Pending or Disposed (a forward just saved has no reply yet)
        public string Status { get; set; } = ApplicationStatus.Forwarded;
        // When the receiving office first replied, which moved it from Forwarded to Pending
        public DateTime? FirstResponseAt { get; set; }
        // Closed by Admin (Tbl_Applicant_Closure): status Disposed
        public bool IsDisposed { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? ClosedBy { get; set; }
        public string? ClosureRemarks { get; set; }
        // Onward forwards by the receiving Commissioner / IG / DIG to a DM and / or SP (Tbl_Applicant_Reforward)
        public List<ReforwardDto> Reforwards { get; set; } = new();
    }

    // Regional office kinds (Mst_Regional_Office.Office_Id)
    public static class OfficeKind
    {
        public const int Commissioner = 1;
        public const int DistrictMagistrate = 2;
        public const int InspectorGeneral = 3;
        public const int DeputyInspectorGeneral = 4;
        public const int SuperintendentOfPolice = 5;
        // Below a DM (Mst_SDO_Office / Mst_DCLR_Office, unit = SubDivisions.Sd_Code2) and an SP (Mst_SDPO_Office)
        public const int SubDivisionalOfficer = 6;
        public const int Dclr = 7;
        public const int Sdpo = 8;
        // Last level (010_co_thana_forward.sql): CO under SDO / DCLR (unit = Blocks.BlockCode), थाना under SDPO (mst_thana.PS_Code)
        public const int CircleOfficer = 9;
        public const int Thana = 10;

        // Logins that may forward what they received onward to DM / SP
        public static bool IsRegional(int? officeId) =>
            officeId is Commissioner or InspectorGeneral or DeputyInspectorGeneral;

        // Logins that forward onward to the offices under them (vw_Office_Hierarchy):
        // DM -> SDO / DCLR, SP -> SDPO, SDO / DCLR -> CO, SDPO -> थाना
        public static bool ForwardsDownHierarchy(int? officeId) =>
            officeId is DistrictMagistrate or SuperintendentOfPolice or SubDivisionalOfficer or Dclr or Sdpo;

        public static bool CanForwardOnward(int? officeId) => IsRegional(officeId) || ForwardsDownHierarchy(officeId);

        // Only the DM / SP that received an application closes it, when Admin sent it to a regional office or a DM / SP
        public static bool CanCloseApplications(int? officeId) =>
            officeId is DistrictMagistrate or SuperintendentOfPolice;
    }

    // Onward forward of a received application to one or more offices below the sender, each office at most once per
    // application: Commissioner / IG / DIG -> DM / SP of its jurisdiction, DM -> SDO / DCLR of its district,
    // SP -> DSP / SDPO of its police district. The server rejects any office not under the sender.
    public class ReforwardRequest
    {
        [Range(1, long.MaxValue)]
        public long ApplicantId { get; set; }
        // Dist_Codes of the DM offices to send to now
        public List<int>? DmUnitCodes { get; set; }
        // SP_Codes of the SP offices to send to now
        public List<int>? SpUnitCodes { get; set; }
        // Older clients: a single DM / SP office (merged with the lists above)
        public int? DmUnitCode { get; set; }
        public int? SpUnitCode { get; set; }
        // Sd_Code2 of the SDO / DCLR offices (sent by a DM)
        public List<int>? SdoUnitCodes { get; set; }
        public List<int>? DclrUnitCodes { get; set; }
        // SDPO_Codes of the DSP / SDPO offices (sent by an SP)
        public List<int>? SdpoUnitCodes { get; set; }
        // BlockCodes of the CO offices (sent by an SDO / DCLR)
        public List<int>? CoUnitCodes { get; set; }
        // PS_Codes of the police stations (sent by an SDPO)
        public List<int>? ThanaUnitCodes { get; set; }
        [StringLength(500)]
        public string? Remarks { get; set; }

        // Every (office kind, unit) requested, without repeats
        public IReadOnlyList<(int OfficeId, int UnitCode)> Targets()
        {
            var dm = (DmUnitCodes ?? new List<int>()).Concat(DmUnitCode is int d ? new[] { d } : Array.Empty<int>());
            var sp = (SpUnitCodes ?? new List<int>()).Concat(SpUnitCode is int s ? new[] { s } : Array.Empty<int>());
            IEnumerable<(int, int)> Of(int officeId, IEnumerable<int>? units) =>
                (units ?? Enumerable.Empty<int>()).Distinct().Select(u => (officeId, u));
            return Of(OfficeKind.DistrictMagistrate, dm)
                .Concat(Of(OfficeKind.SuperintendentOfPolice, sp))
                .Concat(Of(OfficeKind.SubDivisionalOfficer, SdoUnitCodes))
                .Concat(Of(OfficeKind.Dclr, DclrUnitCodes))
                .Concat(Of(OfficeKind.Sdpo, SdpoUnitCodes))
                .Concat(Of(OfficeKind.CircleOfficer, CoUnitCodes))
                .Concat(Of(OfficeKind.Thana, ThanaUnitCodes))
                .ToList();
        }
    }
    public class ReforwardDto
    {
        public long ID { get; set; }
        public long ApplicantId { get; set; }
        public int FromOfficeId { get; set; }
        public int FromOfficeUnitCode { get; set; }
        public string FromOfficeLabel { get; set; } = string.Empty;
        public int ToOfficeId { get; set; }
        public int ToOfficeUnitCode { get; set; }
        public string ToOfficeLabel { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public string ForwardedBy { get; set; } = string.Empty;
        public DateTime ForwardedAt { get; set; }
        // The onward forward that brought the application to the sender (DM / SP -> SDO / DCLR / SDPO);
        // null when the sender got it straight from Admin, or for Commissioner / IG / DIG -> DM / SP
        public long? ParentReforwardId { get; set; }
    }
    // An office the logged-in Commissioner / IG / DIG (DM / SP), DM (SDO / DCLR), SP (DSP / SDPO), SDO / DCLR (CO) or
    // SDPO (थाना) may forward to
    public class ReforwardTargetDto
    {
        public int OfficeId { get; set; }
        public int UnitCode { get; set; }
        public string UnitLabel { get; set; } = string.Empty;
        // The office of the application's own area (preselected in the popup): its district's DM / SP, its
        // subdivision's SDO / DCLR, the SDPO of its thana, its anchal's CO or its thana
        public bool IsApplicantDistrict { get; set; }
    }

    // Close a forwarded application, which moves it to Disposed: the DM / SP that received it when Admin sent it to a
    // regional office or a DM / SP; Admin only for forwards to a branch / section
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
        public string ClosedBy { get; set; } = string.Empty;
        public DateTime ClosedAt { get; set; }
        // Office / branch of the login that closed it (Track popup); null on the close response
        public string? ClosedByOffice { get; set; }
    }

    // Responses page: one forwarded application with replies. Admin: replies by any receiving office;
    // DM / SP: applications it forwarded onward or that got a remark (its own, or by SDO / DCLR / SDPO / CO / थाना under it)
    public class ApplicationResponseDto
    {
        public long ApplicantId { get; set; }
        public string CategoryLabel { get; set; } = string.Empty;
        public string BranchLabel { get; set; } = string.Empty;
        public string ComplaintTypeLabel { get; set; } = string.Empty;
        public string? PrashakhaLabel { get; set; }
        public string? OfficeLabel { get; set; }
        public string? OfficeUnitLabel { get; set; }
        public DateTime ForwardedAt { get; set; }
        // Remarks by roles other than Admin; Unseen = not yet opened by Admin
        public int ResponseCount { get; set; }
        public int UnseenCount { get; set; }
        public DateTime LastResponseAt { get; set; }
        public string LastRemark { get; set; } = string.Empty;
        public string LastRemarkBy { get; set; } = string.Empty;
        public string? LastRemarkByRole { get; set; }
        public bool IsDisposed { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? ClosedBy { get; set; }
        public string? ClosureRemarks { get; set; }
        // Whether this login may close it here: never Admin (view only); a DM / SP the applications that reached it
        public bool CanClose { get; set; }
        // Admin page: the application reached a DM / an SP, who can close it (both: whoever closes first)
        public bool ReachedDm { get; set; }
        public bool ReachedSp { get; set; }
        // Office of the login that wrote the last response (e.g. "CO Office, Araria, ARARIA"), when known
        public string? LastRemarkByOffice { get; set; }
        // DM / SP page: how many offices it forwarded the application to (an application with no remark yet is listed
        // once forwarded onward; its LastRemark is then empty)
        public int OnwardCount { get; set; }
    }

    // Public (citizen) tracking by Application_No: workflow status and applicant name, no other personal details
    public class PublicTrackingDto
    {
        public string ComplaintNumber { get; set; } = string.Empty;
        public string? ApplicantName { get; set; }
        // ApplicationStatus: Registered -> Forwarded -> Pending (office replied) -> Disposed (closed by Admin)
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
        public string Remark { get; set; } = string.Empty;
        public string RemarkBy { get; set; } = string.Empty;
        public string? RemarkByRole { get; set; }
        public DateTime CreatedDate { get; set; }
        // True when a PDF is attached; fetch it from get-remark-document/{ID}
        public bool HasDocument { get; set; }
        // Office / section / branch of the login that wrote it (e.g. "Commissioner Patna"), when known
        public string? RemarkByOffice { get; set; }
        // Writer's regional office (Mst_Regional_Office.Office_Id) and unit, to place the remark on the forward chain
        public int? RemarkByOfficeId { get; set; }
        public int? RemarkByUnitCode { get; set; }
    }

    // One hop of an application's forward chain: Admin -> office (level 1), Commissioner / IG / DIG -> DM / SP (level 2),
    // DM -> SDO / DCLR and SP -> DSP / SDPO (level 2 when Admin sent it to the DM / SP directly, else 3), and so on. ParentId links a hop to the one it continues, so the chain can be shown as a tree.
    public class ForwardHopDto
    {
        // "F<id>" for Tbl_Applicant_Forward, "R<id>" for Tbl_Applicant_Reforward
        public string Id { get; set; } = string.Empty;
        public string? ParentId { get; set; }
        public int Level { get; set; }
        public string FromLabel { get; set; } = string.Empty;
        // Mst_Regional_Office.Office_Id of the receiver, when it is a regional office (null: branch / section)
        public int? ToOfficeId { get; set; }
        public int? ToUnitCode { get; set; }
        public string ToLabel { get; set; } = string.Empty;
        // शाखा (Mst_Branch) and complaint type picked when forwarding; level 1 only for now
        public string? BranchLabel { get; set; }
        public string? ComplaintTypeLabel { get; set; }
        public string? Remarks { get; set; }
        public string ForwardedBy { get; set; } = string.Empty;
        public DateTime ForwardedAt { get; set; }
    }
}
