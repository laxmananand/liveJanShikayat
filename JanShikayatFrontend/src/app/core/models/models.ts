export type AppRole = 'SuperAdmin' | 'BranchOfficer' | 'DepartmentHead' | 'CompetentAuthority';

export interface LoginResponse {
  token: string;
  expiresAt: string;
  email: string;
  fullName: string;
  role: AppRole;
  branchId: number | null;
  departmentId: number | null;
}

export interface CurrentUser {
  email: string;
  fullName: string;
  role: AppRole;
  branchId: number | null;
  departmentId: number | null;
}

export interface Branch {
  id: number;
  code: string;
  name: string;
  nameHindi?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  nameHindi?: string;
}

// ── Location masters (POST /Master/get-district | get-block | get-panchayat | get-village) ──
export interface MasterApiResponse<T> {
  status: string; // "true" | "false"
  message: string;
  data?: T[];
}

export interface District {
  districtcode: number;
  districtname: string;
}

export interface BlockMaster {
  distCode: number;
  blockCode: number;
  blockName: string;
  blockNameHN?: string;
}

export interface Panchayat {
  panchayatCode: number;
  panchayatName: string;
  panchayatNameHnd?: string;
  blockCode: number;
  districtCode: number;
}

export interface Village {
  villcode: number;
  villname: string;
  distcode: number;
  blockcode: number;
}

// ── Applicant (POST /Applicant/save-janshikayat_applicant-details, multipart/form-data) ──
export interface SaveApplicantPayload {
  applicantName: string;
  fatherHusbandName: string;
  mobileNumber: string;
  mobileNumber2?: string;
  address: string;
  pinCode: string;
  emailId?: string;
  applicationDate: string; // yyyy-MM-dd
  village: number;
  panchayat: number;
  block: number;
  district: number;
  applicationSource: string; // CPGRAMS | CM Dashboard | Sahyog Portal | PMO Grievance Portal | Offline | Other
  createdBy?: string;
  photograph: File;
}

export interface SaveApplicantResponse {
  flag: number;
  message: string;
  applicationNo: string | null; // 'JS' + District(3) + Block(4) + serial, e.g. JS23014140001
}

/** One row from GET /Applicant/get-all (usp_getApplicant + base64 document). */
export interface ApplicantRecord {
  id: number;
  applicationNo: string; // tracking number generated on finalise
  applicantName: string;
  fatherHusbandName: string;
  mobileNumber: string;
  mobileNumber2: string;
  address: string;
  pinCode: string;
  emailId: string;
  applicationDate: string | null;
  villageName: string;
  panchayatName: string;
  blockName: string;
  districtName: string;
  documentBase64: string | null; // base64 of the stored file, or null
  applicationSource: string;
}

/** One row from GET /Applicant/get-remarks/{id} (Tbl_Applicant_Remarks). */
export interface ApplicantRemark {
  id: number;
  applicantId: number;
  remark: string;
  remarkBy: string;
  remarkByRole: string | null; // Mst_Role name: Admin / Saction / Branch
  createdDate: string;
}

export interface CompetentAuthorityDesignation {
  id: number;
  code: string;
  title: string;
}

export type ComplaintStatus =
  | 'Pending'
  | 'UnderReview'
  | 'ForwardedToDepartment'
  | 'ForwardedForFieldEnquiry'
  | 'ActionTaken'
  | 'Disposed';

export interface ComplaintListItem {
  id: number;
  complaintNumber: string;
  applicantName: string;
  subject: string;
  complaintDate: string;
  status: ComplaintStatus;
  source: string;
  branchName: string; // empty for complaints submitted online by citizens
  departmentName: string | null;
}

export interface ComplaintDocument {
  id: number;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  downloadUrl: string;
}

export interface ComplaintRemark {
  id: number;
  remarkType: string;
  text: string;
  createdByName: string;
  createdAt: string;
}

export interface ComplaintHistoryEntry {
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  actionByName: string;
  actionAt: string;
}

export interface ComplaintDetail extends ComplaintListItem {
  guardianName: string;
  mobileNumber: string;
  address: string;
  district: string;
  block: string;
  policeStation?: string;
  area?: string;
  email?: string;
  oppositeParty?: string;
  category: string;
  subCategory?: string;
  description: string;
  closureRemarks?: string;
  closedAt?: string;
  documents: ComplaintDocument[];
  remarks: ComplaintRemark[];
  history: ComplaintHistoryEntry[];
}

export interface CreateComplaintPayload {
  applicantName: string;
  guardianName: string;
  mobileNumber: string;
  address: string;
  district: string;
  block: string;
  policeStation?: string;
  area?: string;
  email?: string;
  oppositeParty?: string;
  subject: string;
  category: string;
  subCategory?: string;
  description: string;
  complaintDate?: string;
  source: string;
  branchId: number;
  departmentId?: number;
}

export interface DashboardSummary {
  totalComplaints: number;
  pending: number;
  underReview: number;
  forwarded: number;
  underFieldEnquiry: number;
  disposed: number;
  onlineSubmissions: number;
}

// ---- Public (citizen) portal ----

export interface PublicComplaintPayload {
  applicantName: string;
  guardianName: string;
  mobileNumber: string;
  email?: string;
  address: string;
  district: string;
  block: string;
  policeStation?: string;
  area?: string;
  oppositeParty?: string;
  subject: string;
  category: string;
  subCategory?: string;
  description: string;
  departmentId?: number | null;
  captchaId: string;
  captchaCode: string;
}

export interface Captcha {
  captchaId: string;
  image: string; // data:image/png;base64,...
  expiresInSeconds: number;
}

export interface PublicComplaintCreated {
  complaintNumber: string;
  registeredAt: string;
  status: ComplaintStatus;
  documentAttached: boolean;
}

export interface PublicTimelineEntry {
  status: ComplaintStatus;
  at: string;
}

export interface PublicTracking {
  complaintNumber: string;
  status: ComplaintStatus;
  registeredAt: string;
  lastUpdatedAt: string;
  departmentName: string | null;
  departmentNameHindi: string | null;
  closedAt: string | null;
  timeline: PublicTimelineEntry[];
}
