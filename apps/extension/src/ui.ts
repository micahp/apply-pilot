export function createFloatingPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'autoapply-panel';
  
  const style = document.createElement('style');
  style.textContent = `
    .autoapply-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      min-width: 300px;
    }
    
    .autoapply-panel h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #333;
    }
    
    .autoapply-panel p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    
    .autoapply-panel button {
      margin-top: 12px;
      padding: 8px 16px;
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .autoapply-panel button:hover {
      background: #0056b3;
    }
  `;
  document.head.appendChild(style);
  
  const content = document.createElement('div');
  content.innerHTML = `
    <h3>AutoApply</h3>
    <p>Filled <span class="filled-count">0</span> fields</p>
    <button class="undo-btn">Undo Last Fill</button>
  `;
  panel.appendChild(content);
  
  // Add undo functionality
  const undoBtn = panel.querySelector('.undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      // TODO: Implement undo functionality
      console.log('Undo clicked');
    });
  }
  
  return panel;
}

// Update the filled count in the panel
export function updateFilledCount(panel: HTMLElement, count: number): void {
  const countElement = panel.querySelector('.filled-count');
  if (countElement) {
    countElement.textContent = String(count);
  }
} 