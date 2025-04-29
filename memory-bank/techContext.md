# Technical Context: Robots.txt Analyzer CLI

## Core Technologies

- **Language(s):** JavaScript (Node.js, using ES Modules syntax `import`/`export`)
- **Framework(s):** None (primarily uses libraries)
- **Database(s):** SQLite (via `better-sqlite3`)
- **Key Libraries:**
  - `yargs`: CLI argument parsing and command handling.
  - `node-fetch`: Making HTTP/HTTPS requests.
  - `p-queue`: Managing concurrency for network requests.
  - `better-sqlite3`: Interacting with the SQLite database.
  - `adm-zip`: Handling ZIP file extraction.
  - `robots-parser`: Included as a dependency in `package.json`, but core logic in `scanner.js` uses manual text parsing for identifying blocked agents. _Note: The library itself is not currently used for rule evaluation._
- **Runtime Environment:** Node.js (version compatibility likely depends on dependencies, but modern features like ESM are used).

## Development Environment Setup

- **Package Manager:** npm (implied by `package.json` and `package-lock.json`)
- **Build Tools:** None explicitly defined (no build step in scripts).
- **Linters/Formatters:** None explicitly defined in `package.json` scripts or dependencies.
- **Testing Frameworks:** None defined (`"test": "echo \"Error: no test specified\" && exit 1"`).
- **Key Setup Steps:**
  1.  `git clone <repository_url>` (Assuming source is in git)
  2.  `npm install` (To install dependencies listed in `package.json`)
  3.  Run commands via `node index.js <command> [options]` or potentially set up execution permissions (`chmod +x index.js`) and run as `./index.js <command> [options]`.

## Technical Constraints & Considerations

- **Network Dependency:** Relies heavily on external network access to download the domain list and fetch `robots.txt` files. Network errors, timeouts, and server availability will impact operation.
- **Rate Limiting/Memory Usage:** High concurrency (`CONCURRENCY` was 50, now reduced to 10 in `scanner.js` to mitigate heap memory issues) might trigger rate limiting or temporary blocks from target web servers. Lower concurrency reduces memory pressure but slows the scan.
- **`robots.txt` Variations:** The basic text parsing in `getBlockedAgents` might misinterpret complex or non-standard `robots.txt` files. It only checks for `User-agent:` followed by any `Disallow:`, not specific rules or `Allow:` directives.
- **Storage:** The SQLite database (`robots_data.db`) will grow depending on the number of sites scanned and the number of unique blocked agents found. Could become large if scanning the full 1M list. The `sites` table includes `id`, `url` (for the robots.txt path), and `rank`.
- **Error Handling:** Relies on basic try/catch blocks and console logging. More robust error handling or reporting could be added.
- **User Agent:** Uses a generic `RobotsTxtAnalyzerBot/1.0` user agent. Some sites might block generic or unknown bots.
- **Input Format Assumption:** The `scan` command assumes the input CSV list has the format `rank,url` (e.g., `1,https://www.example.com`).
- **Schema Migration:** Uses a simple additive migration approach in `db_manager.js`. It checks for the existence of the `rank` column in the `sites` table using `PRAGMA table_info` and adds it via `ALTER TABLE` if missing. This handles running against older database files but doesn't support more complex migrations (like renaming or deleting columns).

## Dependencies & Integrations

- **Internal Dependencies:** Modules depend on each other (`index.js` uses `list_downloader`, `scanner`, `db_manager`; `scanner` uses `db_manager`).
- **External APIs/Services:**
  - `http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip`: Source for the Cisco Umbrella domain list.
  - Various external web servers hosting `robots.txt` files for the domains being scanned.

## Tool Usage Patterns

- **Execution:** Run via `node index.js <command>` or `./index.js <command>`.
- **Workflow:**
  1.  (Optional) `node index.js download-list` to get/update `top-1m.csv` (Note: This list might need reformatting to `rank,url` if it's not already).
  2.  `node index.js scan -l <your-list.csv>` (where CSV is `rank,url` format) with optional `--max-rank <number>` to populate the database.
  3.  `node index.js query --report blocked-agents` or `node index.js query --report no-blocked-agents` to view results.
  4.  (Optional) `node index.js reset-db` to clear data.
- **Database:** `robots_data.db` is created/managed automatically in the project directory. Schema changes (like adding the `rank` column) are handled automatically on initialization if needed.

_(This file details the 'how' from a technical perspective. It lists the specific technologies, setup instructions, constraints, and dependencies necessary to work on the project.)_
