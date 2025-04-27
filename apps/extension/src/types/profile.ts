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