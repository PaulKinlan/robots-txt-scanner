# Robots.txt Analyzer CLI

A Node.js command-line tool to download a list of domains, scan their `robots.txt` files, identify disallowed user agents based on simple rules, and store the results in a local SQLite database for querying.

## Features

- **Download Domain List:** Fetches the Cisco Umbrella Top 1 Million domain list (`top-1m.csv.zip`), extracts it, and saves `top-1m.csv`.
- **Scan Domains:** Reads domains from a CSV file, concurrently fetches `robots.txt` files (trying HTTPS then HTTP), performs basic parsing to find user agents listed before any `Disallow:` directive.
- **Store Results:** Saves the site URL and identified blocked user agents into a local SQLite database (`robots_data.db`).
- **Query Data:** Provides a basic report listing user agents and the count of sites where they were found blocked.
- **Reset Database:** Allows clearing all stored scan data.

## Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository_url>
    cd robots-txt
    ```
2.  **Install dependencies:**
    Requires [Node.js](https://nodejs.org/).
    ```bash
    npm install
    ```

## Usage

The tool is run from the command line using `node index.js` followed by a command and any required options.

### Commands

1.  **`download-list`**
    Downloads and extracts the Cisco Umbrella Top 1M list to `top-1m.csv` in the project directory.

    ```bash
    node index.js download-list
    ```

2.  **`scan`**
    Scans domains listed in a CSV file. The CSV file should have the domain name in the second column (e.g., `rank,domain`).

    ```bash
    # Scan using the downloaded list
    node index.js scan -l top-1m.csv

    # Scan using a custom list
    node index.js scan --list path/to/your/domain_list.csv
    ```

    - `-l`, `--list`: (Required) Path to the CSV file containing domain names.

3.  **`query`**
    Queries the database for stored information. Currently supports one report type.

    ```bash
    node index.js query --report blocked-agents
    ```

    - `-r`, `--report`: (Required) Type of report. Currently only `blocked-agents` is supported.

4.  **`reset-db`**
    Deletes all data from the `sites` and `blocked_agents` tables in the database. **Use with caution!**

    ```bash
    node index.js reset-db
    ```

    _(Note: Currently lacks an interactive confirmation prompt.)_

5.  **`help`**
    Displays help information about commands and options.
    ```bash
    node index.js --help
    node index.js <command> --help
    ```

### Example Workflow

```bash
# 1. Download the list (only needed once initially or to update)
node index.js download-list

# 2. Scan the domains in the list
node index.js scan -l top-1m.csv

# 3. Query the results
node index.js query --report blocked-agents

# 4. (Optional) Reset the database if needed
# node index.js reset-db
```

## Technical Details

- **Language:** Node.js (ES Modules)
- **Database:** SQLite (`robots_data.db`)
- **Key Libraries:** `yargs`, `node-fetch`, `p-queue`, `better-sqlite3`, `adm-zip`
- **Concurrency:** Uses `p-queue` to manage concurrent `robots.txt` fetches (default: 50).
- **Parsing:** Uses basic text parsing to identify user agents listed before _any_ `Disallow:` rule. It does **not** perform full, complex `robots.txt` rule evaluation.
