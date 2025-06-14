import { HumanLikeAutomation } from './human-like-automation';
import { CaptchaHandler } from './captcha-handler';
import { Profile } from '../types/profile';
import { ATSSelectors } from './ats-platforms';

interface EnhancedFillResult {
  success: boolean;
  fieldsFilled: number;
  captchasSolved: number;
  errors: string[];
  warnings: string[];
  bypassed: string[]; // Anti-bot measures bypassed
}

/**
 * Enhanced ATS form filler using human-like automation
 * Designed to bypass modern anti-bot detection systems
 */
class EnhancedATSFiller {
  private humanAutomation: HumanLikeAutomation;
  
  constructor() {
    // Configure for realistic behavior
    this.humanAutomation = new HumanLikeAutomation({
      minDelay: 100,
      maxDelay: 500,
      typingSpeedWpm: 42, // Slightly below average to be safe
      scrollBehavior: true,
      mouseMovement: true,
      errorRate: 0.015 // 1.5% typo rate
    });
  }

  /**
   * Fill ATS form with enhanced anti-bot bypass techniques
   */
  async fillATSForm(atsSelectors: ATSSelectors, profile: Profile): Promise<EnhancedFillResult> {
    console.log('[EnhancedATSFiller] Starting enhanced form filling...');
    
    const result: EnhancedFillResult = {
      success: false,
      fieldsFilled: 0,
      captchasSolved: 0,
      errors: [],
      warnings: [],
      bypassed: []
    };

    try {
      // Step 1: Check for CAPTCHAs first
      await this.handleCaptchas(result);
      
      // Step 2: Bypass browser fingerprinting
      await this.bypassFingerprinting(result);
      
      // Step 3: Handle honeypots
      await this.avoidHoneypots(result);
      
      // Step 4: Fill form fields with human-like behavior
      await this.fillFormFields(atsSelectors, profile, result);
      
      // Step 5: Handle file uploads if needed
      if (profile.resumeFile) {
        await this.handleFileUploads(atsSelectors, profile, result);
      }
      
      result.success = result.fieldsFilled > 0 && result.errors.length === 0;
      
    } catch (error: any) {
      console.error('[EnhancedATSFiller] Critical error:', error);
      result.errors.push(error.message);
      result.success = false;
    }

    return result;
  }

  /**
   * Handle CAPTCHAs on the page
   */
  private async handleCaptchas(result: EnhancedFillResult): Promise<void> {
    const captchas = CaptchaHandler.detectCaptchas();
    
    if (captchas.length > 0) {
      console.log(`[EnhancedATSFiller] Found ${captchas.length} CAPTCHA(s)`);
      
      for (const captcha of captchas) {
        console.log(`[EnhancedATSFiller] Handling ${captcha.type} CAPTCHA`);
        
        // Attempt to solve or wait for manual solution
        const solved = await CaptchaHandler.solveCaptchaAutomatically(captcha);
        
        if (solved) {
          result.captchasSolved++;
          result.bypassed.push(`${captcha.type} CAPTCHA`);
        } else {
          result.warnings.push(`Failed to solve ${captcha.type} CAPTCHA`);
        }
      }
      
      // Wait for all CAPTCHAs to be solved before proceeding
      const allSolved = await CaptchaHandler.waitForAllCaptchasSolved(120000);
      if (!allSolved) {
        result.errors.push('Not all CAPTCHAs were solved within timeout');
      }
    }
  }

  /**
   * Bypass browser fingerprinting detection
   */
  private async bypassFingerprinting(result: EnhancedFillResult): Promise<void> {
    try {
      // Remove common automation indicators
      if ((window as any).navigator.webdriver) {
        delete (window as any).navigator.webdriver;
        result.bypassed.push('webdriver property');
      }

      // Override automation detection properties
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Simulate realistic browser behavior
      await this.simulateHumanBrowsing();
      
      result.bypassed.push('browser fingerprinting');
      
    } catch (error: any) {
      console.warn('[EnhancedATSFiller] Fingerprinting bypass failed:', error);
      result.warnings.push('Browser fingerprinting bypass failed');
    }
  }

  /**
   * Simulate human browsing patterns
   */
  private async simulateHumanBrowsing(): Promise<void> {
    // Simulate reading the page
    await this.randomDelay(1000, 3000);
    
    // Simulate some scrolling
    const scrollAmount = Math.random() * 300 + 100;
    window.scrollBy(0, scrollAmount);
    await this.randomDelay(500, 1500);
    
    // Scroll back up slightly (natural behavior)
    window.scrollBy(0, -scrollAmount * 0.3);
    await this.randomDelay(300, 800);
  }

  /**
   * Avoid honeypot traps
   */
  private async avoidHoneypots(result: EnhancedFillResult): Promise<void> {
    const honeypotSelectors = [
      'input[style*="display:none"]',
      'input[style*="visibility:hidden"]',
      'input[style*="opacity:0"]',
      '.hidden',
      '.invisible',
      '[aria-hidden="true"]'
    ];

    let honeypotCount = 0;
    
    honeypotSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      honeypotCount += elements.length;
    });
    
    if (honeypotCount > 0) {
      console.log(`[EnhancedATSFiller] Detected ${honeypotCount} potential honeypots`);
      result.bypassed.push(`${honeypotCount} honeypot traps`);
    }
  }

  /**
   * Fill form fields with human-like behavior
   */
  private async fillFormFields(atsSelectors: ATSSelectors, profile: Profile, result: EnhancedFillResult): Promise<void> {
    const fieldMappings = [
      { selector: atsSelectors.firstName, value: profile.firstName, name: 'firstName' },
      { selector: atsSelectors.lastName, value: profile.lastName, name: 'lastName' },
      { selector: atsSelectors.email, value: profile.email, name: 'email' },
      { selector: atsSelectors.phone, value: profile.phone, name: 'phone' },
      { selector: atsSelectors.address, value: profile.address, name: 'address' },
      { selector: atsSelectors.city, value: profile.city, name: 'city' },
      { selector: atsSelectors.state, value: profile.state, name: 'state' },
      { selector: atsSelectors.zipCode, value: profile.zipCode, name: 'zipCode' },
      { selector: atsSelectors.country, value: profile.country, name: 'country' }
    ];

    for (const field of fieldMappings) {
      if (!field.selector || !field.value) continue;
      
      try {
        const element = await this.humanAutomation.waitForElement(field.selector, 5000);
        
        if (!element) {
          result.warnings.push(`Field not found: ${field.name}`);
          continue;
        }

        // Check if this is a protected element
        if (this.isProtectedField(element)) {
          result.warnings.push(`Protected field detected: ${field.name}`);
          continue;
        }

        console.log(`[EnhancedATSFiller] Filling ${field.name}`);
        
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          await this.humanAutomation.typeText(element, field.value);
          result.fieldsFilled++;
        } else if (element instanceof HTMLSelectElement) {
          await this.humanAutomation.selectOption(element, field.value);
          result.fieldsFilled++;
        }
        
        // Random pause between fields (human-like)
        await this.randomDelay(800, 2000);
        
      } catch (error: any) {
        console.error(`[EnhancedATSFiller] Error filling ${field.name}:`, error);
        result.errors.push(`Failed to fill ${field.name}: ${error.message}`);
      }
    }
  }

  /**
   * Handle file uploads (resumes, cover letters)
   */
  private async handleFileUploads(atsSelectors: ATSSelectors, profile: Profile, result: EnhancedFillResult): Promise<void> {
    if (atsSelectors.resume && profile.resumeFile) {
      try {
        const fileInput = await this.humanAutomation.waitForElement(atsSelectors.resume, 5000) as HTMLInputElement;
        
        if (fileInput && fileInput.type === 'file') {
          console.log('[EnhancedATSFiller] Uploading resume file');
          await this.humanAutomation.uploadFile(fileInput, profile.resumeFile);
          result.fieldsFilled++;
        }
        
      } catch (error: any) {
        console.error('[EnhancedATSFiller] File upload error:', error);
        result.errors.push(`File upload failed: ${error.message}`);
      }
    }
  }

  /**
   * Check if field has anti-bot protection
   */
  private isProtectedField(element: HTMLElement): boolean {
    const protectionPatterns = [
      /data-cf-/i,      // Cloudflare
      /data-akamai/i,   // Akamai
      /bot-protection/i,
      /anti-bot/i,
      /captcha/i
    ];

    const elementHtml = element.outerHTML;
    return protectionPatterns.some(pattern => pattern.test(elementHtml));
  }

  /**
   * Generate random delay between min and max milliseconds
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate realistic form submission behavior
   */
  async simulateFormSubmission(formSelector: string = 'form'): Promise<boolean> {
    try {
      const form = document.querySelector(formSelector) as HTMLFormElement;
      if (!form) {
        console.warn('[EnhancedATSFiller] No form found for submission');
        return false;
      }

      // Simulate user reviewing form before submission
      await this.randomDelay(2000, 5000);
      
      // Look for submit button
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
      
      if (submitButton) {
        console.log('[EnhancedATSFiller] Simulating form submission click');
        await this.humanAutomation.focusElement(submitButton);
        
        // Add extra delay before clicking submit (human behavior)
        await this.randomDelay(1000, 2000);
        
        submitButton.click();
        return true;
      } else {
        console.warn('[EnhancedATSFiller] No submit button found');
        return false;
      }
      
    } catch (error: any) {
      console.error('[EnhancedATSFiller] Form submission error:', error);
      return false;
    }
  }
}

export { EnhancedATSFiller, type EnhancedFillResult }; 