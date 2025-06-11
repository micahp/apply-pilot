/**
 * Pluggable Google Search client.
 * Currently a stub/mock. Replace with actual API calls to Google Custom Search API
 * or a headless browser solution.
 */

const DEFAULT_MAX_RESULTS = 40; // Default max results per ATS, as per user feedback

/**
 * Simulates fetching search results from Google.
 * 
 * @param {object} rawQueryParts - Parts of the query.
 * @param {string} rawQueryParts.site - The specific site to search (e.g., "boards.greenhouse.io").
 * @param {string} rawQueryParts.keywordsString - Pre-formatted keyword string (e.g., ""Software Engineer" OR "Developer"").
 * @param {string} rawQueryParts.countryFilterString - Pre-formatted country string (e.g., ""United States"").
 * @param {object} options - Options for the search.
 * @param {number} [options.hoursBack=24] - How many hours back to search.
 * @param {string} [options.apiKey=process.env.CSE_KEY] - Google Custom Search API Key.
 * @param {string} [options.cx=process.env.CSE_CX] - Google Custom Search Engine ID.
 * @param {number} [options.maxResults=DEFAULT_MAX_RESULTS] - Max results to aim for.
 * @returns {Promise<Array<{link: string, title: string}>>} A list of search result items.
 */
export async function searchGoogle(
  rawQueryParts, 
  { hoursBack = 24, apiKey = process.env.CSE_KEY, cx = process.env.CSE_CX, maxResults = DEFAULT_MAX_RESULTS } = {}
) {
  const { site, keywordsString, countryFilterString } = rawQueryParts;

  if (!apiKey || !cx) {
    console.warn(
      "googleClient.js: CSE_KEY or CSE_CX environment variables are not set. " +
      "Google search will be skipped, returning empty results."
    );
    return []; // Graceful no-op as requested
  }

  // 1. Construct the query string (q parameter for Google)
  // User feedback: "site:boards.greenhouse.io "apply" ("Software Developer" OR "Software Engineer") "United States""
  // The "apply" keyword seems useful.
  const query = encodeURIComponent(`${site ? `site:${site} ` : ''}"apply" ${keywordsString} ${countryFilterString}`);

  // 2. Determine the tbs (time-based search) parameter
  let tbs = '';
  if (hoursBack > 0) {
    if (hoursBack <= 24) tbs = 'qdr:d'; // Last 24 hours (Google uses 'd' for day 1)
    else if (hoursBack <= 48) tbs = 'qdr:d2'; // Last 2 days
    else if (hoursBack <= 168) tbs = 'qdr:w'; // Last week (Google uses 'w' for week 1)
    // Google also supports hX for hours, but d, w, m, y are more common for qdr.
    // For more precision with hours: tbs = `qdr:h${hoursBack}`;
    // Sticking to simpler qdr:d, qdr:d2, qdr:w for now as per common usage for "last X days/week"
  }
  
  // 3. Construct the full URL (example for Google Custom Search API)
  // Note: This URL is for documentation; actual API calls might vary slightly.
  let fullSearchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=${Math.min(maxResults, 10)}`; // Max 10 results per page for CSE
  if (tbs) {
    fullSearchUrl += `&tbs=${tbs}`;
  }

  console.log(`googleClient.js: MOCKING API Call to Google Custom Search.`);
  console.log(`googleClient.js: Target URL (conceptual): ${fullSearchUrl}`);
  console.log(`googleClient.js: Max results to process for this query: ${maxResults}`);
  
  // In a real scenario, you would make an HTTP request here using 'got' or similar.
  // For example:
  // try {
  //   const response = await got(fullSearchUrl, { responseType: 'json' });
  //   // Assuming response.body.items is an array like [{ link, title, ... }]
  //   return response.body.items || []; 
  // } catch (error) {
  //   console.error(`googleClient.js: Error fetching Google Search results for query "${query}":`, error);
  //   return [];
  // }

  // ---- MOCK RESULTS ----
  // Return a predefined mock result array.
  // This structure should align with what the Google Custom Search API returns (items have 'link' and 'title').
  const mockResults = [
    { link: `https://www.${rawQueryParts.site}/mockjob/123`, title: `Mock Software Engineer at ${rawQueryParts.site}` },
    { link: `https://www.${rawQueryParts.site}/mockjob/456`, title: `Mock Backend Developer at ${rawQueryParts.site}` },
    { link: `https://www.${rawQueryParts.site}/another/789`, title: `Another Mock Role at ${rawQueryParts.site}` },
  ];
  // Simulate batch size by returning only up to maxResults
  return mockResults.slice(0, maxResults);
}
