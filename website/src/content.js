export const project = {
  course: 'INFO 492',
  team: 'Sub Team 4',
  title:
    'Using AI Agents for Efficient Information Retrieval and Reduction of Ambiguity for Subcontractors',
  role: 'Subcontractor',
};

export const teamMembers = [
  { name: 'Jaime Li', role: 'Research & Documentation' },
  { name: 'Teresa Wang', role: 'Planning & Communication' },
  { name: 'Zeye Li', role: 'Coding & Technical Support' },
  { name: 'Joe Chen', role: 'General Support & Review' },
];

export const thesisStatement =
  'We propose that utilizing AI agents for information retrieval will allow ' +
  'subcontractors to improve information accuracy and reduce ambiguity in the ' +
  'RFI submission process. We estimate that with AI agents RFI information ' +
  'accuracy will increase by at least 10%.';

export const paperSummary =
  'Subcontractors need the right drawings and documents to prepare an RFI. ' +
  'Finding them takes time, especially when files are scattered or drawings ' +
  'are out of date. Joy et al. (2025) describe these problems in the RFI ' +
  'process. Wu et al. (2025) developed RAG4CM to search construction documents ' +
  'and answer questions. We want to test whether AI agents can help ' +
  'subcontractors find accurate references and reduce ambiguity when ' +
  'preparing RFIs.' +
  '\n\n' +
  'We\'ll compare manual searching with AI-assisted searching using the same ' +
  'public documents from the Seattle Aquarium Ocean Pavilion. We plan to ' +
  'create about 20 tasks based on concrete construction scenarios and ' +
  'identify the correct sources beforehand. For each task, we\'ll record how ' +
  'long it takes and check whether the correct reference is among the top ' +
  'three sources. We expect at least a 10% increase in accuracy.';

export const fullPaperUrl =
  'https://docs.google.com/document/d/1mWZ5glFVbaz-HXh6wqxvimRZcSYoCS94IFlVUTWIhmA/edit?usp=sharing';

export const datasetDescription =
  'Our project lens is the Seattle Aquarium Ocean Pavilion, a public construction ' +
  'project located on Seattle’s downtown waterfront. We will use publicly available ' +
  'project information, design materials, meeting records, environmental documents, ' +
  'and other relevant construction-related sources.';

export const datasetSources = [
  {
    title: 'Ocean Pavilion Progress',
    url: 'https://www.seattleaquarium.org/explore-the-aquarium/campus/ocean-pavilion/progress/',
  },
  {
    title: 'Design Commission Presentation (August 20, 2020)',
    url: 'https://www.seattle.gov/Documents/Departments/OPCD/DesignCommission/Waterfront%E2%80%93OverlookWalk/SeattleDesignCommission-2020.08.20OceanPavilion_Presentation_DRAFT.pdf',
  },
  {
    title: 'Design Commission Meeting Minutes (March 5, 2020)',
    url: 'https://www.seattle.gov/documents/Departments/OPCD/DesignCommission/Waterfront%E2%80%93OverlookWalk/SeattleDesignCommission-2020.03.05OverlookWalk_OceanPavilionminutes.pdf',
  },
  {
    title: 'EIS Scoping Summary Report (2018)',
    url: 'https://www.seattleaquarium.org/wp-content/uploads/2023/10/Seattle-Aquarium-Environmental-Impact-Statement-Scoping-Summary-Report-2018.pdf',
  },
];

export const experimentPlans = [
  {
    title: 'Basic Document Retrieval',
    description:
      'We will compare manual document searching with AI-assisted retrieval using ' +
      'construction documents from the Seattle Aquarium Ocean Pavilion.',
    metrics: 'Retrieval accuracy and time required to find the correct information.',
  },
  {
    title: 'Cross-Document Information Retrieval',
    description:
      'We will test whether AI agents can help subcontractors retrieve and connect ' +
      'relevant information from different sources, such as structural drawings, ' +
      'specifications, and technical reports.',
    metrics: 'Percentage of required references correctly identified and retrieval time.',
  },
  {
    title: 'Information Retrieval with Inconsistent Terminology',
    description:
      'We will create information retrieval tasks using alternative terminology ' +
      'to evaluate whether AI agents ' +
      'can identify relevant information more effectively than manual searching.',
    metrics: 'Retrieval success rate and time under different terminology conditions.',
  },
  {
    title: 'RFI Preparation and Reference Verification',
    description:
      'Participants will use either manual searching or AI-assisted retrieval ' +
      'to identify supporting references for an RFI.',
    metrics:
      'Reference accuracy, completeness of supporting information, ' +
      'and preparation time.',
  },
];
