import { ATS } from '../utils/ats';
import { Profile } from '../types/profile';

import { EnhancedFillResult } from '../utils/ats-enhanced';

/**
 * Interface for panel configuration options
 */
interface FloatingPanelOptions {
  ats: ATS;
  onFillFields: (profileData: Profile) => Promise<EnhancedFillResult>;
  onApply?: () => boolean;
  onClose: () => void;
  isJobListingPage?: boolean;
}

/**
 * Creates and initializes a floating control panel for the extension
 * @param options Configuration options for the panel
 * @returns The DOM element for the panel
 */
export function initFloatingPanel(options: FloatingPanelOptions): HTMLElement {
  // Create panel container
  const panel = document.createElement('div');

  // Create a dedicated status message area
  const statusMessageArea = document.createElement('div');
  statusMessageArea.id = 'autoapply-status-message-area'; // Unique ID for targeting
  statusMessageArea.style.cssText = `
    margin-top: 10px;
    padding: 8px;
    text-align: center;
    font-size: 14px;
    border-radius: 4px;
  `;
  panel.id = 'autoapply-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    z-index: 9999;
    transition: all 0.3s ease;
    overflow: hidden;
    padding: 16px;
  `;

  // Create header with close button
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'AutoApply';
  title.style.cssText = `
    margin: 0;
    color: #2c3e50;
    font-size: 16px;
    font-weight: 600;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #7f8c8d;
    padding: 0 4px;
  `;
  closeButton.addEventListener('click', options.onClose);
  
  header.appendChild(title);
  header.appendChild(closeButton);
  panel.appendChild(header);

  // Current ATS info
  const atsInfo = document.createElement('div');
  atsInfo.style.cssText = `
    padding: 8px 12px;
    background-color: #f8f9fa;
    border-radius: 4px;
    margin-bottom: 12px;
    font-size: 14px;
  `;
  
  const atsName = document.createElement('p');
  atsName.textContent = `Detected: ${options.ats.name}`;
  atsName.style.cssText = `
    margin: 0 0 4px 0;
    font-weight: 500;
  `;
  
  const atsDescription = document.createElement('p');
  atsDescription.textContent = options.isJobListingPage 
    ? 'Ready to apply to this job' 
    : 'Ready to autofill application fields';
  atsDescription.style.cssText = `
    margin: 0;
  `;
  
  atsInfo.appendChild(atsName);
  atsInfo.appendChild(atsDescription);
  panel.appendChild(atsInfo);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  const fillButton = document.createElement('button');
  fillButton.textContent = options.isJobListingPage ? 'Apply' : 'Autofill Application';
  fillButton.style.cssText = `
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  `;
  fillButton.addEventListener('mouseover', () => {
    fillButton.style.backgroundColor = '#2980b9';
  });
  fillButton.addEventListener('mouseout', () => {
    fillButton.style.backgroundColor = '#3498db';
  });
  
  // When the fill button is clicked, either apply or autofill based on page type
  fillButton.addEventListener('click', async () => {
    // Clear previous status messages
    statusMessageArea.textContent = '';
    statusMessageArea.style.color = 'inherit'; // Reset color

    if (options.isJobListingPage && options.onApply) {
      // Job listing page - click the apply button
      statusMessageArea.textContent = 'Clicking Apply button...';
      statusMessageArea.style.color = '#2c3e50'; // Neutral color
      
      try {
        const success = options.onApply();
        if (success) {
          statusMessageArea.textContent = '✅ Clicked Apply button! Redirecting to application...';
          statusMessageArea.style.color = '#27ae60';
        } else {
          statusMessageArea.textContent = '❌ Could not find Apply button on this page';
          statusMessageArea.style.color = '#e74c3c';
        }
      } catch (error: any) {
        console.error('Error clicking apply button:', error);
        statusMessageArea.textContent = `❌ Error: ${error.message || 'Failed to click apply button'}`;
        statusMessageArea.style.color = '#e74c3c';
      }
    } else {
      // Application form page - autofill fields
      try {
        // Fetch profile data from storage
        chrome.storage.local.get(['profile', 'playwrightEnabled'], async (result) => {
          if (result.profile) {
            statusMessageArea.textContent = 'Filling application fields...';
            statusMessageArea.style.color = '#2c3e50'; // Neutral color
            
            try {
              // Call the enhanced callback that returns full result information
              const fillResult = await options.onFillFields(result.profile);
              
              if (fillResult.success) {
                const playwrightText = fillResult.usedPlaywright 
                  ? ` (${fillResult.contentScriptFields} basic + ${fillResult.playwrightFields} complex)` 
                  : '';
                statusMessageArea.textContent = `✅ Filled ${fillResult.totalFieldsFilled} fields${playwrightText}!`;
                statusMessageArea.style.color = '#27ae60';
                
                // Show warnings if any (with delay)
                if (fillResult.warnings.length > 0) {
                  setTimeout(() => {
                    statusMessageArea.innerHTML = `✅ Filled ${fillResult.totalFieldsFilled} fields${playwrightText}!<br><span style="font-size: 12px; color: #f39c12;">⚠️ ${fillResult.warnings[0]}</span>`;
                  }, 2000);
                }
                
                // Show first recommendation if any (with longer delay)
                if (fillResult.recommendations.length > 0) {
                  setTimeout(() => {
                    statusMessageArea.innerHTML = `✅ Filled ${fillResult.totalFieldsFilled} fields${playwrightText}!<br><span style="font-size: 11px; color: #3498db;">💡 ${fillResult.recommendations[0]}</span>`;
                  }, 5000);
                }
              } else {
                statusMessageArea.innerHTML = `❌ Fill failed: ${fillResult.errors[0] || 'Unknown error'}<br><span style="font-size: 11px; color: #e67e22;">💡 ${fillResult.recommendations[0] || 'Try refreshing the page'}</span>`;
                statusMessageArea.style.color = '#e74c3c';
              }
            } catch (fillError: any) {
              console.error('Error during field filling:', fillError);
              statusMessageArea.innerHTML = `❌ Error: ${fillError.message || 'Fill operation failed'}<br><span style="font-size: 11px; color: #e67e22;">💡 Check console for details</span>`;
              statusMessageArea.style.color = '#e74c3c';
            }
          } else {
            statusMessageArea.textContent = 'No profile found. Please create one in the extension settings.';
            statusMessageArea.style.color = '#e74c3c';
          }
        });
      } catch (error: any) {
        console.error('Error in fillButton click handler:', error);
        statusMessageArea.textContent = `Error: ${error.message || 'Unknown error'}`;
        statusMessageArea.style.color = '#e74c3c';
      }
    }
  });
  
  const settingsButton = document.createElement('button');
  settingsButton.id = 'autoapply-panel-settings-button'; // Assign an ID
  settingsButton.textContent = 'Open Extension Settings';
  settingsButton.style.cssText = `
    background-color: transparent;
    color: #7f8c8d;
    border: 1px solid #dfe6e9;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  settingsButton.addEventListener('mouseover', () => {
    settingsButton.style.backgroundColor = '#f8f9fa';
    settingsButton.style.color = '#2c3e50';
  });
  settingsButton.addEventListener('mouseout', () => {
    settingsButton.style.backgroundColor = 'transparent';
    settingsButton.style.color = '#7f8c8d';
  });
  
  // Open extension options page when settings is clicked
  settingsButton.addEventListener('click', () => {
    console.log('[AutoApply] Open Extension Settings button clicked');
    chrome.runtime.sendMessage({ action: "openOptionsPage" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[AutoApply] Error sending openOptionsPage message:', chrome.runtime.lastError.message);
      } else {
        console.log('[AutoApply] openOptionsPage message response:', response);
      }
    });
  });
  
  actionsContainer.appendChild(fillButton);
  actionsContainer.appendChild(settingsButton);
  panel.appendChild(actionsContainer);
  panel.appendChild(statusMessageArea); // Append the dedicated status message area

  // Add panel to page
  document.body.appendChild(panel);
  
  // Make panel draggable
  makeDraggable(panel, header);
  
  return panel;
}

/**
 * Makes an element draggable
 * @param element The element to make draggable
 * @param handle The drag handle (usually the header)
 */
function makeDraggable(element: HTMLElement, handle: HTMLElement): void {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.style.cursor = 'move';
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    // If we're dragging from the bottom right, adjust position to maintain that
    if (element.style.bottom && !element.style.top) {
      element.style.bottom = '';
      element.style.top = (window.innerHeight - element.offsetHeight - parseInt(getComputedStyle(element).bottom)) + "px";
    }
    if (element.style.right && !element.style.left) {
      element.style.right = '';
      element.style.left = (window.innerWidth - element.offsetWidth - parseInt(getComputedStyle(element).right)) + "px";
    }
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
} 