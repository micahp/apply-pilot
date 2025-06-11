/**
 * Job keyword configuration for Google Search Crawler.
 * Simulates the structure that would come from a YAML file.
 * Each key is a job family, and 'aliases' are the keywords for that family.
 */
const jobKeywords = {
  Engineering: {
    aliases: ["Software Engineer", "Software Developer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "ML Engineer", "Data Engineer", "DevOps Engineer", "SRE", "Site Reliability Engineer", "Platform Engineer", "Cloud Engineer", "Security Engineer", "Embedded Engineer", "Firmware Engineer", "Mobile Engineer", "iOS Engineer", "Android Engineer"],
    // Example: Add more specific roles or variations if needed
  },
  Product: {
    aliases: ["Product Manager", "Technical Product Manager", "Product Owner", "Senior Product Manager"],
  },
  Design: {
    aliases: ["Product Designer", "UX Designer", "UI Designer", "UX/UI Designer", "Visual Designer", "Brand Designer", "Design Systems Manager"],
  },
  GrowthMarketing: {
    aliases: ["Growth Marketing Manager", "Performance Marketing Manager", "Demand Generation Manager", "Content Marketing Manager", "SEO Manager", "Digital Marketing Manager"],
  },
  Sales: {
    aliases: ["Account Executive", "Sales Engineer", "Solutions Engineer", "Business Development Manager", "Partnerships Manager", "Sales Manager"],
  },
  CustomerSuccess: {
    aliases: ["Customer Success Manager", "Implementation Manager", "Support Engineer", "Technical Account Manager", "Client Success Manager"],
  },
  Operations: {
    aliases: ["Business Operations", "Strategy Analyst", "Chief of Staff", "Operations Manager", "BizOps Manager", "Program Manager", "Project Manager"],
  },
  FinanceAccounting: {
    aliases: ["Financial Analyst", "FP&A Manager", "Controller", "Finance Manager", "Accountant", "Finance Business Partner"],
  },
  PeopleHRRecruiting: {
    aliases: ["Recruiter", "HR Business Partner", "People Operations Manager", "Talent Acquisition Manager", "Sourcer", "HR Generalist"],
  },
  LegalCompliance: {
    aliases: ["Legal Counsel", "Compliance Manager", "Contracts Manager", "Privacy Counsel", "Corporate Counsel"],
  },
  // Add more families as needed based on the user's full taxonomy
  DataScienceAnalytics: { // Separated from pure Engineering for more specific roles
    aliases: ["Data Scientist", "Analytics Engineer", "Business Intelligence Analyst", "Data Analyst", "Machine Learning Scientist"]
  }
};

export default jobKeywords;
