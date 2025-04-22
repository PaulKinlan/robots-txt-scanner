import fetch from "node-fetch";
import fs from "node:fs";
import stream from "node:stream";
import { promisify } from "node:util";
import path from "node:path";
import AdmZip from "adm-zip";
import { fileURLToPath } from "node:url"; // Needed for __dirname replacement

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pipeline = promisify(stream.pipeline); // Promisify stream.pipeline for async/await

const LIST_URL =
  "http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip";
const ZIP_OUTPUT_PATH = path.join(__dirname, "top-1m.csv.zip");
const CSV_OUTPUT_PATH = path.join(__dirname, "top-1m.csv");
const CSV_FILENAME_IN_ZIP = "top-1m.csv";

export async function downloadList() {
  console.log(`Attempting to download list from ${LIST_URL}...`);

  try {
    // 1. Download the zip file
    const response = await fetch(LIST_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to download list: ${response.status} ${response.statusText}`
      );
    }
    if (!response.body) {
      throw new Error("Response body is null");
    }

    console.log("Download started, saving to zip file...");
    await pipeline(response.body, fs.createWriteStream(ZIP_OUTPUT_PATH));
    console.log(`Zip file saved to ${ZIP_OUTPUT_PATH}`);

    // 2. Extract the CSV from the zip
    console.log("Extracting CSV from zip file...");
    const zip = new AdmZip(ZIP_OUTPUT_PATH);
    const zipEntries = zip.getEntries(); // an array of ZipEntry records

    let csvEntry = null;
    for (const entry of zipEntries) {
      if (entry.entryName === CSV_FILENAME_IN_ZIP) {
        csvEntry = entry;
        break;
      }
    }

    if (!csvEntry) {
      throw new Error(
        `Could not find ${CSV_FILENAME_IN_ZIP} inside the downloaded zip file.`
      );
    }

    // Extract the found entry to the target path
    zip.extractEntryTo(csvEntry, __dirname, false, true); // Maintain dir structure=false, overwrite=true
    // AdmZip might extract to a subdirectory based on entry name, ensure it's named correctly
    const extractedPath = path.join(__dirname, csvEntry.entryName);
    if (extractedPath !== CSV_OUTPUT_PATH) {
      // If extracted with a different name (unlikely here but good practice), rename it
      await fs.promises.rename(extractedPath, CSV_OUTPUT_PATH);
    }

    console.log(
      `Successfully extracted ${CSV_FILENAME_IN_ZIP} to ${CSV_OUTPUT_PATH}`
    );

    // 3. Clean up the zip file
    console.log("Cleaning up downloaded zip file...");
    await fs.promises.unlink(ZIP_OUTPUT_PATH);
    console.log("Zip file deleted.");

    console.log("List download and extraction complete.");
  } catch (error) {
    console.error("Error during list download/extraction:", error);
    // Attempt to clean up zip file even if error occurred
    try {
      if (fs.existsSync(ZIP_OUTPUT_PATH)) {
        await fs.promises.unlink(ZIP_OUTPUT_PATH);
        console.log("Cleaned up zip file after error.");
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
    // Re-throw the original error or handle as needed
    throw error; // Propagate error to the caller
  }
}

// No default export, just named export
