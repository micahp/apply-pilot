const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sizes = [16, 48, 128];
const inputSvg = path.join(__dirname, '../apps/extension/src/assets/icon.svg');
const outputDir = path.join(__dirname, '../dist/apps/extension/assets');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to create a base64 encoded 1x1 pixel PNG in the specified color
function createPlaceholderPNG(size, color = '#4285f4') {
  // Base64 encoded 1x1 pixel PNG template
  const base64Template = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(base64Template, 'base64');
  
  // Create a placeholder PNG file
  const outputPath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created placeholder ${outputPath}`);
}

// Try to use ImageMagick, fall back to placeholders if not available
try {
  // Check if imagemagick is installed
  execSync('which convert');
  
  // Convert SVG to PNG for each size
  sizes.forEach(size => {
    const outputPath = path.join(outputDir, `icon${size}.png`);
    const command = `convert -background none -size ${size}x${size} ${inputSvg} ${outputPath}`;
    
    try {
      execSync(command);
      console.log(`Created ${outputPath}`);
    } catch (error) {
      console.error(`Error creating icon${size}.png:`, error.message);
      // Fall back to placeholder if conversion fails
      createPlaceholderPNG(size);
    }
  });
} catch (error) {
  console.warn('ImageMagick is not installed. Creating placeholder icons instead.');
  console.warn('For better icons, install ImageMagick:');
  console.warn('On macOS: brew install imagemagick');
  console.warn('On Ubuntu/Debian: sudo apt-get install imagemagick');
  
  // Create placeholder icons
  sizes.forEach(size => {
    createPlaceholderPNG(size);
  });
}

// Copy the SVG to the output directory as well
try {
  fs.copyFileSync(inputSvg, path.join(outputDir, 'icon.svg'));
  console.log('Copied SVG icon');
} catch (error) {
  console.error('Error copying SVG icon:', error.message);
}

console.log('Icon generation complete!'); 