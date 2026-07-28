const { exec } = require('child_process');
const fs = require('fs');

// Default max stdout/stderr buffer for each `sf` retrieve, in megabytes.
// Overridable via the --max-buffer flag or the SF_RETRIEVE_MAX_BUFFER_MB env var.
const DEFAULT_MAX_BUFFER_MB = 100;

// Default number of `sf` retrieves to run at the same time.
// Overridable via the --concurrency flag or the SF_RETRIEVE_CONCURRENCY env var.
const DEFAULT_CONCURRENCY = 5;

// Custom function to parse command-line arguments with flags
function parseArgs(args) {
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target-org' && i + 1 < args.length) {
      params.orgAlias = args[i + 1];
      i++; // Skip the next argument as it's the value for the flag
    } else if (args[i] === '--output-file' && i + 1 < args.length) {
      params.metadataJsonFile = args[i + 1];
      i++; // Skip the next argument as it's the value for the flag
    } else if (args[i] === '--max-buffer' && i + 1 < args.length) {
      params.maxBufferMb = args[i + 1];
      i++; // Skip the next argument as it's the value for the flag
    } else if (args[i] === '--concurrency' && i + 1 < args.length) {
      params.concurrency = args[i + 1];
      i++; // Skip the next argument as it's the value for the flag
    }
  }
  return params;
}

// Get command-line arguments
const args = process.argv.slice(2);
const { orgAlias, metadataJsonFile, maxBufferMb, concurrency } = parseArgs(args);

if (!orgAlias || !metadataJsonFile) {
  console.error('Usage: node DownloadAllComponents.js --target-org <orgAlias> --output-file <metadataJsonFile> [--max-buffer <MB>] [--concurrency <N>]');
  process.exit(1); // Exit with failure
}

// Resolve the max buffer size (precedence: CLI flag > env var > default).
const resolvedMaxBufferMb = Number(maxBufferMb || process.env.SF_RETRIEVE_MAX_BUFFER_MB || DEFAULT_MAX_BUFFER_MB);
if (!Number.isFinite(resolvedMaxBufferMb) || resolvedMaxBufferMb <= 0) {
  console.error(`Invalid --max-buffer value: ${maxBufferMb || process.env.SF_RETRIEVE_MAX_BUFFER_MB}. Must be a positive number of megabytes.`);
  process.exit(1);
}
const MAX_BUFFER_BYTES = Math.floor(resolvedMaxBufferMb * 1024 * 1024);
console.log(`Using max stdout buffer of ${resolvedMaxBufferMb} MB per retrieve.`);

// Resolve the concurrency limit (precedence: CLI flag > env var > default).
const resolvedConcurrency = Number(concurrency || process.env.SF_RETRIEVE_CONCURRENCY || DEFAULT_CONCURRENCY);
if (!Number.isInteger(resolvedConcurrency) || resolvedConcurrency <= 0) {
  console.error(`Invalid --concurrency value: ${concurrency || process.env.SF_RETRIEVE_CONCURRENCY}. Must be a positive integer.`);
  process.exit(1);
}
const CONCURRENCY = resolvedConcurrency;
console.log(`Running up to ${CONCURRENCY} retrieve(s) at a time.`);

// Function to read the JSON file and iterate through metadataObjects
function processMetadataFile(metadataJsonFile, orgAlias) {
  fs.readFile(metadataJsonFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${metadataJsonFile}: ${err.message}`);
      return;
    }

    try {
      const metadata = JSON.parse(data);
      const metadataObjects = metadata.metadataObjects;

      if (!metadataObjects || metadataObjects.length === 0) {
        console.error('No metadataObjects found in the file.');
        return;
      }

      // Collect the metadata types to retrieve, warning on any missing xmlName.
      const xmlNames = [];
      metadataObjects.forEach((metadataObject, i) => {
        const xmlName = metadataObject.xmlName;
        if (xmlName) {
          xmlNames.push(xmlName);
        } else {
          console.warn(`No xmlName found for metadataObject at index ${i}`);
        }
      });

      // Retrieve them with a bounded number of concurrent `sf` processes.
      runWithConcurrency(xmlNames, orgAlias, CONCURRENCY).then(() => {
        console.log('All retrievals complete.');
      });

    } catch (parseErr) {
      console.error(`Error parsing JSON file: ${parseErr.message}`);
    }
  });
}

// Run retrieves through a fixed-size worker pool so that no more than
// `limit` `sf` processes are ever in flight at once.
function runWithConcurrency(xmlNames, orgAlias, limit) {
  let nextIndex = 0;

  function worker() {
    if (nextIndex >= xmlNames.length) {
      return Promise.resolve();
    }
    const xmlName = xmlNames[nextIndex++];
    console.log(`Starting to retrieve ${xmlName}`);
    // Chain onto the next item once this one settles, keeping the slot busy.
    return retrieveMetadata(xmlName, orgAlias).then(worker);
  }

  // Start `limit` workers that each pull from the shared queue until it's empty.
  const workerCount = Math.min(limit, xmlNames.length);
  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  return Promise.all(workers);
}

// Function to execute the retrieve command for each metadata type.
// Resolves (never rejects) so one failed retrieve doesn't halt the pool.
function retrieveMetadata(xmlName, orgAlias) {
  const command = `sf project retrieve start --metadata ${xmlName} -o ${orgAlias}`;
  return new Promise((resolve) => {
    try {
      exec(command, { maxBuffer: MAX_BUFFER_BYTES }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error retrieving metadata for ${xmlName}: ${error.message}`);
          return resolve();
        }
        if (stderr) {
          console.error(`Error output during metadata retrieval for ${xmlName}: ${stderr}`);
          return resolve();
        }
        console.log(`Successfully retrieved metadata for ${xmlName}: ${stdout}`);
        resolve();
      });
    } catch (err) {
      console.log('------ ' + err.message);
      resolve();
    }
  });
}

processMetadataFile(metadataJsonFile, orgAlias);
