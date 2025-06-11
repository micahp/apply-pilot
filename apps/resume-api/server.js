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
  origin: true // Allow all origins
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

// Resume upload and parse endpoint
fastify.post('/parse-resume', async (request, reply) => {
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }
    
    // Check if file is a PDF
    if (!data.filename.toLowerCase().endsWith('.pdf')) {
      return reply.code(400).send({ error: 'Uploaded file must be a PDF' });
    }
    
    // Generate random filename to prevent collisions
    const tempFilename = path.join(uploadsDir, `${crypto.randomUUID()}.pdf`);
    
    // Save the file to disk
    await pump(data.file, fs.createWriteStream(tempFilename));
    
    // Read and parse the PDF
    const dataBuffer = fs.readFileSync(tempFilename);
    const result = await pdfParse(dataBuffer);
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilename);
    
    // Extract and structure resume data
    return {
      filename: data.filename,
      pages: result.numpages,
      version: result.info ? result.info.PDFFormatVersion : undefined,
      text: result.text,
      // You can add more structured data extraction here
    };
  } catch (err) {
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