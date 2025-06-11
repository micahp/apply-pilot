import React from 'react';
import { createRoot } from 'react-dom/client';
import JobListings from '../components/JobListings.tsx';
import '../components/JobListings.css';

// Add some basic styling for the jobs page
const styles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
  }
  .jobs-header {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .jobs-header h1 {
    margin: 0;
    color: #333;
  }
  .jobs-header p {
    margin: 5px 0 0 0;
    color: #666;
  }
  .jobs-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 20px;
  }
`;

// Add styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Render the page
function JobsPage() {
  return (
    <div>
      <div className="jobs-header">
        <h1>Job Listings</h1>
        <p>Discover job opportunities from various companies and ATS platforms</p>
      </div>
      
      <div className="jobs-content">
        <JobListings />
      </div>
    </div>
  );
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('job-listings-container');
  if (container) {
    const root = createRoot(container);
    root.render(<JobsPage />);
  }
}); 