import pg from 'pg';

// Database connection pool (similar to jobCrawler.js)
// Ensure DATABASE_URL environment variable is set
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const DAYS_UNTIL_CLOSED = 7; // Configurable: number of days after which an unseen job is marked closed

async function markOldJobsAsClosed() {
  console.log(`Starting to mark jobs as closed if not seen in ${DAYS_UNTIL_CLOSED} days...`);
  let updatedCount = 0;

  try {
    const result = await pool.query(
      `UPDATE job_postings
       SET status = 'closed'
       WHERE last_seen_at < NOW() - INTERVAL '${DAYS_UNTIL_CLOSED} days'
         AND status != 'closed'`, // Only update those not already marked 'closed'
      [] // No parameters needed for this query
    );
    updatedCount = result.rowCount || 0; // rowCount is the number of rows affected
    console.log(`Successfully marked ${updatedCount} job posting(s) as 'closed'.`);
  } catch (error) {
    console.error('Error marking old jobs as closed:', error.message);
    console.error(error.stack); // For more detailed debugging if needed
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

// If invoked directly from CLI: node utils/markClosedJobs.js
if (require.main === module) {
  markOldJobsAsClosed()
    .then(() => {
      console.log('markClosedJobs.js script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      // This catch block might be redundant if markOldJobsAsClosed handles its own errors
      // but it's good for catching unexpected issues during script setup or pool.end()
      console.error('Unhandled error in markClosedJobs.js script:', err);
      process.exit(1);
    });
}
