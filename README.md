
## Script to copy "RetrieveAllComponents.js"

```javascript
const { exec } = require('child_process');
const fs = require('fs');

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
    }
  }
  return params;
}

// Get command-line arguments
const args = process.argv.slice(2);
const { orgAlias, metadataJsonFile } = parseArgs(args);

if (!orgAlias || !metadataJsonFile) {
  console.error('Usage: node RetrieveAllComponents.js --target-org <orgAlias> --output-file <metadataJsonFile>');
  process.exit(1); // Exit with failure
}

// Function to execute the listMetadataTypes command
function listMetadataTypes(orgAlias, metadataJsonFile) {
  const command = `sf org list metadata-types --api-version 57.0 --target-org ${orgAlias} --output-file ${metadataJsonFile}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing listMetadataTypes: ${error.message}`);
      return;
    }

    if (stderr) {
      console.error(`Error output from listMetadataTypes: ${stderr}`);
      return;
    }

    console.log(`Successfully generated ${metadataJsonFile}`);
    processMetadataFile(metadataJsonFile, orgAlias);
  });
}

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

      metadataObjects.forEach((metadataObject, i) => {
        const xmlName = metadataObject.xmlName;
        if (xmlName) {
          retrieveMetadata(xmlName, orgAlias);
        } else {
          console.warn(`No xmlName found for metadataObject at index ${i}`);
        }
      });

    } catch (parseErr) {
      console.error(`Error parsing JSON file: ${parseErr.message}`);
    }
  });
}

// Function to execute the retrieve command for each metadata type
function retrieveMetadata(xmlName, orgAlias) {
  const command = `sf project retrieve start --metadata ${xmlName} -o ${orgAlias}`;
  try {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error retrieving metadata for ${xmlName}: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Error output during metadata retrieval for ${xmlName}: ${stderr}`);
        return;
      }
      console.log(`Successfully retrieved metadata for ${xmlName}: ${stdout}`);
    });
  } catch (err) {
    console.log('------ ' + err.message);
  }
}

// Start the process by calling listMetadataTypes
listMetadataTypes(orgAlias, metadataJsonFile);
```

## Run Locally

```bash
node RetrieveAllComponents.js --target-org PROD_ALIAS --output-file PROD_06_Sept_2024_metadataJsonFile.json
```