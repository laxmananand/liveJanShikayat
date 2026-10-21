import {
  Branch,
  CompetentAuthorityDesignation,
  ComplaintHistoryEntry,
  ComplaintRemark,
  ComplaintStatus,
  Department
} from '../models/models';

/**
 * STATIC LOOKUP + SEED DATA (frontend-only template).
 *
 * Mirrors what the old backend seeded into its database so every screen has
 * something to show. MockDbService copies the seed complaints into localStorage
 * on first load; after that, changes made in the UI are kept until the mock DB
 * is reset (see README).
 *
 * TODO (API integration): delete this file once the services call real APIs.
 */

export const MOCK_BRANCHES: Branch[] = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1,
  code: `B${String(i + 1).padStart(2, '0')}`,
  name: `Branch ${i + 1}`,
  nameHindi: `प्रशाखा ${i + 1}`
}));

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 1, code: 'HOME', name: 'Home Department', nameHindi: 'गृह विभाग' },
  { id: 2, code: 'RLR', name: 'Revenue & Land Reforms Department', nameHindi: 'राजस्व एवं भूमि सुधार विभाग' },
  { id: 3, code: 'FIN', name: 'Finance Department', nameHindi: 'वित्त विभाग' },
  { id: 4, code: 'TRN', name: 'Transport Department', nameHindi: 'परिवहन विभाग' },
  { id: 5, code: 'GEN', name: 'General Administration Department', nameHindi: 'सामान्य प्रशासन विभाग' },
  { id: 6, code: 'DGP', name: 'Office of the Director General of Police', nameHindi: 'पुलिस महानिदेशक का कार्यालय' },
  { id: 7, code: 'PRISON', name: 'Directorate of Prisons & Correctional Services', nameHindi: 'कारा निदेशालय एवं सुधार सेवाएँ' },
  { id: 8, code: 'HOMEGUARD', name: 'Home Guards', nameHindi: 'गृह रक्षा वाहिनी' },
  { id: 9, code: 'FIRE', name: 'Directorate of Fire Services', nameHindi: 'अग्निशमन निदेशालय' },
  { id: 10, code: 'SAINIK', name: 'Directorate of Sainik Welfare', nameHindi: 'सैनिक कल्याण निदेशालय' },
  { id: 11, code: 'PROSEC', name: 'Directorate of Prosecution', nameHindi: 'अभियोजन निदेशालय' }
];

export const MOCK_COMPETENT_AUTHORITIES: CompetentAuthorityDesignation[] = [
  { id: 1, code: 'COMM', title: 'Commissioner' },
  { id: 2, code: 'IG', title: 'Inspector General of Police' },
  { id: 3, code: 'DIG', title: 'Deputy Inspector General of Police' },
  { id: 4, code: 'CM_HELPLINE', title: 'CM Helpline / CM Jaibodha Cell' },
  { id: 5, code: 'SSP', title: 'Senior Superintendent of Police' },
  { id: 6, code: 'SP', title: 'Superintendent of Police' },
  { id: 7, code: 'SDO', title: 'Sub-Divisional Officer (Anchal Adhikari)' },
  { id: 8, code: 'CO', title: 'Circle Officer' }
];

// ---------------------------------------------------------------------------
// Complaint records (the shape MockDbService stores)
// ---------------------------------------------------------------------------

export interface StoredDocument {
  id: number;
  fileName: string;
  documentType: string;
  uploadedAt: string;
}

export interface ComplaintRecord {
  id: number;
  complaintNumber: string;
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
  complaintDate: string;
  source: string;
  branchId: number | null;
  departmentId: number | null;
  competentAuthorityDesignationId: number | null;
  status: ComplaintStatus;
  closureRemarks?: string;
  closedAt?: string;
  createdAt: string;
  documents: StoredDocument[];
  remarks: ComplaintRemark[];
  history: ComplaintHistoryEntry[];
}

interface SeedSpec {
  applicantName: string;
  guardianName: string;
  mobileNumber: string;
  district: string;
  block: string;
  policeStation?: string;
  oppositeParty?: string;
  subject: string;
  category: string;
  description: string;
  source: string;
  branchId: number | null;
  departmentId: number | null;
  authorityId?: number;
  status: ComplaintStatus;
  daysAgo: number;
}

const SEED_SPECS: SeedSpec[] = [
  {
    applicantName: 'रमेश कुमार', guardianName: 'सुरेश प्रसाद', mobileNumber: '9876543210',
    district: 'पटना', block: 'पटना सदर', policeStation: 'कोतवाली',
    subject: 'भूमि पर अवैध कब्जा एवं थाना द्वारा कार्रवाई न करने के संबंध में',
    category: 'भूमि विवाद', oppositeParty: 'मनोज सिंह',
    description: 'आवेदक की पैतृक भूमि पर विपक्षी द्वारा अवैध कब्जा किया गया है। थाना में आवेदन देने के बावजूद कोई कार्रवाई नहीं हुई।',
    source: 'Offline', branchId: 1, departmentId: null, status: 'Pending', daysAgo: 1
  },
  {
    applicantName: 'सुनीता देवी', guardianName: 'राम बाबू सिंह', mobileNumber: '9123456780',
    district: 'गया', block: 'गया सदर', policeStation: 'सिविल लाइंस',
    subject: 'प्राथमिकी दर्ज न किए जाने के संबंध में शिकायत',
    category: 'प्राथमिकी (FIR) दर्ज न होना',
    description: 'चोरी की घटना के संबंध में थाना प्रभारी द्वारा प्राथमिकी दर्ज करने से इनकार किया गया।',
    source: 'CPGRAMS', branchId: 1, departmentId: 1, status: 'UnderReview', daysAgo: 3
  },
  {
    applicantName: 'मोहम्मद इरफ़ान', guardianName: 'मोहम्मद सलीम', mobileNumber: '9988776655',
    district: 'मुजफ्फरपुर', block: 'कांटी', policeStation: 'कांटी',
    subject: 'पुलिस द्वारा दुर्व्यवहार की शिकायत',
    category: 'पुलिस कार्रवाई / निष्क्रियता',
    description: 'वाहन जांच के दौरान पुलिसकर्मियों द्वारा दुर्व्यवहार एवं अवैध वसूली की गई।',
    source: 'CMJaibodha', branchId: 2, departmentId: 1, status: 'ForwardedToDepartment', daysAgo: 6
  },
  {
    applicantName: 'राकेश रंजन सिंह', guardianName: 'विजय सिंह', mobileNumber: '9431122334',
    district: 'पटना', block: 'दानापुर', policeStation: 'दानापुर',
    subject: 'जमीन विवाद में मारपीट की घटना की स्थलीय जांच हेतु',
    category: 'भूमि विवाद', oppositeParty: 'अज्ञात',
    description: 'भूमि विवाद को लेकर आवेदक के परिवार के साथ मारपीट की गई। निष्पक्ष स्थलीय जांच का अनुरोध।',
    source: 'PMOGrievancePortal', branchId: 1, departmentId: 1, authorityId: 7, status: 'ForwardedForFieldEnquiry', daysAgo: 10
  },
  {
    applicantName: 'प्रमोद कुमार यादव', guardianName: 'शिवनाथ यादव', mobileNumber: '9801234567',
    district: 'नालंदा', block: 'बिहारशरीफ',
    subject: 'गृह रक्षा वाहिनी के मानदेय भुगतान में विलंब',
    category: 'गृह रक्षा वाहिनी',
    description: 'पिछले चार माह से मानदेय का भुगतान नहीं किया गया है।',
    source: 'Offline', branchId: 3, departmentId: 8, authorityId: 6, status: 'ActionTaken', daysAgo: 18
  },
  {
    applicantName: 'अमृता कुमारी', guardianName: 'अशोक कुमार', mobileNumber: '9709988776',
    district: 'भागलपुर', block: 'नाथनगर',
    subject: 'अग्निशमन वाहन के विलंब से पहुँचने की शिकायत',
    category: 'अग्निशमन सेवा',
    description: 'घर में आग लगने की सूचना देने के बाद अग्निशमन वाहन दो घंटे बाद पहुँचा।',
    source: 'Offline', branchId: 1, departmentId: 9, authorityId: 1, status: 'Disposed', daysAgo: 30
  },
  {
    applicantName: 'विनोद पासवान', guardianName: 'रामेश्वर पासवान', mobileNumber: '9572233445',
    district: 'दरभंगा', block: 'दरभंगा सदर', policeStation: 'लहेरियासराय',
    subject: 'कारा में बंदी से मुलाकात की अनुमति न मिलना',
    category: 'कारा / बंदी से संबंधित',
    description: 'मंडल कारा में बंद पुत्र से मुलाकात हेतु बार-बार आवेदन देने पर भी अनुमति नहीं दी जा रही है।',
    source: 'Online', branchId: null, departmentId: 7, status: 'Pending', daysAgo: 2
  },
  {
    applicantName: 'सीमा कुमारी', guardianName: 'दिनेश प्रसाद', mobileNumber: '8877665544',
    district: 'पटना', block: 'फुलवारी शरीफ', policeStation: 'फुलवारी शरीफ',
    subject: 'महिला उत्पीड़न मामले में अनुसंधान में शिथिलता',
    category: 'पुलिस कार्रवाई / निष्क्रियता',
    description: 'दर्ज मामले में तीन माह बाद भी आरोप पत्र समर्पित नहीं किया गया है।',
    source: 'Online', branchId: null, departmentId: 1, status: 'UnderReview', daysAgo: 4
  },
  {
    applicantName: 'अजय कुमार सिन्हा', guardianName: 'स्व. राजेंद्र सिन्हा', mobileNumber: '9334455667',
    district: 'सारण', block: 'छपरा सदर',
    subject: 'सेवानिवृत्ति लाभ के भुगतान में विलंब',
    category: 'सेवा / वेतन संबंधी',
    description: 'सेवानिवृत्ति के एक वर्ष बाद भी पेंशन एवं उपादान का भुगतान नहीं हुआ है।',
    source: 'Other', branchId: 4, departmentId: 5, status: 'ForwardedToDepartment', daysAgo: 12
  },
  {
    applicantName: 'गीता देवी', guardianName: 'महेंद्र राम', mobileNumber: '9006543210',
    district: 'वैशाली', block: 'हाजीपुर', policeStation: 'हाजीपुर नगर',
    subject: 'थाना स्तर पर भ्रष्टाचार की शिकायत',
    category: 'भ्रष्टाचार', oppositeParty: 'थाना मुंशी',
    description: 'आवेदन प्राप्ति रसीद देने के एवज में अवैध राशि की मांग की गई।',
    source: 'Online', branchId: null, departmentId: 1, authorityId: 5, status: 'ForwardedForFieldEnquiry', daysAgo: 9
  },
  {
    applicantName: 'संतोष कुमार', guardianName: 'लालबाबू साह', mobileNumber: '9771234560',
    district: 'पूर्णिया', block: 'पूर्णिया पूर्व',
    subject: 'पूर्व सैनिक आश्रित को सहायता राशि न मिलना',
    category: 'अन्य',
    description: 'पूर्व सैनिक की विधवा को देय सहायता राशि का भुगतान लंबित है।',
    source: 'CPGRAMS', branchId: 1, departmentId: 10, status: 'Disposed', daysAgo: 45
  },
  {
    applicantName: 'नीरज कुमार', guardianName: 'उमेश कुमार', mobileNumber: '9608877665',
    district: 'रोहतास', block: 'सासाराम',
    subject: 'अभियोजन में विलंब के संबंध में',
    category: 'अन्य',
    description: 'वाद में अभियोजन पक्ष की ओर से बार-बार तिथि ली जा रही है।',
    source: 'Offline', branchId: 1, departmentId: null, status: 'Pending', daysAgo: 0
  }
];

const DAY = 86_400_000;

const SYSTEM_NAMES = {
  branch: 'Branch Officer 1',
  head: 'Home Department Head',
  authority: 'SDO Patna Sadar',
  admin: 'Super Admin'
};

/** Builds the initial complaint table, with history/remarks consistent with each status. */
export function buildSeedComplaints(now = Date.now()): ComplaintRecord[] {
  const year = new Date(now).getFullYear();
  let docId = 1;
  let remarkId = 1;

  return SEED_SPECS.map((s, index) => {
    const id = index + 1;
    const created = now - s.daysAgo * DAY - 3 * 3600_000;
    const at = (hoursAfter: number) => new Date(Math.min(created + hoursAfter * 3600_000, now)).toISOString();
    const isOnline = s.source === 'Online';

    const history: ComplaintHistoryEntry[] = [
      {
        fromStatus: 'Pending',
        toStatus: 'Pending',
        reason: isOnline ? 'Complaint registered online by citizen.' : 'Complaint registered.',
        actionByName: isOnline ? '' : SYSTEM_NAMES.branch,
        actionAt: at(0)
      }
    ];
    const remarks: ComplaintRemark[] = [];
    const documents: StoredDocument[] = [
      { id: docId++, fileName: `Complaint_${id}.pdf`, documentType: 'Complaint', uploadedAt: at(0) }
    ];

    const order: ComplaintStatus[] = ['Pending', 'UnderReview', 'ForwardedToDepartment', 'ForwardedForFieldEnquiry', 'ActionTaken', 'Disposed'];
    const reached = (st: ComplaintStatus) => order.indexOf(s.status) >= order.indexOf(st);
    let current: ComplaintStatus = 'Pending';
    let closureRemarks: string | undefined;
    let closedAt: string | undefined;

    if (reached('UnderReview')) {
      remarks.push({
        id: remarkId++, remarkType: 'Enquiry',
        text: 'प्रारंभिक समीक्षा की गई। संबंधित तथ्यों की जांच आवश्यक है।',
        createdByName: SYSTEM_NAMES.head, createdAt: at(20)
      });
      current = 'UnderReview';
    }
    if (reached('ForwardedToDepartment')) {
      history.push({ fromStatus: current, toStatus: 'ForwardedToDepartment', reason: 'आवश्यक कार्रवाई हेतु विभाग को अग्रेषित।', actionByName: SYSTEM_NAMES.head, actionAt: at(30) });
      current = 'ForwardedToDepartment';
    }
    if (s.authorityId && reached('ForwardedForFieldEnquiry')) {
      history.push({ fromStatus: current, toStatus: 'ForwardedForFieldEnquiry', reason: 'स्थलीय जांच कर प्रतिवेदन समर्पित करें।', actionByName: SYSTEM_NAMES.head, actionAt: at(40) });
      current = 'ForwardedForFieldEnquiry';
    }
    if (reached('ActionTaken')) {
      remarks.push({
        id: remarkId++, remarkType: 'Official',
        text: 'स्थलीय जांच पूर्ण। जांच प्रतिवेदन संलग्न है एवं आवश्यक कार्रवाई की गई।',
        createdByName: SYSTEM_NAMES.authority, createdAt: at(70)
      });
      documents.push({ id: docId++, fileName: `Enquiry_Report_${id}.pdf`, documentType: 'EnquiryReport', uploadedAt: at(70) });
      history.push({ fromStatus: current, toStatus: 'ActionTaken', reason: 'Action taken; report submitted.', actionByName: SYSTEM_NAMES.authority, actionAt: at(72) });
      current = 'ActionTaken';
    }
    if (reached('Disposed')) {
      closureRemarks = 'शिकायत का निवारण कर दिया गया है। आवेदक को सूचित किया गया।';
      closedAt = at(90);
      history.push({ fromStatus: current, toStatus: 'Disposed', reason: closureRemarks, actionByName: SYSTEM_NAMES.head, actionAt: closedAt });
    }

    return {
      id,
      complaintNumber: `JS${year}${String(id).padStart(4, '0')}`,
      applicantName: s.applicantName,
      guardianName: s.guardianName,
      mobileNumber: s.mobileNumber,
      address: `मुख्य मार्ग, ${s.block}, ${s.district}`,
      district: s.district,
      block: s.block,
      policeStation: s.policeStation,
      oppositeParty: s.oppositeParty,
      subject: s.subject,
      category: s.category,
      description: s.description,
      complaintDate: new Date(created).toISOString(),
      source: s.source,
      branchId: s.branchId,
      departmentId: s.departmentId,
      competentAuthorityDesignationId: s.authorityId ?? null,
      status: s.status,
      closureRemarks,
      closedAt,
      createdAt: new Date(created).toISOString(),
      documents,
      remarks,
      history
    };
  });
}
