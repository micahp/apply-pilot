#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const distPath = path.join(__dirname, '../dist/apps/extension');
const absolutePath = path.resolve(distPath);

const platform = os.platform();

console.log('AutoApply Chrome Extension');
console.log('==========================');
console.log();
console.log('To install the extension in Chrome:');
console.log();
console.log('1. Open Chrome and navigate to chrome://extensions');
console.log('2. Enable "Developer mode" using the toggle in the top right');
console.log('3. Click "Load unpacked"');
console.log('4. Select the following directory:');
console.log();
console.log(`   ${absolutePath}`);
console.log();

// Try to open the extensions page automatically
try {
  console.log('Attempting to open Chrome Extensions page automatically...');
  
  if (platform === 'darwin') {
    // macOS
    execSync('open -a "Google Chrome" chrome://extensions');
    console.log('Chrome Extensions page should now be open.');
  } else if (platform === 'win32') {
    // Windows
    execSync('start chrome chrome://extensions');
    console.log('Chrome Extensions page should now be open.');
  } else if (platform === 'linux') {
    // Linux
    execSync('google-chrome chrome://extensions');
    console.log('Chrome Extensions page should now be open.');
  } else {
    console.log('Automatic opening not supported on your platform. Please open Chrome manually.');
  }
} catch (error) {
  console.error('Could not open Chrome automatically. Please follow the manual steps above.');
}

// Try to open the extension directory
try {
  console.log();
  console.log('Attempting to open the extension directory...');
  
  if (platform === 'darwin') {
    // macOS
    execSync(`open "${absolutePath}"`);
  } else if (platform === 'win32') {
    // Windows
    execSync(`explorer "${absolutePath}"`);
  } else if (platform === 'linux') {
    // Linux
    execSync(`xdg-open "${absolutePath}"`);
  } else {
    console.log('Automatic directory opening not supported on your platform.');
  }
  
  console.log('Extension directory should now be open.');
} catch (error) {
  console.error('Could not open extension directory automatically. Please navigate to it manually.');
}

console.log();
console.log('After installation, the extension should appear in the Chrome toolbar.');
console.log('You can now visit websites like workday.com or greenhouse.io to test the auto-filling functionality.');
console.log();
console.log('Happy job hunting!'); 