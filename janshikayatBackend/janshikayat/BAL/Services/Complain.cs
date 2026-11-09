using janshikayat.BAL.Interfaces;
using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using janshikayat.Models;
using janshikayat.Data;
using Microsoft.AspNetCore.Mvc;

namespace janshikayat.BAL.Services
{
   
    public class Complain : IComplain
    {
        private readonly DapperContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IWebHostEnvironment _environment;

        public Complain(IConfiguration config, DapperContext context, IHttpContextAccessor httpContextAccessor, IWebHostEnvironment environment)
        {
            _config = config;
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _environment = environment;
        }

        public (long Flag, string Message, string? ApplicationNo) SaveApplicant(TblApplicantDetails applicant,string DocumentPath)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@Applicant_Name", applicant.Applicant_Name);
            parameters.Add("@Father_Husband_Name", applicant.Father_Husband_Name);
            parameters.Add("@Mobile_Number", applicant.Mobile_Number);
            parameters.Add("@Mobile_Number2", applicant.Mobile_Number2);
            parameters.Add("@Address", applicant.Address);
            parameters.Add("@Pin_Code", applicant.Pin_Code);
            parameters.Add("@Email_Id", applicant.Email_Id);
            parameters.Add("@Application_Date", applicant.Application_Date);
            parameters.Add("@Village", applicant.Village);
            parameters.Add("@Panchayat", applicant.Panchayat);
            parameters.Add("@Block", applicant.Block);
            parameters.Add("@District", applicant.District);
            parameters.Add("@Thana", applicant.Thana);
            parameters.Add("@SubDivision", applicant.SubDivision);
            parameters.Add("@AreaType", applicant.AreaType);
            parameters.Add("@Ward", applicant.Ward);
            parameters.Add("@Mohalla", applicant.Mohalla);
            parameters.Add("@DocumentPath", DocumentPath);
            parameters.Add("@Application_Source", applicant.Application_Source);
            parameters.Add("@CreatedBy", applicant.CreatedBy);
            parameters.Add("@CreatedIp", applicant.CreatedIp);
            parameters.Add("@Is_Active", applicant.Is_Active ?? true);
            var result = conn.QueryFirstOrDefault<(long Flag, string Message, string? ApplicationNo)>(
                "sp_InsertApplicantDetails",
                parameters,
                commandType: CommandType.StoredProcedure
            );

            return result;
        }
        public IEnumerable<ApplicantDetailsDto> GetApplicants()
        {
            using var conn = _context.CreateConnection();

            var applicants = conn.Query<ApplicantDetailsDto>(
                "usp_getApplicant",
                commandType: CommandType.StoredProcedure
            );


            foreach (var item in applicants)
            {
                item.DocumentPath =
                    ConvertFileToBase64(item.DocumentPath);
            }
            return applicants;
        }
        public string? ConvertFileToBase64(string? filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                return null;

            try
            {
                // Remove starting /
                filePath = filePath.TrimStart('/');

                // wwwroot/BiharStateDisability/filename.pdf
                string fullPath = Path.Combine(
                    _environment.WebRootPath,
                    filePath.Replace("/", Path.DirectorySeparatorChar.ToString())
                );

                if (!System.IO.File.Exists(fullPath))
                    return null;

                byte[] fileBytes = System.IO.File.ReadAllBytes(fullPath);

                string extension = Path.GetExtension(fullPath).ToLowerInvariant();

                string contentType = extension switch
                {
                    ".pdf" => "application/pdf",
                    ".jpg" => "image/jpeg",
                    ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".gif" => "image/gif",
                    _ => "application/octet-stream"
                };

                return $"data:{contentType};base64,{Convert.ToBase64String(fileBytes)}";
            }
            catch
            {
                return null;
            }
        }

        public IEnumerable<ApplicantDetailsDto> GetApplicantstatus(ApplicantDetailsDtoRequestParam request)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@District", request.District);
            parameters.Add("@Id", request.ID);
            parameters.Add("@status", request.Status);
            parameters.Add("@Application_No", request.Application_No);

            var applicants = conn.Query<ApplicantDetailsDto>(
                "usp_getApplicantstatus",
                param: parameters,
                commandType: CommandType.StoredProcedure
            );


            foreach (var item in applicants)
            {
                item.DocumentPath =
                    ConvertFileToBase64(item.DocumentPath);
            }
            return applicants;
        }

        // Returns null when the application does not exist (or is inactive), or the
        // branch / complaint type does not match the Mst_Category -> Mst_Branch -> Mst_Complain_Sub_Type mapping
        public ApplicantForwardDto? ForwardApplicant(ApplicantForwardRequest request, string forwardedBy, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters(request);
            parameters.Add("@ForwardedBy", forwardedBy);
            parameters.Add("@ForwardedIp", ip);

            return conn.QueryFirstOrDefault<ApplicantForwardDto>(
                @"INSERT INTO Tbl_Applicant_Forward
                       (ApplicantId, CategoryId, CategoryLabel, BranchId, BranchLabel,
                        ComplaintTypeId, ComplaintTypeLabel, Remarks, ForwardedBy, ForwardedIp,
                        PrashakhaId, PrashakhaLabel, OfficeId, OfficeLabel, OfficeUnitCode, OfficeUnitLabel)
                  OUTPUT inserted.ApplicantId, inserted.CategoryId, inserted.CategoryLabel, inserted.BranchId,
                         inserted.BranchLabel, inserted.ComplaintTypeId, inserted.ComplaintTypeLabel,
                         inserted.Remarks, inserted.ForwardedBy, inserted.ForwardedDate AS ForwardedAt,
                         inserted.PrashakhaId, inserted.PrashakhaLabel,
                         inserted.OfficeId, inserted.OfficeLabel, inserted.OfficeUnitCode, inserted.OfficeUnitLabel
                  SELECT @ApplicantId, @CategoryId, @CategoryLabel, @BranchId, @BranchLabel,
                         @ComplaintTypeId, @ComplaintTypeLabel, @Remarks, @ForwardedBy, @ForwardedIp,
                         @PrashakhaId, @PrashakhaLabel, @OfficeId, @OfficeLabel, @OfficeUnitCode, @OfficeUnitLabel
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND EXISTS (SELECT 1 FROM Mst_Branch b
                                WHERE b.Complain_id = TRY_CAST(@BranchId AS BIGINT) AND b.Is_Active = 1
                                  AND TRY_CAST(@CategoryId AS INT) IN (b.Home_Categ, b.Section_Categ, b.District_Categ, b.Regional_Categ))
                    AND EXISTS (SELECT 1 FROM Mst_Complain_Sub_Type s
                                WHERE s.Sub_Type_id = TRY_CAST(@ComplaintTypeId AS BIGINT)
                                  AND s.Complain_Id = TRY_CAST(@BranchId AS BIGINT))
                    -- Section needs a valid Prashakha; other categories must not carry one
                    AND (CASE WHEN EXISTS (SELECT 1 FROM Mst_Category c
                                           WHERE c.Category_Id = TRY_CAST(@CategoryId AS INT) AND c.Category = 'Section')
                              THEN CASE WHEN EXISTS (SELECT 1 FROM Mst_Prashakha p WHERE CAST(p.ID AS INT) = @PrashakhaId) THEN 1 ELSE 0 END
                              ELSE CASE WHEN @PrashakhaId IS NULL THEN 1 ELSE 0 END
                         END) = 1
                    -- District Administration / Regional Office need a regional office of that category, plus one of its
                    -- offices when it has a list; other categories must not carry either
                    AND (CASE WHEN EXISTS (SELECT 1 FROM Mst_Category c
                                           WHERE c.Category_Id = TRY_CAST(@CategoryId AS INT)
                                             AND c.Category IN ('District Administration', 'Regional Office'))
                              THEN CASE WHEN EXISTS (SELECT 1 FROM Mst_Regional_Office o
                                                     WHERE o.Office_Id = @OfficeId AND o.Is_Active = 1
                                                       AND o.Category_Id = TRY_CAST(@CategoryId AS INT)
                                                       AND (CASE WHEN EXISTS (SELECT 1 FROM vw_Office_Unit u WHERE u.Office_Id = o.Office_Id)
                                                                 THEN CASE WHEN EXISTS (SELECT 1 FROM vw_Office_Unit u
                                                                                        WHERE u.Office_Id = o.Office_Id AND u.Unit_Code = @OfficeUnitCode)
                                                                           THEN 1 ELSE 0 END
                                                                 ELSE CASE WHEN @OfficeUnitCode IS NULL THEN 1 ELSE 0 END
                                                            END) = 1) THEN 1 ELSE 0 END
                              ELSE CASE WHEN @OfficeId IS NULL AND @OfficeUnitCode IS NULL THEN 1 ELSE 0 END
                         END) = 1",
                parameters);
        }

        // An application is forwarded only once (UX_Applicant_Forward_ApplicantId)
        public bool IsForwarded(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<bool>(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM Tbl_Applicant_Forward WHERE ApplicantId = @ApplicantId) THEN 1 ELSE 0 END",
                new { ApplicantId = applicantId });
        }

        // Oldest first, so the last row per application is its latest forward
        public IEnumerable<ApplicantForwardDto> GetForwards(string adminRole)
        {
            using var conn = _context.CreateConnection();

            var forwards = conn.Query<ApplicantForwardDto>(
                @"SELECT f.ApplicantId, f.CategoryId, f.CategoryLabel, f.BranchId, f.BranchLabel,
                         f.ComplaintTypeId, f.ComplaintTypeLabel, f.Remarks, f.ForwardedBy, f.ForwardedDate AS ForwardedAt,
                         f.PrashakhaId, f.PrashakhaLabel, f.OfficeId, f.OfficeLabel, f.OfficeUnitCode, f.OfficeUnitLabel,
                         " + StatusColumns + ", " + ClosureColumns + @"
                  FROM Tbl_Applicant_Forward f
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = f.ApplicantId
                  " + FirstReplyApply + @"
                  ORDER BY f.ForwardedDate, f.ID",
                new { AdminRole = adminRole }).ToList();
            AttachReforwards(conn, forwards);
            return forwards;
        }

        // Latest forward per application, newest first, limited to what the login may see (ScopeFilter)
        public IEnumerable<ApplicantForwardDto> GetLatestForwards(AccessScope scope, string adminRole)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters(scope);
            parameters.Add("@AdminRole", adminRole);

            var forwards = conn.Query<ApplicantForwardDto>(
                @"SELECT f.ApplicantId, f.CategoryId, f.CategoryLabel, f.BranchId, f.BranchLabel,
                         f.ComplaintTypeId, f.ComplaintTypeLabel, f.Remarks, f.ForwardedBy, f.ForwardedDate AS ForwardedAt,
                         f.PrashakhaId, f.PrashakhaLabel, f.OfficeId, f.OfficeLabel, f.OfficeUnitCode, f.OfficeUnitLabel,
                         " + StatusColumns + ", " + ClosureColumns + @"
                  FROM (SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.ApplicantId ORDER BY x.ForwardedDate DESC, x.ID DESC) AS rn
                        FROM Tbl_Applicant_Forward x) f
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = f.ApplicantId
                  " + FirstReplyApply + @"
                  WHERE f.rn = 1 AND " + ScopeFilter + @"
                  ORDER BY f.ForwardedDate DESC, f.ID DESC",
                parameters).ToList();
            AttachReforwards(conn, forwards);
            return forwards;
        }

        // Fills ApplicantForwardDto.Reforwards (onward forwards by the Commissioner / IG / DIG to DM / SP)
        private static void AttachReforwards(IDbConnection conn, List<ApplicantForwardDto> forwards)
        {
            if (forwards.Count == 0)
                return;

            var byApplicant = conn.Query<ReforwardDto>(
                    @"SELECT " + ReforwardColumns + @"
                      FROM Tbl_Applicant_Reforward rf
                      WHERE rf.ApplicantId IN @Ids
                      ORDER BY rf.ForwardedDate, rf.ID",
                    new { Ids = forwards.Select(f => f.ApplicantId).Distinct().ToArray() })
                .ToLookup(r => r.ApplicantId);

            foreach (var f in forwards)
                f.Reforwards = byApplicant[f.ApplicantId].ToList();
        }

        private const string ReforwardColumns =
            @"rf.ID, rf.ApplicantId, rf.FromOfficeId, rf.FromOfficeUnitCode, rf.FromOfficeLabel,
              rf.ToOfficeId, rf.ToOfficeUnitCode, rf.ToOfficeLabel, rf.Remarks, rf.ForwardedBy, rf.ForwardedDate AS ForwardedAt,
              rf.ParentReforwardId";

        // DM (Office_Id 2) and SP (Office_Id 5) offices, aliased t, with the division / range they fall under
        private const string JurisdictionOffices =
            @"(SELECT 2 AS OfficeId, m.Dist_Code AS UnitCode, m.Head AS UnitLabel, m.Division_Code, m.Range_Code
               FROM Mst_DM_Office m
               UNION ALL
               SELECT 5, s.SP_Code, s.Head, s.Division_Code, s.Range_Code
               FROM Mst_SP_Office s) t";

        // t is under the sender: a Commissioner's division, or an IG / DIG's range (@FromOfficeId / @FromUnitCode)
        private const string InJurisdiction =
            @"((@FromOfficeId = 1 AND t.Division_Code = @FromUnitCode)
               OR (@FromOfficeId IN (3, 4) AND t.Range_Code = @FromUnitCode))";

        // Offices the logged-in user may forward this application to:
        //   Commissioner / IG / DIG: DM / SP offices of its division / range. The office of the application's own
        //     district comes first and is marked (for SP its main office, e.g. not SP Bagaha).
        //   DM / SP: the offices under it (vw_Office_Hierarchy). The SDO / DCLR of the application's subdivision, or
        //     the SDPO of its thana (Mst_Thana_SDPO), comes first and is marked.
        public IEnumerable<ReforwardTargetDto> GetReforwardTargets(long applicantId, int fromOfficeId, int fromUnitCode)
        {
            using var conn = _context.CreateConnection();

            if (OfficeKind.IsDistrictLevel(fromOfficeId))
            {
                return conn.Query<ReforwardTargetDto>(
                    @"SELECT h.Office_Id AS OfficeId, h.Unit_Code AS UnitCode, h.Unit_Name AS UnitLabel,
                             CAST(" + OwnAreaCase + @" AS BIT) AS IsApplicantDistrict
                      FROM vw_Office_Hierarchy h
                      CROSS JOIN (SELECT SubDivision, Thana FROM Tbl_Applicant_Details WHERE ID = @ApplicantId) d
                      WHERE h.Parent_Office_Id = @FromOfficeId AND h.Parent_Unit_Code = @FromUnitCode
                      ORDER BY h.Office_Id, " + OwnAreaCase + @" DESC, h.Unit_Name",
                    new { ApplicantId = applicantId, FromOfficeId = fromOfficeId, FromUnitCode = fromUnitCode });
            }

            return conn.Query<ReforwardTargetDto>(
                @"SELECT t.OfficeId, t.UnitCode, t.UnitLabel,
                         CAST(CASE WHEN t.UnitCode = d.District THEN 1 ELSE 0 END AS BIT) AS IsApplicantDistrict
                  FROM " + JurisdictionOffices + @"
                  CROSS JOIN (SELECT District FROM Tbl_Applicant_Details WHERE ID = @ApplicantId) d
                  WHERE " + InJurisdiction + @"
                  ORDER BY t.OfficeId, CASE WHEN t.UnitCode = d.District THEN 0 ELSE 1 END, t.UnitLabel",
                new { ApplicantId = applicantId, FromOfficeId = fromOfficeId, FromUnitCode = fromUnitCode });
        }

        // 1 when office h (vw_Office_Hierarchy) covers the application d (SubDivision, Thana) itself, else 0:
        // SDO / DCLR (6 / 7) of its subdivision, SDPO (8) of its thana
        private const string OwnAreaCase =
            @"CASE WHEN h.Office_Id IN (6, 7) AND h.Unit_Code = d.SubDivision THEN 1
                   WHEN h.Office_Id = 8 AND EXISTS (SELECT 1 FROM Mst_Thana_SDPO ts
                                                     WHERE ts.PS_Code = d.Thana AND ts.SDPO_Code = h.Unit_Code) THEN 1
                   ELSE 0 END";

        // Offices (kind and unit) this application was already forwarded onward to
        public IReadOnlyList<(int OfficeId, int UnitCode)> GetReforwardedOffices(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<(int, int)>(
                "SELECT ToOfficeId, ToOfficeUnitCode FROM Tbl_Applicant_Reforward WHERE ApplicantId = @ApplicantId",
                new { ApplicantId = applicantId }).ToList();
        }

        private const string ReforwardOutput =
            @"OUTPUT inserted.ID, inserted.ApplicantId, inserted.FromOfficeId, inserted.FromOfficeUnitCode,
                     inserted.FromOfficeLabel, inserted.ToOfficeId, inserted.ToOfficeUnitCode, inserted.ToOfficeLabel,
                     inserted.Remarks, inserted.ForwardedBy, inserted.ForwardedDate AS ForwardedAt, inserted.ParentReforwardId";

        private const string OpenApplication =
            @"EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
              AND NOT EXISTS (SELECT 1 FROM Tbl_Applicant_Closure WHERE ApplicantId = @ApplicantId)";

        // Commissioner / IG / DIG -> a DM / SP of its jurisdiction; the application must have been forwarded to it by Admin
        private const string RegionalReforwardInsert =
            @"INSERT INTO Tbl_Applicant_Reforward
                   (ApplicantId, ForwardId, FromOfficeId, FromOfficeUnitCode, FromOfficeLabel,
                    ToOfficeId, ToOfficeUnitCode, ToOfficeLabel, Remarks, ForwardedBy, ForwardedIp)
              " + ReforwardOutput + @"
              SELECT f.ApplicantId, f.ID, f.OfficeId, f.OfficeUnitCode, COALESCE(f.OfficeUnitLabel, f.OfficeLabel, ''),
                     t.OfficeId, t.UnitCode, t.UnitLabel, @Remarks, @ForwardedBy, @ForwardedIp
              FROM Tbl_Applicant_Forward f
              JOIN " + JurisdictionOffices + @"
                ON t.OfficeId = @ToOfficeId AND t.UnitCode = @ToUnitCode AND " + InJurisdiction + @"
              WHERE f.ApplicantId = @ApplicantId
                AND f.OfficeId = @FromOfficeId AND f.OfficeUnitCode = @FromUnitCode
                AND " + OpenApplication;

        // DM / SP -> an office directly under it (vw_Office_Hierarchy). The DM / SP must have received the application,
        // from Admin (Tbl_Applicant_Forward) or from a Commissioner / IG / DIG (Tbl_Applicant_Reforward, which becomes
        // the parent of this forward).
        private const string DistrictReforwardInsert =
            @"INSERT INTO Tbl_Applicant_Reforward
                   (ApplicantId, ForwardId, FromOfficeId, FromOfficeUnitCode, FromOfficeLabel,
                    ToOfficeId, ToOfficeUnitCode, ToOfficeLabel, Remarks, ForwardedBy, ForwardedIp, ParentReforwardId)
              " + ReforwardOutput + @"
              SELECT f.ApplicantId, f.ID, @FromOfficeId, @FromUnitCode,
                     COALESCE((SELECT TOP 1 u.Unit_Name FROM vw_Office_Unit u
                               WHERE u.Office_Id = @FromOfficeId AND u.Unit_Code = @FromUnitCode), ''),
                     h.Office_Id, h.Unit_Code, h.Unit_Name, @Remarks, @ForwardedBy, @ForwardedIp, rcv.ID
              FROM Tbl_Applicant_Forward f
              JOIN vw_Office_Hierarchy h
                ON h.Office_Id = @ToOfficeId AND h.Unit_Code = @ToUnitCode
               AND h.Parent_Office_Id = @FromOfficeId AND h.Parent_Unit_Code = @FromUnitCode
              OUTER APPLY (SELECT TOP 1 rf.ID FROM Tbl_Applicant_Reforward rf
                           WHERE rf.ApplicantId = f.ApplicantId
                             AND rf.ToOfficeId = @FromOfficeId AND rf.ToOfficeUnitCode = @FromUnitCode
                           ORDER BY rf.ID) rcv
              WHERE f.ApplicantId = @ApplicantId
                AND ((f.OfficeId = @FromOfficeId AND f.OfficeUnitCode = @FromUnitCode) OR rcv.ID IS NOT NULL)
                AND " + OpenApplication;

        // Saves one onward forward per requested office in one transaction. Returns null when the application did not
        // reach the sender, is closed, or an office is not under the sender (any one bad office saves nothing).
        public IReadOnlyList<ReforwardDto>? Reforward(ReforwardRequest request, int fromOfficeId, int fromUnitCode, string forwardedBy, string? ip)
        {
            var targets = request.Targets();
            var insertSql = OfficeKind.IsDistrictLevel(fromOfficeId) ? DistrictReforwardInsert : RegionalReforwardInsert;

            using var conn = _context.CreateConnection();
            conn.Open();
            using var tx = conn.BeginTransaction();

            var saved = new List<ReforwardDto>();
            foreach (var (officeId, unitCode) in targets)
            {
                var row = conn.QueryFirstOrDefault<ReforwardDto>(
                    insertSql,
                    new
                    {
                        request.ApplicantId,
                        FromOfficeId = fromOfficeId,
                        FromUnitCode = fromUnitCode,
                        ToOfficeId = officeId,
                        ToUnitCode = unitCode,
                        Remarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim(),
                        ForwardedBy = forwardedBy,
                        ForwardedIp = ip
                    },
                    tx);
                if (row == null)
                {
                    tx.Rollback();
                    return null;
                }
                saved.Add(row);
            }

            tx.Commit();
            return saved;
        }

        // Applications a login may see, for a query whose forward is f (Tbl_Applicant_Forward, LEFT JOINed
        // where unforwarded applications count) and whose parameters are an AccessScope:
        //   Admin all; Branch / Prashakha their forwards; Commissioner its own forwards and those to the DM offices
        //   of its division; DM / IG / DIG / SP their own forwards; every office also those forwarded onward to it
        //   (Tbl_Applicant_Reforward: DM / SP from Commissioner / IG / DIG, SDO / DCLR from DM, SDPO from SP)
        private const string ScopeFilter =
            @"(@All = 1
               OR (@BranchId IS NOT NULL AND f.BranchId = CAST(@BranchId AS VARCHAR(50)))
               OR (@PrashakhaId IS NOT NULL AND f.PrashakhaId = @PrashakhaId)
               OR (@OfficeId = 1 AND ((f.OfficeId = 1 AND f.OfficeUnitCode = @OfficeUnitCode)
                                      OR (f.OfficeId = 2 AND f.OfficeUnitCode IN (SELECT m.Dist_Code FROM Mst_DM_Office m
                                                                                  WHERE m.Division_Code = @OfficeUnitCode))))
               OR (@OfficeId IN (2, 3, 4, 5) AND f.OfficeId = @OfficeId AND f.OfficeUnitCode = @OfficeUnitCode)
               OR (@OfficeId IS NOT NULL AND EXISTS (SELECT 1 FROM Tbl_Applicant_Reforward rf
                                                     WHERE rf.ApplicantId = f.ApplicantId
                                                       AND rf.ToOfficeId = @OfficeId AND rf.ToOfficeUnitCode = @OfficeUnitCode)))";

        // When the receiving office first replied (a remark by a role other than Admin), for a query whose forward is f.
        // NULL when it has not replied, or when f is NULL (not forwarded). Needs the @AdminRole parameter.
        private const string FirstReplyApply =
            @"OUTER APPLY (SELECT MIN(m.CreatedDate) AS FirstResponseAt
                           FROM Tbl_Applicant_Remarks m
                           WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> @AdminRole) r";

        // The one rule for an application's status (ApplicationStatus), for a query with f (forward, LEFT JOINed where
        // unforwarded applications count), c (closure, LEFT JOIN) and r (FirstReplyApply). A new status starts here.
        private const string StatusCase =
            "CASE WHEN c.ID IS NOT NULL THEN '" + ApplicationStatus.Disposed + @"'
                  WHEN f.ID IS NULL THEN '" + ApplicationStatus.Registered + @"'
                  WHEN r.FirstResponseAt IS NOT NULL THEN '" + ApplicationStatus.Pending + @"'
                  ELSE '" + ApplicationStatus.Forwarded + "' END";

        private const string StatusColumns = StatusCase + " AS Status, r.FirstResponseAt";

        private static string StatusCount(string status) =>
            $"SUM(CASE WHEN {StatusCase} = '{status}' THEN 1 ELSE 0 END) AS {status}";

        // Pendency Report: shared FROM / WHERE. An application is forwarded once (UX_Applicant_Forward_ApplicantId),
        // so f is its forward or NULL; c is its closure or NULL. Village / thana / panchayat may be 0 (not selected).
        private const string PendencySource =
            @"FROM Tbl_Applicant_Details d
              LEFT JOIN Tbl_Applicant_Forward f ON f.ApplicantId = d.ID
              LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = d.ID
              " + FirstReplyApply + @"
              LEFT JOIN mst_Commissionary_Districts dist ON dist.DISTRICTCODE = d.District
              LEFT JOIN SubDivisions sd ON sd.Sd_Code2 = d.SubDivision
              LEFT JOIN Blocks b ON b.BlockCode = d.Block AND b.DistCode = d.District
              LEFT JOIN mst_Panchayats pt ON pt.PanchayatCode = d.Panchayat AND pt.BlockCode = d.Block AND pt.DistrictCode = d.District
              LEFT JOIN mst_thana th ON th.PS_Code = d.Thana
              WHERE d.Is_Active = 1
                AND (@District IS NULL OR d.District = @District)
                AND (@Block IS NULL OR d.Block = @Block)
                AND (@Thana IS NULL OR ISNULL(d.Thana, 0) = @Thana)
                AND (@Panchayat IS NULL OR ISNULL(d.Panchayat, 0) = @Panchayat)
                AND (@FromDate IS NULL OR d.Application_Date >= @FromDate)
                AND (@ToDate IS NULL OR d.Application_Date < DATEADD(DAY, 1, @ToDate))
                AND ";

        private static DynamicParameters PendencyParameters(PendencyReportRequest request, AccessScope scope, string adminRole)
        {
            var parameters = new DynamicParameters(scope);
            parameters.Add("@AdminRole", adminRole);
            parameters.Add("@District", request.District);
            parameters.Add("@Block", request.Block);
            parameters.Add("@Thana", request.Thana);
            parameters.Add("@Panchayat", request.Panchayat);
            parameters.Add("@FromDate", request.FromDate?.Date);
            parameters.Add("@ToDate", request.ToDate?.Date);
            return parameters;
        }

        // Counts per district / block / thana / panchayat; the grouping columns come from this fixed list, never the request
        public IEnumerable<PendencyRowDto> GetPendencyReport(PendencyReportRequest request, AccessScope scope, string adminRole)
        {
            var (code, name) = (request.Level ?? "").ToLowerInvariant() switch
            {
                "block" => ("CAST(ISNULL(d.Block, 0) AS BIGINT)", "b.BlockName"),
                "thana" => ("CAST(ISNULL(d.Thana, 0) AS BIGINT)", "th.Police_Station"),
                "panchayat" => ("CAST(ISNULL(d.Panchayat, 0) AS BIGINT)", "pt.PanchayatName"),
                _ => ("CAST(ISNULL(d.District, 0) AS BIGINT)", "dist.DISTRICTNAME")
            };

            using var conn = _context.CreateConnection();

            return conn.Query<PendencyRowDto>(
                $@"SELECT {code} AS Code, ISNULL(MAX({name}), '') AS Name,
                          COUNT(*) AS Total,
                          {StatusCount(ApplicationStatus.Registered)},
                          {StatusCount(ApplicationStatus.Forwarded)},
                          {StatusCount(ApplicationStatus.Pending)},
                          {StatusCount(ApplicationStatus.Disposed)}
                   " + PendencySource + ScopeFilter + $@"
                   GROUP BY {code}
                   ORDER BY CASE WHEN {code} = 0 THEN 1 ELSE 0 END, Name",
                PendencyParameters(request, scope, adminRole));
        }

        // The applications behind a count, undisposed ones first and the oldest of them on top
        public IEnumerable<PendencyApplicationDto> GetPendencyApplications(PendencyReportRequest request, AccessScope scope, string adminRole)
        {
            var parameters = PendencyParameters(request, scope, adminRole);
            parameters.Add("@Status", (request.Status ?? "").ToLowerInvariant());

            using var conn = _context.CreateConnection();

            return conn.Query<PendencyApplicationDto>(
                @"SELECT d.ID AS ApplicantId, d.Application_No AS ApplicationNo, d.Applicant_Name AS ApplicantName,
                         d.Father_Husband_Name AS FatherHusbandName, d.Mobile_Number AS MobileNumber,
                         d.Application_Date AS ApplicationDate,
                         ISNULL(dist.DISTRICTNAME, '') AS DistrictName, ISNULL(sd.Sd_Name_En, '') AS SubDivisionName,
                         ISNULL(b.BlockName, '') AS BlockName,
                         ISNULL(th.Police_Station, '') AS PoliceStation,
                         f.CategoryLabel, f.BranchLabel, f.ComplaintTypeLabel, f.PrashakhaLabel, f.OfficeLabel, f.OfficeUnitLabel,
                         f.ForwardedDate AS ForwardedAt, c.ClosedDate AS ClosedAt,
                         " + StatusCase + @" AS Status,
                         DATEDIFF(DAY, ISNULL(d.Application_Date, d.CreatedDate), ISNULL(c.ClosedDate, GETDATE())) AS PendingDays
                  " + PendencySource + ScopeFilter + @"
                    AND (@Status = '' OR LOWER(" + StatusCase + @") = @Status)
                  ORDER BY CASE WHEN c.ID IS NULL THEN 0 ELSE 1 END, ISNULL(d.Application_Date, d.CreatedDate), d.ID",
                parameters);
        }

        // Returns null when the application does not exist (or is inactive)
        public ApplicantRemarkDto? AddRemark(ApplicantRemarkRequest request, string remarkBy, string? role, string? ip, string? documentPath)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ApplicantId", request.ApplicantId);
            parameters.Add("@Remark", request.Remark.Trim());
            parameters.Add("@RemarkBy", remarkBy);
            parameters.Add("@RemarkByRole", role);
            parameters.Add("@CreatedIp", ip);
            parameters.Add("@DocumentPath", documentPath);

            return conn.QueryFirstOrDefault<ApplicantRemarkDto>(
                @"INSERT INTO Tbl_Applicant_Remarks (ApplicantId, Remark, RemarkBy, RemarkByRole, CreatedIp, DocumentPath)
                  OUTPUT inserted.ID, inserted.ApplicantId, inserted.Remark, inserted.RemarkBy,
                         inserted.RemarkByRole, inserted.CreatedDate,
                         CAST(CASE WHEN inserted.DocumentPath IS NULL THEN 0 ELSE 1 END AS BIT) AS HasDocument
                  SELECT @ApplicantId, @Remark, @RemarkBy, @RemarkByRole, @CreatedIp, @DocumentPath
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND NOT EXISTS (SELECT 1 FROM Tbl_Applicant_Closure WHERE ApplicantId = @ApplicantId)",
                parameters);
        }

        public IEnumerable<ApplicantRemarkDto> GetRemarks(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicantRemarkDto>(
                @"SELECT m.ID, m.ApplicantId, m.Remark, m.RemarkBy, m.RemarkByRole, m.CreatedDate,
                         CAST(CASE WHEN m.DocumentPath IS NULL THEN 0 ELSE 1 END AS BIT) AS HasDocument,
                         o.RemarkByOffice, o.RemarkByOfficeId, o.RemarkByUnitCode
                  FROM Tbl_Applicant_Remarks m
                  -- The writer's office (Commissioner / DM / ...), section or branch, from its login
                  OUTER APPLY (SELECT TOP 1 COALESCE(ou.Unit_Name, p.Name, b.Branch_Hindi) AS RemarkByOffice,
                                      u.Office_Id AS RemarkByOfficeId, u.Office_Unit_Code AS RemarkByUnitCode
                               FROM Tbl_UserLogin u
                               LEFT JOIN vw_Office_Unit ou ON ou.Office_Id = u.Office_Id AND ou.Unit_Code = u.Office_Unit_Code
                               LEFT JOIN Mst_Prashakha p ON CAST(p.ID AS INT) = u.Prashakha_Id
                               LEFT JOIN Mst_Branch b ON b.Complain_id = u.Branch_Id
                               WHERE u.UserName = m.RemarkBy) o
                  WHERE m.ApplicantId = @ApplicantId
                  ORDER BY m.CreatedDate, m.ID",
                new { ApplicantId = applicantId });
        }

        // Who forwards from the Admin login
        private const string AdminDepartmentLabel = "गृह विभाग";

        // Every hop of the forward chain, top level first, each level oldest first. Onward forwards hang under the
        // forward that brought the application to their sender (ParentReforwardId), else under Admin's forward, at any
        // depth: a new level (e.g. SDO / DCLR -> CO, SDPO -> thana) needs no change here.
        public IEnumerable<ForwardHopDto> GetForwardHistory(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ForwardHopDto>(
                @"WITH chain AS (
                      SELECT rf.ID, rf.ForwardId, rf.ParentReforwardId, 2 AS Level
                      FROM Tbl_Applicant_Reforward rf
                      WHERE rf.ApplicantId = @ApplicantId AND rf.ParentReforwardId IS NULL
                      UNION ALL
                      SELECT c.ID, c.ForwardId, c.ParentReforwardId, p.Level + 1
                      FROM Tbl_Applicant_Reforward c
                      JOIN chain p ON c.ParentReforwardId = p.ID
                  )
                  SELECT h.* FROM (
                      SELECT 'F' + CAST(f.ID AS VARCHAR(20)) AS Id, CAST(NULL AS VARCHAR(21)) AS ParentId, 1 AS Level,
                             @AdminDepartment AS FromLabel, f.OfficeId AS ToOfficeId, f.OfficeUnitCode AS ToUnitCode,
                             COALESCE(f.OfficeUnitLabel, f.OfficeLabel, f.PrashakhaLabel, f.BranchLabel, '') AS ToLabel,
                             f.BranchLabel, f.ComplaintTypeLabel, f.Remarks, f.ForwardedBy, f.ForwardedDate AS ForwardedAt, f.ID AS Seq
                      FROM Tbl_Applicant_Forward f
                      WHERE f.ApplicantId = @ApplicantId
                      UNION ALL
                      SELECT 'R' + CAST(rf.ID AS VARCHAR(20)),
                             CASE WHEN ch.ParentReforwardId IS NULL THEN 'F' + CAST(rf.ForwardId AS VARCHAR(20))
                                  ELSE 'R' + CAST(ch.ParentReforwardId AS VARCHAR(20)) END,
                             ch.Level,
                             rf.FromOfficeLabel, rf.ToOfficeId, rf.ToOfficeUnitCode, rf.ToOfficeLabel,
                             NULL, NULL, rf.Remarks, rf.ForwardedBy, rf.ForwardedDate, rf.ID
                      FROM chain ch
                      JOIN Tbl_Applicant_Reforward rf ON rf.ID = ch.ID
                  ) h
                  ORDER BY h.Level, h.ForwardedAt, h.Seq",
                new { ApplicantId = applicantId, AdminDepartment = AdminDepartmentLabel });
        }

        // Stored file name of the PDF attached to a remark, or null when there is none
        public string? GetRemarkDocumentPath(long remarkId)
        {
            using var conn = _context.CreateConnection();

            return conn.QueryFirstOrDefault<string?>(
                "SELECT DocumentPath FROM Tbl_Applicant_Remarks WHERE ID = @ID",
                new { ID = remarkId });
        }

        // Public tracking: null when no active application has this number.
        // Each workflow step that has happened becomes a timeline entry; the last one is the current status.
        public PublicTrackingDto? TrackApplication(string applicationNo, string adminRole)
        {
            using var conn = _context.CreateConnection();

            var row = conn.QueryFirstOrDefault<PublicTrackingRow>(
                @"SELECT d.Application_No, d.Applicant_Name, d.CreatedDate,
                         f.ForwardedDate, f.BranchLabel, f.PrashakhaLabel, f.OfficeLabel, f.OfficeUnitLabel,
                         r.FirstResponseAt, c.ClosedDate
                  FROM Tbl_Applicant_Details d
                  LEFT JOIN Tbl_Applicant_Forward f ON f.ApplicantId = d.ID
                  " + FirstReplyApply + @"
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = d.ID
                  WHERE d.Application_No = @ApplicationNo AND d.Is_Active = 1",
                new { ApplicationNo = applicationNo, AdminRole = adminRole });
            if (row == null)
                return null;

            var registeredAt = row.CreatedDate ?? DateTime.Now;
            var timeline = new List<PublicTimelineEntryDto> { new() { Status = ApplicationStatus.Registered, At = registeredAt } };
            if (row.ForwardedDate != null)
                timeline.Add(new() { Status = ApplicationStatus.Forwarded, At = row.ForwardedDate.Value });
            if (row.FirstResponseAt != null)
                timeline.Add(new() { Status = ApplicationStatus.Pending, At = row.FirstResponseAt.Value });
            if (row.ClosedDate != null)
                timeline.Add(new() { Status = ApplicationStatus.Disposed, At = row.ClosedDate.Value });

            var office = row.OfficeUnitLabel ?? row.OfficeLabel ?? row.PrashakhaLabel;
            return new PublicTrackingDto
            {
                ComplaintNumber = row.Application_No,
                ApplicantName = row.Applicant_Name,
                Status = timeline[^1].Status,
                RegisteredAt = registeredAt,
                LastUpdatedAt = timeline[^1].At,
                DepartmentName = row.BranchLabel == null ? null : office == null ? row.BranchLabel : $"{row.BranchLabel} • {office}",
                ClosedAt = row.ClosedDate,
                Timeline = timeline
            };
        }

        private class PublicTrackingRow
        {
            public string Application_No { get; set; } = string.Empty;
            public string? Applicant_Name { get; set; }
            public DateTime? CreatedDate { get; set; }
            public DateTime? ForwardedDate { get; set; }
            public string? BranchLabel { get; set; }
            public string? PrashakhaLabel { get; set; }
            public string? OfficeLabel { get; set; }
            public string? OfficeUnitLabel { get; set; }
            public DateTime? FirstResponseAt { get; set; }
            public DateTime? ClosedDate { get; set; }
        }

        // Closure fields for a query that LEFT JOINs Tbl_Applicant_Closure as c
        private const string ClosureColumns =
            @"CAST(CASE WHEN c.ID IS NULL THEN 0 ELSE 1 END AS BIT) AS IsDisposed,
              c.ClosedDate AS ClosedAt, c.ClosedBy, c.ClosureRemarks";

        // Forwarded applications with at least one reply (a remark by a role other than Admin).
        // Pending ones first, each group with the latest reply first.
        public IEnumerable<ApplicationResponseDto> GetResponses(string adminRole)
        {
            using var conn = _context.CreateConnection();

            return conn.Query<ApplicationResponseDto>(
                @"SELECT f.ApplicantId, f.CategoryLabel, f.BranchLabel, f.ComplaintTypeLabel,
                         f.PrashakhaLabel, f.OfficeLabel, f.OfficeUnitLabel, f.ForwardedDate AS ForwardedAt,
                         r.ResponseCount, r.UnseenCount, r.LastResponseAt,
                         lr.Remark AS LastRemark, lr.RemarkBy AS LastRemarkBy, lr.RemarkByRole AS LastRemarkByRole,
                         " + ClosureColumns + @"
                  FROM Tbl_Applicant_Forward f
                  CROSS APPLY (SELECT COUNT(*) AS ResponseCount,
                                      SUM(CASE WHEN m.SeenByAdminDate IS NULL THEN 1 ELSE 0 END) AS UnseenCount,
                                      MAX(m.CreatedDate) AS LastResponseAt
                               FROM Tbl_Applicant_Remarks m
                               WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> @AdminRole) r
                  OUTER APPLY (SELECT TOP 1 m.Remark, m.RemarkBy, m.RemarkByRole
                               FROM Tbl_Applicant_Remarks m
                               WHERE m.ApplicantId = f.ApplicantId AND ISNULL(m.RemarkByRole, '') <> @AdminRole
                               ORDER BY m.CreatedDate DESC, m.ID DESC) lr
                  LEFT JOIN Tbl_Applicant_Closure c ON c.ApplicantId = f.ApplicantId
                  WHERE r.ResponseCount > 0
                  ORDER BY CASE WHEN c.ID IS NULL THEN 0 ELSE 1 END, r.LastResponseAt DESC",
                new { AdminRole = adminRole });
        }

        // Pending applications with a reply Admin has not opened yet (the sidebar badge)
        public int GetUnseenResponseCount(string adminRole)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<int>(
                @"SELECT COUNT(DISTINCT m.ApplicantId)
                  FROM Tbl_Applicant_Remarks m
                  JOIN Tbl_Applicant_Forward f ON f.ApplicantId = m.ApplicantId
                  WHERE m.SeenByAdminDate IS NULL AND ISNULL(m.RemarkByRole, '') <> @AdminRole
                    AND NOT EXISTS (SELECT 1 FROM Tbl_Applicant_Closure c WHERE c.ApplicantId = m.ApplicantId)",
                new { AdminRole = adminRole });
        }

        public void MarkResponsesSeen(long applicantId, string adminRole)
        {
            using var conn = _context.CreateConnection();

            conn.Execute(
                @"UPDATE Tbl_Applicant_Remarks SET SeenByAdminDate = GETDATE()
                  WHERE ApplicantId = @ApplicantId AND SeenByAdminDate IS NULL AND ISNULL(RemarkByRole, '') <> @AdminRole",
                new { ApplicantId = applicantId, AdminRole = adminRole });
        }

        // An application is closed only once (UX_Applicant_Closure_ApplicantId)
        public bool IsClosed(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.ExecuteScalar<bool>(
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM Tbl_Applicant_Closure WHERE ApplicantId = @ApplicantId) THEN 1 ELSE 0 END",
                new { ApplicantId = applicantId });
        }

        // Returns null when the application does not exist (or is inactive) or has not been forwarded
        public ApplicationClosureDto? CloseApplication(ApplicationCloseRequest request, string closedBy, string? ip)
        {
            using var conn = _context.CreateConnection();

            var parameters = new DynamicParameters();
            parameters.Add("@ApplicantId", request.ApplicantId);
            parameters.Add("@ClosureRemarks", string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim());
            parameters.Add("@ClosedBy", closedBy);
            parameters.Add("@ClosedIp", ip);

            return conn.QueryFirstOrDefault<ApplicationClosureDto>(
                @"INSERT INTO Tbl_Applicant_Closure (ApplicantId, ClosureRemarks, ClosedBy, ClosedIp)
                  OUTPUT inserted.ApplicantId, inserted.ClosureRemarks, inserted.ClosedBy, inserted.ClosedDate AS ClosedAt
                  SELECT @ApplicantId, @ClosureRemarks, @ClosedBy, @ClosedIp
                  WHERE EXISTS (SELECT 1 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId AND Is_Active = 1)
                    AND EXISTS (SELECT 1 FROM Tbl_Applicant_Forward WHERE ApplicantId = @ApplicantId)",
                parameters);
        }

        // Application number and mobile numbers for an SMS to the applicant (all null when not found)
        public (string? ApplicationNo, string? MobileNumber, string? MobileNumber2) GetSmsContact(long applicantId)
        {
            using var conn = _context.CreateConnection();

            return conn.QueryFirstOrDefault<(string? ApplicationNo, string? MobileNumber, string? MobileNumber2)>(
                "SELECT Application_No, Mobile_Number, Mobile_Number2 FROM Tbl_Applicant_Details WHERE ID = @ApplicantId",
                new { ApplicantId = applicantId });
        }
    }
}
