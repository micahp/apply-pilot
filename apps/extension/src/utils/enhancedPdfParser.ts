import { Profile } from '../types/profile';
import * as pdfjsLib from 'pdfjs-dist';
// Remove the pdf-parse import since it's a Node.js library and won't work in browser
// import pdfParse from 'pdf-parse';

// Set up worker configuration for Chrome extensions (compatible with CSP)
try {
  const workerUrl = chrome.runtime.getURL('pdf.worker.min.js');
  console.log('Setting PDF.js worker URL:', workerUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} catch (error) {
  console.error('Failed to set PDF.js worker URL:', error);
}

// Import the ParsedResume interface and parseResumeFile function from resumeParser
import { parseResumeFile as originalParseResumeFile } from './resumeParser';

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

// Month and season mappings
const MONTH_MAP: { [key: string]: string } = {
  'jan': '01', 'january': '01',
  'feb': '02', 'february': '02',
  'mar': '03', 'march': '03',
  'apr': '04', 'april': '04',
  'may': '05',
  'jun': '06', 'june': '06',
  'jul': '07', 'july': '07',
  'aug': '08', 'august': '08',
  'sep': '09', 'september': '09',
  'oct': '10', 'october': '10',
  'nov': '11', 'november': '11',
  'dec': '12', 'december': '12'
};

const SEASON_MAP: { [key: string]: string } = {
  'spring': '03', // Spring starts in March
  'summer': '06', // Summer starts in June
  'fall': '09',   // Fall starts in September
  'autumn': '09', // Alternative for fall
  'winter': '12'  // Winter starts in December
};

// Feature scoring system for resume attributes
interface FeatureSet {
  match: (text: string) => boolean;
  score: number;
}

// Core feature functions for different resume attributes
const FEATURE_SETS = {
  company: [
    { match: (text: string) => !/(University|College|School|Institute)/i.test(text), score: 2 },
    { match: (text: string) => /(Inc\.|LLC|Corp\.|Ltd\.|Company|Co\.)/i.test(text), score: 1 },
    { match: (text: string) => /(Engineer|Developer|Analyst|Manager|Intern|Specialist|Consultant)/i.test(text), score: -2 }, // job title
    { match: (text: string) => /[A-Z][a-zA-Z\s]+, [A-Z]{2}/.test(text), score: -1 }, // location
    { match: (text: string) => /^[A-Z][a-zA-Z\s&.,]+$/.test(text), score: 1 }, // standalone company name
    { match: (text: string) => /^[A-Z][a-zA-Z\s&.,]+(?:\s+[A-Z][a-zA-Z\s&.,]+)*$/.test(text), score: 1 }, // multi-word company name
  ],
  jobTitle: [
    { match: (text: string) => /(Software|Senior|Junior|Lead|Staff|Principal)\s+(Engineer|Developer|Architect)/i.test(text), score: 3 },
    { match: (text: string) => /(Engineer|Developer|Architect|Designer|Analyst|Manager|Intern|Specialist|Consultant)/i.test(text), score: 2 },
    { match: (text: string) => /(Research|Teaching)\s+(Assistant|Fellow)/i.test(text), score: 2 },
    { match: (text: string) => /(Summer|Winter|Spring|Fall)\s+\d{4}/i.test(text), score: -2 }, // date
    { match: (text: string) => /(Inc\.|LLC|Corp\.|Ltd\.|Company|Co\.)/i.test(text), score: -1 }, // company
  ],
  date: [
    { match: (text: string) => /(?:19|20)\d{2}/.test(text), score: 2 },
    { match: (text: string) => /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i.test(text), score: 2 },
    { match: (text: string) => /(Spring|Summer|Fall|Winter)/i.test(text), score: 2 },
    { match: (text: string) => /Present/i.test(text), score: 2 },
  ]
};

// Helper function to calculate feature score for a text item
function calculateFeatureScore(text: string, featureSets: FeatureSet[]): number {
  return featureSets.reduce((score, feature) => {
    return score + (feature.match(text) ? feature.score : 0);
  }, 0);
}

// Helper function to convert date to yyyy-MM-dd format
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.toLowerCase() === 'present') return 'present';
  
  // Handle month year format (e.g., "Sep 2019")
  const monthYearMatch = dateStr.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (monthYearMatch) {
    const year = monthYearMatch[1];
    const month = dateStr.substring(0, 3).toLowerCase();
    return `${year}-${MONTH_MAP[month]}-01`;
  }
  
  // Handle season year format (e.g., "Spring 2023")
  const seasonYearMatch = dateStr.match(/(?:Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})/i);
  if (seasonYearMatch) {
    const year = seasonYearMatch[1];
    const season = dateStr.split(' ')[0].toLowerCase();
    return `${year}-${SEASON_MAP[season]}-01`;
  }
  
  // Handle year only format (e.g., "2023")
  const yearMatch = dateStr.match(/\d{4}/);
  if (yearMatch) {
    return `${yearMatch[0]}-01-01`;
  }
  
  // Handle date range format (e.g., "Sep 2019 - May 2023")
  const dateRangeMatch = dateStr.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Fall|Autumn|Winter)\s+\d{4})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Fall|Autumn|Winter)\s+\d{4}|Present)/i);
  if (dateRangeMatch) {
    const startDate = dateRangeMatch[1];
    const endDate = dateRangeMatch[2];
    return formatDate(startDate);
  }
  
  return dateStr;
};

// Helper function to extract location from text
function extractLocation(text: string): string | null {
  // Common location patterns
  const patterns = [
    /([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})/,  // City, State
    /([A-Z][a-zA-Z\s]+)\s*,\s*([A-Z]{2})/,  // City , State
    /([A-Z][a-zA-Z\s]+)\s+([A-Z]{2})/,  // City State
    /(Remote|Hybrid|On-site)/i,  // Work arrangements
    /\(([^)]+)\)/  // Anything in parentheses - fallback
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// Helper function to extract dates from text
function extractDates(text: string): { startDate: string, endDate: string } | null {
  const datePatterns = [
    // Month Year - Month Year or Present
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Present)/i,
    // Season Year - Season Year or Present
    /((?:Spring|Summer|Fall|Winter)\s+\d{4})\s*[-–]\s*((?:Spring|Summer|Fall|Winter)\s+\d{4}|Present)/i,
    // Year - Year or Present
    /(\d{4})\s*[-–]\s*(\d{4}|Present)/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        startDate: formatDate(match[1]),
        endDate: formatDate(match[2])
      };
    }
  }
  return null;
}

/**
 * Parse text extracted from a resume to identify key information
 * Specialized for resumes with ALL CAPS section headers and specific work experience format
 */
function parseResumeText(text: string): ParsedResume {
  console.log("Full extracted text:", text);
  
  // Initialize the parsed resume with empty values
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
  
  // First, identify all the major sections by looking for ALL CAPS headers
  const sectionMatches: Record<string, { startIndex: number, endIndex: number, content: string }> = {};
  
  // Define patterns for section headers (specifically looking for ALL CAPS sections)
  const sectionPatterns = [
    { name: 'PROFILE', pattern: /\bPROFILE\b/ },
    { name: 'SUMMARY', pattern: /\bSUMMARY\b/ },
    { name: 'EDUCATION', pattern: /\bEDUCATION\b/ },
    { name: 'EXPERIENCE', pattern: /\bEXPERIENCE\b/ },
    { name: 'WORK EXPERIENCE', pattern: /\bWORK\s+EXPERIENCE\b/ },
    { name: 'EMPLOYMENT', pattern: /\bEMPLOYMENT\b/ },
    { name: 'PROJECTS', pattern: /\bPROJECTS\b/ },
    { name: 'SKILLS', pattern: /\bSKILLS\b/ },
    { name: 'ACHIEVEMENTS', pattern: /\bACHIEVEMENTS\b/ },
    { name: 'CERTIFICATIONS', pattern: /\bCERTIFICATIONS\b/ }
  ];
  
  // Find each section in the text
  const lines = text.split('\n');
  const allCapsLines: {line: string, index: number}[] = [];
  
  // First, identify all ALL CAPS lines which might be section headers
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0 && trimmedLine === trimmedLine.toUpperCase() && !/^\d+$/.test(trimmedLine)) {
      allCapsLines.push({line: trimmedLine, index});
      console.log(`Found ALL CAPS line: '${trimmedLine}' at index ${index}`);
    }
  });
  
  // Match the ALL CAPS lines to our known section patterns
  for (let i = 0; i < allCapsLines.length; i++) {
    const {line, index} = allCapsLines[i];
    
    for (const section of sectionPatterns) {
      if (section.pattern.test(line)) {
        // Found a section - determine where it ends (at the next section or end of text)
        const nextSectionIndex = i < allCapsLines.length - 1 ? allCapsLines[i + 1].index : lines.length;
        
        // Extract the content of this section (excluding the header)
        const content = lines.slice(index + 1, nextSectionIndex).join('\n');
        
        // Store the section info
        sectionMatches[section.name] = {
          startIndex: index,
          endIndex: nextSectionIndex - 1,
          content: content.trim()
        };
        
        console.log(`Found section: ${section.name}, content length: ${content.length} characters`);
        break;
      }
    }
  }
  
  // Extract personal information first
  // Look for email address
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatch = text.match(emailRegex);
  
  if (emailMatch) {
    parsedResume.personal.email = emailMatch[0];
    console.log(`Found email: ${parsedResume.personal.email}`);
  }
  
  // Look for phone number
  const phoneRegex = /\b(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?)?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
  const phoneMatch = text.match(phoneRegex);
  
  if (phoneMatch) {
    parsedResume.personal.phone = phoneMatch[0];
    console.log(`Found phone: ${parsedResume.personal.phone}`);
  }
  
  // Look for name (typically at the beginning of the resume)
  // First check the first few lines for what might be a name
  const nameLines = lines.slice(0, 5).filter(line => 
    line.trim().length > 0 && 
    line.trim().split(/\s+/).length <= 4 && 
    !/[@\d]/.test(line)
  );
  
  if (nameLines.length > 0) {
    const nameParts = nameLines[0].trim().split(/\s+/);
    if (nameParts.length >= 2) {
      parsedResume.personal.firstName = nameParts[0];
      parsedResume.personal.lastName = nameParts[nameParts.length - 1];
      console.log(`Found name: ${parsedResume.personal.firstName} ${parsedResume.personal.lastName}`);
    }
  }
  
  // Look for location
  const locationRegex = /\b[A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*,\s*[A-Z]{2}\b/;
  const locationMatch = text.match(locationRegex);
  
  if (locationMatch) {
    parsedResume.personal.location = locationMatch[0];
    console.log(`Found location: ${parsedResume.personal.location}`);
  }
  
  // Look for LinkedIn
  const linkedInRegex = /linkedin\.com\/in\/[a-z0-9-]+/i;
  const linkedInMatch = text.match(linkedInRegex);
  
  if (linkedInMatch) {
    parsedResume.personal.linkedIn = linkedInMatch[0];
    console.log(`Found LinkedIn: ${parsedResume.personal.linkedIn}`);
  }
  
  // Extract summary if available (from PROFILE or SUMMARY section)
  if (sectionMatches['PROFILE']) {
    parsedResume.personal.summary = sectionMatches['PROFILE'].content;
  } else if (sectionMatches['SUMMARY']) {
    parsedResume.personal.summary = sectionMatches['SUMMARY'].content;
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
    
    let consecutiveNonBulletLines = 0;
    let lastBulletPointIndex = -1;
    let lastCompanyLineIndex = -1;
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      if (!line) continue;
      
      // Check if this line could be a company name
      const companyScore = calculateFeatureScore(line, FEATURE_SETS.company);
      const titleScore = calculateFeatureScore(line, FEATURE_SETS.jobTitle);
      
      // Check if this is a bullet point
      const isBulletPoint = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
      
      // Update bullet point tracking
      if (isBulletPoint) {
        lastBulletPointIndex = i;
        consecutiveNonBulletLines = 0;
      } else {
        consecutiveNonBulletLines++;
      }
      
      // Detect new job start conditions:
      // 1. High company score and not too close to last company
      // 2. Gap after bullet points (2+ lines after last bullet)
      // 3. Strong title indicator after previous job
      // 4. Significant gap from last company line
      const isNewJobStart = 
        (companyScore > 2 && (lastCompanyLineIndex === -1 || i - lastCompanyLineIndex >= 2)) || 
        (lastBulletPointIndex !== -1 && i - lastBulletPointIndex >= 2) ||
        (currentJob?.description.length && titleScore > 2) ||
        (lastCompanyLineIndex !== -1 && i - lastCompanyLineIndex >= 3);
      
      if (currentJob && isNewJobStart) {
        // Save the current job if it has at least a company or title
        if (currentJob.company || currentJob.title) {
          parsedResume.experience.push(currentJob);
        }
        currentJob = null;
      }
      
      // Start new job
      if (!currentJob && (companyScore > 0 || titleScore > 0)) {
        currentJob = {
          company: companyScore > titleScore ? line : '',
          title: titleScore > companyScore ? line : '',
          startDate: '',
          endDate: '',
          description: [],
          location: ''
        };
        
        if (companyScore > 0) {
          lastCompanyLineIndex = i;
        }
        
        // Try to extract location from the current line
        const locationFromLine = extractLocation(line);
        if (locationFromLine) {
          currentJob.location = locationFromLine;
          // Clean up company/title by removing the location
          if (currentJob.company) {
            currentJob.company = currentJob.company.replace(locationFromLine, '').trim();
          }
          if (currentJob.title) {
            currentJob.title = currentJob.title.replace(locationFromLine, '').trim();
          }
        }
        
        // Look ahead for title/company/location/dates
        if (i + 1 < experienceLines.length) {
          const nextLine = experienceLines[i + 1].trim();
          const nextCompanyScore = calculateFeatureScore(nextLine, FEATURE_SETS.company);
          const nextTitleScore = calculateFeatureScore(nextLine, FEATURE_SETS.jobTitle);
          
          // Try to extract location from next line
          const locationFromNextLine = extractLocation(nextLine);
          
          if (!currentJob.location && locationFromNextLine) {
            currentJob.location = locationFromNextLine;
            // Don't increment i yet as the line might contain other information
          }
          
          // If next line looks more like a title and we don't have one
          if (!currentJob.title && nextTitleScore > nextCompanyScore) {
            currentJob.title = nextLine.replace(locationFromNextLine || '', '').trim();
            i++; // Skip the next line since we used it
          }
          // If next line looks more like a company and we don't have one
          else if (!currentJob.company && nextCompanyScore > nextTitleScore) {
            currentJob.company = nextLine.replace(locationFromNextLine || '', '').trim();
            i++; // Skip the next line since we used it
          }
        }
      }
      // If we have a current job
      else if (currentJob) {
        // Check for bullet points
        if (isBulletPoint) {
          currentJob.description.push(line.substring(1).trim());
        }
        // Check for dates
        else {
          const dates = extractDates(line);
          if (dates) {
            currentJob.startDate = dates.startDate;
            currentJob.endDate = dates.endDate;
          }
          // If no dates found, check for missing title or location
          else {
            const locationFromLine = extractLocation(line);
            if (!currentJob.location && locationFromLine) {
              currentJob.location = locationFromLine;
            }
            else if (!currentJob.title && titleScore > 0) {
              currentJob.title = line.replace(locationFromLine || '', '').trim();
            }
          }
        }
      }
    }
    
    // Don't forget to add the last job
    if (currentJob && (currentJob.company || currentJob.title)) {
      parsedResume.experience.push(currentJob);
    }
  }
  
  // Process EDUCATION section
  if (sectionMatches['EDUCATION']) {
    const educationContent = sectionMatches['EDUCATION'].content;
    const educationLines = educationContent.split('\n').filter(line => line.trim().length > 0);
    
    if (educationLines.length > 0) {
      const educationEntries = [];
      let currentEntry = {
        startLine: 0,
        endLine: 0
      };
      
      // Identify education entries
      for (let i = 0; i < educationLines.length; i++) {
        const line = educationLines[i].trim();
        
        // Education entries often start with the institution name
        // which is typically a standalone line with the school name
        if (i === 0 || 
            (line.length > 0 && 
             /University|College|School|Institute/i.test(line) && 
             !line.startsWith('•') && !line.startsWith('-'))) {
          
          // If we were already processing an entry, finalize it
          if (i > 0) {
            currentEntry.endLine = i - 1;
            educationEntries.push({...currentEntry});
          }
          
          // Start new entry
          currentEntry = {
            startLine: i,
            endLine: 0
          };
        }
      }
      
      // Don't forget the last entry
      currentEntry.endLine = educationLines.length - 1;
      educationEntries.push(currentEntry);
      
      // Process each education entry
      for (const entry of educationEntries) {
        let institution = educationLines[entry.startLine].trim();
        let degree = '';
        let field = '';
        let startDate = '';
        let endDate = '';
        let gpa = '';
        const descriptions: string[] = [];
        
        // Process remaining lines for degree, dates, GPA
        for (let i = entry.startLine + 1; i <= entry.endLine; i++) {
          const line = educationLines[i].trim();
          
          // Check for degree information
          if (!degree && /Bachelor|Master|Ph\.D\.|Associate|B\.S\.|M\.S\.|B\.A\.|M\.A\./i.test(line)) {
            degree = line;
            
            // Look for GPA in the same line
            const gpaMatch = line.match(/\b([0-9]+\.[0-9]+)\s+GPA\b/i);
            if (gpaMatch) {
              gpa = gpaMatch[1];
            }
            continue;
          }
          
          // Check for GPA if we haven't found it yet
          if (!gpa) {
            const gpaMatch = line.match(/\bGPA\s*:?\s*([0-9]+\.[0-9]+)\b/i);
            if (gpaMatch) {
              gpa = gpaMatch[1];
              continue;
            }
          }
          
          // Check for date information
          if (!startDate) {
            const dateMatch = line.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Present)\b/i) ||
                             line.match(/\b(\d{4})\s*[-–]\s*(\d{4}|Present)\b/i);
            if (dateMatch) {
              startDate = formatDate(dateMatch[1]);
              endDate = dateMatch[2] ? formatDate(dateMatch[2]) : 'present';
              continue;
            }
          }
          
          // Check for bullet points describing education
          if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
              /^[\u2022\u2023\u25E6\u2043\u2219]/.test(line)) {
            const bulletText = line.replace(/^[•\-*\u2022\u2023\u25E6\u2043\u2219]\s*/, '').trim();
            if (bulletText.length > 0) {
              descriptions.push(bulletText);
            }
          }
        }
        
        // Add the education entry
        parsedResume.education.push({
          institution,
          degree,
          field,
          startDate,
          endDate,
          gpa,
          descriptions
        });
        
        console.log(`Added education: ${institution}, ${degree}, GPA: ${gpa}, ${startDate}-${endDate}`);
      }
    }
  }
  
  // Process PROJECTS section
  if (sectionMatches['PROJECTS']) {
    const projectsContent = sectionMatches['PROJECTS'].content;
    const projectsLines = projectsContent.split('\n').filter(line => line.trim().length > 0);
    
    const projectEntries = [];
    let currentEntry = {
      startLine: 0,
      endLine: 0
    };
    
    // Identify project entries
    for (let i = 0; i < projectsLines.length; i++) {
      const line = projectsLines[i].trim();
      
      // Project entries often start with project name, which is typically a standalone line
      if (i === 0 || 
          (line.length > 0 && 
           !line.startsWith('•') && !line.startsWith('-') && 
           projectsLines[i-1].startsWith('•') || projectsLines[i-1].startsWith('-'))) {
        
        // If we were already processing an entry, finalize it
        if (i > 0) {
          currentEntry.endLine = i - 1;
          projectEntries.push({...currentEntry});
        }
        
        // Start new entry
        currentEntry = {
          startLine: i,
          endLine: 0
        };
      }
    }
    
    // Don't forget the last entry
    currentEntry.endLine = projectsLines.length - 1;
    projectEntries.push(currentEntry);
    
    // Process each project entry
    for (const entry of projectEntries) {
      let name = projectsLines[entry.startLine].trim();
      let date = '';
      const descriptions: string[] = [];
      
      // Check if the project name line contains a date
      const dateMatch = name.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Spring\s+\d{4}|Fall\s+\d{4}|Summer\s+\d{4})\b/i);
      
      if (dateMatch) {
        date = dateMatch[1];
        // Remove date from name
        name = name.replace(dateMatch[0], '').trim();
      }
      
      // Look for bullet points in the remaining lines
      for (let i = entry.startLine + 1; i <= entry.endLine; i++) {
        const line = projectsLines[i].trim();
        
        // Check for date if we don't have one yet
        if (!date) {
          const dateMatch = line.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Spring\s+\d{4}|Fall\s+\d{4}|Summer\s+\d{4})\b/i);
          if (dateMatch) {
            date = dateMatch[1];
            continue;
          }
        }
        
        // Check for bullet points
        if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
            /^[\u2022\u2023\u25E6\u2043\u2219]/.test(line)) {
          const bulletText = line.replace(/^[•\-*\u2022\u2023\u25E6\u2043\u2219]\s*/, '').trim();
          if (bulletText.length > 0) {
            descriptions.push(bulletText);
          }
        }
      }
      
      // Add the project entry
      parsedResume.projects.push({
        name,
        date,
        descriptions
      });
      
      console.log(`Added project: ${name}, ${date}, ${descriptions.length} bullet points`);
    }
  }
  
  // Process SKILLS section
  if (sectionMatches['SKILLS']) {
    const skillsContent = sectionMatches['SKILLS'].content;
    
    // Skills can be listed in various formats, including:
    // - Bullet points
    // - Comma-separated lists
    // - Category headers with skills listed beneath
    
    // First, split by bullet points if present
    const bulletPointSkills: string[] = [];
    const skillsLines = skillsContent.split('\n');
    
    skillsLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return;
      
      // Check if this is a bullet point
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || 
          /^[\u2022\u2023\u25E6\u2043\u2219]/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[•\-*\u2022\u2023\u25E6\u2043\u2219]\s*/, '').trim();
        bulletPointSkills.push(bulletText);
      } else {
        // For non-bullet points, try comma separation
        const commaSeparated = trimmed.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        if (commaSeparated.length > 1) {
          commaSeparated.forEach(skill => {
            const cleanedSkill = skill.trim();
            if (cleanedSkill.length > 0) {
              bulletPointSkills.push(cleanedSkill);
            }
          });
        } else {
          // If no commas, add the whole line
          bulletPointSkills.push(trimmed);
        }
      }
    });
    
    // If we found bullet point skills, use those
    if (bulletPointSkills.length > 0) {
      // Process each bullet to split further if it contains multiple skills
      bulletPointSkills.forEach(bullet => {
        // Check if this bullet contains a list of skills (common in tech resumes)
        if (bullet.includes(',')) {
          const skillsList = bullet.split(',').map(s => s.trim()).filter(s => s.length > 0);
          parsedResume.skills.push(...skillsList);
        } else {
          parsedResume.skills.push(bullet);
        }
      });
    }
    // If no bullet points, try to parse the entire content as a comma-separated list
    else if (skillsContent.includes(',')) {
      const skillsList = skillsContent
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      parsedResume.skills.push(...skillsList);
    }
    // Fallback: use each non-empty line as a skill
    else {
      skillsLines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .forEach(line => parsedResume.skills.push(line));
    }
    
    console.log(`Found ${parsedResume.skills.length} skills`);
  }
  
  return parsedResume;
}

/**
 * Enhanced PDF parser with multiple extraction methods and fallbacks
 * Specialized for resumes with ALL CAPS section headers
 */
export async function parseResumeFile(file: File): Promise<Partial<Profile>> {
  try {
    // Step 1: Extract text content from file using multiple methods
    const textContent = await extractPdfTextWithFallbacks(file);
    console.log('Extracted text content length:', textContent.length);
    
    // If text extraction was successful, try to parse the structured data
    if (textContent.length > 100) {
      // Step 2: Parse the text to extract structured information
      const parsedResume = parseResumeText(textContent);
      
      // Step 3: Convert to our Profile structure
      return {
        personal: {
          firstName: parsedResume.personal.firstName,
          lastName: parsedResume.personal.lastName,
          email: parsedResume.personal.email,
          phone: parsedResume.personal.phone,
          // Add location and LinkedIn if available
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
    } else {
      // If our enhanced parsing didn't yield good results, fall back to the original parser
      console.log('Enhanced parsing yielded insufficient results, falling back to original parser');
      return originalParseResumeFile(file);
    }
  } catch (error: unknown) {
    console.error('Enhanced resume parsing error:', error);
    
    // If the enhanced parser fails, try the original as a fallback
    try {
      console.log('Trying original parser as fallback');
      return originalParseResumeFile(file);
    } catch (fallbackError) {
      console.error('Both parsers failed:', fallbackError);
      throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Extract PDF text using multiple methods with fallbacks
 * Tries several approaches and uses the one with the most content
 */
async function extractPdfTextWithFallbacks(file: File): Promise<string> {
  const results: { method: string; text: string }[] = [];
  
  // Only try PDF methods for PDF files
  if (file.type === 'application/pdf') {
    try {
      // Method 1: Use PDF.js with position-aware text extraction
      const arrayBuffer1 = await file.arrayBuffer();
      const positionAwareText = await extractTextWithPositioningFromPDF(arrayBuffer1);
      if (isValidText(positionAwareText)) {
        results.push({
          method: 'pdf.js-positioned',
          text: positionAwareText
        });
      }
      
      // Method 2: Use plain PDF.js extraction
      const arrayBuffer2 = await file.arrayBuffer();
      const plainPdfJsText = await extractTextFromPDF(arrayBuffer2);
      if (isValidText(plainPdfJsText)) {
        results.push({
          method: 'pdf.js-plain',
          text: plainPdfJsText
        });
      }
      
      // Method 3: Use fallback method if others fail
      const fallbackText = await extractTextFromPDFFallback(file);
      if (isValidText(fallbackText)) {
        results.push({
          method: 'pdf.js-fallback',
          text: fallbackText
        });
      }
    } catch (error) {
      console.error('Error in PDF extraction methods:', error);
    }
  } else {
    // For non-PDF files, use simple text extraction
    const text = await extractNonPdfText(file);
    if (isValidText(text)) {
      results.push({
        method: 'plain-text',
        text
      });
    }
  }
  
  // Find the best result based on text quality
  results.sort((a, b) => {
    const scoreA = calculateTextQualityScore(a.text);
    const scoreB = calculateTextQualityScore(b.text);
    return scoreB - scoreA;
  });
  
  // Log results for debugging
  for (const result of results) {
    console.log(`Extraction method: ${result.method}, text length: ${result.text.length}, quality score: ${calculateTextQualityScore(result.text)}`);
  }
  
  // Return the best result, or empty string if all methods failed
  return results.length > 0 ? results[0].text : '';
}

/**
 * Check if extracted text is valid and useful
 */
function isValidText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // Text should be mostly printable ASCII characters
  const printableRatio = text.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length / text.length;
  if (printableRatio < 0.7) return false;
  
  // Text should have some minimum length
  if (text.length < 50) return false;
  
  // Text should contain some common resume keywords
  const commonWords = ['experience', 'education', 'skills', 'work', 'project'];
  const hasCommonWords = commonWords.some(word => text.toLowerCase().includes(word));
  if (!hasCommonWords) return false;
  
  return true;
}

/**
 * Calculate a quality score for the extracted text
 */
function calculateTextQualityScore(text: string): number {
  let score = 0;
  
  // Favor text with higher ratio of printable characters
  const printableRatio = text.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length / text.length;
  score += printableRatio * 50;
  
  // Favor text with common resume section headers
  const sections = ['experience', 'education', 'skills', 'projects', 'work'];
  sections.forEach(section => {
    if (text.toLowerCase().includes(section)) score += 10;
  });
  
  // Favor text with reasonable line breaks (not too many, not too few)
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const lineRatio = lines.length / text.length;
  if (lineRatio > 0.01 && lineRatio < 0.1) score += 20;
  
  // Penalize text with high occurrence of special characters
  const specialCharRatio = text.split('').filter(c => !(/[a-zA-Z0-9\s.,]/).test(c)).length / text.length;
  score -= specialCharRatio * 30;
  
  return score;
}

/**
 * Position-aware PDF text extraction for better structure preservation
 */
async function extractTextWithPositioningFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Check if worker is properly configured
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      console.warn('PDF.js worker source is not configured');
      throw new Error('PDF.js worker not configured properly');
    }

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: buffer,
      disableAutoFetch: true,
      disableStream: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
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
            const y = Math.round(transform[5]); // Round to handle slight variations
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
          // Sort items by x position
          line.sort((a, b) => a.x - b.x);
          
          // Join with appropriate spacing
          const lineText = line.map(item => item.str).join(' ');
          fullText += lineText + '\n';
        }
      }
      
      fullText += '\n'; // Add extra line between pages
      console.log(`Extracted positioned text from page ${i}/${pdf.numPages}`);
    }
    
    return fullText;
  } catch (error) {
    console.error('Error in position-aware PDF extraction:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF using pdf.js standard method
 */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Check if worker is properly configured
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      console.warn('PDF.js worker source is not configured');
      throw new Error('PDF.js worker not configured properly');
    }

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: buffer,
      disableAutoFetch: true,
      disableStream: true,
    });
    
    const timeoutMs = 10000; // 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`PDF loading timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Join all the text items from the page
      const pageText = textContent.items
        .map(item => 'str' in item ? item.str : '')
        .join(' ');
        
      fullText += pageText + '\n\n';
      
      console.log(`Extracted text from page ${i}/${pdf.numPages}`);
    }
    
    return fullText;
  } catch (error) {
    console.error('Error in standard PDF extraction:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fallback method for PDF text extraction
 */
async function extractTextFromPDFFallback(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Using fallback PDF text extraction method...');
    
    const reader = new FileReader();
    reader.onload = () => {
      let text = '';
      try {
        const content = reader.result as string;
        
        // First attempt: Look for text content between parentheses
        const textChunks = content.match(/\(([^)]+)\)/g) || [];
        
        text = textChunks
          .map(chunk => chunk.slice(1, -1))
          .join(' ')
          .replace(/\\r|\\n|\\t/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Second attempt if first approach didn't yield much text
        if (text.length < 100) {
          console.log('First extraction method yielded insufficient text, trying alternative approach');
          const contentMatches = content.match(/[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){5,}/g) || [];
          if (contentMatches.length > 0) {
            text = contentMatches.join(' ');
          }
        }
        
        // Third attempt - try to extract all plain text
        if (text.length < 100) {
          console.log('Second extraction method yielded insufficient text, trying full content scan');
          const plainTextMatches = content.match(/[\x20-\x7E]{4,}/g) || [];
          text = plainTextMatches
            .filter(fragment => fragment.length > 10)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        console.log(`Fallback extraction complete. Extracted ${text.length} characters.`);
        
        if (text.length > 0) {
          resolve(text);
        } else {
          reject(new Error('Could not extract text from PDF using fallback method'));
        }
      } catch (error) {
        console.error('Error in fallback PDF extraction:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(new Error('Failed to read PDF file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Extract text from non-PDF file formats
 */
async function extractNonPdfText(file: File): Promise<string> {
  const fileType = file.type;
  
  // For text/plain or similar text formats
  if (fileType.includes('text/') || fileType === 'application/rtf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  }
  
  // For DOC/DOCX files
  if (fileType === 'application/msword' || 
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const textFromDoc = extractTextFromDoc(arrayBuffer);
        resolve(textFromDoc);
      };
      reader.onerror = () => reject(new Error('Failed to read document file'));
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Fallback - try to read as text
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string || '');
    reader.onerror = () => reject(new Error('Unsupported file format'));
    reader.readAsText(file);
  });
}

/**
 * Basic text extraction from DOC/DOCX 
 */
function extractTextFromDoc(buffer: ArrayBuffer): string {
  // Convert buffer to string (this is a simple approach)
  const textDecoder = new TextDecoder('utf-8');
  let text = textDecoder.decode(buffer);
  
  // Clean up text by removing binary characters
  text = text.replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/\s+/g, ' ');
  
  return text || "Could not extract text from document. Please use a text format.";
}