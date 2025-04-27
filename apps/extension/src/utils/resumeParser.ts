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
  
  // Identify major sections in the resume
  const sections: { [key: string]: string } = {};
  
  // Common section headers
  const sectionHeaders = [
    { key: 'experience', patterns: ['EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT'] },
    { key: 'education', patterns: ['EDUCATION', 'ACADEMIC', 'EDUCATIONAL BACKGROUND'] },
    { key: 'skills', patterns: ['SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES'] },
    { key: 'projects', patterns: ['PROJECTS', 'PROJECT EXPERIENCE'] },
    { key: 'certifications', patterns: ['CERTIFICATIONS', 'CERTIFICATES'] }
  ];
  
  // Break the resume into major sections by identifying section headers
  const lines = text.split('\n');
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check if this line is a section header
    let isHeader = false;
    for (const sectionHeader of sectionHeaders) {
      if (sectionHeader.patterns.some(pattern => line.includes(pattern))) {
        currentSection = sectionHeader.key;
        sections[currentSection] = '';
        isHeader = true;
        break;
      }
    }
    
    if (!isHeader && currentSection) {
      // Add content to the current section
      sections[currentSection] += lines[i] + '\n';
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
    
    // Remove duplicates
    parsedResume.skills = [...new Set(parsedResume.skills)];
  }
  
  // Extract experience
  if (sections.experience) {
    const experienceText = sections.experience;
    
    // Approach 1: Split by company/job title lines
    // Look for patterns like "Company Name - Location - Date"
    const jobBlocks = experienceText.split(/\n(?=[A-Z][^a-z\n]*(?:[-–]|at|\s{2,})[A-Z][^a-z\n]*)/);
    
    // If we couldn't find clear job blocks, try another approach
    if (jobBlocks.length <= 1) {
      // Approach 2: Split by double newlines which often separate entries
      const alternativeBlocks = experienceText.split(/\n\s*\n/);
      if (alternativeBlocks.length > 1) {
        jobBlocks.length = 0; // Clear the array
        alternativeBlocks.forEach(block => {
          if (block.trim().length > 20) {
            jobBlocks.push(block.trim());
          }
        });
      }
    }
    
    console.log(`Found ${jobBlocks.length} job blocks`);
    
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
      
      // First line often contains company name
      if (lines.length > 0) {
        // Try to extract company and location from the first line
        const firstLine = lines[0];
        
        // Company - Location pattern
        const companyMatch = firstLine.match(/^([^-–]+)[-–]([^-–]+)(?:[-–]([^-–]+))?/);
        if (companyMatch) {
          exp.company = companyMatch[1].trim();
          exp.location = companyMatch[2].trim();
          
          // If there's a third part, it might be a date
          if (companyMatch[3]) {
            const dateText = companyMatch[3].trim();
            const dateMatch = dateText.match(/(\w+\s+\d{4})\s*[-–]?\s*(\w+\s+\d{4}|Present)/i);
            if (dateMatch) {
              exp.startDate = dateMatch[1];
              exp.endDate = dateMatch[2];
            }
          }
        } else {
          // Just use the first line as company
          exp.company = firstLine;
        }
      }
      
      // Second line often contains job title
      if (lines.length > 1) {
        // Check if the second line looks like a job title
        const titleLine = lines[1];
        if (!/\d{4}/.test(titleLine) && !titleLine.includes('-') && !titleLine.includes('–')) {
          exp.title = titleLine;
        }
      }
      
      // If we haven't found dates yet, look through the first few lines
      if (!exp.startDate) {
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          const line = lines[i];
          // Look for date ranges
          const dateMatch = line.match(/(\b\w+\s+\d{4}\b|\b\d{4}\b)(?:\s*[-–—to]+\s*|\s*-\s*|\s+to\s+)(\b\w+\s+\d{4}\b|\b\d{4}\b|Present\b|Current\b)/i);
          if (dateMatch) {
            exp.startDate = dateMatch[1];
            exp.endDate = dateMatch[2];
            break;
          }
        }
      }
      
      // Extract full job description (everything after title and dates)
      if (exp.title) {
        const titleIndex = lines.findIndex(line => line === exp.title);
        if (titleIndex !== -1 && titleIndex < lines.length - 1) {
          exp.description = lines.slice(titleIndex + 1).join('\n');
        }
      }
      
      // Only add if we have at least company or title
      if (exp.company || exp.title) {
        parsedResume.experience.push(exp);
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
      const degreePatterns = [
        /(?:Bachelor|Master|PhD|Doctorate|Associate|B\.S\.|M\.S\.|B\.A\.|M\.A\.|M\.B\.A\.|B\.Tech|M\.Tech)/i,
        /(?:Bachelor's|Master's|Doctoral|Associate's) (?:Degree|degree)?(?:\s+in\s+|\s+of\s+)?([A-Za-z\s]+)/i,
        /(?:BS|BA|MS|MA|MBA|PhD)(?:\s+in\s+|\s+of\s+)?([A-Za-z\s]+)/i
      ];
      
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