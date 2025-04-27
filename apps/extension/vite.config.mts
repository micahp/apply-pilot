import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import fs from 'fs';
import { readFileSync } from 'fs';

// Define manifest manually to ensure correct format
const manifest = JSON.parse(
  readFileSync(resolve(__dirname, 'manifest.json'), 'utf8')
);

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'make-html',
      buildEnd() {
        // Ensure directories exist
        const projectRoot = resolve(__dirname, '..', '..');
        const outDir = resolve(projectRoot, 'dist', 'apps', 'extension');
        
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        
        const assetsDir = resolve(outDir, 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }
      }
    },
    {
      name: 'copy-files',
      closeBundle() {
        const projectRoot = resolve(__dirname, '..', '..');
        const outDir = resolve(projectRoot, 'dist', 'apps', 'extension');
        const assetsDir = resolve(outDir, 'assets');
        
        // Copy manifest
        fs.copyFileSync(resolve(__dirname, 'manifest.json'), resolve(outDir, 'manifest.json'));
        
        // Copy CSS
        fs.copyFileSync(resolve(__dirname, 'content.css'), resolve(outDir, 'content.css'));
        
        // Create simple background.js
        fs.writeFileSync(resolve(outDir, 'background.js'), `
          // Background script
          chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'GET_FIELD_MAP') {
              const fieldMaps = {
                'workday': {
                  'firstName': '#first-name',
                  'lastName': '#last-name',
                  'email': '#email',
                  'phone': '#phone'
                },
                'greenhouse': {
                  'firstName': '#first_name',
                  'lastName': '#last_name',
                  'email': '#email',
                  'phone': '#phone'
                }
              };
              sendResponse(fieldMaps[message.platform] || {});
              return true;
            }
          });
        `);
        
        // Create simple content.js
        fs.writeFileSync(resolve(outDir, 'content.js'), `
          // Content script
          (function() {
            function detectAts() {
              const url = window.location.href.toLowerCase();
              
              if (url.includes('workday.com')) {
                return 'workday';
              } else if (url.includes('greenhouse.io')) {
                return 'greenhouse';
              }
              
              return null;
            }
            
            async function fillFields(fieldMap) {
              const profile = await new Promise(resolve => {
                chrome.storage.local.get('profile', result => {
                  resolve(result.profile || {});
                });
              });
              
              if (!profile || !profile.personal) return 0;
              
              let filledCount = 0;
              
              for (const [key, selector] of Object.entries(fieldMap)) {
                const value = profile.personal[key];
                if (!value) continue;
                
                const element = document.querySelector(selector);
                if (element && element.tagName === 'INPUT') {
                  element.value = value;
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  filledCount++;
                }
              }
              
              return filledCount;
            }
            
            function init() {
              const platform = detectAts();
              if (!platform) return;
              
              chrome.runtime.sendMessage({ type: 'GET_FIELD_MAP', platform }, fieldMap => {
                if (!fieldMap) return;
                
                const panel = document.createElement('div');
                panel.className = 'auto-apply-panel';
                panel.textContent = 'AutoApply: Filling fields...';
                document.body.appendChild(panel);
                
                fillFields(fieldMap).then(count => {
                  panel.textContent = \`Filled \${count} fields\`;
                });
              });
            }
            
            init();
          })();
        `);
        
        // Create basic html file
        fs.writeFileSync(resolve(outDir, 'popup.html'), `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>AutoApply</title>
            <style>
              body {
                width: 300px;
                padding: 10px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              }
              h1 {
                font-size: 18px;
                margin-bottom: 16px;
              }
              .btn {
                background: #4285f4;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
              }
              #profile-form {
                display: none;
              }
              .form-field {
                margin-bottom: 12px;
              }
              .form-field label {
                display: block;
                margin-bottom: 4px;
                font-size: 14px;
              }
              .form-field input {
                width: 100%;
                padding: 6px;
                border: 1px solid #ddd;
                border-radius: 4px;
              }
              #profile-display {
                background: #f8f9fa;
                border-radius: 4px;
                padding: 12px;
                margin-top: 16px;
              }
              .field {
                margin-bottom: 8px;
              }
              .field-label {
                font-size: 12px;
                color: #666;
              }
              .field-value {
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <h1>AutoApply</h1>
            
            <div id="profile-display">
              <p>No profile data yet. Please create your profile.</p>
            </div>
            
            <button class="btn" id="toggle-form">Edit Profile</button>
            
            <form id="profile-form">
              <div class="form-field">
                <label for="firstName">First Name</label>
                <input type="text" id="firstName" name="firstName">
              </div>
              
              <div class="form-field">
                <label for="lastName">Last Name</label>
                <input type="text" id="lastName" name="lastName">
              </div>
              
              <div class="form-field">
                <label for="email">Email</label>
                <input type="email" id="email" name="email">
              </div>
              
              <div class="form-field">
                <label for="phone">Phone</label>
                <input type="tel" id="phone" name="phone">
              </div>
              
              <button type="submit" class="btn">Save Profile</button>
            </form>
            
            <script src="popup.js"></script>
          </body>
          </html>
        `);
        
        // Create simple popup.js
        fs.writeFileSync(resolve(outDir, 'popup.js'), `
          // Get DOM elements
          const profileDisplay = document.getElementById('profile-display');
          const profileForm = document.getElementById('profile-form');
          const toggleFormBtn = document.getElementById('toggle-form');
          
          // Load profile data
          function loadProfile() {
            chrome.storage.local.get('profile', (result) => {
              if (result.profile && result.profile.personal) {
                const personal = result.profile.personal;
                
                // Update the display
                profileDisplay.innerHTML = \`
                  <div class="field">
                    <div class="field-label">Name</div>
                    <div class="field-value">\${personal.firstName || ''} \${personal.lastName || ''}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">Email</div>
                    <div class="field-value">\${personal.email || ''}</div>
                  </div>
                  <div class="field">
                    <div class="field-label">Phone</div>
                    <div class="field-value">\${personal.phone || ''}</div>
                  </div>
                \`;
                
                // Fill form fields
                document.getElementById('firstName').value = personal.firstName || '';
                document.getElementById('lastName').value = personal.lastName || '';
                document.getElementById('email').value = personal.email || '';
                document.getElementById('phone').value = personal.phone || '';
              } else {
                profileDisplay.innerHTML = '<p>No profile data yet. Please create your profile.</p>';
              }
            });
          }
          
          // Toggle form visibility
          toggleFormBtn.addEventListener('click', () => {
            if (profileForm.style.display === 'block') {
              profileForm.style.display = 'none';
              toggleFormBtn.textContent = 'Edit Profile';
            } else {
              profileForm.style.display = 'block';
              toggleFormBtn.textContent = 'Cancel';
            }
          });
          
          // Handle form submission
          profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const profile = {
              personal: {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value
              }
            };
            
            // Save to storage
            chrome.storage.local.set({ profile }, () => {
              // Update the display
              loadProfile();
              
              // Hide the form
              profileForm.style.display = 'none';
              toggleFormBtn.textContent = 'Edit Profile';
            });
          });
          
          // Load profile on page load
          loadProfile();
        `);
        
        // Create options page
        fs.writeFileSync(resolve(outDir, 'options.html'), `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>AutoApply Options</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                margin: 0;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 20px;
              }
              .section {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
              }
              h2 {
                font-size: 18px;
                margin-top: 0;
                margin-bottom: 16px;
              }
              .form-field {
                margin-bottom: 16px;
              }
              .form-field label {
                display: block;
                margin-bottom: 6px;
                font-weight: bold;
              }
              .form-field input, .form-field select {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
              }
              .btn {
                background: #4285f4;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
              }
              .btn:hover {
                background: #3367d6;
              }
              .tabs {
                display: flex;
                margin-bottom: 20px;
                border-bottom: 1px solid #ddd;
              }
              .tab {
                padding: 10px 20px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
              }
              .tab.active {
                border-bottom: 2px solid #4285f4;
                font-weight: bold;
              }
              .tab-content {
                display: none;
              }
              .tab-content.active {
                display: block;
              }
            </style>
          </head>
          <body>
            <h1>AutoApply Options</h1>
            
            <div class="tabs">
              <div class="tab active" data-tab="profile">Profile</div>
              <div class="tab" data-tab="experience">Experience</div>
              <div class="tab" data-tab="education">Education</div>
              <div class="tab" data-tab="settings">Settings</div>
            </div>
            
            <div id="profile-tab" class="tab-content active">
              <div class="section">
                <h2>Personal Information</h2>
                <div class="form-field">
                  <label for="firstName">First Name</label>
                  <input type="text" id="firstName" name="firstName">
                </div>
                
                <div class="form-field">
                  <label for="lastName">Last Name</label>
                  <input type="text" id="lastName" name="lastName">
                </div>
                
                <div class="form-field">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email">
                </div>
                
                <div class="form-field">
                  <label for="phone">Phone</label>
                  <input type="tel" id="phone" name="phone">
                </div>
              </div>
              
              <div class="section">
                <h2>Location</h2>
                <div class="form-field">
                  <label for="street">Street</label>
                  <input type="text" id="street" name="street">
                </div>
                
                <div class="form-field">
                  <label for="city">City</label>
                  <input type="text" id="city" name="city">
                </div>
                
                <div class="form-field">
                  <label for="state">State</label>
                  <input type="text" id="state" name="state">
                </div>
                
                <div class="form-field">
                  <label for="postalCode">Postal Code</label>
                  <input type="text" id="postalCode" name="postalCode">
                </div>
                
                <div class="form-field">
                  <label for="country">Country</label>
                  <input type="text" id="country" name="country">
                </div>
              </div>
              
              <button class="btn save-btn">Save Profile</button>
            </div>
            
            <div id="experience-tab" class="tab-content">
              <div class="section">
                <h2>Work Experience</h2>
                <div id="experience-container">
                  <!-- Experience items will be added here -->
                </div>
                <button class="btn" id="add-experience">Add Experience</button>
              </div>
              
              <button class="btn save-btn">Save Experience</button>
            </div>
            
            <div id="education-tab" class="tab-content">
              <div class="section">
                <h2>Education</h2>
                <div id="education-container">
                  <!-- Education items will be added here -->
                </div>
                <button class="btn" id="add-education">Add Education</button>
              </div>
              
              <button class="btn save-btn">Save Education</button>
            </div>
            
            <div id="settings-tab" class="tab-content">
              <div class="section">
                <h2>Extension Settings</h2>
                <div class="form-field">
                  <label for="auto-fill">Auto-fill forms</label>
                  <select id="auto-fill">
                    <option value="always">Always auto-fill</option>
                    <option value="ask">Ask before filling</option>
                    <option value="never">Never auto-fill</option>
                  </select>
                </div>
              </div>
              
              <button class="btn save-btn">Save Settings</button>
            </div>
            
            <script src="options.js"></script>
          </body>
          </html>
        `);
        
        // Create options.js
        fs.writeFileSync(resolve(outDir, 'options.js'), `
          // Tab switching
          const tabs = document.querySelectorAll('.tab');
          const tabContents = document.querySelectorAll('.tab-content');
          
          tabs.forEach(tab => {
            tab.addEventListener('click', () => {
              // Remove active class from all tabs and contents
              tabs.forEach(t => t.classList.remove('active'));
              tabContents.forEach(c => c.classList.remove('active'));
              
              // Add active class to clicked tab and corresponding content
              tab.classList.add('active');
              const tabName = tab.getAttribute('data-tab');
              document.getElementById(\`\${tabName}-tab\`).classList.add('active');
            });
          });
          
          // Load profile data
          function loadProfile() {
            chrome.storage.local.get('profile', (result) => {
              if (result.profile) {
                const profile = result.profile;
                
                // Fill personal info fields
                if (profile.personal) {
                  document.getElementById('firstName').value = profile.personal.firstName || '';
                  document.getElementById('lastName').value = profile.personal.lastName || '';
                  document.getElementById('email').value = profile.personal.email || '';
                  document.getElementById('phone').value = profile.personal.phone || '';
                  
                  if (profile.personal.location) {
                    document.getElementById('street').value = profile.personal.location.street || '';
                    document.getElementById('city').value = profile.personal.location.city || '';
                    document.getElementById('state').value = profile.personal.location.state || '';
                    document.getElementById('postalCode').value = profile.personal.location.postalCode || '';
                    document.getElementById('country').value = profile.personal.location.country || '';
                  }
                }
                
                // Load experience items (simplified for now)
                if (profile.experience && profile.experience.length > 0) {
                  // In a real implementation, we would loop through and create UI for each experience
                }
                
                // Load education items (simplified for now)
                if (profile.education && profile.education.length > 0) {
                  // In a real implementation, we would loop through and create UI for each education
                }
              }
            });
          }
          
          // Save profile data
          document.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              chrome.storage.local.get('profile', (result) => {
                const profile = result.profile || {};
                
                // Update personal info
                profile.personal = profile.personal || {};
                profile.personal.firstName = document.getElementById('firstName').value;
                profile.personal.lastName = document.getElementById('lastName').value;
                profile.personal.email = document.getElementById('email').value;
                profile.personal.phone = document.getElementById('phone').value;
                
                // Update location info (if in the personal tab)
                if (document.getElementById('street')) {
                  profile.personal.location = {
                    street: document.getElementById('street').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    postalCode: document.getElementById('postalCode').value,
                    country: document.getElementById('country').value
                  };
                }
                
                // In a real implementation, we would also save experience and education data
                
                // Save to storage
                chrome.storage.local.set({ profile }, () => {
                  alert('Profile saved successfully!');
                });
              });
            });
          });
          
          // Initialize
          loadProfile();
        `);
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
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'content' || chunkInfo.name === 'background'
            ? '[name].js'
            : 'assets/[name]-[hash].js';
        }
      }
    }
  },
  server: {
    port: 3000,
    open: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}); 