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
        let rawStartDate = '';
        let rawEndDate = '';
        
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
        
        // Enhanced date extraction with month names
        const monthNames = {
          'january': 1, 'jan': 1,
          'february': 2, 'feb': 2,
          'march': 3, 'mar': 3,
          'april': 4, 'apr': 4,
          'may': 5,
          'june': 6, 'jun': 6,
          'july': 7, 'jul': 7,
          'august': 8, 'aug': 8,
          'september': 9, 'sep': 9, 'sept': 9,
          'october': 10, 'oct': 10,
          'november': 11, 'nov': 11,
          'december': 12, 'dec': 12
        };
        
        // Function to get last day of month
        const getLastDayOfMonth = (year, month) => {
          return new Date(year, month, 0).getDate();
        };
        
        // Look for date patterns in first few lines
        let dateLineIndex = -1;
        let foundDatePattern = false;
        
        // Helper function to extract month number from text
        const extractMonthNumber = (monthText) => {
          // Remove any periods and trim
          const cleanMonth = monthText.replace('.', '').toLowerCase().trim();
          return monthNames[cleanMonth] || monthNames[cleanMonth.substring(0, 3)];
        };
        
        // Multiple date pattern matching approaches
        for (let i = 0; i < Math.min(4, lines.length); i++) {
          const line = lines[i];
          
          // Approach 1: Standard "Month Year - Month Year" or "Month Year - Present"
          const monthYearPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})\s*[-–—]\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})|Present)/i;
          
          const monthYearMatch = line.match(monthYearPattern);
          if (monthYearMatch) {
            dateLineIndex = i;
            foundDatePattern = true;
            
            // Extract month and year for start date
            const startMonth = monthYearMatch[1];
            const startYear = monthYearMatch[2];
            const startMonthNum = extractMonthNumber(startMonth);
            
            // Format raw dates (Month Year)
            rawStartDate = `${startMonth} ${startYear}`;
            
            // Create formatted date (YYYY-MM-DD)
            if (startMonthNum && startYear) {
              // Use 1st day of month for start date
              startDate = `${startYear}-${startMonthNum.toString().padStart(2, '0')}-01`;
            }
            
            // Handle end date
            if (monthYearMatch[3].toLowerCase() === 'present') {
              rawEndDate = 'Present';
              // Use current date for "Present"
              const now = new Date();
              const currentYear = now.getFullYear();
              const currentMonth = now.getMonth() + 1;
              const currentDay = now.getDate();
              endDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${currentDay.toString().padStart(2, '0')}`;
            } else {
              // Extract end month and year
              const endMonthMatch = monthYearMatch[3].match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})/i);
              
              if (endMonthMatch) {
                const endMonth = endMonthMatch[1];
                const endYear = endMonthMatch[2];
                const endMonthNum = extractMonthNumber(endMonth);
                
                rawEndDate = `${endMonth} ${endYear}`;
                
                if (endMonthNum && endYear) {
                  // Use last day of month for end date
                  const lastDay = getLastDayOfMonth(parseInt(endYear), endMonthNum);
                  endDate = `${endYear}-${endMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                }
              }
            }
            
            break;
          }
          
          // Approach 2: Handle more date formats: "Month. Year - Month. Year"
          const abbreviatedMonthPattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})\s*[-–—]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})|Present)/i;
          
          const abbreviatedMatch = line.match(abbreviatedMonthPattern);
          if (abbreviatedMatch && !foundDatePattern) {
            dateLineIndex = i;
            foundDatePattern = true;
            
            const startMonth = abbreviatedMatch[1];
            const startYear = abbreviatedMatch[2];
            const startMonthNum = extractMonthNumber(startMonth);
            
            rawStartDate = `${startMonth} ${startYear}`;
            
            if (startMonthNum && startYear) {
              startDate = `${startYear}-${startMonthNum.toString().padStart(2, '0')}-01`;
            }
            
            if (abbreviatedMatch[3].toLowerCase() === 'present') {
              rawEndDate = 'Present';
              const now = new Date();
              endDate = now.toISOString().split('T')[0];
            } else {
              const endMonthMatch = abbreviatedMatch[3].match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})/i);
              
              if (endMonthMatch) {
                const endMonth = endMonthMatch[1];
                const endYear = endMonthMatch[2];
                const endMonthNum = extractMonthNumber(endMonth);
                
                rawEndDate = `${endMonth} ${endYear}`;
                
                if (endMonthNum && endYear) {
                  const lastDay = getLastDayOfMonth(parseInt(endYear), endMonthNum);
                  endDate = `${endYear}-${endMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                }
              }
            }
            
            break;
          }
          
          // Approach 3: More flexible pattern that looks for any date-like information
          if (!foundDatePattern) {
            // Look for lines containing both a month name and at least one year
            const hasMonth = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\b/i.test(line);
            const years = line.match(/\b(20\d{2}|19\d{2})\b/g);
            
            if (hasMonth && years && years.length > 0) {
              dateLineIndex = i;
              foundDatePattern = true;
              
              // Extract individual date components using more targeted patterns
              const monthMatches = line.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\b/gi);
              
              if (monthMatches && monthMatches.length > 0 && years.length > 0) {
                // Assume first month and year combination is start date
                const startMonth = monthMatches[0];
                const startYear = years[0];
                const startMonthNum = extractMonthNumber(startMonth);
                
                rawStartDate = `${startMonth} ${startYear}`;
                
                if (startMonthNum) {
                  startDate = `${startYear}-${startMonthNum.toString().padStart(2, '0')}-01`;
                }
                
                // End date logic
                if (line.toLowerCase().includes('present')) {
                  rawEndDate = 'Present';
                  const now = new Date();
                  endDate = now.toISOString().split('T')[0];
                } else if (monthMatches.length > 1 && years.length > 1) {
                  // Assume last month and last year form the end date
                  const endMonth = monthMatches[monthMatches.length - 1];
                  const endYear = years[years.length - 1];
                  const endMonthNum = extractMonthNumber(endMonth);
                  
                  rawEndDate = `${endMonth} ${endYear}`;
                  
                  if (endMonthNum) {
                    const lastDay = getLastDayOfMonth(parseInt(endYear), endMonthNum);
                    endDate = `${endYear}-${endMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
                  }
                } else if (years.length > 1) {
                  // If multiple years but only one month, use last year as end date with December
                  const endYear = years[years.length - 1];
                  rawEndDate = `Dec ${endYear}`;
                  endDate = `${endYear}-12-31`;
                }
                
                break;
              }
            }
          }
          
          // Approach 4: Fallback to just year-year pattern if nothing else matched
          if (!foundDatePattern) {
            const yearPattern = /\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|19\d{2}|Present)\b/i;
            const yearMatch = line.match(yearPattern);
            
            if (yearMatch) {
              dateLineIndex = i;
              foundDatePattern = true;
              
              const startYear = yearMatch[1];
              rawStartDate = startYear;
              // Default to January 1st if only year is available
              startDate = `${startYear}-01-01`;
              
              if (yearMatch[2].toLowerCase() === 'present') {
                rawEndDate = 'Present';
                // Use current date for "Present"
                const now = new Date();
                endDate = now.toISOString().split('T')[0];
              } else {
                const endYear = yearMatch[2];
                rawEndDate = endYear;
                // Default to December 31st if only year is available
                endDate = `${endYear}-12-31`;
              }
              
              break;
            }
          }
        }
        
        // If we still couldn't find dates but have a location line with years, try to extract from there
        if (!foundDatePattern && location) {
          const years = location.match(/\b(20\d{2}|19\d{2})\b/g);
          if (years && years.length > 0) {
            const startYear = years[0];
            rawStartDate = startYear;
            startDate = `${startYear}-01-01`;
            
            if (years.length > 1) {
              const endYear = years[years.length - 1];
              rawEndDate = endYear;
              endDate = `${endYear}-12-31`;
            } else if (location.toLowerCase().includes('present')) {
              rawEndDate = 'Present';
              const now = new Date();
              endDate = now.toISOString().split('T')[0];
            }
          }
        }
        
        // If still no dates found after all attempts, check entire entry
        if (!startDate || !endDate) {
          // Look for any year patterns across all lines
          let allText = lines.join(' ');
          const years = allText.match(/\b(20\d{2}|19\d{2})\b/g);
          
          if (years && years.length > 0) {
            // Just use the years if found
            const startYear = years[0];
            rawStartDate = startYear;
            startDate = `${startYear}-01-01`;
            
            if (years.length > 1) {
              const endYear = years[years.length - 1];
              rawEndDate = endYear;
              endDate = `${endYear}-12-31`;
            } else if (allText.toLowerCase().includes('present')) {
              rawEndDate = 'Present';
              const now = new Date();
              endDate = now.toISOString().split('T')[0];
            }
          }
        }
        
        // Create a clean description by removing lines with redundant information
        let descriptionLines = [...lines];
        
        // Remove first lines if they contain company name, job title, or date info
        const linesToRemove = new Set();
        
        // Remove the company/location line
        if (lines.length > 0) {
          linesToRemove.add(0);
        }
        
        // Remove the job title line if it exists
        if (lines.length > 1 && jobTitle === lines[1]) {
          linesToRemove.add(1);
        }
        
        // Remove the date line if we found it
        if (dateLineIndex >= 0) {
          linesToRemove.add(dateLineIndex);
        }
        
        // Build the clean description without removed lines
        const cleanDescription = descriptionLines
          .filter((_, index) => !linesToRemove.has(index))
          .join('\n');
        
        structuredData.workExperience.push({
          company: companyName,
          title: jobTitle,
          location: location,
          startDate: startDate,
          endDate: endDate,
          rawStartDate: rawStartDate,
          rawEndDate: rawEndDate,
          description: cleanDescription
        });
      }
    }
  }
  
  // Extract education - simplified to avoid performance issues
  if (sections.education) {
    const educationText = sections.education;
    
    // Define known degree types for standardization
    const degreeTypes = {
      'GED': 'GED',
      'HIGH SCHOOL': 'High School',
      'ASSOCIATE': 'Associates',
      'ASSOCIATES': 'Associates',
      'AA': 'Associates',
      'AS': 'Associates',
      'BACHELOR': 'Bachelors',
      'BACHELORS': 'Bachelors',
      'BS': 'Bachelors',
      'BA': 'Bachelors',
      'BSC': 'Bachelors',
      'MASTER': 'Masters',
      'MASTERS': 'Masters',
      'MS': 'Masters',
      'MA': 'Masters',
      'MSC': 'Masters',
      'PHD': 'Doctorate',
      'DOCTORATE': 'Doctorate',
      'MD': 'Doctorate'
    };

    // Find education entries - simple split
    const educationEntries = educationText.split(/\n\n+/).filter(entry => entry.trim().length > 0);
    
    for (const entry of educationEntries) {
      const lines = entry.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 1) {
        // Initialize education entry fields
        let institution = '';
        let degreeType = '';
        let fieldOfStudy = '';
        let gpa = '';
        let graduationDate = '';
        let startDate = '';
        let endDate = '';
        let isExpectedDate = false;

        // Look for institution name
        const institutionLine = lines.find(line => 
          /university|college|institute|school/i.test(line)
        ) || lines[0] || '';

        // Clean institution name by removing any dates
        institution = institutionLine.replace(/\b(19|20)\d{2}\b/g, '').trim();
        institution = institution.replace(/\s+[-–—]\s+.*$/, '').trim(); // Remove anything after dash

        // Look for degree and field of study
        const degreeLines = lines.filter(line => 
          /bachelor|master|phd|bs|ba|ms|ma|degree|major|study|gpa/i.test(line)
        );

        if (degreeLines.length > 0) {
          // Try to extract degree type and field of study
          for (const line of degreeLines) {
            // First try to find a known degree type
            const degreeParts = line.split(/\s+(?:in|of)\s+/i);
            const upperLine = line.toUpperCase();
            
            // Look for known degree types
            for (const [key, value] of Object.entries(degreeTypes)) {
              if (upperLine.includes(key)) {
                degreeType = value;
                // Extract field of study - everything after the degree type
                const afterDegree = line.substring(line.toUpperCase().indexOf(key) + key.length).trim();
                if (afterDegree && !fieldOfStudy) {
                  fieldOfStudy = afterDegree.replace(/^(?:in|of)\s+/i, '').trim();
                }
                break;
              }
            }

            // If we found a degree type but no field of study, check the rest of the line
            if (degreeType && !fieldOfStudy && degreeParts.length > 1) {
              fieldOfStudy = degreeParts[1].trim();
            }

            // Look for GPA
            const gpaMatch = line.match(/(?:GPA|Grade Point Average|G\.P\.A\.)\s*(?:[:-])?\s*([\d.]+)/i);
            if (gpaMatch) {
              gpa = gpaMatch[1];
            }
          }
        }

        // Extract dates
        let dates = [];
        for (const line of lines) {
          // Look for dates in various formats
          const yearMatches = line.match(/\b(19|20)\d{2}\b/g);
          if (yearMatches) {
            dates = dates.concat(yearMatches);
          }
        }

        // Process dates
        if (dates.length > 0) {
          // Sort dates chronologically
          dates.sort();
          
          const now = new Date();
          const currentYear = now.getFullYear();
          
          if (dates.length >= 2) {
            // If we have multiple dates, use first as start and last as end
            startDate = `${dates[0]}-09-01`; // Assume September start
            endDate = `${dates[dates.length-1]}-05-31`; // Assume May end
            isExpectedDate = parseInt(dates[dates.length-1]) >= currentYear;
          } else {
            // If we have only one date
            const year = parseInt(dates[0]);
            if (year >= currentYear) {
              // Future date - expected graduation
              endDate = `${year}-05-31`;
              isExpectedDate = true;
              startDate = `${year-4}-09-01`; // Assume 4-year program
            } else {
              // Past date - actual graduation
              endDate = `${year}-05-31`;
              startDate = `${year-4}-09-01`; // Assume 4-year program
            }
          }
          
          // Set graduation date for display
          graduationDate = endDate;
        }

        // If we couldn't determine a degree type but found field of study
        if (!degreeType && fieldOfStudy) {
          // Look for common degree indicators in the field of study
          if (/computer|engineering|science|mathematics|physics/i.test(fieldOfStudy)) {
            degreeType = 'Bachelors'; // Assume Bachelor's for technical fields
          } else if (/arts|literature|history|philosophy/i.test(fieldOfStudy)) {
            degreeType = 'Bachelors'; // Assume Bachelor's for liberal arts
          }
        }

        // Clean up field of study
        if (fieldOfStudy) {
          // Remove common prefixes and degree indicators
          fieldOfStudy = fieldOfStudy
            .replace(/^(?:in|of)\s+/i, '')
            .replace(/bachelor'?s?|master'?s?|phd|doctorate|degree/i, '')
            .replace(/\([^)]*\)/g, '') // Remove parenthetical content
            .trim();
        }

        structuredData.education.push({
          institution,
          degreeType,
          fieldOfStudy,
          gpa,
          startDate,
          endDate,
          isExpectedDate,
          graduationDate
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