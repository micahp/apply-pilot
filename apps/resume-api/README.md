# Resume Parsing API

A simple API server for parsing resume PDFs and extracting structured data.

## Features

- PDF resume parsing
- Extraction of personal info, work experience, education, and skills
- CORS-enabled for use with web applications
- Simple health check endpoint

## Setup

### Prerequisites

- Node.js (v14.x or higher)
- npm or yarn

### Installation

1. Install dependencies:

```bash
cd apps/resume-api
npm install
```

### Running the Server

Start the API server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Or use the project root script:

```bash
# From project root
npm run resume-api
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## API Endpoints

### Health Check

```
GET /health
```

Returns status to check if API is running.

### CORS Test

```
GET /cors-test
```

Endpoint to test CORS configuration.

### Parse Resume

```
POST /parse-resume
```

Upload a resume PDF file to be parsed. The file should be sent as form data with the key `file`.

#### Response

```json
{
  "filename": "example.pdf",
  "pages": 2,
  "version": "1.4",
  "text": "Raw text content...",
  "structuredData": {
    "personal": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "123-456-7890"
    },
    "workExperience": [...],
    "education": [...],
    "skills": [...]
  }
}
```

## Troubleshooting

### CORS Issues

The API has CORS enabled with permissive settings. If you're experiencing CORS issues:

1. Check that the server is running
2. Verify the correct URL is being used
3. Check browser console for specific error messages

### PDF Parsing Issues

For best results:
- Use text-based PDFs (not scanned images)
- Use standard section headers (EXPERIENCE, EDUCATION, SKILLS)
- Use a clean, well-structured resume format 