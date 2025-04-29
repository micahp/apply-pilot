import { Profile } from '../types/profile';
import * as pdfjsLib from 'pdfjs-dist';

// Set up worker configuration for Chrome extensions (compatible with CSP)
// In a Chrome extension, we need to use the extension URL since it's within the allowed CSP
try {
  const workerUrl = chrome.runtime.getURL('pdf.worker.min.js');
  console.log('Setting PDF.js worker URL to:', workerUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} catch (error) {
  console.error('Failed to set PDF.js worker URL:', error);
}

// Simple Resume Parser
// This is a basic implementation to extract data from resume text content
// In a production environment, you would use a more robust solution or API

interface ParsedResume {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description: string;
    location?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
  }>;
  skills: string[];
}

/**
 * Extract content from different resume file types
 */
export async function extractResumeContent(file: File): Promise<string> {
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
  
  // For PDF files
  if (fileType === 'application/pdf') {
    try {
      console.log('Extracting text from PDF using pdfjs-dist...');
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        // First try with PDF.js
        const text = await extractTextFromPDF(arrayBuffer);
        return text;
      } catch (pdfJsError) {
        // If PDF.js fails, try a simpler approach with FileReader
        console.warn('PDF.js extraction failed, trying fallback method...', pdfJsError);
        return extractTextFromPDFFallback(file);
      }
    } catch (err) {
      console.error('PDF extraction error:', err);
      throw new Error('Failed to extract text from PDF');
    }
  }
  
  // For DOC/DOCX files
  if (fileType === 'application/msword' || 
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // In a real implementation, you would need a server-side component or specialized library
    // For this demo, we'll extract whatever text is available
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Attempt to extract text from binary data
        // This is a very simplified approach
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
 * Extract text from PDF buffer using pdfjs-dist
 */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Check if worker is properly configured
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      console.warn('PDF.js worker source is not configured');
      throw new Error('PDF.js worker not configured properly');
    }

    // Load the PDF document using pdfjs-dist with proper error handling
    console.log('Creating PDF loading task with buffer size:', buffer.byteLength);
    const loadingTask = pdfjsLib.getDocument({ 
      data: buffer,
      disableAutoFetch: true, // Disable streaming to improve reliability
      disableStream: true,
    });
    
    // Set a timeout for the loading operation
    const timeoutMs = 10000; // 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`PDF loading timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    // Add error handler for the loading task
    const pdf = await Promise.race([loadingTask.promise, timeoutPromise])
      .catch(error => {
        console.error('PDF loading error:', error);
        throw new Error(`Failed to load PDF: ${error.message}`);
      });
    
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    // Extract text from each page
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
    
    console.log('PDF text extraction completed. Text length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from DOC/DOCX buffer
 * Very simplified implementation for demo purposes
 */
function extractTextFromDoc(buffer: ArrayBuffer): string {
  // This is a placeholder - in a real implementation, use a library or API
  
  // Convert buffer to string (this won't work properly for binary DOC data)
  // Just a simplistic approach to show structure
  const textDecoder = new TextDecoder('utf-8');
  let text = textDecoder.decode(buffer);
  
  // Clean up text by removing binary characters
  text = text.replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/\s+/g, ' ');
  
  return text || "Could not extract text from document. Please use a text format.";
}

/**
 * Fallback method to extract text from PDF file using FileReader
 * This is a simplified approach that may not work for all PDFs
 * but provides a backup in case PDF.js fails
 */
function extractTextFromPDFFallback(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Using fallback PDF text extraction method...');
    
    const reader = new FileReader();
    reader.onload = () => {
      let text = '';
      try {
        // Try to extract readable text from the PDF binary data
        // This is very basic and won't work for all PDFs
        const content = reader.result as string;
        
        // First attempt: Look for text content between parentheses (common in PDFs)
        const textChunks = content.match(/\(([^)]+)\)/g) || [];
        
        text = textChunks
          .map(chunk => chunk.slice(1, -1)) // Remove the parentheses
          .join(' ')
          .replace(/\\r|\\n|\\t/g, ' ') // Replace escaped newlines and tabs
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Second attempt if first approach didn't yield much text
        if (text.length < 100) {
          console.log('First extraction method yielded insufficient text, trying alternative approach');
          // Look for longer text strings that might be content
          const contentMatches = content.match(/[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){5,}/g) || [];
          if (contentMatches.length > 0) {
            text = contentMatches.join(' ');
          }
        }
        
        // Third attempt - try to extract all plain text
        if (text.length < 100) {
          console.log('Second extraction method yielded insufficient text, trying full content scan');
          // Extract all readable ASCII text
          const plainTextMatches = content.match(/[\x20-\x7E]{4,}/g) || [];
          text = plainTextMatches
            .filter(fragment => fragment.length > 10) // Only keep longer fragments
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
    
    // Try to read as text first
    reader.readAsText(file);
  });
}

/**
 * Parse resume text to extract structured data
 */
function parseResumeText(text: string): ParsedResume {
  console.log('Parsing resume text:', text.substring(0, 100) + '...');
  
  // Initialize the parsed resume with empty values
  const parsedResume: ParsedResume = {
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: ''
    },
    experience: [],
    education: [],
    skills: []
  };
  
  // Extract email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);
  if (emails && emails.length > 0) {
    parsedResume.personal.email = emails[0];
  }
  
  // Extract phone numbers - various formats
  const phoneRegex = /\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const phones = text.match(phoneRegex);
  if (phones && phones.length > 0) {
    parsedResume.personal.phone = phones[0];
  }
  
  // Extract name - look for patterns or use heuristics
  // This is a simple approach that looks for capitalized words at beginning
  const nameMatch = text.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
  if (nameMatch) {
    parsedResume.personal.firstName = nameMatch[1];
    parsedResume.personal.lastName = nameMatch[2];
  } else {
    // Try to find name in other formats, like "Name: John Doe"
    const altNameMatch = text.match(/(?:name|candidate)[\s:]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i);
    if (altNameMatch) {
      parsedResume.personal.firstName = altNameMatch[1];
      parsedResume.personal.lastName = altNameMatch[2];
    }
  }
  
  // If we still don't have a name, try to find it in the first few lines
  if (!parsedResume.personal.firstName) {
    const firstLines = text.split('\n').slice(0, 10).join(' ');
    const namePattern = /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
    let nameMatches;
    
    // Find all capitalized name-like patterns in first few lines
    while ((nameMatches = namePattern.exec(firstLines)) !== null) {
      // Skip common header words
      const fullName = nameMatches[0];
      if (!['Resume Summary', 'Curriculum Vitae', 'Personal Information'].includes(fullName)) {
        parsedResume.personal.firstName = nameMatches[1];
        parsedResume.personal.lastName = nameMatches[2]; 
        break;
      }
    }
  }
  
  // Identify major sections in the resume using a more flexible approach
  const sections: { [key: string]: string } = {};
  
  // Common section headers with variations
  const sectionHeaders = [
    { key: 'experience', patterns: ['EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT', 'WORK HISTORY'] },
    { key: 'education', patterns: ['EDUCATION', 'ACADEMIC', 'EDUCATIONAL BACKGROUND', 'ACADEMIC BACKGROUND'] },
    { key: 'skills', patterns: ['SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES', 'COMPETENCIES', 'PROFICIENCIES', 'EXPERTISE'] },
    { key: 'projects', patterns: ['PROJECTS', 'PROJECT EXPERIENCE', 'KEY PROJECTS'] },
    { key: 'certifications', patterns: ['CERTIFICATIONS', 'CERTIFICATES', 'QUALIFICATIONS'] }
  ];
  
  // Common degree patterns for education extraction
  const degreePatterns = [
    /(?:Bachelor|Master|PhD|Doctorate|Associate|B\.S\.|M\.S\.|B\.A\.|M\.A\.|M\.B\.A\.|B\.Tech|M\.Tech)/i,
    /(?:Bachelor's|Master's|Doctoral|Associate's) (?:Degree|degree)?(?:\s+in\s+|\s+of\s+)?([A-Za-z\s]+)/i,
    /(?:BS|BA|MS|MA|MBA|PhD)(?:\s+in\s+|\s+of\s+)?([A-Za-z\s]+)/i
  ];
  
  // Get the full text as a diagnostic
  console.log('Full resume text for analysis:', text);
  
  // Break the resume into major sections using two approaches
  
  // Approach 1: Line-by-line analysis
  const lines = text.split('\n');
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    const lineUpper = line.toUpperCase();
    
    // Check if this line is a section header
    let isHeader = false;
    for (const sectionHeader of sectionHeaders) {
      // Check for exact matches first
      if (sectionHeader.patterns.includes(lineUpper)) {
        currentSection = sectionHeader.key;
        sections[currentSection] = '';
        isHeader = true;
        console.log(`Found exact section header: "${line}" -> ${currentSection}`);
        break;
      }
      
      // Check for partial matches (for headers like "WORK EXPERIENCE AND HISTORY")
      if (!isHeader) {
        for (const pattern of sectionHeader.patterns) {
          if (lineUpper.includes(pattern)) {
            currentSection = sectionHeader.key;
            sections[currentSection] = '';
            isHeader = true;
            console.log(`Found partial section header: "${line}" -> ${currentSection}`);
            break;
          }
        }
        if (isHeader) break;
      }
    }
    
    // A line with just 1-2 words in ALL CAPS could be a section header
    if (!isHeader && lineUpper === line && line.split(/\s+/).length <= 3 && line.length > 3) {
      // Check if this might be a custom section header
      const potentialHeader = line.toUpperCase();
      
      if (potentialHeader.includes('SKILL')) {
        currentSection = 'skills';
        sections[currentSection] = '';
        isHeader = true;
        console.log(`Found potential skills header: "${line}"`);
      } else if (potentialHeader.includes('EDUCAT') || potentialHeader.includes('ACADEMIC')) {
        currentSection = 'education';
        sections[currentSection] = '';
        isHeader = true;
        console.log(`Found potential education header: "${line}"`);
      } else if (potentialHeader.includes('WORK') || potentialHeader.includes('EXPER') || 
                potentialHeader.includes('EMPLOY') || potentialHeader === 'JOBS') {
        currentSection = 'experience';
        sections[currentSection] = '';
        isHeader = true;
        console.log(`Found potential experience header: "${line}"`);
      }
    }
    
    if (!isHeader && currentSection) {
      // Add content to the current section
      sections[currentSection] += lines[i] + '\n';
    }
  }
  
  // Approach 2: Use regex to find sections if the first approach didn't work well
  if (Object.keys(sections).length <= 1) {
    console.log('Using alternative section detection method');
    
    // Try to extract sections using regex patterns
    for (const sectionHeader of sectionHeaders) {
      for (const pattern of sectionHeader.patterns) {
        const regex = new RegExp(`(${pattern})\\s*(?:\\n|$)([\\s\\S]*?)(?=\\n(?:[A-Z][A-Z\\s]{2,}|$)|$)`, 'i');
        const match = text.match(regex);
        
        if (match && match[2] && match[2].trim().length > 0) {
          sections[sectionHeader.key] = match[2].trim() + '\n';
          console.log(`Found section using regex: ${sectionHeader.key} (${pattern})`);
          break;
        }
      }
    }
  }
  
  // If we still don't have an experience section but can identify patterns, create one
  if (!sections.experience) {
    // Look for company - location - date patterns
    const expRegex = /([A-Z][A-Za-z\s&.,]+)[\s]*[-–][\s]*([A-Za-z,\s]+)[\s]*[-–][\s]*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+[-–][\s\d\w]+)/gi;
    
    let expMatches;
    let experienceText = '';
    
    while ((expMatches = expRegex.exec(text)) !== null) {
      const matchedText = text.substring(expMatches.index);
      // Take this match and the next ~10 lines as a potential job description
      const nextLines = matchedText.split('\n', 10).join('\n');
      experienceText += nextLines + '\n\n';
    }
    
    if (experienceText) {
      sections.experience = experienceText;
      console.log('Created experience section from pattern matches');
    }
  }
  
  console.log('Identified sections:', Object.keys(sections));
  
  // Extract skills from the skills section
  if (sections.skills) {
    // Look for skill keywords using multiple approaches
    const skillLines = sections.skills.split(/[\n•]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Process each line to extract skill keywords
    for (const line of skillLines) {
      // Split by common separators
      const lineSkills = line.split(/[,|/•:;]|\s{2,}/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);
      
      // Filter out non-skills
      const filteredSkills = lineSkills.filter(skill => {
        const lowerSkill = skill.toLowerCase();
        return !['and', 'the', 'with', 'for', 'experience', 'years', 'using', 'including'].includes(lowerSkill);
      });
      
      parsedResume.skills.push(...filteredSkills);
    }
    
    // If we still don't have skills, look for bullet points or list-like structures
    if (parsedResume.skills.length === 0) {
      const potentialSkills = sections.skills.match(/[•\-*][\s]*([^•\-*\n]+)/g);
      if (potentialSkills) {
        parsedResume.skills = potentialSkills.map(s => 
          s.replace(/^[•\-*\s]+/, '').trim()
        ).filter(s => s.length > 2 && s.length < 50);
      }
    }
    
    // Even if sections.skills exists but we couldn't extract skills,
    // try to find skills from the entire document
    if (parsedResume.skills.length === 0) {
      // Look for technology terms in the entire document
      const techTerms = [
        'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 
        'HTML', 'CSS', 'SASS', 'SCSS', 'Python', 'Java', 'C#', 'C++', 'Ruby', 'PHP',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'REST', 'GraphQL',
        'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'TensorFlow',
        'PyTorch', 'NLP', 'Machine Learning', 'AI', 'Data Science', 'Agile', 'Scrum'
      ];
      
      for (const term of techTerms) {
        if (text.includes(term)) {
          parsedResume.skills.push(term);
        }
      }
    }
    
    // Remove duplicates
    parsedResume.skills = [...new Set(parsedResume.skills)];
  }
  
  // Extract experience from the identified experience section
  if (sections.experience) {
    const experienceText = sections.experience;
    console.log('Experience section content:', experienceText.substring(0, 200) + '...');
    
    // Two patterns to try:
    // 1. Company - Location - Date
    // 2. Company at Location - Date
    
    // Approach 1: Split by common job entry patterns
    const companyPattern = /([A-Z][A-Za-z0-9\s&.,]+)[\s]*[–-][\s]*([A-Za-z,\s]+)[\s]*(?:[–-][\s]*)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+(?:[–-][\s]*(?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+))?)/i;
    
    const jobBlocks = [];
    const lines = experienceText.split('\n');
    
    let currentJob = '';
    let captureStarted = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      // Check if this line starts a new job entry
      const isJobHeader = companyPattern.test(line);
      
      if (isJobHeader) {
        // If we were already capturing a job, save it
        if (captureStarted && currentJob.trim()) {
          jobBlocks.push(currentJob.trim());
        }
        
        // Start a new job capture
        currentJob = line + '\n';
        captureStarted = true;
      } else if (captureStarted) {
        // Continue capturing this job
        currentJob += line + '\n';
      }
    }
    
    // Don't forget the last job
    if (captureStarted && currentJob.trim()) {
      jobBlocks.push(currentJob.trim());
    }
    
    // If we couldn't find clear job blocks with the first approach, try another
    if (jobBlocks.length <= 1) {
      // Approach 2: Use a more generic pattern that might catch more jobs
      const alternativePattern = /(?:^|\n)([A-Z][A-Za-z0-9\s&.,]+)\s+(?:[-–]|at|with|for)\s+/gm;
      let match;
      let lastIndex = 0;
      
      // Reset job blocks
      jobBlocks.length = 0;
      
      while ((match = alternativePattern.exec(experienceText)) !== null) {
        // If this isn't the first match, capture everything from the last match to this one
        if (lastIndex > 0) {
          const jobText = experienceText.substring(lastIndex, match.index).trim();
          if (jobText.length > 20) {
            jobBlocks.push(jobText);
          }
        }
        lastIndex = match.index;
      }
      
      // Capture the last job
      if (lastIndex > 0 && lastIndex < experienceText.length) {
        const jobText = experienceText.substring(lastIndex).trim();
        if (jobText.length > 20) {
          jobBlocks.push(jobText);
        }
      }
    }
    
    // If we still don't have job blocks, try splitting by double newlines
    if (jobBlocks.length <= 1) {
      const paragraphs = experienceText.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      if (paragraphs.length > 1) {
        jobBlocks.length = 0; // Clear the array
        paragraphs.forEach(block => {
          jobBlocks.push(block.trim());
        });
      }
    }
    
    console.log(`Found ${jobBlocks.length} job blocks`);
    
    // Process each job block to extract details
    for (const jobBlock of jobBlocks) {
      // Skip if too short
      if (jobBlock.trim().length < 20) continue;
      
      const exp = {
        company: '',
        title: '',
        startDate: '',
        endDate: '',
        description: jobBlock.trim(),
        location: ''
      };
      
      const lines = jobBlock.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // First line often contains company, location, and dates
      if (lines.length > 0) {
        const firstLine = lines[0];
        
        // Try company - location - date pattern
        const companyMatch = firstLine.match(/^([^-–]+)[-–]([^-–]+)(?:[-–]([^-–]+))?/);
        if (companyMatch) {
          exp.company = companyMatch[1].trim();
          exp.location = companyMatch[2].trim();
          
          // If there's a third part, it might be a date
          if (companyMatch[3]) {
            const dateText = companyMatch[3].trim();
            // Look for month year - month year or month year - present
            const dateMatch = dateText.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+)[-–]?((?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+))?/i);
            
            if (dateMatch) {
              exp.startDate = dateMatch[1].trim();
              exp.endDate = dateMatch[2] ? dateMatch[2].trim() : 'Present';
            }
          }
        } else {
          // Try to extract company name
          exp.company = firstLine;
        }
      }
      
      // Second line often contains job title
      if (lines.length > 1) {
        // Check if the second line looks like a job title
        const titleLine = lines[1];
        // Job titles typically don't contain dates or location markers
        if (!/\d{4}/.test(titleLine) && !titleLine.includes('-') && !titleLine.includes('–')) {
          exp.title = titleLine;
        }
      }
      
      // If we haven't found dates yet, look through all lines
      if (!exp.startDate) {
        for (const line of lines) {
          // Look for date ranges
          const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+)[-–]?((?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\s\d]+))?/i);
          
          if (dateMatch) {
            exp.startDate = dateMatch[1].trim();
            exp.endDate = dateMatch[2] ? dateMatch[2].trim() : 'Present';
            break;
          }
        }
      }
      
      // Extract job description (everything after the first 1-2 lines)
      const descriptionStartIdx = exp.title ? 2 : 1;
      if (lines.length > descriptionStartIdx) {
        exp.description = lines.slice(descriptionStartIdx).join('\n');
      }
      
      // Only add if we have at least company or title
      if (exp.company || exp.title) {
        parsedResume.experience.push(exp);
      }
    }
    
    // If we still don't have any experience entries but have text,
    // use a special pattern for this specific resume format
    if (parsedResume.experience.length === 0 && experienceText.length > 0) {
      // Try a more specific pattern match for this resume
      const jobPattern = /(.*?)\s+[-–]\s+(.*?)\s+[-–]\s+(.*?)\s+[-–]\s+(.*)/g;
      let match;
      
      while ((match = jobPattern.exec(experienceText)) !== null) {
        const [_, company, location, dates, title] = match;
        
        // Split the dates into start and end
        const dateMatch = dates.match(/(.*?)[-–](.*)/);
        const startDate = dateMatch ? dateMatch[1].trim() : dates.trim();
        const endDate = dateMatch ? dateMatch[2].trim() : 'Present';
        
        parsedResume.experience.push({
          company: company.trim(),
          location: location.trim(),
          title: title.trim(),
          startDate,
          endDate,
          description: ''
        });
      }
    }
  }
  
  // Extract education
  if (sections.education) {
    const educationText = sections.education;
    
    // Split education section into individual entries
    const eduBlocks = educationText.split(/\n\s*\n/);
    
    for (const eduBlock of eduBlocks) {
      // Skip if too short
      if (eduBlock.trim().length < 10) continue;
      
      const edu = {
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
      };
      
      const lines = eduBlock.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // First line often contains institution
      if (lines.length > 0) {
        // Try to match institution name patterns
        const firstLine = lines[0];
        const institutionMatch = firstLine.match(/([A-Z][A-Za-z\s&.,]+(?:University|College|Institute|School))/i);
        if (institutionMatch) {
          edu.institution = institutionMatch[1].trim();
        } else {
          // If no specific pattern matched, use the whole line
          edu.institution = firstLine;
        }
      }
      
      // Look for degree and field of study
      for (const line of lines) {
        // Try each degree pattern
        for (const pattern of degreePatterns) {
          const degreeMatch = line.match(pattern);
          if (degreeMatch) {
            edu.degree = degreeMatch[0].trim();
            
            // If the pattern captured a field group, use it
            if (degreeMatch[1]) {
              edu.field = degreeMatch[1].trim();
            }
            break;
          }
        }
        
        // If we found a degree, no need to continue
        if (edu.degree) break;
      }
      
      // Look for dates
      for (const line of lines) {
        // Look for date patterns
        const dateMatch = line.match(/(\b\d{4}\b)(?:\s*[-–]\s*|\s+to\s+)?(\b\d{4}\b|Present\b|Current\b)?/i);
        if (dateMatch) {
          edu.startDate = dateMatch[1];
          if (dateMatch[2]) {
            edu.endDate = dateMatch[2];
          }
          break;
        }
        
        // Also look for "Graduated in YYYY" pattern
        const gradMatch = line.match(/(?:Graduated|Graduation|Completed)(?:\s+in)?\s+(\d{4})/i);
        if (gradMatch) {
          edu.endDate = gradMatch[1];
          break;
        }
      }
      
      // If we have at least an institution, add the education entry
      if (edu.institution) {
        parsedResume.education.push(edu);
      }
    }
    
    // If we didn't find any education entries but have text, try a different approach
    if (parsedResume.education.length === 0 && educationText.length > 0) {
      // Look for institution names directly
      const instPattern = /([A-Z][A-Za-z\s&.,]+(?:University|College|Institute|School))/gi;
      let match;
      
      while ((match = instPattern.exec(educationText)) !== null) {
        const institution = match[1];
        
        // Find degree near this institution if possible
        const surroundingText = educationText.substring(
          Math.max(0, match.index - 50),
          Math.min(educationText.length, match.index + institution.length + 100)
        );
        
        // Look for degree
        let degree = '';
        for (const pattern of degreePatterns) {
          const degreeMatch = surroundingText.match(pattern);
          if (degreeMatch) {
            degree = degreeMatch[0];
            break;
          }
        }
        
        // Add the education entry
        parsedResume.education.push({
          institution: institution.trim(),
          degree: degree.trim(),
          field: '',
          startDate: '',
          endDate: ''
        });
      }
    }
  }
  
  // If we still don't have education entries, look for educational keywords
  if (parsedResume.education.length === 0) {
    const eduKeywords = ['degree', 'university', 'college', 'bachelor', 'master', 'phd', 'graduated'];
    
    // Check if any of these keywords appear in the text
    for (const keyword of eduKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        // Look for surrounding text
        const index = text.toLowerCase().indexOf(keyword);
        const surroundingText = text.substring(
          Math.max(0, index - 50),
          Math.min(text.length, index + 100)
        );
        
        // Try to extract institution name
        const instMatch = surroundingText.match(/([A-Z][A-Za-z\s&.,]+(?:University|College|Institute|School))/i);
        
        if (instMatch) {
          parsedResume.education.push({
            institution: instMatch[1].trim(),
            degree: '',
            field: '',
            startDate: '',
            endDate: ''
          });
          break;
        }
      }
    }
  }
  
  // If we couldn't extract structured data, create placeholders with parts of the text
  if (parsedResume.experience.length === 0 && text.length > 50) {
    // Look for paragraphs that might be job experiences
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 100);
    
    if (paragraphs.length > 0) {
      for (let i = 0; i < Math.min(2, paragraphs.length); i++) {
        const paragraph = paragraphs[i];
        parsedResume.experience.push({
          company: 'Extracted from resume',
          title: `Position ${i+1}`,
          startDate: '',
          description: paragraph.substring(0, 300) + (paragraph.length > 300 ? '...' : '')
        });
      }
    }
  }
  
  return parsedResume;
}

/**
 * Main function to parse a resume file
 */
export async function parseResumeFile(file: File): Promise<Partial<Profile>> {
  try {
    // Step 1: Extract text content from the file
    const textContent = await extractResumeContent(file);
    console.log('Extracted text content length:', textContent.length);
    
    // Step 2: Parse the text to extract structured information
    const parsedResume = parseResumeText(textContent);
    
    // Step 3: Convert to our Profile structure
    return {
      personal: parsedResume.personal,
      workExperience: parsedResume.experience.map(exp => ({
        company: exp.company,
        title: exp.title,
        startDate: exp.startDate,
        endDate: exp.endDate,
        description: exp.description,
        location: exp.location
      })),
      education: parsedResume.education.map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.field,
        startDate: edu.startDate,
        endDate: edu.endDate
      })),
      skills: parsedResume.skills.map(skill => ({ name: skill }))
    };
  } catch (error: unknown) {
    console.error('Resume parsing error:', error);
    throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 