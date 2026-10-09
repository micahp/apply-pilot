export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  preferredName?: string;
  pronouns?: string;
}

/** Leave a field empty to decline to self-identify where the form allows it. */
export interface EEOData {
  gender?: string;
  race?: string;
  /** @deprecated older profiles stored race here; read as `race`. */
  ethnicity?: string;
  hispanicOrLatino?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
}

/** 'Yes' / 'No' / '' (unanswered) for yes/no screening questions. */
export type YesNo = 'Yes' | 'No' | '';

export interface Preferences {
  workAuthorized?: YesNo;
  requiresSponsorship?: YesNo;
  willingToRelocate?: YesNo;
  desiredSalary?: string;
  availableStartDate?: string;
  noticePeriod?: string;
  howDidYouHear?: string;
}

export interface CustomAnswer {
  /** Case-insensitive substring of the question, or /regex/. */
  question: string;
  answer: string;
}

export interface StoredFile {
  name: string;
  type: string;
  dataUrl: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  description: string;
  endDate?: string;
  location?: string;
  current?: boolean;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

export interface Skill {
  name: string;
  proficiency?: string;
}

export interface Documents {
  resume?: string;
  coverLetter?: string;
}

export interface Profile {
  personal: PersonalInfo;
  eeo: EEOData;
  workExperience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  documents: Documents;
  preferences?: Preferences;
  customAnswers?: CustomAnswer[];
  resumeFile?: StoredFile;
}

export type PartialProfile = {
  personal?: Partial<PersonalInfo>;
  workExperience?: Partial<WorkExperience>[];
  education?: Partial<Education>[];
  eeo?: Partial<EEOData>;
  skills?: (Skill | string)[];
  documents?: Partial<Documents>;
  preferences?: Preferences;
  customAnswers?: CustomAnswer[];
  resumeFile?: StoredFile;
}

// Added from user context and popup implementation needs
export interface ATSFieldDescriptor {
  selector: string; // CSS selector for the form field
  tag: string;      // Tag name of the element (e.g., 'INPUT', 'SELECT')
  type?: string;     // Type attribute, if applicable (e.g., 'text', 'email')
  // Potentially other attributes like name, id, aria-label, etc.
}

export interface ATSMessageData {
  ats: string;
  fields?: ATSFieldDescriptor[] | null; // Null if not on an application page or no fields found
  // onApplicationPage?: boolean; // This is handled by separate messages or popup state now
  [key: string]: any; // Adding index signature to satisfy JsonObject constraint
} 