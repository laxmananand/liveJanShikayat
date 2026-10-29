export const STATUS_LABELS: Record<string, string> = {
  Pending: 'लंबित',
  UnderReview: 'समीक्षाधीन',
  ForwardedToDepartment: 'विभाग को अग्रेषित',
  ForwardedForFieldEnquiry: 'क्षेत्रीय जांच हेतु अग्रेषित',
  ActionTaken: 'कार्रवाई की गई',
  Disposed: 'निष्पादित'
};

export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'सुपर एडमिन',
  BranchOfficer: 'शाखा अधिकारी',
  DepartmentHead: 'विभागाध्यक्ष',
  CompetentAuthority: 'सक्षम प्राधिकारी',
  Commissioner: 'प्रमंडलीय आयुक्त',
  DistrictMagistrate: 'जिलाधिकारी'
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

/**
 * The five citizen-facing stages shown in the design's status flow
 * (प्राप्त → समीक्षा → अग्रेषित → कार्रवाई → निस्तारित), and which stage each
 * backend status falls in.
 */
export const STATUS_STAGES = [
  { key: 'received', label: 'प्राप्त', icon: 'fa-inbox' },
  { key: 'review', label: 'समीक्षा', icon: 'fa-magnifying-glass' },
  { key: 'forwarded', label: 'अग्रेषित', icon: 'fa-share-nodes' },
  { key: 'action', label: 'कार्रवाई', icon: 'fa-gavel' },
  { key: 'disposed', label: 'निस्तारित', icon: 'fa-flag-checkered' }
] as const;

const STATUS_STAGE_INDEX: Record<string, number> = {
  Pending: 0,
  UnderReview: 1,
  ForwardedToDepartment: 2,
  ForwardedForFieldEnquiry: 2,
  ActionTaken: 3,
  Disposed: 4
};

export function statusStageIndex(status: string | null | undefined): number {
  return status ? STATUS_STAGE_INDEX[status] ?? 0 : 0;
}

/** Rough completion percentage used by progress bars (20% per stage). */
export function statusProgress(status: string | null | undefined): number {
  return (statusStageIndex(status) + 1) * 20;
}
