import React, { useState, useEffect } from 'react';

interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  url: string;
}

// Define a type for the component props, if any are needed in the future.
// For now, it doesn't take any props.
// interface JobListingsProps {}

const JobListings: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        // Placeholder API endpoint. This will be replaced with the actual API.
        // The issue implies filters like fortune=1 and ATS types.
        // e.g., /api/jobs?fortune=1&ats=workday,icims
        const response = await fetch('https://api.example.com/jobs?source=fortune500&ats=workday,icims');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Simulate API response structure. Adjust if API sends data differently.
        // Assuming the API returns an array of job objects directly.
        // If data is in a nested property, e.g. data.jobs, adjust here.
        setJobs(data.jobs || data); 
      } catch (e) {
        if (e instanceof Error) {
          setError(`Failed to fetch jobs: ${e.message}`);
        } else {
          setError('Failed to fetch jobs: An unknown error occurred.');
        }
        console.error("Error fetching jobs:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []); // Empty dependency array means this effect runs once on mount

  if (loading) {
    return <div className="job-listings-loading">Loading job listings...</div>;
  }

  if (error) {
    return <div className="job-listings-error">Error: {error}</div>;
  }

  if (jobs.length === 0) {
    return <div className="job-listings-empty">No job listings found.</div>;
  }

  return (
    <div className="job-listings-container">
      <h3>Available Jobs</h3>
      <ul className="job-list">
        {jobs.map(job => (
          <li key={job.id} className="job-item">
            <h4><a href={job.url} target="_blank" rel="noopener noreferrer">{job.title}</a></h4>
            <p>{job.company}{job.location ? ` - ${job.location}` : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JobListings;
