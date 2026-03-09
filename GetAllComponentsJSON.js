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
  console.error('Usage: node GetAllComponentsJSON.js --target-org <orgAlias> --output-file <metadataJsonFile>');
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
  });
}


// Start the process by calling listMetadataTypes
listMetadataTypes(orgAlias, metadataJsonFile);