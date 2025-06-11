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
        // Connect to our jobs-web server
        const response = await fetch('http://localhost:3001/api/jobs');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Our jobs-web API returns { jobs: [...] } - map to enhanced interface
        const jobsData = data.jobs || [];
        const enhancedJobs = jobsData.map((job: any, index: number) => ({
          id: job.id || `${job.source}-${index}`,
          title: job.title,
          company: job.source, // Use source as company for now
          location: job.location,
          url: job.url
        }));
        setJobs(enhancedJobs); 
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
    return (
      <div className="job-listings-error">
        <p>Error: {error}</p>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          Make sure the jobs web server is running on http://localhost:3001
        </p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return <div className="job-listings-empty">No job listings found.</div>;
  }

  return (
    <div className="job-listings-container">
      <h3>Available Jobs ({jobs.length})</h3>
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
