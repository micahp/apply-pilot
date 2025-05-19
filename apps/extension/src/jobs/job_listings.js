console.log("job_listings.js loaded successfully.");
console.log("Current URL:", window.location.href);
// console.log("Extension ID:", chrome.runtime.id);

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM Content Loaded event fired");
  const jobListingsContainer = document.getElementById('job-listings-container');
  
  if (jobListingsContainer) {
    console.log("Found job listings container");
    // Clear initial placeholder content
    jobListingsContainer.innerHTML = ''; 

    // Get any stored data
    const result = await chrome.storage.local.get(['jobSearchData']);
    console.log("Retrieved stored data:", result);

    const atsSearchQueries = [
      {
        name: "Workable",
        url: 'https://www.google.com/search?q=site:apply.workable.com+"software+engineer"'
      },
      {
        name: "Ashby",
        url: 'https://www.google.com/search?q=site:jobs.ashbyhq.com+"software+engineer"'
      },
      {
        name: "Greenhouse",
        url: 'https://www.google.com/search?q=site:boards.greenhouse.io+"software+engineer"'
      },
      {
        name: "Lever",
        url: 'https://www.google.com/search?q=site:jobs.lever.co+"software+engineer"'
      }
    ];

    console.log("Creating search links for ATS:", atsSearchQueries.map(q => q.name).join(', '));

    const list = document.createElement('ul');
    list.className = 'ats-search-links'; // For potential styling

    atsSearchQueries.forEach(ats => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = ats.url;
      link.textContent = `Find Software Engineer jobs on ${ats.name}`;
      link.target = "_blank"; // Open in a new tab
      link.rel = "noopener noreferrer"; // Security best practice for target="_blank"
      
      listItem.appendChild(link);
      list.appendChild(listItem);
    });

    jobListingsContainer.appendChild(list);
    console.log("Search links added to page");

  } else {
    console.error('Error: Job listings container not found in job_listings.html');
  }
}); 