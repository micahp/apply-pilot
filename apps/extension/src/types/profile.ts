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
}

export interface EEOData {
  gender?: string;
  ethnicity?: string;
  veteranStatus?: boolean;
  disabilityStatus?: boolean;
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
}

export type PartialProfile = {
  personal?: Partial<PersonalInfo>;
  workExperience?: Partial<WorkExperience>[];
  education?: Partial<Education>[];
  eeo?: Partial<EEOData>;
  skills?: (Skill | string)[];
  documents?: Partial<Documents>;
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