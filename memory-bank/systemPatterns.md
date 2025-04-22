# System Patterns & Architecture: Robots.txt Analyzer CLI

## High-Level Architecture

This project is a command-line interface (CLI) application built with Node.js. It operates locally, fetching data from external web servers (`robots.txt` files) and storing results in a local SQLite database. It does not follow complex architectural patterns like microservices or serverless, functioning as a self-contained tool.

```mermaid
graph TD
    subgraph User Interaction
        CLI[User via Terminal] -- Runs command --> IndexJS(index.js / yargs)
    end

    subgraph Core Logic
        IndexJS -- download-list --> Downloader(list_downloader.js)
        IndexJS -- scan --> Scanner(scanner.js)
        IndexJS -- query/reset-db --> DBManager(db_manager.js)

        Downloader -- Fetches --> ExternalZip[External HTTP Server (top-1m.csv.zip)]
        Downloader -- Writes --> LocalCSV(top-1m.csv)

        Scanner -- Reads --> InputCSV[Input CSV (rank,url)]
        Scanner -- Uses --> PQueue(p-queue for Concurrency)
        Scanner -- Constructs URL --> RobotsTxtURL{robots.txt URL}
        Scanner -- Fetches --> ExternalRobots[External Web Servers (robots.txt)]
        Scanner -- Uses --> DBManager

        DBManager -- Manages --> SQLiteDB[(robots_data.db: sites(id,url,rank), blocked_agents)]
    end

    CLI -- Receives output --> ConsoleOutput[Console Output]
    IndexJS -- Logs to --> ConsoleOutput
    Scanner -- Logs to --> ConsoleOutput
    Downloader -- Logs to --> ConsoleOutput
    DBManager -- Logs to --> ConsoleOutput

```

## Key Technical Decisions & Rationale

- **Decision 1:** Node.js with ES Modules
  - **Rationale:** Modern JavaScript environment suitable for I/O-bound tasks (network requests, file system), good ecosystem for CLI tools (`yargs`) and async operations. ESM allows for modern syntax (`import`/`export`).
- **Decision 2:** `yargs` for CLI Parsing
  - **Rationale:** Robust and popular library for creating structured command-line interfaces with commands, options, help messages, and validation.
- **Decision 3:** `node-fetch` for HTTP Requests
  - **Rationale:** Provides a familiar Fetch API interface within the Node.js environment for making HTTP(S) requests to retrieve the domain list zip and `robots.txt` files. Supports timeouts via `AbortSignal`.
- **Decision 4:** `p-queue` for Concurrency Control
  - **Rationale:** Manages the rate of concurrent network requests during the scan phase, preventing overwhelming local resources or target servers. Allows configurable concurrency.
- **Decision 5:** `better-sqlite3` for Database
  - **Rationale:** Simple, file-based SQL database. Suitable for local storage without requiring a separate database server. `better-sqlite3` offers a synchronous API (often simpler for CLI tools) but uses transactions for atomic writes.
- **Decision 6:** Basic Text Parsing for Blocked Agents
  - **Rationale:** The specific goal is only to identify user agents mentioned before _any_ `Disallow:` rule. A simple line-by-line text scan (`scanner.js:getBlockedAgents`) is sufficient and avoids the complexity of a full `robots-parser` implementation for this narrow requirement. This is faster but less accurate for general robots.txt rule interpretation.
- **Decision 7:** `adm-zip` for Unzipping
  - **Rationale:** Pure JavaScript library for handling ZIP archives, avoiding native dependencies for this specific task. Used to extract the CSV from the downloaded domain list.
- **Decision 8:** Input List Format (`rank,url`)
  - **Rationale:** Changed based on user feedback. Assumes the second column is a full base URL (e.g., `https://www.example.com`).
- **Decision 9:** Simple Schema Migration (`ALTER TABLE`)
  - **Rationale:** Added a check in `db_manager.js` using `PRAGMA table_info` and `ALTER TABLE` to add the `rank` column if missing. This provides basic backward compatibility for existing databases without requiring a full migration framework.

## Core Components & Responsibilities

- **`index.js`:**
  - **Responsibility:** Main entry point. Parses CLI arguments using `yargs` (including `--max-rank` for `scan`), defines commands (`download-list`, `scan`, `query`, `reset-db`), and delegates execution to other modules. Handles basic console output and exit codes.
- **`list_downloader.js`:**
  - **Responsibility:** Handles the logic for downloading the Cisco Umbrella Top 1M list zip file, extracting the `top-1m.csv` using `adm-zip`, and saving it locally.
- **`scanner.js`:**
  - **Responsibility:** Orchestrates the scanning process. Reads URLs and ranks from the specified CSV (format: `rank,url`), filters based on `maxRank`, uses `p-queue` to manage concurrent fetching of `robots.txt` files (via `fetchRobotsTxt` which constructs the correct path from the URL origin), performs basic text parsing to identify blocked agents (`getBlockedAgents`), and calls `db_manager` to store results (robots.txt URL, rank, agents).
- **`db_manager.js`:**
  - **Responsibility:** Manages all interactions with the SQLite database (`robots_data.db`). Initializes the connection, ensures schema exists (`sites` table with `url`, `rank`; `blocked_agents` table; index), performs basic schema migration (adds `rank` column if missing), provides functions for adding scan results within a transaction (`addScanResult`), querying data (`queryBlockedAgentsReport`), resetting the database (`resetDb`), and closing the connection gracefully.

## Important Design Patterns Used

- **Command Pattern:** Implemented via `yargs` where each CLI command (`download-list`, `scan`, etc.) encapsulates a specific action.
- **Transaction Script:** The `addScanResult` function in `db_manager.js` groups database operations (find/insert site with rank, insert agents) into a single atomic transaction.
- **Singleton (implicit):** `db_manager.js` ensures only one connection to the SQLite database is active (`initDb` caches the connection/functions).
- **Queueing:** `scanner.js` uses `p-queue` to manage and limit the concurrency of asynchronous tasks (fetching `robots.txt`).
- **Schema Migration (Simple):** `db_manager.js` uses `PRAGMA table_info` and `ALTER TABLE` for basic, additive schema updates during initialization.

## Critical Implementation Paths / Data Flows

1.  **Download List:** `index.js` (`download-list` command) -> `list_downloader.downloadList` -> Fetch ZIP from URL -> Save ZIP -> Extract CSV using `adm-zip` -> Save `top-1m.csv` -> Delete ZIP.
2.  **Scan URLs:** `index.js` (`scan` command with optional `--max-rank`) -> `scanner.scanSites` -> Read input CSV (`rank,url`) -> Filter by `maxRank` -> For each valid URL: Add task to `p-queue` -> Task executes `fetchRobotsTxt` (constructs `robots.txt` URL from base URL origin, fetches via HTTPS) -> If successful, task executes `getBlockedAgents` (text parse) -> Task executes `db_manager.addScanResult` (transaction: find/insert site with `robots.txt` URL and rank, insert agents into SQLite).
3.  **Query Report:** `index.js` (`query` command) -> `db_manager.initDb` (includes schema migration check) -> `db_manager.queryBlockedAgentsReport` -> Execute SQL `GROUP BY`/`COUNT(*)` query -> Format results -> Print to console.
4.  **Reset Database:** `index.js` (`reset-db` command) -> `db_manager.resetDb` -> Execute SQL `DROP TABLE` commands -> Call `initDb` to recreate tables/indexes (including migration check).

_(This file documents the technical blueprint of the system. It covers the architecture, major technical choices, component breakdown, and common patterns. It helps maintain consistency and understanding of how the system is built.)_
