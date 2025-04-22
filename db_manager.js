import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url"; // Needed for __dirname replacement

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "robots_data.db");
let db;
let dbFunctions = null; // Store the returned functions

// Function to initialize the database connection and schema
export function initDb() {
  // Return cached functions if already initialized
  if (dbFunctions) {
    return dbFunctions;
  }
  // Return existing connection if only db is set but not functions (should not happen often)
  if (db) {
    console.warn(
      "DB was initialized but functions were not cached. Re-initializing."
    );
    // Fall through to re-initialize properly
  }

  try {
    db = new Database(dbPath, { verbose: console.log }); // Enable verbose logging for debugging
    console.log(`Connected to database at ${dbPath}`);

    // Create tables if they don't exist
    db.exec(`
            CREATE TABLE IF NOT EXISTS sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL
            );
        `);
    console.log("Checked/created 'sites' table.");

    db.exec(`
            CREATE TABLE IF NOT EXISTS blocked_agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site_id INTEGER NOT NULL,
                user_agent TEXT NOT NULL,
                FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
            );
        `);
    console.log("Checked/created 'blocked_agents' table.");

    // Create index for faster querying
    db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_agent ON blocked_agents (user_agent);
         `);
    console.log("Checked/created index on 'blocked_agents.user_agent'.");

    // Prepare statements for insertion (improves performance)
    const insertSiteStmt = db.prepare(
      "INSERT OR IGNORE INTO sites (url) VALUES (?)"
    );
    const insertAgentStmt = db.prepare(
      "INSERT INTO blocked_agents (site_id, user_agent) VALUES (?, ?)"
    );
    const findSiteIdStmt = db.prepare("SELECT id FROM sites WHERE url = ?");

    // Function to add a site and its blocked agents within a transaction
    const addScanResult = db.transaction((siteUrl, blockedAgents) => {
      const siteInfo = findSiteIdStmt.get(siteUrl);
      let siteId;
      if (!siteInfo) {
        const info = insertSiteStmt.run(siteUrl);
        siteId = info.lastInsertRowid;
        if (!siteId) {
          // If IGNORE happened, fetch the existing ID
          const existingSite = findSiteIdStmt.get(siteUrl);
          if (!existingSite) {
            console.error(
              `Failed to find existing site ID for ${siteUrl} after IGNORE.`
            );
            return; // Stop transaction if site ID is unobtainable
          }
          siteId = existingSite.id;
        }
      } else {
        siteId = siteInfo.id;
      }

      if (siteId) {
        let count = 0;
        for (const agent of blockedAgents) {
          // Basic check to avoid overly long user agents if needed
          if (agent && agent.length < 512) {
            // Example length limit
            insertAgentStmt.run(siteId, agent);
            count++;
          } else {
            console.warn(
              `Skipping potentially invalid or long agent for site ID ${siteId}: ${agent?.substring(
                0,
                100
              )}...`
            );
          }
        }
        if (count > 0) {
          console.log(
            `Added ${count} blocked agents for site ID ${siteId} (${siteUrl})`
          );
        }
      } else {
        console.error(`Could not find or insert site ID for ${siteUrl}`);
      }
    });

    // Function to query the blocked agents report
    const queryBlockedAgentsReport = () => {
      if (!db) {
        console.error("Database not initialized for query.");
        return [];
      }
      const stmt = db.prepare(`
                SELECT user_agent, COUNT(*) as block_count
                FROM blocked_agents
                GROUP BY user_agent
                ORDER BY block_count DESC
            `);
      const results = stmt.all();
      console.log(`Found ${results.length} unique blocked user agents.`);
      return results;
    };

    // Cache the functions and return them
    dbFunctions = { db, addScanResult, queryBlockedAgentsReport };
    return dbFunctions;
  } catch (err) {
    console.error("Database initialization failed:", err);
    // Don't exit here, let the caller handle it
    throw err; // Re-throw error
  }
}

// Function to reset the database (drop tables and re-initialize)
export function resetDb() {
  console.log("Attempting to reset database...");
  if (!db) {
    // If DB isn't connected, initialize it first (which creates tables if needed)
    // This scenario shouldn't happen if called via CLI which initializes first, but good practice.
    console.log("DB not connected, initializing first.");
    initDb();
    // If initDb failed, db would still be null or an error thrown.
    if (!db) {
      console.error("Failed to initialize DB during reset attempt.");
      return; // Can't proceed
    }
  }

  try {
    console.log("Dropping existing tables...");
    // Drop dependent table first due to foreign key constraint
    db.exec(`DROP TABLE IF EXISTS blocked_agents;`);
    db.exec(`DROP TABLE IF EXISTS sites;`);
    console.log("Tables dropped.");

    // Re-run initialization to create tables and prepare statements
    // Clear the cached functions before re-initializing
    dbFunctions = null;
    console.log("Re-initializing tables and statements...");
    initDb(); // This will recreate tables via CREATE IF NOT EXISTS and repopulate dbFunctions
    console.log("Database reset successfully.");
  } catch (err) {
    console.error("Failed to reset database:", err);
    // Attempt to close connection on error? Or leave it to exit handler?
    // For now, just log the error.
  }
}

// Function to close the database connection
export function closeDb() {
  if (db) {
    db.close();
    console.log("Database connection closed.");
    db = null;
    dbFunctions = null; // Clear cached functions
  }
}

// Ensure DB connection is closed gracefully on exit
process.on("exit", closeDb);
process.on("SIGINT", () => {
  // Catch Ctrl+C
  closeDb();
  process.exit(0);
});
process.on("uncaughtException", (err) => {
  // Catch unexpected errors
  console.error("Uncaught Exception:", err);
  closeDb();
  process.exit(1);
});

// No default export needed as we export named functions
