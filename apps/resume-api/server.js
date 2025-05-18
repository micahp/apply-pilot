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
  
  // Improved name extraction - try multiple approaches
  let nameFound = false;

  // Approach 1: First line if it looks like a name (standard format)
  const firstLine = text.split('\n')[0].trim();
  if (firstLine && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(firstLine) && firstLine.length < 40) {
    const nameParts = firstLine.split(/\s+/);
    if (nameParts.length >= 2) {
      structuredData.personal.firstName = nameParts[0];
      structuredData.personal.lastName = nameParts[nameParts.length - 1];
      nameFound = true;
    }
  }

  // Approach 2: Look for patterns suggesting a name near the beginning (within first 10 lines)
  if (!nameFound) {
    const initialLines = text.split('\n').slice(0, 10).join('\n');
    const namePattern = /\b([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))(?:\s+([A-Z][a-z]+))?\b/g;
    
    let nameMatch;
    // Find the first occurrence that looks like a name (not all caps, reasonable length)
    while ((nameMatch = namePattern.exec(initialLines)) !== null) {
      const fullMatch = nameMatch[0];
      if (fullMatch.length > 4 && fullMatch.length < 40 && fullMatch !== fullMatch.toUpperCase()) {
        const parts = fullMatch.split(/\s+/);
        structuredData.personal.firstName = parts[0];
        structuredData.personal.lastName = parts[parts.length - 1];
        nameFound = true;
        break;
      }
    }
  }

  // Approach 3: Look for explicit name labels
  if (!nameFound) {
    const nameLabels = [
      /name[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /candidate[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
    ];
    
    for (const pattern of nameLabels) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const nameParts = match[1].split(/\s+/);
        if (nameParts.length >= 2) {
          structuredData.personal.firstName = nameParts[0];
          structuredData.personal.lastName = nameParts[nameParts.length - 1];
          nameFound = true;
          break;
        }
      }
    }
  }

  // If we still don't have a name, try a more aggressive approach for the first line
  if (!nameFound) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim();
      // Check if this line contains only words with first letter capitalized and reasonable length
      if (
        line.length > 3 && 
        line.length < 40 && 
        line.split(/\s+/).length <= 4 &&
        !/[0-9@]/.test(line) && // No numbers or @ symbols (to avoid emails)
        !/EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CONTACT|PROFESSIONAL|SUMMARY/.test(line.toUpperCase())
      ) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          structuredData.personal.firstName = parts[0];
          structuredData.personal.lastName = parts[parts.length - 1];
          nameFound = true;
          break;
        }
      }
    }
  }

  // Add a full name property for convenience
  if (structuredData.personal.firstName && structuredData.personal.lastName) {
    structuredData.personal.name = `${structuredData.personal.firstName} ${structuredData.personal.lastName}`;
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
  
  // Extract work experience - simpler approach to avoid regex hanging
  if (sections.experience) {
    const experienceText = sections.experience;
    
    // Split by newline groups to identify potential job entries
    const experienceLines = experienceText.split('\n');
    let experienceEntries = [];
    let currentEntry = [];
    
    // Identify potential job entries by looking for patterns that typically indicate a new job
    // such as a company name followed by a date or a job title
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) {
        continue;
      }
      
      // Potential indicators of a new job entry:
      // 1. A line that contains a year (likely a date range)
      // 2. A line that contains a dash or hyphen (often separates company and location or dates)
      // 3. A line that looks like a company name (first letter capitalized)
      const hasYear = /\b(19|20)\d{2}\b/.test(line);
      const hasDash = /[-–—]/.test(line);
      const looksLikeCompanyName = /^[A-Z]/.test(line) && line.length > 5;
      const hasJobTitleKeyword = /engineer|developer|manager|director|analyst|designer|consultant|lead|architect|owner|specialist/i.test(line);
      
      const isLikelyNewJobEntry = (
        ((hasYear && hasDash) || (looksLikeCompanyName && i < experienceLines.length - 1)) &&
        (i === 0 || experienceLines[i-1].trim().length === 0)
      );
      
      if (isLikelyNewJobEntry && currentEntry.length > 0) {
        experienceEntries.push(currentEntry.join('\n'));
        currentEntry = [];
      }
      
      currentEntry.push(line);
    }
    
    // Don't forget the last entry
    if (currentEntry.length > 0) {
      experienceEntries.push(currentEntry.join('\n'));
    }
    
    // If we couldn't identify entries this way, fall back to simpler splitting
    if (experienceEntries.length < 2) {
      experienceEntries = experienceText.split(/\n\n+/)
                        .filter(entry => entry.trim().length > 0);
    }
    
    // Process each job entry
    for (const entry of experienceEntries) {
      const lines = entry.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 1) {
        // First line typically contains company and location
        const firstLine = lines[0];
        
        // Attempt to parse company, location, and date information
        let companyName = '';
        let location = '';
        let jobTitle = '';
        let startDate = '';
        let endDate = '';
        
        // Simple approach - first line is likely company name, second line is job title
        companyName = firstLine;
        if (lines.length >= 2) {
          jobTitle = lines[1];
        }
        
        // Try to extract location if present in the company line
        const locationMatch = firstLine.match(/\s+[-–—]\s+([^-–—\d]+)(?=\s|$)/);
        if (locationMatch) {
          location = locationMatch[1].trim();
          // Update company name to remove location
          companyName = firstLine.substring(0, locationMatch.index).trim();
        }
        
        // Look for date ranges in first two lines
        for (let i = 0; i < Math.min(2, lines.length); i++) {
          // Look for year patterns
          const yearMatches = lines[i].match(/\b(19|20)\d{2}\b/g);
          if (yearMatches && yearMatches.length >= 1) {
            startDate = yearMatches[0];
            
            // Look for end date or "Present"
            if (yearMatches.length >= 2) {
              endDate = yearMatches[1];
            } else if (lines[i].toLowerCase().includes('present')) {
              endDate = 'Present';
            }
            
            // If we found dates, and this is the first line, it might be part of the company info
            if (i === 0) {
              // Try to extract company name without the date part
              const dateIndex = lines[i].indexOf(startDate);
              if (dateIndex > 0) {
                companyName = lines[i].substring(0, dateIndex).trim();
                
                // If there's a dash before the date, it might separate company and location
                const dashBeforeDateMatch = companyName.match(/^(.*?)[-–—]\s*([^-–—]+)$/);
                if (dashBeforeDateMatch) {
                  companyName = dashBeforeDateMatch[1].trim();
                  location = dashBeforeDateMatch[2].trim();
                }
              }
            }
            
            break;
          }
        }
        
        // Create description by joining all lines
        const description = entry;
        
        structuredData.workExperience.push({
          company: companyName,
          title: jobTitle,
          location: location,
          startDate: startDate,
          endDate: endDate,
          description: description
        });
      }
    }
  }
  
  // Extract education - simplified to avoid performance issues
  if (sections.education) {
    const educationText = sections.education;
    
    // Find education entries - simple split
    const educationEntries = educationText.split(/\n\n+/).filter(entry => entry.trim().length > 0);
    
    for (const entry of educationEntries) {
      const lines = entry.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 1) {
        // Look for institution name and degree
        const institutionLine = lines.find(line => 
          /university|college|institute|school/i.test(line)
        ) || lines[0] || '';
        
        const degreeLine = lines.find(line => 
          /bachelor|master|phd|bs|ba|ms|ma|degree/i.test(line)
        ) || (lines.length > 1 ? lines[1] : '');
        
        // Extract dates if available - simple approach
        const dates = [];
        for (const line of lines) {
          const yearMatches = line.match(/\b(19|20)\d{2}\b/g);
          if (yearMatches) {
            dates.push(...yearMatches);
          }
        }
        
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
  
  // Extract skills - simplified approach
  if (sections.skills) {
    const skillsText = sections.skills;
    
    // Split by common separators and clean up
    const skillItems = skillsText.split(/[,|•;\n]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
    
    // Add skills (limit to reasonable number)
    const uniqueSkills = new Set();
    for (const skill of skillItems.slice(0, 30)) {
      if (!uniqueSkills.has(skill.toLowerCase())) {
        uniqueSkills.add(skill.toLowerCase());
        structuredData.skills.push({ name: skill });
      }
    }
  }
  
  // If no skills were found, extract some from the entire document
  if (structuredData.skills.length === 0) {
    const techSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Ruby', 'PHP', 'Swift',
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
      'HTML', 'CSS', 'SASS', 'SCSS', 'Bootstrap', 'Tailwind', 'React Native',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'REST', 'GraphQL',
      'SQL', 'NoSQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis'
    ];
    
    for (const tech of techSkills) {
      if (text.includes(tech)) {
        structuredData.skills.push({ name: tech });
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