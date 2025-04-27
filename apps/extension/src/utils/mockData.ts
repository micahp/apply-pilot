import { Profile } from '../types/profile';

/**
 * Generates mock parsed profile data for testing
 * 
 * This simulates data that would be extracted from an ATS application page
 */
export function generateMockParsedProfile(): Partial<Profile> {
  return {
    personal: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '(555) 123-4567'
    },
    workExperience: [
      {
        company: 'Tech Solutions Inc.',
        title: 'Senior Software Engineer',
        startDate: '2020-01',
        endDate: '2023-04',
        location: 'San Francisco, CA',
        description: 'Led development of cloud-based applications using React and Node.js. Implemented CI/CD pipelines and improved application performance by 40%.'
      },
      {
        company: 'Digital Innovations LLC',
        title: 'Software Developer',
        startDate: '2017-06',
        endDate: '2019-12',
        location: 'Austin, TX',
        description: 'Developed and maintained web applications for financial services clients. Collaborated in an agile team environment.'
      }
    ],
    education: [
      {
        institution: 'University of California, Berkeley',
        degree: 'Master of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-08',
        endDate: '2017-05',
        gpa: '3.8'
      },
      {
        institution: 'University of Washington',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Engineering',
        startDate: '2011-09',
        endDate: '2015-06',
        gpa: '3.7'
      }
    ],
    skills: [
      { name: 'JavaScript' },
      { name: 'TypeScript' },
      { name: 'React' },
      { name: 'Node.js' },
      { name: 'AWS' },
      { name: 'Docker' },
      { name: 'GraphQL' },
      { name: 'Python' }
    ],
    eeo: {
      gender: 'FEMALE',
      ethnicity: 'ASIAN'
    }
  };
}

/**
 * Sample profile data for testing
 */
export const sampleProfile: Profile = {
  personal: {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@example.com',
    phone: '(123) 456-7890',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'United States',
    linkedIn: 'https://linkedin.com/in/sarahjohnson',
    github: 'https://github.com/sarahj'
  },
  workExperience: [
    {
      company: 'Tech Innovations Inc.',
      title: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      startDate: '2019-06',
      endDate: '2023-04',
      description: 'Led development of cloud-based applications using React and Node.js. Improved system performance by 40% through architecture optimization.'
    },
    {
      company: 'DataFlow Systems',
      title: 'Software Developer',
      location: 'Seattle, WA',
      startDate: '2017-03',
      endDate: '2019-05',
      description: 'Developed data processing pipelines using Python and AWS. Collaborated with data scientists to implement machine learning models.'
    }
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'Master of Science',
      fieldOfStudy: 'Computer Science',
      startDate: '2015-08',
      endDate: '2017-05',
      gpa: '3.8'
    },
    {
      institution: 'University of Washington',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Engineering',
      startDate: '2011-09',
      endDate: '2015-06',
      gpa: '3.7'
    }
  ],
  skills: [
    { name: 'JavaScript' },
    { name: 'TypeScript' },
    { name: 'React' },
    { name: 'Node.js' },
    { name: 'AWS' },
    { name: 'Docker' },
    { name: 'GraphQL' },
    { name: 'Python' }
  ],
  eeo: {
    gender: 'FEMALE',
    ethnicity: 'ASIAN'
  },
  documents: {
    resume: '', // Base64 string would go here in a real implementation
    coverLetter: '' // Base64 string would go here in a real implementation
  }
}; 