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
- **Rate Limiting:** High concurrency (`CONCURRENCY = 50` in `scanner.js`) might trigger rate limiting or temporary blocks from target web servers.
- **`robots.txt` Variations:** The basic text parsing in `getBlockedAgents` might misinterpret complex or non-standard `robots.txt` files. It only checks for `User-agent:` followed by any `Disallow:`, not specific rules or `Allow:` directives.
- **Storage:** The SQLite database (`robots_data.db`) will grow depending on the number of sites scanned and the number of unique blocked agents found. Could become large if scanning the full 1M list.
- **Error Handling:** Relies on basic try/catch blocks and console logging. More robust error handling or reporting could be added.
- **User Agent:** Uses a generic `RobotsTxtAnalyzerBot/1.0` user agent. Some sites might block generic or unknown bots.

## Dependencies & Integrations

- **Internal Dependencies:** Modules depend on each other (`index.js` uses `list_downloader`, `scanner`, `db_manager`; `scanner` uses `db_manager`).
- **External APIs/Services:**
  - `http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip`: Source for the Cisco Umbrella domain list.
  - Various external web servers hosting `robots.txt` files for the domains being scanned.

## Tool Usage Patterns

- **Execution:** Run via `node index.js <command>` or `./index.js <command>`.
- **Workflow:**
  1.  (Optional) `node index.js download-list` to get/update `top-1m.csv`.
  2.  `node index.js scan -l top-1m.csv` (or other list) to populate the database.
  3.  `node index.js query --report blocked-agents` to view results.
  4.  (Optional) `node index.js reset-db` to clear data.
- **Database:** `robots_data.db` is created/managed automatically in the project directory.

_(This file details the 'how' from a technical perspective. It lists the specific technologies, setup instructions, constraints, and dependencies necessary to work on the project.)_
