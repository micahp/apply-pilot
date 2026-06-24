/**
 * CAPTCHA detection and handling for job application forms
 * Integrates with various CAPTCHA solving approaches
 */

interface CaptchaInfo {
  type: 'recaptcha' | 'hcaptcha' | 'turnstile' | 'funcaptcha' | 'text' | 'unknown';
  element: HTMLElement;
  siteKey?: string;
  action?: string;
}

class CaptchaHandler {
  private static readonly CAPTCHA_SELECTORS = {
    recaptcha: [
      '.g-recaptcha',
      '[data-sitekey]',
      'iframe[src*="recaptcha"]',
      '.recaptcha-checkbox'
    ],
    hcaptcha: [
      '.h-captcha',
      '[data-hcaptcha-sitekey]',
      'iframe[src*="hcaptcha"]'
    ],
    turnstile: [
      '.cf-turnstile',
      '[data-cf-turnstile]',
      'iframe[src*="turnstile"]'
    ],
    funcaptcha: [
      '.funcaptcha',
      '[data-pk]',
      'iframe[src*="funcaptcha"]'
    ],
    textCaptcha: [
      'img[alt*="captcha" i]',
      'input[name*="captcha" i]',
      '.captcha-image'
    ]
  };

  /**
   * Detect all CAPTCHAs on the current page
   */
  static detectCaptchas(): CaptchaInfo[] {
    const captchas: CaptchaInfo[] = [];

    // Check each CAPTCHA type
    Object.entries(this.CAPTCHA_SELECTORS).forEach(([type, selectors]) => {
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const captchaInfo = this.analyzeCaptchaElement(element as HTMLElement, type as CaptchaInfo['type']);
          if (captchaInfo) {
            captchas.push(captchaInfo);
          }
        });
      });
    });

    return captchas;
  }

  /**
   * Analyze a specific element to determine CAPTCHA details
   */
  private static analyzeCaptchaElement(element: HTMLElement, type: CaptchaInfo['type']): CaptchaInfo | null {
    if (!element || !this.isElementVisible(element)) {
      return null;
    }

    const captchaInfo: CaptchaInfo = {
      type,
      element
    };

         // Extract site key and other parameters
    switch (type) {
      case 'recaptcha':
        captchaInfo.siteKey = element.getAttribute('data-sitekey') || 
                            element.getAttribute('data-site-key') || undefined;
        captchaInfo.action = element.getAttribute('data-action') || undefined;
        break;
      
      case 'hcaptcha':
        captchaInfo.siteKey = element.getAttribute('data-hcaptcha-sitekey') ||
                            element.getAttribute('data-sitekey') || undefined;
        break;
      
      case 'turnstile':
        captchaInfo.siteKey = element.getAttribute('data-sitekey') || undefined;
        break;
      
      case 'funcaptcha':
        captchaInfo.siteKey = element.getAttribute('data-pk') || undefined;
        break;
    }

    return captchaInfo;
  }

  /**
   * Check if element is visible and interactive
   */
  private static isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  /**
   * Wait for user to solve CAPTCHA manually
   */
  static async waitForCaptchaSolution(captchaInfo: CaptchaInfo, timeout: number = 60000): Promise<boolean> {
    console.log(`[CaptchaHandler] Waiting for ${captchaInfo.type} solution...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.isCaptchaSolved(captchaInfo)) {
        console.log(`[CaptchaHandler] ${captchaInfo.type} solved!`);
        return true;
      }
      
      // Check every 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[CaptchaHandler] ${captchaInfo.type} solution timeout`);
    return false;
  }

  /**
   * Check if CAPTCHA has been solved
   */
  private static isCaptchaSolved(captchaInfo: CaptchaInfo): boolean {
    const { type, element } = captchaInfo;
    
    switch (type) {
      case 'recaptcha':
        // Check for response token
        const recaptchaResponse = document.querySelector('textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement;
        return recaptchaResponse && recaptchaResponse.value.length > 0;
      
      case 'hcaptcha':
        const hcaptchaResponse = document.querySelector('textarea[name="h-captcha-response"]') as HTMLTextAreaElement;
        return hcaptchaResponse && hcaptchaResponse.value.length > 0;
      
      case 'turnstile':
        const turnstileResponse = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
        return turnstileResponse && turnstileResponse.value.length > 0;
      
      case 'funcaptcha':
        // FunCaptcha typically adds hidden fields when solved
        const funcaptchaToken = document.querySelector('input[name*="fc-token"]') as HTMLInputElement;
        return funcaptchaToken && funcaptchaToken.value.length > 0;
      
      case 'text':
        // For text CAPTCHAs, assume solved if user has entered text
        const textInput = element.querySelector('input[type="text"]') as HTMLInputElement;
        return textInput && textInput.value.length > 0;
      
      default:
        return false;
    }
  }

  /**
   * Show user notification about CAPTCHA requirement
   */
  static showCaptchaNotification(captchaInfo: CaptchaInfo): void {
    const notification = document.createElement('div');
    notification.id = 'autoapply-captcha-notification';
    notification.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  background: #ff6b6b; color: white; padding: 20px; border-radius: 8px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10001; max-width: 400px;">
        <h3>🤖 CAPTCHA Detected</h3>
        <p>Please solve the ${captchaInfo.type.toUpperCase()} challenge to continue with auto-filling.</p>
        <p><small>The extension will resume automatically once you complete it.</small></p>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: rgba(255,255,255,0.2); border: none; color: white; 
                       padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Got it
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      const existing = document.getElementById('autoapply-captcha-notification');
      if (existing) {
        existing.remove();
      }
    }, 10000);
  }

  /**
   * Integration point for external CAPTCHA solving services
   */
  static async solveCaptchaAutomatically(captchaInfo: CaptchaInfo): Promise<string | null> {
    console.log(`[CaptchaHandler] Attempting automatic solution for ${captchaInfo.type}`);
    
    // This is where you'd integrate with services like:
    // - 2captcha API
    // - AntiCaptcha API  
    // - CapSolver API
    // - Death By Captcha API
    
    // For now, we'll just show notification and wait for manual solution
    this.showCaptchaNotification(captchaInfo);
    
    const solved = await this.waitForCaptchaSolution(captchaInfo);
    return solved ? 'solved-manually' : null;
  }

  /**
   * Check if page has any unsolved CAPTCHAs
   */
  static hasUnsolvedCaptchas(): boolean {
    const captchas = this.detectCaptchas();
    return captchas.some(captcha => !this.isCaptchaSolved(captcha));
  }

  /**
   * Wait for all CAPTCHAs to be solved before proceeding
   */
  static async waitForAllCaptchasSolved(timeout: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!this.hasUnsolvedCaptchas()) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }
}

export { CaptchaHandler, type CaptchaInfo }; 