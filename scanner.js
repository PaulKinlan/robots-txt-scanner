import fs from "node:fs";
import path from "node:path";
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
const USER_AGENT = "RobotsTxtAnalyzerBot/1.0 (+https://github.com/your-repo)";

// --- Database Initialization ---
// We get the actual DB functions when initDb is called
let dbManager;

// --- Helper Functions ---

// Tries fetching robots.txt via HTTPS first, then HTTP
async function fetchRobotsTxt(domain) {
  const urls = [`https://${domain}/robots.txt`, `http://${domain}/robots.txt`];
  let lastError = null;

  for (const url of urls) {
    try {
      console.log(`Attempting to fetch: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT), // Use AbortSignal for timeout with node-fetch v3+
        redirect: "follow", // Follow redirects
        follow: 5, // Max 5 redirects
      });

      if (response.ok) {
        console.log(`Successfully fetched: ${url}`);
        const text = await response.text();
        return { url: response.url, text }; // Return final URL after redirects and text
      } else if (response.status === 404) {
        console.log(`Not found (404): ${url}`);
        lastError = new Error(`Not found (404) at ${url}`);
        // Don't retry on 404 for the other protocol immediately,
        // but continue the loop in case the other protocol works.
      } else {
        console.warn(`Fetch failed for ${url} with status: ${response.status}`);
        lastError = new Error(
          `Fetch failed for ${url} with status: ${response.status}`
        );
        // Continue loop to try other protocol
      }
    } catch (error) {
      // Check if it's a timeout error
      if (error.name === "AbortError") {
        console.warn(`Timeout fetching ${url}`);
        lastError = new Error(`Timeout fetching ${url}`);
      } else {
        console.warn(`Error fetching ${url}:`, error.message);
        lastError = error; // Store the error and try the next URL
      }
    }
  }

  console.warn(`Failed to fetch robots.txt for ${domain} from all URLs.`);
  // If both attempts failed, throw the last encountered error
  if (lastError) throw lastError;
  // Or return null if no specific error was caught but nothing worked
  return null;
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

export async function scanSites(listPath) {
  console.log(`Starting scan process for list: ${listPath}`);
  console.log(`Concurrency: ${CONCURRENCY}, Timeout: ${REQUEST_TIMEOUT}ms`);

  // Initialize DB connection and get functions
  try {
    dbManager = initDb();
    if (!dbManager || !dbManager.addScanResult) {
      throw new Error("Database manager failed to initialize properly.");
    }
  } catch (dbError) {
    console.error("Failed to initialize database:", dbError.message);
    process.exitCode = 1;
    return; // Stop if DB fails
  }

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
    // Assuming CSV format: rank,domain (e.g., "1,google.com")
    const parts = line.split(",");
    const domain = parts[1]?.trim(); // Get the second part and trim whitespace

    if (domain) {
      queue.add(async () => {
        try {
          const result = await fetchRobotsTxt(domain);
          if (result && result.text) {
            // Basic parsing to find blocked agents
            const agents = getBlockedAgents(result.text, result.url);
            if (agents.length > 0) {
              // Add to database using the function from the initialized dbManager
              dbManager.addScanResult(result.url, agents); // Use the final URL
            }
            successCount++;
          } else {
            // No robots.txt found or fetched (already logged in fetchRobotsTxt)
            // Could optionally store sites without robots.txt if needed
          }
        } catch (error) {
          // Log error but continue processing other domains
          console.error(`Failed processing domain ${domain}: ${error.message}`);
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
    } else if (line.trim() !== "") {
      // Avoid warning for empty lines
      console.warn(`Skipping invalid line #${lineCount}: ${line}`);
    }
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
