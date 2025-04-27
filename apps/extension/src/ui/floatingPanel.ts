import { ATS } from '../utils/ats';
import { Profile } from '../types/profile';

/**
 * Interface for panel configuration options
 */
interface FloatingPanelOptions {
  ats: ATS;
  onFillFields: (profileData: Profile) => void;
  onClose: () => void;
}

/**
 * Creates and initializes a floating control panel for the extension
 * @param options Configuration options for the panel
 * @returns The DOM element for the panel
 */
export function initFloatingPanel(options: FloatingPanelOptions): HTMLElement {
  // Create panel container
  const panel = document.createElement('div');
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
  atsDescription.textContent = 'Ready to autofill application fields';
  atsDescription.style.cssText = `
    margin: 0;
    font-size: 12px;
    color: #7f8c8d;
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
  fillButton.textContent = 'Autofill Application';
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
  
  // When the fill button is clicked, fetch profile data and fill fields
  fillButton.addEventListener('click', async () => {
    try {
      // Fetch profile data from storage
      chrome.storage.local.get(['profile'], (result) => {
        if (result.profile) {
          const statusText = document.createElement('p');
          statusText.textContent = 'Filling application fields...';
          statusText.style.cssText = `
            margin: 8px 0;
            font-size: 13px;
            color: #2c3e50;
          `;
          
          // Add below the button
          actionsContainer.appendChild(statusText);
          
          // Call the callback to fill fields
          options.onFillFields(result.profile);
          
          // Update status after a delay
          setTimeout(() => {
            statusText.textContent = 'Fields filled successfully!';
            statusText.style.color = '#27ae60';
          }, 1000);
        } else {
          const errorText = document.createElement('p');
          errorText.textContent = 'No profile found. Please create one in the extension popup.';
          errorText.style.cssText = `
            margin: 8px 0;
            font-size: 13px;
            color: #e74c3c;
          `;
          actionsContainer.appendChild(errorText);
        }
      });
    } catch (error) {
      console.error('Error filling fields:', error);
    }
  });
  
  const settingsButton = document.createElement('button');
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
  
  // Open extension popup when settings is clicked
  settingsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  actionsContainer.appendChild(fillButton);
  actionsContainer.appendChild(settingsButton);
  panel.appendChild(actionsContainer);

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