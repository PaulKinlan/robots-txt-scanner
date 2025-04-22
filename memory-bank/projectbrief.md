# Project Brief: Robots.txt Analyzer CLI

## Core Requirements

- Download a list of top domains (specifically, the Cisco Umbrella Top 1M list).
- Scan the `robots.txt` file for each domain in a provided list.
- Identify and store user agents that are disallowed by any rule within the `robots.txt` files.
- Store the scan results (site URL, blocked user agents) persistently in a local database.
- Provide a command-line interface (CLI) to trigger these actions (download, scan).
- Provide a CLI command to query the stored data (e.g., report on frequently blocked user agents).
- Provide a CLI command to reset the database.

## Goals

- Create a tool for analyzing `robots.txt` files at scale.
- Understand which user agents are commonly blocked across a large set of websites.
- Provide a simple CLI for users to perform these tasks.
- Use a local database for efficient data storage and querying.

## Scope

- **In Scope:**
  - Downloading the Cisco Umbrella Top 1M list (`top-1m.csv.zip`).
  - Parsing a CSV list of domains (format: `rank,domain`).
  - Fetching `robots.txt` via HTTPS and HTTP.
  - Basic parsing of `robots.txt` to identify any `User-agent:` followed by a `Disallow:`.
  - Storing results in an SQLite database (`robots_data.db`).
  - CLI commands: `download-list`, `scan -l <list>`, `query --report blocked-agents`, `reset-db`.
  - Using Node.js with ES Modules.
  - Concurrent scanning using `p-queue`.
- **Out of Scope:**
  - Complex `robots.txt` rule interpretation (e.g., Allow rules, path specificity, wildcard matching beyond simple identification).
  - Analysis of `Sitemap:` directives.
  - Graphical User Interface (GUI).
  - Distributed scanning or cloud deployment.
  - Authentication or handling sites requiring login.
  - Advanced reporting beyond the current "blocked-agents" query.
  - Real-time monitoring.

## Key Stakeholders

- Developer(s) using the tool for research or analysis.
- Potentially SEO professionals or web analysts interested in crawler behavior.

_(This file serves as the foundation for the project. Define the essential requirements, objectives, and boundaries here. It should be the source of truth for what the project aims to achieve.)_
