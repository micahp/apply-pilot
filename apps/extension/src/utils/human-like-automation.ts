/**
 * Human-like automation utilities for bypassing anti-bot detection
 * Based on modern anti-scraping research and techniques
 */

interface HumanBehaviorConfig {
  minDelay: number;
  maxDelay: number;
  typingSpeedWpm: number;
  scrollBehavior: boolean;
  mouseMovement: boolean;
  errorRate: number; // Percentage of "typos" to simulate
}

class HumanLikeAutomation {
  private config: HumanBehaviorConfig;
  
  constructor(config?: Partial<HumanBehaviorConfig>) {
    this.config = {
      minDelay: 50,
      maxDelay: 300,
      typingSpeedWpm: 45, // Average human typing speed
      scrollBehavior: true,
      mouseMovement: true,
      errorRate: 0.02, // 2% error rate
      ...config
    };
  }

  /**
   * Simulate human-like delays with realistic variance
   */
  private async humanDelay(baseMs?: number): Promise<void> {
    const base = baseMs || this.randomBetween(this.config.minDelay, this.config.maxDelay);
    // Add realistic variance (normal distribution)
    const variance = this.normalRandom(0, base * 0.3);
    const delay = Math.max(10, base + variance);
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate random number between min and max
   */
  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate normally distributed random number (Box-Muller transform)
   */
  private normalRandom(mean: number = 0, stdDev: number = 1): number {
    const u = Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Simulate realistic mouse movement to element
   */
  private async simulateMouseMovement(element: HTMLElement): Promise<void> {
    if (!this.config.mouseMovement) return;

    const rect = element.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Simulate mouse move events
    const steps = this.randomBetween(3, 8);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const currentX = targetX * progress;
      const currentY = targetY * progress;

      element.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: currentX,
        clientY: currentY
      }));

      await this.humanDelay(this.randomBetween(10, 30));
    }
  }

  /**
   * Scroll element into view with human-like behavior
   */
  private async scrollToElement(element: HTMLElement): Promise<void> {
    if (!this.config.scrollBehavior) return;

    // Check if element is already in view
    const rect = element.getBoundingClientRect();
    const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    
    if (!isInView) {
      // Smooth scroll with realistic behavior
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Wait for scroll to complete
      await this.humanDelay(this.randomBetween(300, 800));
    }
  }

  /**
   * Focus element with human-like behavior
   */
  async focusElement(element: HTMLElement): Promise<void> {
    console.log('[HumanAutomation] Focusing element with human-like behavior');
    
    // Scroll to element first
    await this.scrollToElement(element);
    
    // Simulate mouse movement
    await this.simulateMouseMovement(element);
    
    // Add realistic delay before focus
    await this.humanDelay();
    
    // Dispatch mouse events
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await this.humanDelay(this.randomBetween(50, 150));
    
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Focus the element
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
    }
    
    await this.humanDelay();
  }

  /**
   * Type text with human-like behavior including typos and corrections
   */
  async typeText(element: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
    console.log('[HumanAutomation] Typing text with human-like behavior');
    
    await this.focusElement(element);
    
    // Clear existing content
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    const charactersPerMinute = this.config.typingSpeedWpm * 5; // Assuming 5 chars per word
    const baseDelay = 60000 / charactersPerMinute; // ms per character
    
    let currentText = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Simulate occasional typos
      if (Math.random() < this.config.errorRate && i > 0) {
        // Type wrong character first
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + this.randomBetween(-2, 2));
        currentText += wrongChar;
        element.value = currentText;
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await this.humanDelay(baseDelay + this.randomBetween(0, 100));
        
        // Delete the wrong character
        currentText = currentText.slice(0, -1);
        element.value = currentText;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await this.humanDelay(this.randomBetween(100, 300));
      }
      
      // Type the correct character
      currentText += char;
      element.value = currentText;
      
      // Dispatch realistic events
      element.dispatchEvent(new KeyboardEvent('keydown', { 
        key: char, 
        bubbles: true 
      }));
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      element.dispatchEvent(new KeyboardEvent('keyup', { 
        key: char, 
        bubbles: true 
      }));
      
      // Variable typing speed
      const charDelay = baseDelay * this.randomBetween(0.5, 2.0);
      await this.humanDelay(charDelay);
    }
    
    // Final blur event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Select option from dropdown with human-like behavior
   */
  async selectOption(selectElement: HTMLSelectElement, value: string): Promise<void> {
    console.log('[HumanAutomation] Selecting option with human-like behavior');
    
    await this.focusElement(selectElement);
    
    // Find the option
    const option = Array.from(selectElement.options).find(opt => 
      opt.value === value || opt.textContent?.toLowerCase().includes(value.toLowerCase())
    );
    
    if (option) {
      selectElement.value = option.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      selectElement.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
      console.warn(`[HumanAutomation] Option not found: ${value}`);
    }
    
    await this.humanDelay();
  }

  /**
   * Upload file with human-like behavior
   */
  async uploadFile(fileInput: HTMLInputElement, file: File): Promise<void> {
    console.log('[HumanAutomation] Uploading file with human-like behavior');
    
    await this.focusElement(fileInput);
    
    // Create a FileList-like object
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    await this.humanDelay(this.randomBetween(500, 1500));
  }

  /**
   * Check if element requires human interaction (anti-bot protection)
   */
  isProtectedElement(element: HTMLElement): boolean {
    const protectionIndicators = [
      'data-cf-', // Cloudflare
      'data-akamai', // Akamai
      'recaptcha', // reCAPTCHA
      'hcaptcha', // hCaptcha
      'turnstile', // Cloudflare Turnstile
      'captcha-', // Generic CAPTCHA
      'bot-protection',
      'anti-bot'
    ];
    
    const elementHtml = element.outerHTML.toLowerCase();
    return protectionIndicators.some(indicator => elementHtml.includes(indicator));
  }

  /**
   * Wait for element to be ready for interaction
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<HTMLElement | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector) as HTMLElement;
      
      if (element && this.isElementInteractable(element)) {
        return element;
      }
      
      await this.humanDelay(100);
    }
    
    return null;
  }

  /**
   * Check if element is ready for interaction
   */
  private isElementInteractable(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const isNotHidden = !element.hidden && 
                       getComputedStyle(element).display !== 'none' &&
                       getComputedStyle(element).visibility !== 'hidden';
    const isNotDisabled = !(element as HTMLInputElement).disabled;
    
    return isVisible && isNotHidden && isNotDisabled;
  }
}

export { HumanLikeAutomation, type HumanBehaviorConfig }; 