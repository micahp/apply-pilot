# Jobs Web - Direct ATS Crawler

This Fastify server aggregates job listings by directly crawling multiple Applicant Tracking Systems (ATS) without requiring Google Search API. It provides a modern web interface and API for managing and viewing scraped job data.

## Features

- **Direct ATS Crawling**: Scrapes jobs directly from ATS platforms (Greenhouse, Lever, Ashby, Workable, Workday, iCIMS)
- **No Google Dependency**: Works without Google Custom Search API
- **Real-time Data**: Shows recently discovered jobs from the database
- **Filtering**: Filter by ATS type, location, job family, and time range
- **Statistics**: View crawler performance and ATS host status
- **Modern UI**: Clean, responsive interface with live updates

## API Endpoints

- `GET /api/jobs` - Get filtered job listings from database
- `GET /api/ats/stats` - Get crawler statistics and performance metrics
- `GET /api/ats/hosts` - List configured ATS hosts
- `POST /api/ats/crawl` - Trigger a new crawling session

## Running

```bash
pnpm install
pnpm --filter jobs-web start
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `PORT` - Server port (default: 3001)

## Prerequisites

1. PostgreSQL database with job_postings and ats_hosts tables
2. Resume API crawler utilities for data collection
3. Node.js 18+
