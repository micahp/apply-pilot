import { Profile } from '../types/profile';
import * as pdfjsLib from 'pdfjs-dist';

// Set up worker configuration for Chrome extensions (compatible with CSP)
try {
  const workerUrl = chrome.runtime.getURL('pdf.worker.min.js');
  console.log('Setting PDF.js worker URL:', workerUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} catch (error) {
  console.error('Failed to set PDF.js worker URL:', error);
}

interface ParsedResume {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location?: string;
    linkedIn?: string;
    summary?: string;
  };
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string[];
    location?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
    descriptions?: string[];
  }>;
  projects: Array<{
    name: string;
    date: string;
    descriptions: string[];
  }>;
  skills: string[];
}

// Feature scoring system for resume attributes
interface FeatureSet {
  match: (text: string) => boolean;
  score: number;
}

// Core feature functions for different resume attributes
const FEATURE_SETS = {
  name: [
    { match: (text: string) => /^[a-zA-Z\s\.]+$/.test(text), score: 3 },
    { match: (text: string) => text === text.toUpperCase(), score: 2 },
    { match: (text: string) => /\S+@\S+\.\S+/.test(text), score: -4 }, // email
    { match: (text: string) => /\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(text), score: -4 }, // phone
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -4 }, // location
    { match: (text: string) => /\S+\.[a-z]+\/\S+/.test(text), score: -4 }, // url
  ],
  email: [
    { match: (text: string) => /\S+@\S+\.\S+/.test(text), score: 4 },
    { match: (text: string) => /\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(text), score: 0 }, // phone
    { match: (text: string) => /^[a-zA-Z\s\.]+$/.test(text), score: -1 }, // name
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -5 }, // location
  ],
  phone: [
    { match: (text: string) => /\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(text), score: 4 },
    { match: (text: string) => /\S+@\S+\.\S+/.test(text), score: -4 }, // email
    { match: (text: string) => /^[a-zA-Z\s\.]+$/.test(text), score: -4 }, // name
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -4 }, // location
  ],
  location: [
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: 4 },
    { match: (text: string) => /[A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?/.test(text), score: 3 },
    { match: (text: string) => /(?:Remote|Hybrid|On-site)/i.test(text), score: 2 },
    { match: (text: string) => /\S+@\S+\.\S+/.test(text), score: -4 }, // email
    { match: (text: string) => /\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(text), score: -4 }, // phone
  ],
  school: [
    { match: (text: string) => /(University|College|School|Institute)/i.test(text), score: 4 },
    { match: (text: string) => /(Bachelor|Master|PhD|Associate)/i.test(text), score: -2 }, // degree
  ],
  degree: [
    { match: (text: string) => /(Bachelor|Master|PhD|Associate|B\.S\.|M\.S\.|B\.A\.|M\.A\.)/i.test(text), score: 4 },
    { match: (text: string) => /(University|College|School|Institute)/i.test(text), score: -2 }, // school
  ],
  gpa: [
    { match: (text: string) => /[0-4]\.\d{1,2}/.test(text), score: 4 },
    { match: (text: string) => /GPA/i.test(text), score: 2 },
  ],
  date: [
    { match: (text: string) => /(?:19|20)\d{2}/.test(text), score: 2 },
    { match: (text: string) => /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i.test(text), score: 2 },
    { match: (text: string) => /(Spring|Summer|Fall|Winter)/i.test(text), score: 2 },
    { match: (text: string) => /Present/i.test(text), score: 2 },
  ],
  jobTitle: [
    { match: (text: string) => /(Engineer|Developer|Analyst|Manager|Intern|Specialist|Consultant|Designer|Architect|Lead|Director|Coordinator|Associate)/i.test(text), score: 3 },
    { match: (text: string) => /(Senior|Junior|Principal|Staff)/i.test(text), score: 2 },
    { match: (text: string) => /(University|College|School|Institute)/i.test(text), score: -2 }, // school
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -1 }, // location
  ],
  company: [
    { match: (text: string) => !/(University|College|School|Institute)/i.test(text), score: 2 },
    { match: (text: string) => /(Inc\.|LLC|Corp\.|Ltd\.|Company|Co\.)/i.test(text), score: 1 },
    { match: (text: string) => /(Engineer|Developer|Analyst|Manager|Intern|Specialist|Consultant)/i.test(text), score: -2 }, // job title
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -1 }, // location
  ],
  project: [
    { match: (text: string) => !/(University|College|School|Institute)/i.test(text), score: 2 },
    { match: (text: string) => /(Engineer|Developer|Analyst|Manager|Intern|Specialist|Consultant)/i.test(text), score: -2 }, // job title
  ],
};

// Helper function to calculate feature score for a text item
function calculateFeatureScore(text: string, featureSets: FeatureSet[]): number {
  return featureSets.reduce((score, feature) => {
    return score + (feature.match(text) ? feature.score : 0);
  }, 0);
}

// Helper function to find the best matching text item
function findBestMatch(textItems: string[], featureSets: FeatureSet[]): string {
  let bestScore = -Infinity;
  let bestMatch = '';

  for (const text of textItems) {
    const score = calculateFeatureScore(text, featureSets);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = text;
    }
  }

  return bestMatch;
}

// Helper function to detect subsections based on line gaps
function detectSubsections(lines: string[]): string[][] {
  const subsections: string[][] = [];
  let currentSubsection: string[] = [];
  
  // Calculate typical line gap
  const lineGaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() && lines[i-1].trim()) {
      lineGaps.push(1); // Assuming 1 is the typical line gap
    }
  }
  const typicalGap = lineGaps.length > 0 ? 
    lineGaps.reduce((a, b) => a + b) / lineGaps.length : 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i-1] : '';
    
    // Check if this is a new subsection
    if (i > 0 && prevLine.trim() && line.trim()) {
      const gap = 1; // Simplified gap calculation
      if (gap > typicalGap * 1.4) {
        if (currentSubsection.length > 0) {
          subsections.push(currentSubsection);
          currentSubsection = [];
        }
      }
    }
    
    if (line.trim()) {
      currentSubsection.push(line);
    }
  }
  
  if (currentSubsection.length > 0) {
    subsections.push(currentSubsection);
  }
  
  return subsections;
}

// Main function to parse resume text
function parseResumeText(text: string): ParsedResume {
  const lines = text.split('\n');
  const parsedResume: ParsedResume = {
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      linkedIn: '',
      summary: ''
    },
    experience: [],
    education: [],
    projects: [],
    skills: []
  };
  
  // First, identify all the major sections
  const sectionMatches: Record<string, { startIndex: number, endIndex: number, content: string }> = {};
  
  const sectionPatterns = [
    { name: 'PROFILE', pattern: /\bPROFILE\b/ },
    { name: 'SUMMARY', pattern: /\bSUMMARY\b/ },
    { name: 'EDUCATION', pattern: /\bEDUCATION\b/ },
    { name: 'EXPERIENCE', pattern: /\bEXPERIENCE\b/ },
    { name: 'WORK EXPERIENCE', pattern: /\bWORK\s+EXPERIENCE\b/ },
    { name: 'EMPLOYMENT', pattern: /\bEMPLOYMENT\b/ },
    { name: 'PROJECTS', pattern: /\bPROJECTS\b/ },
    { name: 'SKILLS', pattern: /\bSKILLS\b/ },
  ];
  
  // Find each section in the text
  const allCapsLines: {line: string, index: number}[] = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0 && trimmedLine === trimmedLine.toUpperCase() && !/^\d+$/.test(trimmedLine)) {
      allCapsLines.push({line: trimmedLine, index});
    }
  });
  
  for (let i = 0; i < allCapsLines.length; i++) {
    const {line, index} = allCapsLines[i];
    for (const section of sectionPatterns) {
      if (section.pattern.test(line)) {
        const nextSectionIndex = i < allCapsLines.length - 1 ? allCapsLines[i + 1].index : lines.length;
        const content = lines.slice(index + 1, nextSectionIndex).join('\n');
        sectionMatches[section.name] = {
          startIndex: index,
          endIndex: nextSectionIndex - 1,
          content: content.trim()
        };
        break;
      }
    }
  }
  
  // Extract personal information
  if (sectionMatches['PROFILE'] || sectionMatches['SUMMARY']) {
    const profileContent = (sectionMatches['PROFILE'] || sectionMatches['SUMMARY']).content;
    const profileLines = profileContent.split('\n').filter(line => line.trim());
    
    parsedResume.personal.firstName = findBestMatch(profileLines, FEATURE_SETS.name).split(' ')[0];
    parsedResume.personal.lastName = findBestMatch(profileLines, FEATURE_SETS.name).split(' ').slice(1).join(' ');
    parsedResume.personal.email = findBestMatch(profileLines, FEATURE_SETS.email);
    parsedResume.personal.phone = findBestMatch(profileLines, FEATURE_SETS.phone);
    parsedResume.personal.location = findBestMatch(profileLines, FEATURE_SETS.location);
    parsedResume.personal.summary = profileLines.join(' ');
  }
  
  // Extract education
  if (sectionMatches['EDUCATION']) {
    const educationContent = sectionMatches['EDUCATION'].content;
    const educationLines = educationContent.split('\n').filter(line => line.trim());
    const educationSubsections = detectSubsections(educationLines);
    
    for (const subsection of educationSubsections) {
      const education = {
        institution: findBestMatch(subsection, FEATURE_SETS.school),
        degree: findBestMatch(subsection, FEATURE_SETS.degree),
        field: '',
        startDate: findBestMatch(subsection, FEATURE_SETS.date),
        endDate: '',
        gpa: findBestMatch(subsection, FEATURE_SETS.gpa),
        descriptions: subsection.filter(line => line.startsWith('•'))
      };
      
      parsedResume.education.push(education);
    }
  }
  
  // Extract experience
  if (sectionMatches['EXPERIENCE'] || sectionMatches['WORK EXPERIENCE'] || sectionMatches['EMPLOYMENT']) {
    const experienceSection = sectionMatches['EXPERIENCE'] || sectionMatches['WORK EXPERIENCE'] || sectionMatches['EMPLOYMENT'];
    const experienceLines = experienceSection.content.split('\n').filter(line => line.trim());
    
    let currentJob: {
      company: string;
      title: string;
      startDate: string;
      endDate: string;
      description: string[];
      location?: string;
    } | null = null;
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Check if this line could be a company name
      const companyScore = calculateFeatureScore(line, FEATURE_SETS.company);
      const titleScore = calculateFeatureScore(line, FEATURE_SETS.jobTitle);
      const locationScore = calculateFeatureScore(line, FEATURE_SETS.location);
      
      // If we have a current job and this line looks like a new company or title
      if (currentJob && (companyScore > 0 || titleScore > 0)) {
        // Save the current job if it has at least a company or title
        if (currentJob.company || currentJob.title) {
          parsedResume.experience.push(currentJob);
        }
        currentJob = null;
      }
      
      // If we don't have a current job and this line looks like a company
      if (!currentJob && companyScore > 0) {
        currentJob = {
          company: line,
          title: '',
          startDate: '',
          endDate: '',
          description: [],
          location: ''
        };
        
        // Check next line for title and location
        if (i + 1 < experienceLines.length) {
          const nextLine = experienceLines[i + 1].trim();
          const nextTitleScore = calculateFeatureScore(nextLine, FEATURE_SETS.jobTitle);
          const nextLocationScore = calculateFeatureScore(nextLine, FEATURE_SETS.location);
          
          if (nextTitleScore > 0) {
            currentJob.title = nextLine;
            i++; // Skip the next line since we used it
          }
          
          // Check for location in either line
          if (locationScore > 0) {
            currentJob.location = line;
          } else if (nextLocationScore > 0) {
            currentJob.location = nextLine;
          }
        }
      }
      // If we have a current job
      else if (currentJob) {
        // Check for bullet points
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
          currentJob.description.push(line.substring(1).trim());
        }
        // Check for dates
        else if (calculateFeatureScore(line, FEATURE_SETS.date) > 0) {
          const dates = line.split('-').map(d => d.trim());
          if (dates.length >= 1) {
            currentJob.startDate = dates[0];
            if (dates.length >= 2) {
              currentJob.endDate = dates[1];
            }
          }
        }
        // Check for location if we don't have one yet
        else if (!currentJob.location && locationScore > 0) {
          currentJob.location = line;
        }
      }
    }
    
    // Don't forget to add the last job
    if (currentJob && (currentJob.company || currentJob.title)) {
      parsedResume.experience.push(currentJob);
    }
  }
  
  // Extract projects
  if (sectionMatches['PROJECTS']) {
    const projectsContent = sectionMatches['PROJECTS'].content;
    const projectsLines = projectsContent.split('\n').filter(line => line.trim());
    const projectSubsections = detectSubsections(projectsLines);
    
    for (const subsection of projectSubsections) {
      const project = {
        name: findBestMatch(subsection, FEATURE_SETS.project),
        date: findBestMatch(subsection, FEATURE_SETS.date),
        descriptions: subsection.filter(line => line.startsWith('•'))
      };
      
      parsedResume.projects.push(project);
    }
  }
  
  // Extract skills
  if (sectionMatches['SKILLS']) {
    const skillsContent = sectionMatches['SKILLS'].content;
    const skillsLines = skillsContent.split('\n').filter(line => line.trim());
    parsedResume.skills = skillsLines.filter(line => !line.startsWith('•'));
  }
  
  return parsedResume;
}

/**
 * Enhanced PDF parser with feature scoring system
 */
export async function parseResumeFile(file: File): Promise<Partial<Profile>> {
  try {
    // Extract text content from file
    const arrayBuffer = await file.arrayBuffer();
    const textContent = await extractTextFromPDF(arrayBuffer);
    
    // Parse the text to extract structured information
    const parsedResume = parseResumeText(textContent);
    
    // Convert to our Profile structure
    return {
      personal: {
        firstName: parsedResume.personal.firstName,
        lastName: parsedResume.personal.lastName,
        email: parsedResume.personal.email,
        phone: parsedResume.personal.phone,
        ...(parsedResume.personal.location && { address: parsedResume.personal.location }),
        ...(parsedResume.personal.linkedIn && { linkedIn: parsedResume.personal.linkedIn })
      },
      workExperience: parsedResume.experience.map((exp) => ({
        company: exp.company,
        title: exp.title,
        startDate: exp.startDate,
        endDate: exp.endDate,
        description: exp.description.join('\n'),
        location: exp.location
      })),
      education: parsedResume.education.map((edu) => ({
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.field,
        startDate: edu.startDate,
        endDate: edu.endDate,
        gpa: edu.gpa
      })),
      skills: parsedResume.skills.map((skill) => ({ name: skill }))
    };
  } catch (error) {
    console.error('Enhanced resume parsing error:', error);
    throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF using pdf.js
 */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      throw new Error('PDF.js worker not configured properly');
    }

    const loadingTask = pdfjsLib.getDocument({ 
      data: buffer,
      disableAutoFetch: true,
      disableStream: true,
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group items by their vertical position to preserve lines
      const lineMap = new Map<number, Array<{str: string, x: number}>>();
      
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const transform = 'transform' in item ? item.transform : null;
          if (transform) {
            const y = Math.round(transform[5]);
            const x = transform[4];
            
            if (!lineMap.has(y)) {
              lineMap.set(y, []);
            }
            
            lineMap.get(y)?.push({
              str: item.str,
              x: x
            });
          }
        }
      }
      
      // Sort line map by y position (in reverse since PDF coords start from bottom)
      const sortedYPositions = Array.from(lineMap.keys()).sort((a, b) => b - a);
      
      // For each line, sort the text items by x position and join them
      for (const y of sortedYPositions) {
        const line = lineMap.get(y);
        if (line) {
          line.sort((a, b) => a.x - b.x);
          const lineText = line.map(item => item.str).join(' ');
          fullText += lineText + '\n';
        }
      }
      
      fullText += '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Map of month names to their numeric values
const MONTH_MAP: { [key: string]: string } = {
  'january': '01',
  'jan': '01',
  'february': '02',
  'feb': '02',
  'march': '03',
  'mar': '03',
  'april': '04',
  'apr': '04',
  'may': '05',
  'june': '06',
  'jun': '06',
  'july': '07',
  'jul': '07',
  'august': '08',
  'aug': '08',
  'september': '09',
  'sep': '09',
  'october': '10',
  'oct': '10',
  'november': '11',
  'nov': '11',
  'december': '12',
  'dec': '12'
};

// Map of seasons to their numeric values
const SEASON_MAP: { [key: string]: string } = {
  'spring': '03',
  'summer': '06',
  'fall': '09',
  'winter': '12'
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.toLowerCase() === 'present') return 'Present';

  // Handle season format (e.g., "Spring 2023")
  const seasonMatch = dateStr.match(/^(Spring|Summer|Fall|Winter)\s+(\d{4})$/i);
  if (seasonMatch) {
    const season = seasonMatch[1].toLowerCase();
    const year = seasonMatch[2];
    return `${year}-${SEASON_MAP[season]}`;
  }

  // Handle month year format (e.g., "January 2023" or "Jan 2023")
  const monthYearMatch = dateStr.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = monthYearMatch[1].toLowerCase();
    const year = monthYearMatch[2];
    if (MONTH_MAP[month]) {
      return `${year}-${MONTH_MAP[month]}`;
    }
  }

  // Handle year only format
  const yearOnlyMatch = dateStr.match(/^\d{4}$/);
  if (yearOnlyMatch) {
    return yearOnlyMatch[0];
  }

  // Handle date range format (e.g., "Jan 2023 - Present" or "2023 - 2024")
  const rangeMatch = dateStr.match(/^(.+?)\s*-\s*(.+)$/);
  if (rangeMatch) {
    const startDate = formatDate(rangeMatch[1].trim());
    const endDate = formatDate(rangeMatch[2].trim());
    return `${startDate} - ${endDate}`;
  }

  return dateStr;
}; 