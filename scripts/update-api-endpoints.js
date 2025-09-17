/**
 * Script to update API endpoints in the frontend to point to Cloudflare Worker
 * This runs during the build process to configure the frontend for production
 */

const fs = require('fs');
const path = require('path');

// Worker URL - this should be configured based on your Worker deployment
const WORKER_URL = process.env.WORKER_URL || 'https://screen-recorder-api.your-account.workers.dev';

// Files to update
const filesToUpdate = [
  'dist/app.js',
  'dist/js/mp4-utils.js'
];

function updateApiEndpoints() {
  console.log('Updating API endpoints to point to Cloudflare Worker...');
  
  filesToUpdate.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${filePath} - file not found`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace relative API endpoints with Worker URLs
    content = content.replace(/fetch\(['"`]\/upload(['"`])/g, `fetch('${WORKER_URL}/upload'`);
    content = content.replace(/fetch\(['"`]\/upload-video(['"`])/g, `fetch('${WORKER_URL}/upload-video'`);
    content = content.replace(/path:\s*['"`]\/recordings\//g, `path: '${WORKER_URL}/recordings/`);
    
    // Update any hardcoded localhost references
    content = content.replace(/http:\/\/localhost:3000/g, WORKER_URL);
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  });

  // Create a configuration file for the frontend
  const config = {
    apiUrl: WORKER_URL,
    environment: process.env.NODE_ENV || 'production',
    buildTime: new Date().toISOString()
  };

  fs.writeFileSync('dist/config.json', JSON.stringify(config, null, 2));
  console.log('Created dist/config.json with API configuration');
}

if (require.main === module) {
  updateApiEndpoints();
}

module.exports = { updateApiEndpoints };