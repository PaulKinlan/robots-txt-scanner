import fs from "node:fs";
import readline from "node:readline";
import fetch from "node-fetch";
// Assuming 'robots-parser' exports a default class/function for ESM
import RobotsParser from "robots-parser";
// Assuming 'p-queue' exports default for ESM based on previous require usage
import PQueue from "p-queue";
import { initDb } from "./db_manager.js"; // Ensure .js extension

// --- Configuration ---
const CONCURRENCY = 50; // Number of concurrent requests
const REQUEST_TIMEOUT = 10000; // 10 seconds timeout for fetch
// Consider making this configurable or improving it
const USER_AGENT =
  "RobotsTxtAnalyzerBot/1.0 (+https://github.com/paulkinlan/robots-txt-scanner)";

// --- Database Initialization ---
// We get the actual DB functions when initDb is called
let dbManager;

// --- Helper Functions ---

// Fetches robots.txt from the root of the provided base URL's origin
async function fetchRobotsTxt(baseUrl) {
  let robotsUrl;
  try {
    // Ensure the input is treated as a URL and get its origin
    const base = new URL(baseUrl);
    robotsUrl = new URL("/robots.txt", base.origin).toString(); // Construct URL relative to origin
  } catch (e) {
    console.warn(`Invalid base URL provided: ${baseUrl}`, e.message);
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }

  try {
    console.log(`Attempting to fetch: ${robotsUrl}`);
    const response = await fetch(robotsUrl, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT), // Use AbortSignal for timeout with node-fetch v3+
      redirect: "follow", // Follow redirects
      follow: 5, // Max 5 redirects
    });

    if (response.ok) {
      console.log(`Successfully fetched: ${robotsUrl}`);
      const text = await response.text();
      // Return the *original* robots.txt URL we constructed and the text
      // response.url might differ due to redirects, but we want to associate with the canonical robots.txt location
      return { url: robotsUrl, text };
    } else if (response.status === 404) {
      console.log(`Not found (404): ${robotsUrl}`);
      // Return null or throw specific error if needed, but don't retry
      return null;
    } else {
      console.warn(
        `Fetch failed for ${robotsUrl} with status: ${response.status}`
      );
      throw new Error(
        `Fetch failed for ${robotsUrl} with status: ${response.status}`
      );
    }
  } catch (error) {
    // Check if it's a timeout error
    if (error.name === "AbortError") {
      console.warn(`Timeout fetching ${robotsUrl}`);
      throw new Error(`Timeout fetching ${robotsUrl}`);
    } else {
      // Re-throw other errors (like network issues, or the one thrown above)
      console.warn(`Error fetching ${robotsUrl}:`, error.message);
      throw error;
    }
  }
}

// Extracts blocked user agents from parsed robots.txt content
// Using a simple text-based approach as robots-parser might not easily give per-agent blocks
function getBlockedAgents(robotsTxtContent, siteUrl) {
  const blockedAgents = new Set();
  const lines = robotsTxtContent.split("\n");
  let currentUserAgent = null;
  let hasDisallow = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Match User-agent lines, case-insensitive
    const uaMatch = trimmedLine.match(/^User-agent:\s*(.+)$/i);
    // Match Disallow lines, case-insensitive
    const disallowMatch = trimmedLine.match(/^Disallow:/i);

    if (uaMatch) {
      // If we found a User-agent and the previous one had Disallows, add it
      if (currentUserAgent && hasDisallow) {
        blockedAgents.add(currentUserAgent);
      }
      // Start tracking the new user agent
      currentUserAgent = uaMatch[1].trim();
      hasDisallow = false; // Reset disallow flag for the new agent
    } else if (disallowMatch && currentUserAgent) {
      // If we see a Disallow rule for the current agent, mark it
      // We only care *if* there's a disallow, not what it is for this specific goal
      hasDisallow = true;
    } else if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      // Blank lines or comments might separate blocks or end the file
      if (currentUserAgent && hasDisallow) {
        blockedAgents.add(currentUserAgent);
      }
      currentUserAgent = null; // Reset agent on block end/comment/empty line
      hasDisallow = false;
    }
  }
  // Add the last agent if it had disallows and wasn't reset by end of file
  if (currentUserAgent && hasDisallow) {
    blockedAgents.add(currentUserAgent);
  }

  if (blockedAgents.size > 0) {
    console.log(
      `Found ${blockedAgents.size} potentially blocked agents for ${siteUrl}`
    );
  }
  return Array.from(blockedAgents);
}

// --- Main Scan Function ---

export async function scanSites(listPath, dbManagerPassed, maxRank = null) {
  // Accept maxRank
  console.log(`Starting scan process for list: ${listPath}`);
  if (maxRank !== null) {
    console.log(`Filtering: Only scanning sites with rank <= ${maxRank}`);
  }
  console.log(`Concurrency: ${CONCURRENCY}, Timeout: ${REQUEST_TIMEOUT}ms`);

  // Use the passed dbManager if available, otherwise initialize
  dbManager = dbManagerPassed || initDb();
  // Check if list file exists
  if (!fs.existsSync(listPath)) {
    console.error(`Error: Domain list file not found at ${listPath}`);
    process.exitCode = 1;
    return;
  }

  // Setup queue
  const queue = new PQueue({ concurrency: CONCURRENCY });
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let lineCount = 0; // Count lines read

  // Create file read stream
  const fileStream = fs.createReadStream(listPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Handle different line endings
  });

  console.log("Reading domain list and queuing tasks...");

  // Process each line (domain) in the CSV
  rl.on("line", (line) => {
    lineCount++;
    // Assuming CSV format: rank,url (e.g., "1,https://www.google.com")
    const parts = line.split(",");
    const rankStr = parts[0]?.trim();
    const baseUrl = parts[1]?.trim(); // Input is a full URL now
    const rank = parseInt(rankStr, 10); // Parse rank as integer

    // Validate rank and base URL
    if (!baseUrl || isNaN(rank)) {
      if (line.trim() !== "") {
        // Log warning only if it's not just an empty line
        console.warn(`Skipping invalid line #${lineCount}: ${line}`);
      }
      return; // Skip this line entirely
    }

    // Apply maxRank filter if provided
    if (maxRank !== null && rank > maxRank) {
      // console.log(`Skipping ${baseUrl} (Rank ${rank} > ${maxRank})`); // Optional: Log skipped domains
      return; // Skip adding to queue
    }

    // Add valid and unfiltered URL to the queue
    queue.add(async () => {
      try {
        // Pass the full base URL to fetchRobotsTxt
        const result = await fetchRobotsTxt(baseUrl);
        if (result && result.text) {
          // Basic parsing to find blocked agents
          // Use the constructed robots.txt URL (result.url) for logging/DB
          const agents = getBlockedAgents(result.text, result.url);
          // Add site to database, passing the rank
          dbManager.addScanResult(result.url, agents, rank); // Store the robots.txt URL and rank
          successCount++;
        } else {
          // No robots.txt found or fetched (already logged in fetchRobotsTxt)
          // Optionally store site with its rank even if robots.txt is missing/failed
          // We might want to store the original baseUrl or the derived robots.txt URL here
          // dbManager.addScanResult(baseUrl, [], rank); // Example: Store base URL anyway
        }
      } catch (error) {
        // Log error but continue processing other domains
        console.error(
          `Failed processing URL ${baseUrl} (Rank ${rank}): ${error.message}`
        );
        errorCount++;
      } finally {
        processedCount++;
        if (processedCount % 100 === 0) {
          // Log progress every 100 domains processed
          console.log(
            `Progress: Processed ${processedCount} domains... (Success: ${successCount}, Errors: ${errorCount})`
          );
        }
      }
    });
    // Removed the misplaced 'else if' from here
  });

  // Wait for the file reading to complete
  await new Promise((resolve) => rl.on("close", resolve));
  console.log(
    `Finished reading domain list (${lineCount} lines). Total tasks queued: ${
      processedCount + queue.size
    }. Waiting for queue to finish...`
  );

  // Wait for the queue to finish processing all tasks
  await queue.onIdle();

  console.log("--- Scan Complete ---");
  console.log(`Total Domains Processed: ${processedCount}`);
  console.log(`Successful Fetches/Parses with robots.txt: ${successCount}`);
  console.log(`Errors Encountered: ${errorCount}`);
  console.log("---------------------");

  // Note: DB connection is closed automatically on process exit by db_manager.js
}

// No default export needed
