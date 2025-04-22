#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { downloadList } from "./list_downloader.js";
import { scanSites } from "./scanner.js";
import { initDb, resetDb } from "./db_manager.js"; // Import resetDb

console.log("Robots.txt Analyzer CLI"); // Basic check

yargs(hideBin(process.argv))
  .command(
    "download-list",
    "Download the Cisco Umbrella Top 1M list",
    () => {}, // Builder function (no options needed for now)
    async (argv) => {
      console.log("Downloading list...");
      try {
        await downloadList();
        console.log("List download finished successfully.");
      } catch (error) {
        console.error("Failed to download list:", error.message);
        process.exitCode = 1; // Indicate failure
      }
    }
  )
  .command(
    "scan",
    "Scan robots.txt files from a list of domains",
    (yargs) => {
      // Builder function for options
      return yargs.option("list", {
        alias: "l",
        type: "string",
        description: "Path to the CSV file containing domain names",
        demandOption: true, // Make this option required
      });
    },
    async (argv) => {
      console.log(`Scanning sites from list: ${argv.list}`);
      try {
        await scanSites(argv.list);
        console.log("Scan finished.");
      } catch (error) {
        console.error("Scan failed:", error.message);
        process.exitCode = 1;
      }
    }
  )
  .command(
    "query",
    "Query the database for blocked user agents",
    (yargs) => {
      // Builder function for options
      return yargs.option("report", {
        alias: "r",
        type: "string",
        description: 'Type of report to generate (e.g., "blocked-agents")',
        choices: ["blocked-agents"], // Only allow this value for now
        demandOption: true,
      });
    },
    async (argv) => {
      if (argv.report === "blocked-agents") {
        console.log("Querying blocked agents report...");
        try {
          const dbManager = initDb(); // Ensure DB is initialized
          // We need the query function returned by initDb
          if (!dbManager || !dbManager.queryBlockedAgentsReport) {
            throw new Error("DB Manager not initialized correctly for query.");
          }
          const results = dbManager.queryBlockedAgentsReport();
          if (results && results.length > 0) {
            console.log("\n--- Blocked User Agents Report ---");
            console.log("Count | User Agent");
            console.log("------|------------");
            results.forEach((row) => {
              console.log(
                `${String(row.block_count).padEnd(5)} | ${row.user_agent}`
              );
            });
            console.log("----------------------------------");
          } else {
            console.log("No blocked agents found in the database.");
          }
        } catch (error) {
          console.error("Query failed:", error.message);
          process.exitCode = 1;
        }
      } else {
        console.error(`Unknown report type: ${argv.report}`);
      }
    }
  )
  .command(
    "reset-db",
    "Reset the database (Deletes all stored data!)",
    () => {}, // No options needed
    async (argv) => {
      // TODO: Add a real confirmation prompt here (e.g., using 'inquirer' package)
      // For now, just log a warning. A real app should confirm.
      console.warn(
        "WARNING: Proceeding to reset the database. All data will be lost."
      );
      try {
        resetDb(); // Call the reset function from db_manager
      } catch (error) {
        console.error("Failed to reset database:", error.message);
        process.exitCode = 1;
      }
    }
  )
  .demandCommand(1, "You need at least one command before moving on")
  .help()
  .alias("help", "h")
  .strict() // Report errors for unknown commands/options
  .parse(); // Parse the arguments
