## Run RetrieveAllComponents script
node RetrieveAllComponents.js  --target-org Dorma_PROD --output-file Dorma_PROD_06_Sept_2024_metadataJsonFileV3.json

## Create a SFDX project if it is already not an SFDX project
sf project generate --name=RetrieveAllComponents