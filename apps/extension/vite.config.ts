import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

const completeManifest = {
  manifest_version: 3,
  name: 'AutoApply',
  version: '0.1.0',
  description: 'Automatically fill out job applications on various ATS platforms',
  permissions: [
    'storage',
    'activeTab',
    'scripting'
  ],
  host_permissions: [
    '*://workday.com/*',
    '*://*.workday.com/*',
    '*://greenhouse.io/*',
    '*://*.greenhouse.io/*',
    '*://lever.co/*',
    '*://*.lever.co/*',
    '*://taleo.net/*',
    '*://*.taleo.net/*',
    '*://*.ashbyhq.com/*',
    '*://*.workable.com/*',
    '*://*.icims.com/*'
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'assets/s1.png',
      '48': 'assets/s2.png',
      '128': 'assets/s3.png'
    }
  },
  icons: {
    '16': 'assets/s1.png',
    '48': 'assets/s2.png',
    '128': 'assets/s3.png'
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background.ts', // Assuming CRXJS handles .ts -> .js for service worker
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        '*://workday.com/*',
        '*://*.workday.com/*',
        '*://greenhouse.io/*',
        '*://*.greenhouse.io/*',
        '*://lever.co/*',
        '*://*.lever.co/*',
        '*://taleo.net/*',
        '*://*.taleo.net/*',
        '*://*.ashbyhq.com/*',
        '*://*.workable.com/*',
        '*://*.icims.com/*'
      ],
      js: ['src/content.ts'], // Assuming CRXJS handles .ts -> .js for content scripts
      css: ['content.css']
    }
  ]
  // web_accessible_resources might be needed if not automatically handled by CRXJS
  // based on content script output or other assets.
  // Add it here if your build fails or if resources are not accessible.
};

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: completeManifest as any }), // Use 'as any' if TS complains about complex manifest type
    {
      name: 'copy-assets',
      apply: 'build',
      enforce: 'post',
      closeBundle() {
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
        
        // Copy asset files
        const sourceAssetDir = path.resolve(__dirname, 'assets');
        const destAssetDir = path.resolve(__dirname, outDir, 'assets');
        
        try {
          // Create assets directory if it doesn't exist
          if (!fs.existsSync(destAssetDir)) {
            fs.mkdirSync(destAssetDir, { recursive: true });
          }
          
          // Copy each asset file
          const assetFiles = fs.readdirSync(sourceAssetDir);
          for (const file of assetFiles) {
            if (file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
              fs.copyFileSync(
                path.resolve(sourceAssetDir, file),
                path.resolve(destAssetDir, file)
              );
              console.log(`Copied asset: ${file}`);
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