import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Profile } from '../types/profile';
import { ATSPlatform } from './ats';

export interface PlaywrightAutomationOptions {
  headless?: boolean;
  timeout?: number;
  extensionPath?: string;
}

export interface AutomationResult {
  success: boolean;
  filledFields: number;
  errors: string[];
  warnings: string[];
}

export interface ComplexField {
  type: 'file_upload' | 'location_autocomplete' | 'multi_step' | 'dynamic_dropdown';
  selector: string;
  value: string | Buffer;
  waitForSelector?: string;
  options?: Record<string, any>;
}

/**
 * Playwright automation service for handling complex ATS form scenarios
 * that the basic content script approach cannot handle effectively
 */
export class PlaywrightAutomationService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private options: PlaywrightAutomationOptions;

  constructor(options: PlaywrightAutomationOptions = {}) {
    this.options = {
      headless: false, // Default to visible for debugging
      timeout: 30000,
      ...options
    };
  }

  /**
   * Initialize the browser with extension support
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    const launchOptions: any = {
      headless: this.options.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    // Add extension loading if path provided
    if (this.options.extensionPath) {
      launchOptions.args.push(
        `--disable-extensions-except=${this.options.extensionPath}`,
        `--load-extension=${this.options.extensionPath}`
      );
    }

    this.browser = await chromium.launch(launchOptions);
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
  }

  /**
   * Handle complex form filling scenarios that require Playwright
   */
  async handleComplexFormFilling(
    url: string,
    platform: ATSPlatform,
    profile: Profile,
    complexFields: ComplexField[]
  ): Promise<AutomationResult> {
    await this.initialize();
    
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();
    const result: AutomationResult = {
      success: false,
      filledFields: 0,
      errors: [],
      warnings: []
    };

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for the form to be ready
      await this.waitForFormReady(page, platform);

      // Process each complex field
      for (const field of complexFields) {
        try {
          await this.handleComplexField(page, field, profile);
          result.filledFields++;
        } catch (error: any) {
          const errorMsg = `Failed to handle ${field.type} field: ${error.message}`;
          result.errors.push(errorMsg);
          console.error('PlaywrightAutomation:', errorMsg);
        }
      }

      // Validate form completion
      const isValid = await this.validateFormCompletion(page, platform);
      if (!isValid) {
        result.warnings.push('Form may not be ready for submission');
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error: any) {
      result.errors.push(`General automation error: ${error.message}`);
      result.success = false;
      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * Handle file upload scenarios (resume, cover letter, etc.)
   */
  async handleFileUpload(
    page: Page,
    selector: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<void> {
    // Wait for file input to be available
    await page.waitForSelector(selector, { timeout: this.options.timeout });
    
    // Create temporary file from buffer
    const tempFilePath = await this.createTempFile(fileBuffer, fileName);
    
    try {
      // Upload the file
      await page.setInputFiles(selector, tempFilePath);
      
      // Wait for upload to complete
      await page.waitForFunction(
        (sel: string) => {
          const input = document.querySelector(sel) as HTMLInputElement;
          return input && input.files && input.files.length > 0;
        },
        selector,
        { timeout: this.options.timeout }
      );
      
      console.log(`PlaywrightAutomation: Successfully uploaded ${fileName}`);
    } finally {
      // Clean up temp file
      await this.cleanupTempFile(tempFilePath);
    }
  }

  /**
   * Handle location autocomplete fields that require waiting for dropdown options
   */
  async handleLocationAutocomplete(
    page: Page,
    selector: string,
    location: string
  ): Promise<void> {
    // Focus and type in the location field
    await page.focus(selector);
    await page.fill(selector, ''); // Clear first
    await page.type(selector, location, { delay: 100 });

    // Wait for autocomplete dropdown to appear
    const dropdownSelector = this.getLocationDropdownSelector(selector);
    await page.waitForSelector(dropdownSelector, { 
      timeout: 10000,
      state: 'visible'
    });

    // Wait a bit more for options to load
    await page.waitForTimeout(1000);

    // Look for matching options
    const options = await page.$$(`${dropdownSelector} [role="option"]`);
    
    for (const option of options) {
      const text = await option.textContent();
      if (text && this.isLocationMatch(text, location)) {
        await option.click();
        console.log(`PlaywrightAutomation: Selected location option: ${text}`);
        return;
      }
    }

    // If no exact match found, try the first option
    if (options.length > 0) {
      await options[0].click();
      const selectedText = await options[0].textContent();
      console.warn(`PlaywrightAutomation: No exact match for "${location}", selected: ${selectedText}`);
    } else {
      throw new Error(`No location options found for: ${location}`);
    }
  }

  /**
   * Handle multi-step application flows
   */
  async handleMultiStepFlow(
    page: Page,
    steps: Array<{ selector: string; action: string; value?: string }>
  ): Promise<void> {
    for (const step of steps) {
      switch (step.action) {
        case 'click':
          await page.click(step.selector);
          break;
        case 'fill':
          if (step.value) {
            await page.fill(step.selector, step.value);
          }
          break;
        case 'select':
          if (step.value) {
            await page.selectOption(step.selector, step.value);
          }
          break;
        case 'wait':
          await page.waitForSelector(step.selector);
          break;
        default:
          console.warn(`PlaywrightAutomation: Unknown action: ${step.action}`);
      }
      
      // Small delay between steps
      await page.waitForTimeout(500);
    }
  }

  /**
   * Handle dynamic dropdown fields that need time to load options
   */
  async handleDynamicDropdown(
    page: Page,
    selector: string,
    value: string
  ): Promise<void> {
    // Click to open dropdown
    await page.click(selector);
    
    // Wait for options to load
    await page.waitForTimeout(2000);
    
    // Try to find matching option
    const optionSelector = `${selector} option, [role="listbox"] [role="option"]`;
    await page.waitForSelector(optionSelector, { timeout: 10000 });
    
    const options = await page.$$(optionSelector);
    
    for (const option of options) {
      const text = await option.textContent();
      if (text && text.toLowerCase().includes(value.toLowerCase())) {
        await option.click();
        return;
      }
    }
    
    throw new Error(`No matching option found for: ${value}`);
  }

  /**
   * Main handler for complex fields
   */
  private async handleComplexField(
    page: Page,
    field: ComplexField,
    profile: Profile
  ): Promise<void> {
    switch (field.type) {
      case 'file_upload':
        if (field.value instanceof Buffer) {
          const fileName = field.options?.fileName || 'resume.pdf';
          await this.handleFileUpload(page, field.selector, field.value, fileName);
        }
        break;
        
      case 'location_autocomplete':
        if (typeof field.value === 'string') {
          await this.handleLocationAutocomplete(page, field.selector, field.value);
        }
        break;
        
      case 'multi_step':
        if (field.options?.steps) {
          await this.handleMultiStepFlow(page, field.options.steps);
        }
        break;
        
      case 'dynamic_dropdown':
        if (typeof field.value === 'string') {
          await this.handleDynamicDropdown(page, field.selector, field.value);
        }
        break;
        
      default:
        throw new Error(`Unsupported field type: ${field.type}`);
    }
  }

  /**
   * Wait for form to be ready based on ATS platform
   */
  private async waitForFormReady(page: Page, platform: ATSPlatform): Promise<void> {
    // Platform-specific form ready indicators
    const readySelectors: Record<string, string> = {
      'workday': '[data-automation-id="firstName"], input[placeholder*="first name" i]',
      'greenhouse': '#first_name, input[name="first_name"]',
      'lever': 'input[name="name"], input[placeholder*="name" i]',
      'ashby': 'input[name*="first"], input[placeholder*="first" i]',
      'icims': 'input[type="text"], input[type="email"]',
      'workable': '#firstname, input[name="firstname"]'
    };

    const selector = readySelectors[platform.slug] || 'form input[type="text"]:first-of-type';
    await page.waitForSelector(selector, { timeout: this.options.timeout });
  }

  /**
   * Validate form completion
   */
  private async validateFormCompletion(page: Page, platform: ATSPlatform): Promise<boolean> {
    // Check if submit button is enabled
    const submitButton = await page.$('button[type="submit"], input[type="submit"], .submit-btn, .apply-btn');
    if (submitButton) {
      const isDisabled = await submitButton.isDisabled();
      return !isDisabled;
    }
    return true; // Default to true if no submit button found
  }

  /**
   * Get location dropdown selector based on input selector
   */
  private getLocationDropdownSelector(inputSelector: string): string {
    // Common patterns for location dropdowns
    const dropdownPatterns = [
      '[role="listbox"]', 
      '.autocomplete-dropdown',
      '.dropdown-menu',
      '.suggestions',
      '.pac-container', // Google Places autocomplete
      '[data-testid*="dropdown"]',
      '.lever-location-dropdown'
    ];
    
    // Try to find dropdown near the input
    return dropdownPatterns.join(', ');
  }

  /**
   * Check if location text matches the desired location
   */
  private isLocationMatch(optionText: string, desiredLocation: string): boolean {
    const option = optionText.toLowerCase();
    const desired = desiredLocation.toLowerCase();
    
    // Exact match
    if (option === desired) return true;
    
    // Contains match
    if (option.includes(desired) || desired.includes(option)) return true;
    
    // City, State match
    const parts = desired.split(',').map(p => p.trim());
    return parts.some(part => option.includes(part));
  }

  /**
   * Create temporary file from buffer
   */
  private async createTempFile(buffer: Buffer, fileName: string): Promise<string> {
    // In a real implementation, you'd write to a temp directory
    // For now, this is a placeholder - you'll need to implement actual file writing
    const tempPath = `/tmp/${Date.now()}_${fileName}`;
    // TODO: Implement actual file writing using Node.js fs module
    return tempPath;
  }

  /**
   * Clean up temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    // TODO: Implement actual file deletion
    console.log(`PlaywrightAutomation: Cleaned up temp file: ${filePath}`);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Helper function to determine if a field requires Playwright automation
 */
export function shouldUsePlaywright(
  platform: ATSPlatform,
  fieldType: string,
  fieldSelector: string
): boolean {
  // File upload fields always need Playwright
  if (fieldType === 'file' || fieldSelector.includes('file') || fieldSelector.includes('resume')) {
    return true;
  }

  // Location fields with known autocomplete patterns
  if (fieldType === 'location' || fieldSelector.includes('location')) {
    const autoCompletePatterns = ['lever', 'workday', 'greenhouse'];
    return autoCompletePatterns.includes(platform.slug);
  }

  // Multi-step forms
  if (platform.slug === 'workday' && fieldSelector.includes('step')) {
    return true;
  }

  // Dynamic dropdowns that need loading time
  const dynamicDropdownSelectors = [
    '[data-automation-id*="dropdown"]',
    '.async-select',
    '.dynamic-dropdown'
  ];
  
  return dynamicDropdownSelectors.some(pattern => fieldSelector.includes(pattern));
}

/**
 * Factory function to create Playwright automation instance
 */
export function createPlaywrightAutomation(options?: PlaywrightAutomationOptions): PlaywrightAutomationService {
  return new PlaywrightAutomationService(options);
} 