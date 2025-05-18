const fastify = require('fastify')({ 
  logger: true,
  maxParamLength: 100
});
const fs = require('fs');
const path = require('path');
const util = require('util');
const pdfParse = require('pdf-parse');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);
const os = require('os');
const crypto = require('crypto');
const cors = require('@fastify/cors');

// Register CORS plugin
fastify.register(cors, {
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
});

// Register static file serving
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(os.tmpdir(), 'resume-uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Register multipart content parser
fastify.register(require('@fastify/multipart'), {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Root endpoint - serve the HTML page
fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Add route to test CORS
fastify.get('/cors-test', async (request, reply) => {
  console.log('CORS test endpoint called');
  return { status: 'ok', message: 'CORS is working properly' };
});

// Utility function to extract structured resume data from PDF text
function extractStructuredResumeData(text) {
  // Initialize the structured data object
  const structuredData = {
    personal: {},
    workExperience: [],
    education: [],
    skills: []
  };
  
  // Extract email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);
  if (emails && emails.length > 0) {
    structuredData.personal.email = emails[0];
  }
  
  // Extract phone numbers
  const phoneRegex = /\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const phones = text.match(phoneRegex);
  if (phones && phones.length > 0) {
    structuredData.personal.phone = phones[0];
  }
  
  // Extract name - look for patterns or use heuristics
  const nameMatch = text.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
  if (nameMatch) {
    structuredData.personal.firstName = nameMatch[1];
    structuredData.personal.lastName = nameMatch[2];
  } else {
    // Try to find name in other formats, like "Name: John Doe"
    const altNameMatch = text.match(/(?:name|candidate)[\s:]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i);
    if (altNameMatch) {
      structuredData.personal.firstName = altNameMatch[1];
      structuredData.personal.lastName = altNameMatch[2];
    }
  }
  
  // Extract sections
  const sections = {};
  
  // Look for common section headers
  const sectionPatterns = [
    { name: 'experience', regex: /\b(EXPERIENCE|EMPLOYMENT|WORK HISTORY)[\s:]*\n/i },
    { name: 'education', regex: /\b(EDUCATION|ACADEMIC|QUALIFICATION)[\s:]*\n/i },
    { name: 'skills', regex: /\b(SKILLS|EXPERTISE|COMPETENCIES|ABILITIES)[\s:]*\n/i },
    { name: 'projects', regex: /\b(PROJECTS|PROJECT EXPERIENCE)[\s:]*\n/i },
  ];
  
  // Find each section and its content
  for (const section of sectionPatterns) {
    const match = text.match(section.regex);
    if (match) {
      const startIndex = match.index + match[0].length;
      
      // Find the end of this section (start of the next section or end of text)
      let endIndex = text.length;
      for (const otherSection of sectionPatterns) {
        if (otherSection.name !== section.name) {
          const nextMatch = text.substring(startIndex).match(otherSection.regex);
          if (nextMatch) {
            const nextStartIndex = startIndex + nextMatch.index;
            if (nextStartIndex < endIndex) {
              endIndex = nextStartIndex;
            }
          }
        }
      }
      
      sections[section.name] = text.substring(startIndex, endIndex).trim();
    }
  }
  
  // Extract work experience
  if (sections.experience) {
    const experienceText = sections.experience;
    
    // Improved approach to detect job entries - look for company/location and date patterns
    // This regex matches patterns like "Company Name – Location     Date - Date"
    const jobEntryRegex = /^([^–\n]+)(?:\s+[-–—]\s+([^–\n]+))(?:\s+)([A-Za-z]+\s+\d{4}\s+[-–—]\s+(?:\w+\s+\d{4}|Present))/gm;
    let match;
    let experienceEntries = [];
    
    // First try to find well-formatted job entries with the regex
    while ((match = jobEntryRegex.exec(experienceText)) !== null) {
      const startPos = match.index;
      let endPos;
      
      // Look for the start of the next job entry or end of text
      const nextMatch = jobEntryRegex.exec(experienceText);
      if (nextMatch) {
        endPos = nextMatch.index;
        // Reset regex to previous position to not skip entries
        jobEntryRegex.lastIndex = nextMatch.index;
      } else {
        endPos = experienceText.length;
      }
      
      const entryText = experienceText.substring(startPos, endPos).trim();
      experienceEntries.push(entryText);
    }
    
    // If regex approach didn't find entries, fall back to splitting by multiple newlines
    if (experienceEntries.length === 0) {
      // Try to split by triple newlines (common in resumes) or double newlines as fallback
      experienceEntries = experienceText.split(/\n\n\n+/) 
                        .filter(entry => entry.trim().length > 0);
      
      // If we still don't have enough entries, try double newlines
      if (experienceEntries.length < 3) {
        experienceEntries = experienceText.split(/\n\n+/)
                          .filter(entry => entry.trim().length > 0);
      }
    }
    
    // Alternative: identify job entries by looking for date ranges
    if (experienceEntries.length < 3) {
      // Look for date patterns that often indicate start of job entries
      const dateRangeRegex = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}\s+[-–—]\s+(?:\w+\.?\s+\d{4}|Present)/gi;
      
      let lines = experienceText.split('\n');
      let currentEntry = [];
      let entries = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (
          // New entry if line contains a date range
          (i === 0 || lines[i].match(dateRangeRegex)) ||
          // Or if it starts with a company-like pattern (caps followed by location)
          (i === 0 || /^[A-Z][^–]*[-–—]/.test(lines[i]))
        ) {
          if (currentEntry.length > 0) {
            entries.push(currentEntry.join('\n'));
            currentEntry = [];
          }
        }
        currentEntry.push(lines[i]);
      }
      
      if (currentEntry.length > 0) {
        entries.push(currentEntry.join('\n'));
      }
      
      if (entries.length >= 3) {
        experienceEntries = entries;
      }
    }
    
    // Process all job entries without arbitrary limits
    for (const entry of experienceEntries) {
      const lines = entry.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 1) {
        // First line typically contains company and location
        const firstLine = lines[0];
        
        // Try to extract company name, location, and date range from the first line
        let companyName = '';
        let location = '';
        let dateRange = '';
        
        // Look for company name and location pattern: "Company Name – Location"
        const companyLocationMatch = firstLine.match(/^([^–\n]+)(?:\s+[-–—]\s+([^–\n]+))/);
        if (companyLocationMatch) {
          companyName = companyLocationMatch[1].trim();
          // If there's another dash after location, it might be separating location from date
          const remainingPart = firstLine.substring(companyLocationMatch[0].length).trim();
          if (remainingPart) {
            // This might contain the date range
            dateRange = remainingPart;
          }
        } else {
          companyName = firstLine;
        }
        
        // Look for job title, typically the second line
        let jobTitle = '';
        if (lines.length >= 2) {
          jobTitle = lines[1];
        }
        
        // Extract date range if not already found
        if (!dateRange) {
          // Look for date patterns in the first or second line
          const datePatterns = [
            // Month Year - Month Year
            /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}\s+[-–—]\s+(?:\w+\.?\s+\d{4}|Present)/i,
            // Year - Year or Year - Present
            /\b(\d{4})\s+[-–—]\s+(\d{4}|Present|Current)\b/i
          ];
          
          for (const pattern of datePatterns) {
            for (let i = 0; i < Math.min(3, lines.length); i++) {
              const match = lines[i].match(pattern);
              if (match) {
                dateRange = match[0];
                break;
              }
            }
            if (dateRange) break;
          }
        }
        
        // Extract start and end dates from date range
        let startDate = '';
        let endDate = '';
        
        if (dateRange) {
          // Extract all years from the date range
          const yearMatches = dateRange.match(/\b\d{4}\b/g) || [];
          if (yearMatches.length >= 1) {
            startDate = yearMatches[0];
          }
          if (yearMatches.length >= 2) {
            endDate = yearMatches[1];
          } else if (dateRange.toLowerCase().includes('present') || dateRange.toLowerCase().includes('current')) {
            endDate = 'Present';
          }
          
          // Try to extract months too if present
          const monthMatches = dateRange.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi);
          if (monthMatches && monthMatches.length >= 1) {
            if (startDate) {
              startDate = `${monthMatches[0]} ${startDate}`;
            }
            if (monthMatches.length >= 2 && endDate && endDate !== 'Present') {
              endDate = `${monthMatches[1]} ${endDate}`;
            }
          }
        }
        
        // If we couldn't identify a job title, look for common job title patterns
        if (!jobTitle || jobTitle === companyName) {
          const titleKeywords = [
            'engineer', 'developer', 'manager', 'director', 'analyst', 
            'designer', 'consultant', 'specialist', 'lead', 'head', 
            'architect', 'administrator', 'coordinator', 'associate',
            'product', 'project', 'program', 'owner', 'assistant'
          ];
          
          for (let i = 1; i < Math.min(4, lines.length); i++) {
            const line = lines[i].toLowerCase();
            if (titleKeywords.some(keyword => line.includes(keyword))) {
              jobTitle = lines[i];
              break;
            }
          }
        }
        
        // Create a description that excludes the already extracted information
        let description = entry;
        
        structuredData.workExperience.push({
          company: companyName,
          title: jobTitle,
          location,
          startDate,
          endDate,
          description
        });
      }
    }
  }
  
  // Extract education
  if (sections.education) {
    const educationText = sections.education;
    
    // Find education entries
    const educationEntries = educationText.split(/\n\n+/);
    
    for (const entry of educationEntries) { // Remove the limit
      const lines = entry.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 1) {
        // Look for institution name and degree
        const institutionLine = lines.find(line => 
          /university|college|institute|school/i.test(line)
        ) || lines[0] || '';
        
        const degreeLine = lines.find(line => 
          /bachelor|master|phd|bs|ba|ms|ma|degree/i.test(line)
        ) || lines[1] || '';
        
        // Extract dates if available
        const dates = entry.match(/\b\d{4}\b/g) || [];
        
        structuredData.education.push({
          institution: institutionLine,
          degree: degreeLine,
          fieldOfStudy: '',
          startDate: dates.length >= 1 ? dates[0] : '',
          endDate: dates.length >= 2 ? dates[1] : ''
        });
      }
    }
  }
  
  // Extract skills
  if (sections.skills) {
    const skillsText = sections.skills;
    
    // Split by common separators and clean up
    const skillItems = skillsText.split(/[,|•;\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
    
    // Filter out common non-skill words
    const filteredSkills = skillItems.filter(skill => {
      const lowerSkill = skill.toLowerCase();
      return !['and', 'the', 'with', 'for', 'experience', 'years', 'using', 'including'].includes(lowerSkill);
    });
    
    // Add skills (limit to reasonable number)
    for (const skill of filteredSkills.slice(0, 30)) { // Increased limit
      structuredData.skills.push({ name: skill });
    }
    
    // If we couldn't find skills, check for common tech skills in the entire document
    if (structuredData.skills.length === 0) {
      const techSkills = [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Ruby', 'PHP', 'Swift',
        'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
        'HTML', 'CSS', 'SASS', 'SCSS', 'Bootstrap', 'Tailwind', 'React Native',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'REST', 'GraphQL',
        'SQL', 'NoSQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
        'Machine Learning', 'AI', 'Data Science', 'Big Data', 'Hadoop', 'Spark',
        'Agile', 'Scrum', 'DevOps', 'CI/CD', 'TDD', 'Jenkins'
      ];
      
      for (const tech of techSkills) {
        if (text.includes(tech)) {
          structuredData.skills.push({ name: tech });
        }
      }
    }
    
    // Check for projects section to potentially extract more skills
    if (sections.projects) {
      const projectsText = sections.projects;
      const projectSkillMatches = projectsText.match(/\b(?:React|Node\.js|JavaScript|Python|AWS|Azure|SQL|NoSQL|[\w.#]+)\b/g) || [];
      const projectSkills = [...new Set(projectSkillMatches)]; // Unique values
      
      for (const skill of projectSkills) {
        if (!structuredData.skills.some(s => s.name.toLowerCase() === skill.toLowerCase())) {
          structuredData.skills.push({ name: skill });
        }
      }
    }
  }
  
  return structuredData;
}

// Resume upload and parse endpoint
fastify.post('/parse-resume', async (request, reply) => {
  console.log('Received resume parsing request');
  try {
    const data = await request.file();
    
    if (!data) {
      console.error('No file uploaded in request');
      return reply.code(400).send({ error: 'No file uploaded' });
    }
    
    console.log(`Processing uploaded file: ${data.filename}, MIME type: ${data.mimetype}, Size: ${data.file.bytesRead} bytes`);
    
    // Check if file is a PDF
    if (!data.filename.toLowerCase().endsWith('.pdf')) {
      console.error(`Rejected file: ${data.filename} - Not a PDF file`);
      return reply.code(400).send({ error: 'Uploaded file must be a PDF' });
    }
    
    // Generate random filename to prevent collisions
    const tempFilename = path.join(uploadsDir, `${crypto.randomUUID()}.pdf`);
    console.log(`Saving uploaded file temporarily as: ${tempFilename}`);
    
    // Save the file to disk
    await pump(data.file, fs.createWriteStream(tempFilename));
    console.log('File saved successfully');
    
    // Read and parse the PDF
    console.log('Beginning PDF parsing');
    const dataBuffer = fs.readFileSync(tempFilename);
    console.log(`File buffer size: ${dataBuffer.length} bytes`);
    
    const result = await pdfParse(dataBuffer);
    console.log(`PDF parsed successfully: ${result.numpages} pages, text length: ${result.text.length} characters`);
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilename);
    console.log('Temporary file deleted');
    
    // Extract and structure resume data
    console.log('Extracting structured data from PDF text');
    const structuredData = extractStructuredResumeData(result.text);
    
    console.log('Structured data extraction complete with results:');
    console.log(`- Personal info fields: ${Object.keys(structuredData.personal).length}`);
    console.log(`- Work experience entries: ${structuredData.workExperience.length}`);
    console.log(`- Education entries: ${structuredData.education.length}`);
    console.log(`- Skills extracted: ${structuredData.skills.length}`);
    
    // Return both raw and structured data
    const response = {
      filename: data.filename,
      pages: result.numpages,
      version: result.info.PDFFormatVersion,
      text: result.text,
      structuredData
    };
    
    console.log('Sending response to client');
    return response;
  } catch (err) {
    console.error('Error processing resume:', err);
    console.error(err.stack);
    request.log.error(err);
    return reply.code(500).send({ error: 'Failed to process resume', details: err.message });
  }
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
    console.log(`Visit http://localhost:${port} to use the resume parser`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();