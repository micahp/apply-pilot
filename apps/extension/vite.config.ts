import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { manifest } from './manifest';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'prepare-favicon-icons',
      configResolved() {
        // Generate favicon-based icons before the build starts
        const faviconDir = path.resolve(__dirname, '../../favicon');
        const sourceAssetDir = path.resolve(__dirname, 'assets');
        
        // Create assets directory if it doesn't exist
        if (!fs.existsSync(sourceAssetDir)) {
          fs.mkdirSync(sourceAssetDir, { recursive: true });
        }
        
        // Generate properly sized icons synchronously
        const faviconBase = path.resolve(faviconDir, 'favicon-96x96.png');
        
        if (fs.existsSync(faviconBase)) {
          const iconSizes = [
            { size: 16, output: 'icon-16.png' },
            { size: 48, output: 'icon-48.png' },
            { size: 128, output: 'icon-128.png' }
          ];
          
          try {
            // Use sharp synchronously to generate icons in source assets
            const sharp = require('sharp');
            
            for (const { size, output } of iconSizes) {
              const outputPath = path.resolve(sourceAssetDir, output);
              const imageBuffer = sharp(faviconBase)
                .resize(size, size)
                .png()
                .toBufferSync();
              
              fs.writeFileSync(outputPath, imageBuffer);
              console.log(`Pre-generated source icon: ${output} (${size}x${size})`);
            }
          } catch (err) {
            console.log('Sharp not available for pre-generation, using fallback');
            // Fallback: just copy the base favicon
            for (const { output } of iconSizes) {
              fs.copyFileSync(faviconBase, path.resolve(sourceAssetDir, output));
              console.log(`Fallback: copied base favicon as source ${output}`);
            }
          }
        }
      }
    },
    crx({ manifest }),
    {
      name: 'copy-assets',
      apply: 'build',
      enforce: 'post',
      async closeBundle() {
        const outDir = '../../dist/apps/extension';
        
        // Ensure directories exist
        if (!fs.existsSync(path.resolve(__dirname, outDir, 'assets'))) {
          fs.mkdirSync(path.resolve(__dirname, outDir, 'assets'), { recursive: true });
        }
        
        // Copy content.css to the root level of the extension
        try {
          fs.copyFileSync(
            path.resolve(__dirname, 'src/content.css'),
            path.resolve(__dirname, outDir, 'content.css')
          );
          console.log('Successfully copied content.css to root');
        } catch (err) {
          console.error('Failed to copy content.css:', err);
        }
        
        // Copy asset files and favicon conversion
        const sourceAssetDir = path.resolve(__dirname, 'assets');
        const destAssetDir = path.resolve(__dirname, outDir, 'assets');
        const faviconDir = path.resolve(__dirname, '../../favicon');
        
        try {
          // Create assets directory if it doesn't exist
          if (!fs.existsSync(destAssetDir)) {
            fs.mkdirSync(destAssetDir, { recursive: true });
          }
          
          // Copy existing asset files
          const assetFiles = fs.readdirSync(sourceAssetDir);
          for (const file of assetFiles) {
            if (file.match(/\.(png|jpg|jpeg|gif|svg)$/i) && !file.startsWith('icon')) {
              fs.copyFileSync(
                path.resolve(sourceAssetDir, file),
                path.resolve(destAssetDir, file)
              );
              console.log(`Copied asset: ${file}`);
            }
          }
          
          // Copy favicon files for extension icons
          const faviconFiles = [
            { src: 'favicon.ico', dest: 'favicon.ico' },
            { src: 'favicon.svg', dest: 'favicon.svg' },
            { src: 'favicon-96x96.png', dest: 'icon-96.png' },
            { src: 'web-app-manifest-192x192.png', dest: 'icon-192.png' },
            { src: 'web-app-manifest-512x512.png', dest: 'icon-512.png' }
          ];
          
          for (const { src, dest } of faviconFiles) {
            const srcPath = path.resolve(faviconDir, src);
            const destPath = path.resolve(destAssetDir, dest);
            if (fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, destPath);
              console.log(`Copied favicon: ${src} -> ${dest}`);
            }
          }
          
          // Generate properly sized icons from favicon
          const faviconBase = path.resolve(faviconDir, 'favicon-96x96.png');
          
          if (fs.existsSync(faviconBase)) {
            const iconSizes = [
              { size: 16, output: 'icon-16.png' },
              { size: 48, output: 'icon-48.png' },
              { size: 128, output: 'icon-128.png' }
            ];
            
                         // Try to use sharp for cross-platform image resizing
                         try {
              const sharp = (await import('sharp')).default || (await import('sharp'));
             
             for (const { size, output } of iconSizes) {
                const outputPath = path.resolve(destAssetDir, output);
                await sharp(faviconBase)
                  .resize(size, size)
                  .png()
                  .toFile(outputPath);
                console.log(`Generated icon: ${output} (${size}x${size}) using sharp`);
              }
            } catch (sharpErr) {
              console.log('Sharp not available, trying sips (macOS)...');
              
                             // Fallback to sips on macOS
              
              for (const { size, output } of iconSizes) {
                try {
                  const outputPath = path.resolve(destAssetDir, output);
                  
                  await new Promise((resolve, reject) => {
                    const sipsProcess = spawn('sips', [
                      '-z', size.toString(), size.toString(),
                      faviconBase,
                      '--out', outputPath
                    ], { stdio: 'inherit' });
                    
                    sipsProcess.on('close', (code) => {
                      if (code === 0) {
                        console.log(`Generated icon: ${output} (${size}x${size}) using sips`);
                        resolve(code);
                      } else {
                        reject(new Error(`sips failed with code ${code}`));
                      }
                    });
                  });
                } catch (err) {
                  console.error(`Failed to generate ${output}:`, err);
                  // As final fallback, just copy the base favicon
                  fs.copyFileSync(faviconBase, path.resolve(destAssetDir, output));
                  console.log(`Fallback: copied base favicon as ${output}`);
                }
              }
            }
          }
          
        } catch (err) {
          console.error('Failed to copy assets:', err);
        }
        
        // Copy PDF.js worker file to the ROOT of the extension
        try {
          // First try to find it in node_modules
          let pdfWorkerPaths = [
            path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.min.js'),
            path.resolve(__dirname, '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js'),
            path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js')
          ];
          
          let pdfWorkerFound = false;
          
          for (const pdfWorkerPath of pdfWorkerPaths) {
            if (fs.existsSync(pdfWorkerPath)) {
              // Copy to the extension root directory as required by Chrome extensions
              const destWorkerPath = path.resolve(__dirname, outDir, 'pdf.worker.min.js');
              fs.copyFileSync(pdfWorkerPath, destWorkerPath);
              console.log(`Successfully copied PDF.js worker from ${pdfWorkerPath} to extension root`);
              pdfWorkerFound = true;
              break;
            }
          }
          
          if (!pdfWorkerFound) {
            console.error('PDF.js worker file not found in any of the expected locations');
            console.error('Attempting to find it in node_modules...');
            
            // Try to locate the file in node_modules recursively
            const nodeModulesPath = path.resolve(__dirname, '../../node_modules');
            const findWorkerFile = (dir: string): string | null => {
              const files = fs.readdirSync(dir);
              
              for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && file !== 'node_modules') {
                  const found = findWorkerFile(filePath);
                  if (found) return found;
                } else if (file === 'pdf.worker.min.js') {
                  return filePath;
                }
              }
              
              return null;
            };
            
            const workerPath = findWorkerFile(nodeModulesPath);
            if (workerPath) {
              const destWorkerPath = path.resolve(__dirname, outDir, 'pdf.worker.min.js');
              fs.copyFileSync(workerPath, destWorkerPath);
              console.log(`Successfully copied PDF.js worker from ${workerPath} to extension root`);
            } else {
              console.error('PDF.js worker file not found in node_modules');
            }
          }
        } catch (err) {
          console.error('Failed to copy PDF.js worker file:', err);
        }
      }
    }
  ],
  build: {
    outDir: '../../dist/apps/extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        jobs: resolve(__dirname, 'src/jobs/index.html'),
      },
      output: {
        entryFileNames: 'src/[name].js',
        chunkFileNames: 'src/chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          
          if (/\.(png|jpe?g|gif|svg|webp)$/.test(name)) {
            return 'src/assets/[name][extname]';
          }
          
          return `src/[name][extname]`;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
}); 