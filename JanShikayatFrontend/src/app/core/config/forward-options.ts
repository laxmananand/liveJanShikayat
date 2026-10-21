/**
 * Forwarding targets for an application: category → branch → complaint type.
 *
 * TODO: DEMO DATA — replace with the official branch / complaint-type masters
 * (or load them from a backend master API) before going live.
 */

export interface ForwardOption {
  id: string;
  hi: string;
  en: string;
}

export interface ForwardCategory extends ForwardOption {
  branches: ForwardOption[];
  complaintTypes: ForwardOption[];
}

export const FORWARD_CATEGORIES: ForwardCategory[] = [
  {
    id: 'home',
    hi: 'गृह विभाग',
    en: 'Home',
    branches: [
      { id: 'home-police', hi: 'पुलिस शाखा', en: 'Police Branch' },
      { id: 'home-law-order', hi: 'विधि-व्यवस्था शाखा', en: 'Law & Order Branch' },
      { id: 'home-special', hi: 'विशेष शाखा', en: 'Special Branch' },
      { id: 'home-prisons', hi: 'कारा शाखा', en: 'Prisons Branch' },
      { id: 'home-prosecution', hi: 'अभियोजन शाखा', en: 'Prosecution Branch' },
      { id: 'home-fire', hi: 'अग्निशमन शाखा', en: 'Fire Services Branch' },
      { id: 'home-homeguard', hi: 'गृह रक्षा वाहिनी शाखा', en: 'Home Guard Branch' },
      { id: 'home-civil-defence', hi: 'नागरिक सुरक्षा शाखा', en: 'Civil Defence Branch' }
    ],
    complaintTypes: [
      { id: 'fir-not-registered', hi: 'प्राथमिकी दर्ज न होना', en: 'FIR not registered' },
      { id: 'police-inaction', hi: 'पुलिस द्वारा कार्रवाई न करना', en: 'Police inaction' },
      { id: 'police-misconduct', hi: 'पुलिस दुर्व्यवहार', en: 'Police misconduct' },
      { id: 'investigation-delay', hi: 'अनुसंधान में विलंब', en: 'Delay in investigation' },
      { id: 'prison-visit', hi: 'कारा / बंदी संबंधी', en: 'Prison / prisoner related' },
      { id: 'prosecution-delay', hi: 'अभियोजन में विलंब', en: 'Delay in prosecution' },
      { id: 'public-safety', hi: 'जन सुरक्षा', en: 'Public safety' },
      { id: 'home-other', hi: 'अन्य', en: 'Other' }
    ]
  },
  {
    id: 'departments',
    hi: 'अन्य विभाग',
    en: 'Departments',
    branches: [
      { id: 'dept-revenue', hi: 'राजस्व एवं भूमि सुधार विभाग', en: 'Revenue & Land Reforms' },
      { id: 'dept-rural-dev', hi: 'ग्रामीण विकास विभाग', en: 'Rural Development' },
      { id: 'dept-education', hi: 'शिक्षा विभाग', en: 'Education' },
      { id: 'dept-health', hi: 'स्वास्थ्य विभाग', en: 'Health' },
      { id: 'dept-social-welfare', hi: 'समाज कल्याण विभाग', en: 'Social Welfare' },
      { id: 'dept-panchayati-raj', hi: 'पंचायती राज विभाग', en: 'Panchayati Raj' },
      { id: 'dept-food', hi: 'खाद्य एवं उपभोक्ता संरक्षण विभाग', en: 'Food & Consumer Protection' },
      { id: 'dept-urban-dev', hi: 'नगर विकास एवं आवास विभाग', en: 'Urban Development & Housing' }
    ],
    complaintTypes: [
      { id: 'land-dispute', hi: 'भूमि विवाद', en: 'Land dispute' },
      { id: 'mutation', hi: 'दाखिल-खारिज', en: 'Mutation' },
      { id: 'pension', hi: 'पेंशन संबंधी', en: 'Pension related' },
      { id: 'scheme-benefit', hi: 'योजना लाभ न मिलना', en: 'Scheme benefit not received' },
      { id: 'ration', hi: 'राशन / जन वितरण', en: 'Ration / PDS' },
      { id: 'health-service', hi: 'स्वास्थ्य सेवा', en: 'Health service' },
      { id: 'school', hi: 'विद्यालय / शिक्षा संबंधी', en: 'School / education' },
      { id: 'dept-other', hi: 'अन्य', en: 'Other' }
    ]
  },
  {
    id: 'district-admin',
    hi: 'जिला प्रशासन',
    en: 'District Administration',
    branches: [
      { id: 'da-dm', hi: 'जिलाधिकारी कार्यालय', en: 'District Magistrate Office' },
      { id: 'da-sp', hi: 'पुलिस अधीक्षक कार्यालय', en: 'Superintendent of Police Office' },
      { id: 'da-sdo', hi: 'अनुमंडल पदाधिकारी कार्यालय', en: 'Sub-Divisional Officer Office' },
      { id: 'da-sdpo', hi: 'अनुमंडल पुलिस पदाधिकारी कार्यालय', en: 'SDPO Office' },
      { id: 'da-bdo', hi: 'प्रखंड विकास पदाधिकारी कार्यालय', en: 'Block Development Officer Office' },
      { id: 'da-co', hi: 'अंचल अधिकारी कार्यालय', en: 'Circle Officer Office' },
      { id: 'da-supply', hi: 'जिला आपूर्ति कार्यालय', en: 'District Supply Office' },
      { id: 'da-pgro', hi: 'जिला लोक शिकायत निवारण कार्यालय', en: 'District Public Grievance Redressal Office' }
    ],
    complaintTypes: [
      { id: 'encroachment', hi: 'अतिक्रमण', en: 'Encroachment' },
      { id: 'law-order-local', hi: 'स्थानीय विधि-व्यवस्था', en: 'Local law & order' },
      { id: 'certificate', hi: 'प्रमाण पत्र संबंधी', en: 'Certificate related' },
      { id: 'compensation', hi: 'मुआवजा / अनुदान', en: 'Compensation / grant' },
      { id: 'official-negligence', hi: 'पदाधिकारी द्वारा लापरवाही', en: 'Negligence by official' },
      { id: 'corruption', hi: 'भ्रष्टाचार', en: 'Corruption' },
      { id: 'public-utility', hi: 'जन सुविधा (सड़क, बिजली, पानी)', en: 'Public utility (road, power, water)' },
      { id: 'da-other', hi: 'अन्य', en: 'Other' }
    ]
  },
  {
    id: 'section',
    hi: 'अनुभाग',
    en: 'Section',
    branches: [
      { id: 'sec-admin', hi: 'प्रशासन अनुभाग', en: 'Administration Section' },
      { id: 'sec-establishment', hi: 'स्थापना अनुभाग', en: 'Establishment Section' },
      { id: 'sec-accounts', hi: 'लेखा अनुभाग', en: 'Accounts Section' },
      { id: 'sec-legal', hi: 'विधि अनुभाग', en: 'Legal Section' },
      { id: 'sec-grievance', hi: 'शिकायत कोषांग', en: 'Grievance Cell' },
      { id: 'sec-vigilance', hi: 'निगरानी अनुभाग', en: 'Vigilance Section' },
      { id: 'sec-records', hi: 'अभिलेख अनुभाग', en: 'Records Section' },
      { id: 'sec-general', hi: 'सामान्य अनुभाग', en: 'General Section' }
    ],
    complaintTypes: [
      { id: 'service-matter', hi: 'सेवा संबंधी मामला', en: 'Service matter' },
      { id: 'salary', hi: 'वेतन / भत्ता', en: 'Salary / allowance' },
      { id: 'promotion', hi: 'प्रोन्नति', en: 'Promotion' },
      { id: 'transfer', hi: 'स्थानांतरण', en: 'Transfer' },
      { id: 'disciplinary', hi: 'अनुशासनिक कार्रवाई', en: 'Disciplinary action' },
      { id: 'court-case', hi: 'न्यायालय वाद', en: 'Court case' },
      { id: 'rti', hi: 'सूचना का अधिकार', en: 'Right to Information' },
      { id: 'sec-other', hi: 'अन्य', en: 'Other' }
    ]
  }
];
