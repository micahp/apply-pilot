/**
 * Test PDF Parser
 * 
 * This is a simple Node.js script to test PDF parsing locally.
 * Usage:
 * 1. Place a resume PDF in the same directory as this script
 * 2. Run this script with: node testPdfParser.js resume.pdf
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Check if a filename was provided
if (process.argv.length < 3) {
  console.error('Please provide a PDF file path as an argument');
  console.log('Example: node testPdfParser.js resume.pdf');
  process.exit(1);
}

const filePath = process.argv[2];

// Check if the file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// Check if it's a PDF
if (!filePath.toLowerCase().endsWith('.pdf')) {
  console.error('File must be a PDF');
  process.exit(1);
}

console.log(`Parsing PDF: ${filePath}`);

// Read the PDF file
const dataBuffer = fs.readFileSync(filePath);

// Parse the PDF
pdfParse(dataBuffer).then(function(data) {
  console.log('-------- PDF METADATA --------');
  console.log('Number of pages:', data.numpages);
  console.log('PDF Info:', data.info);
  
  console.log('\n-------- EXTRACTED TEXT --------');
  console.log('Text length:', data.text.length, 'characters');
  
  // Output a preview of the text
  const previewLength = 500;
  console.log('\nText preview:');
  console.log(data.text.substring(0, previewLength) + (data.text.length > previewLength ? '...' : ''));
  
  console.log('\n-------- RESUME SECTIONS --------');
  
  // Try to identify sections
  const sections = [];
  
  // Look for common section headers
  const sectionPatterns = [
    { name: 'PROFILE/SUMMARY', regex: /\b(PROFILE|SUMMARY|OBJECTIVE|ABOUT)[\s:]*\n/i },
    { name: 'EXPERIENCE', regex: /\b(EXPERIENCE|EMPLOYMENT|WORK HISTORY)[\s:]*\n/i },
    { name: 'EDUCATION', regex: /\b(EDUCATION|ACADEMIC|QUALIFICATION)[\s:]*\n/i },
    { name: 'SKILLS', regex: /\b(SKILLS|EXPERTISE|COMPETENCIES|ABILITIES)[\s:]*\n/i },
    { name: 'PROJECTS', regex: /\b(PROJECTS|PROJECT EXPERIENCE)[\s:]*\n/i },
    { name: 'CERTIFICATIONS', regex: /\b(CERTIFICATIONS|CERTIFICATES|LICENSES)[\s:]*\n/i },
  ];
  
  // Test each section pattern
  for (const section of sectionPatterns) {
    const match = data.text.match(section.regex);
    if (match) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      sections.push({
        name: section.name,
        found: true,
        startIndex,
        endIndex,
        extractedText: data.text.substring(endIndex, endIndex + 200) + '...'
      });
    } else {
      sections.push({
        name: section.name,
        found: false
      });
    }
  }
  
  // Print section findings
  for (const section of sections) {
    if (section.found) {
      console.log(`✓ ${section.name} section found`);
      console.log(`  Preview: ${section.extractedText.substring(0, 100)}...`);
    } else {
      console.log(`✗ ${section.name} section not found`);
    }
  }
  
  // Extract contact information
  console.log('\n-------- CONTACT INFO --------');
  
  // Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = data.text.match(emailRegex);
  
  // Phone
  const phoneRegex = /\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const phones = data.text.match(phoneRegex);
  
  console.log('Emails found:', emails || 'None');
  console.log('Phone numbers found:', phones || 'None');
  
  // Create an output file with the extracted text
  const outputPath = path.join(path.dirname(filePath), `${path.basename(filePath, '.pdf')}_extracted.txt`);
  fs.writeFileSync(outputPath, data.text);
  console.log(`\nExtracted text saved to: ${outputPath}`);
}).catch(function(error) {
  console.error('Error parsing PDF:', error);
}); 