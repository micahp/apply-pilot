import fs from 'fs';
import pdf from 'pdf-parse';

// Get the PDF file path from command line argument
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Please provide a PDF file path as an argument');
  console.error('Example: node parsePdf.js example.pdf');
  process.exit(1);
}

// Read the PDF file
const dataBuffer = fs.readFileSync(pdfPath);

// Parse the PDF
pdf(dataBuffer).then(function(data) {
  // Log basic PDF information
  console.log('PDF Info:');
  console.log('---------');
  console.log('Number of pages:', data.numpages);
  console.log('PDF Version:', data.info.PDFFormatVersion);
  console.log('Is Encrypted:', data.info.IsEncrypted);
  console.log('Title:', data.info.Title);
  console.log('Author:', data.info.Author);
  console.log('Creator:', data.info.Creator);
  console.log('\nExtracted Text:');
  console.log('---------------');
  console.log(data.text);
}).catch(function(error) {
  console.error('Error parsing PDF:', error);
}); 