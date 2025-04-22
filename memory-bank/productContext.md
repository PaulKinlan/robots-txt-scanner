# Product Context: Robots.txt Analyzer CLI

## Problem Statement

- Understanding which web crawlers (user agents) are commonly blocked by websites via `robots.txt` requires analyzing these files across many domains. Manually checking is impractical at scale.
- There's a need for a simple tool to automate the process of fetching `robots.txt` files, identifying blocked agents based on basic rules, and aggregating this data for analysis.

## Target Audience

- **Primary:** Developers, researchers, or data analysts interested in web crawling patterns, SEO, or large-scale website configurations.
- **Needs:** An efficient way to gather data on `robots.txt` directives, specifically focusing on disallowed user agents, across a large set of domains (like the top 1 million).

## User Experience Goals

- **Efficiency:** The tool should quickly process large lists of domains. Concurrency is key.
- **Simplicity:** The CLI should be straightforward to use with clear commands and options.
- **Transparency:** The tool should provide feedback during operation (downloading, scanning progress, errors).
- **Data Accessibility:** Stored results should be easily queryable via the CLI for basic reporting.

## Key Features & Functionality (from a user perspective)

- **Download Domain List:** Automatically fetch and prepare the Cisco Umbrella Top 1M domain list for scanning.
- **Scan Domains:** Process a list of domains, fetch their `robots.txt`, identify blocked user agents, and store the findings.
- **Query Results:** Retrieve a summary report showing which user agents are most frequently blocked across the scanned sites.
- **Reset Data:** Easily clear the stored scan results to start fresh.

## Success Metrics

- **Task Completion Rate:** Users can successfully download the list, scan domains, and query results without critical errors.
- **Scalability:** The tool can handle scanning a significant portion of the 1 million domains list within a reasonable timeframe.
- **Data Utility:** The generated "blocked-agents" report provides meaningful insights into common `robots.txt` practices.

_(This file focuses on the 'why' and 'who'. It explains the purpose of the project, the users it serves, and the desired experience. It connects the technical work back to the product and business goals.)_
