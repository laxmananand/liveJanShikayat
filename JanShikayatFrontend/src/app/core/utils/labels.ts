import { ComplaintStatus } from '../models/models';

/**
 * The application statuses, in workflow order. The server works them out (Complain.StatusCase);
 * every label, stage bar, filter and progress bar comes from this list, so a new status is added here.
 */
export const STATUS_STAGES: readonly { key: ComplaintStatus; label: string; icon: string }[] = [
  { key: 'Registered', label: 'पंजीकृत', icon: 'fa-file-circle-check' },
  { key: 'Forwarded', label: 'अग्रेषित', icon: 'fa-share-nodes' },
  { key: 'Pending', label: 'लंबित', icon: 'fa-hourglass-half' },
  { key: 'Disposed', label: 'निष्पादित', icon: 'fa-flag-checkered' }
];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_STAGES.map((s) => [s.key, s.label]));

export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'सुपर एडमिन',
  BranchOfficer: 'शाखा अधिकारी',
  DepartmentHead: 'विभागाध्यक्ष',
  CompetentAuthority: 'सक्षम प्राधिकारी',
  Commissioner: 'प्रमंडलीय आयुक्त',
  DistrictMagistrate: 'जिलाधिकारी',
  InspectorGeneral: 'पुलिस महानिरीक्षक',
  DeputyInspectorGeneral: 'पुलिस उप-महानिरीक्षक',
  SuperintendentOfPolice: 'पुलिस अधीक्षक',
  SubDivisionalOfficer: 'अनुमंडल पदाधिकारी',
  Dclr: 'भूमि सुधार उप समाहर्ता',
  Sdpo: 'पुलिस उपाधीक्षक / अनुमंडल पुलिस पदाधिकारी'
};

export const SOURCE_LABELS: Record<string, string> = {
  Offline: 'ऑफ़लाइन',
  CPGRAMS: 'सीपीग्राम्स',
  CMJaibodha: 'सीएम जय बोध',
  PMOGrievancePortal: 'पीएमओ शिकायत पोर्टल',
  Other: 'अन्य',
  Online: 'ऑनलाइन (नागरिक पोर्टल)'
};

export const REMARK_TYPE_LABELS: Record<string, string> = {
  Enquiry: 'जांच टिप्पणी',
  Official: 'कार्यालयी / कार्रवाई टिप्पणी'
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return STATUS_LABELS[status] ?? status;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return '—';
  return SOURCE_LABELS[source] ?? source;
}

export function remarkTypeLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return REMARK_TYPE_LABELS[type] ?? type;
}

/** An application's status from its forward: the server sets it on every forward; no forward = Registered. */
export function applicationStatus(forward: { status?: ComplaintStatus } | null | undefined): ComplaintStatus {
  return forward ? forward.status ?? 'Forwarded' : 'Registered';
}

export function statusStageIndex(status: string | null | undefined): number {
  return Math.max(STATUS_STAGES.findIndex((s) => s.key === status), 0);
}

/** Completion percentage used by progress bars (an equal share per stage). */
export function statusProgress(status: string | null | undefined): number {
  return ((statusStageIndex(status) + 1) * 100) / STATUS_STAGES.length;
}
