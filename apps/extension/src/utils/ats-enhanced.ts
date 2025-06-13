import { Profile } from '../types/profile';
import { ATSPlatform, fillATSFields } from './ats';
import { 
  getPlaywrightService, 
  identifyComplexFields, 
  PlaywrightResponse,
  ComplexFieldRequest 
} from './playwright-background-service';

export interface EnhancedFillResult {
  success: boolean;
  totalFieldsFilled: number;
  contentScriptFields: number;
  playwrightFields: number;
  errors: string[];
  warnings: string[];
  usedPlaywright: boolean;
  recommendations: string[];
  platformSpecificInfo?: {
    platform: string;
    detectedComplexFields: string[];
    requiresManualSteps: boolean;
  };
}

export interface EnhancedFillOptions {
  usePlaywrightForComplex?: boolean;
  forcePlaywright?: boolean;
  forceContentScript?: boolean;
  currentUrl?: string;
  enableFileUploads?: boolean;
  enableLocationAutocomplete?: boolean;
  enableMultiStepFlow?: boolean;
  debugMode?: boolean;
}

/**
 * Enhanced ATS field filling that combines content script approach with Playwright
 * for complex scenarios like file uploads, location autocomplete, and multi-step flows
 */
export class EnhancedATSFiller {
  private playwrightService = getPlaywrightService();
  private debugMode = false;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * Fill ATS form using intelligent hybrid approach
   */
  async fillATSFieldsEnhanced(
    platform: ATSPlatform, 
    profile: Profile,
    options: EnhancedFillOptions = {}
  ): Promise<EnhancedFillResult> {
    const {
      usePlaywrightForComplex = true,
      forcePlaywright = false,
      forceContentScript = false,
      currentUrl = window.location.href,
      enableFileUploads = true,
      enableLocationAutocomplete = true,
      enableMultiStepFlow = true,
      debugMode = this.debugMode
    } = options;

    this.log(debugMode, 'Starting enhanced ATS field filling...', { platform: platform.slug, url: currentUrl });

    const result: EnhancedFillResult = {
      success: false,
      totalFieldsFilled: 0,
      contentScriptFields: 0,
      playwrightFields: 0,
      errors: [],
      warnings: [],
      usedPlaywright: false,
      recommendations: [],
      platformSpecificInfo: {
        platform: platform.slug,
        detectedComplexFields: [],
        requiresManualSteps: false
      }
    };

    try {
      // Strategy selection based on platform and profile analysis
      const strategy = this.determineOptimalStrategy(platform, profile, {
        forcePlaywright,
        forceContentScript,
        usePlaywrightForComplex,
        enableFileUploads,
        enableLocationAutocomplete,
        enableMultiStepFlow
      });

      this.log(debugMode, `Selected strategy: ${strategy.type}`, strategy);

      switch (strategy.type) {
        case 'playwright-only':
          return await this.executePlaywrightOnlyStrategy(currentUrl, platform, profile, strategy, debugMode);
        
        case 'hybrid':
          return await this.executeHybridStrategy(currentUrl, platform, profile, strategy, debugMode);
        
        case 'content-script-only':
          return await this.executeContentScriptOnlyStrategy(platform, profile, debugMode);
        
        default:
          throw new Error(`Unknown strategy: ${strategy.type}`);
      }

    } catch (error: any) {
      this.log(debugMode, 'Critical error in enhanced filling', error);
      result.errors.push(`Critical error: ${error.message}`);
      result.success = false;
      result.recommendations = this.generateFailureRecommendations(error, platform, profile);
      return result;
    }
  }

  /**
   * Determine optimal filling strategy based on platform and profile
   */
  private determineOptimalStrategy(
    platform: ATSPlatform,
    profile: Profile,
    options: any
  ) {
    if (options.forcePlaywright) {
      return {
        type: 'playwright-only',
        reason: 'Forced Playwright mode',
        complexFields: this.getAllFieldsAsComplex(platform, profile)
      };
    }

    if (options.forceContentScript) {
      return {
        type: 'content-script-only',
        reason: 'Forced content script mode'
      };
    }

    const complexFields = identifyComplexFields(platform, profile);
    const hasFileUploads = complexFields.some(f => f.type === 'file_upload');
    const hasLocationAutocomplete = complexFields.some(f => f.type === 'location_autocomplete');
    const hasMultiStep = complexFields.some(f => f.type === 'multi_step');
    const requiresPlaywright = hasFileUploads || hasLocationAutocomplete || hasMultiStep;

    // Platform-specific strategies
    if (platform.slug === 'workday' && options.enableMultiStepFlow) {
      return {
        type: 'playwright-only',
        reason: 'Workday requires multi-step handling',
        complexFields: this.getAllFieldsAsComplex(platform, profile)
      };
    }

    if (platform.slug === 'lever' && hasLocationAutocomplete && options.enableLocationAutocomplete) {
      return {
        type: 'hybrid',
        reason: 'Lever location autocomplete needs Playwright',
        complexFields,
        basicFirst: true
      };
    }

    if (requiresPlaywright && options.usePlaywrightForComplex) {
      return {
        type: 'hybrid',
        reason: 'Complex fields detected',
        complexFields,
        basicFirst: true
      };
    }

    return {
      type: 'content-script-only',
      reason: 'No complex fields detected'
    };
  }

  /**
   * Execute Playwright-only strategy
   */
  private async executePlaywrightOnlyStrategy(
    currentUrl: string,
    platform: ATSPlatform,
    profile: Profile,
    strategy: any,
    debugMode: boolean
  ): Promise<EnhancedFillResult> {
    this.log(debugMode, 'Executing Playwright-only strategy');

    const result: EnhancedFillResult = {
      success: false,
      totalFieldsFilled: 0,
      contentScriptFields: 0,
      playwrightFields: 0,
      errors: [],
      warnings: [],
      usedPlaywright: true,
      recommendations: [],
      platformSpecificInfo: {
        platform: platform.slug,
        detectedComplexFields: strategy.complexFields.map((f: any) => f.type),
        requiresManualSteps: platform.slug === 'workday'
      }
    };

    try {
      const playwrightResult = await this.playwrightService.handleComplexForm(
        currentUrl,
        platform,
        profile,
        strategy.complexFields
      );

      result.playwrightFields = playwrightResult.filledFields;
      result.totalFieldsFilled = playwrightResult.filledFields;
      result.errors = playwrightResult.errors;
      result.warnings = playwrightResult.warnings;
      result.success = playwrightResult.success;

      this.addPlatformSpecificRecommendations(platform, result);
      
      return result;
    } catch (error: any) {
      result.errors.push(`Playwright execution failed: ${error.message}`);
      result.success = false;
      result.recommendations = this.generatePlaywrightFailureRecommendations(error, platform);
      return result;
    }
  }

  /**
   * Execute hybrid strategy (content script + Playwright)
   */
  private async executeHybridStrategy(
    currentUrl: string,
    platform: ATSPlatform,
    profile: Profile,
    strategy: any,
    debugMode: boolean
  ): Promise<EnhancedFillResult> {
    this.log(debugMode, 'Executing hybrid strategy');

    const result: EnhancedFillResult = {
      success: false,
      totalFieldsFilled: 0,
      contentScriptFields: 0,
      playwrightFields: 0,
      errors: [],
      warnings: [],
      usedPlaywright: true,
      recommendations: [],
      platformSpecificInfo: {
        platform: platform.slug,
        detectedComplexFields: strategy.complexFields.map((f: any) => f.type),
        requiresManualSteps: false
      }
    };

    // Phase 1: Content script for basic fields
    this.log(debugMode, 'Phase 1: Content script filling basic fields');
    try {
      result.contentScriptFields = await fillATSFields(platform, profile);
      this.log(debugMode, `Content script filled ${result.contentScriptFields} fields`);
    } catch (error: any) {
      result.errors.push(`Content script phase failed: ${error.message}`);
      this.log(debugMode, 'Content script phase failed', error);
    }

    // Phase 2: Playwright for complex fields
    if (strategy.complexFields.length > 0) {
      this.log(debugMode, `Phase 2: Playwright handling ${strategy.complexFields.length} complex fields`);
      
      try {
        // Wait for content script changes to settle
        await this.waitForSettling(500);

        const playwrightResult = await this.playwrightService.handleComplexForm(
          currentUrl,
          platform,
          profile,
          strategy.complexFields
        );

        result.playwrightFields = playwrightResult.filledFields;
        result.errors.push(...playwrightResult.errors);
        result.warnings.push(...playwrightResult.warnings);

        this.log(debugMode, `Playwright filled ${result.playwrightFields} complex fields`);
      } catch (error: any) {
        result.errors.push(`Playwright phase failed: ${error.message}`);
        this.log(debugMode, 'Playwright phase failed', error);
      }
    }

    // Phase 3: Analysis and recommendations
    result.totalFieldsFilled = result.contentScriptFields + result.playwrightFields;
    result.success = result.totalFieldsFilled > 0 && result.errors.length === 0;

    this.addHybridSpecificAnalysis(platform, result, strategy);
    this.addPlatformSpecificRecommendations(platform, result);

    return result;
  }

  /**
   * Execute content script only strategy
   */
  private async executeContentScriptOnlyStrategy(
    platform: ATSPlatform,
    profile: Profile,
    debugMode: boolean
  ): Promise<EnhancedFillResult> {
    this.log(debugMode, 'Executing content script only strategy');

    const result: EnhancedFillResult = {
      success: false,
      totalFieldsFilled: 0,
      contentScriptFields: 0,
      playwrightFields: 0,
      errors: [],
      warnings: [],
      usedPlaywright: false,
      recommendations: [],
      platformSpecificInfo: {
        platform: platform.slug,
        detectedComplexFields: [],
        requiresManualSteps: false
      }
    };

    try {
      result.contentScriptFields = await fillATSFields(platform, profile);
      result.totalFieldsFilled = result.contentScriptFields;
      result.success = result.totalFieldsFilled > 0;

      // Check if we missed complex fields that would benefit from Playwright
      const missedComplexFields = identifyComplexFields(platform, profile);
      if (missedComplexFields.length > 0) {
        result.warnings.push(`Detected ${missedComplexFields.length} complex fields that could benefit from Playwright`);
        result.recommendations.push('Consider enabling Playwright for better handling of file uploads and location autocomplete');
      }

      this.addContentScriptSpecificAnalysis(platform, result);
      
      return result;
    } catch (error: any) {
      result.errors.push(`Content script failed: ${error.message}`);
      result.success = false;
      result.recommendations = this.generateContentScriptFailureRecommendations(error, platform);
      return result;
    }
  }

  /**
   * Handle specific file upload scenario
   */
  async handleFileUpload(
    platform: ATSPlatform,
    profile: Profile,
    fileType: 'resume' | 'coverLetter',
    options: { debugMode?: boolean } = {}
  ): Promise<PlaywrightResponse> {
    const { debugMode = this.debugMode } = options;
    const currentUrl = window.location.href;
    
    this.log(debugMode, `Handling ${fileType} upload for ${platform.slug}`);

    const fileConfig = this.getFileUploadConfig(platform, fileType);
    
    if (!fileConfig.available) {
      throw new Error(`${fileType} upload not supported for ${platform.slug}`);
    }

    return await this.playwrightService.handleFileUpload(
      currentUrl,
      platform,
      profile,
      fileConfig.selector,
      fileConfig.fileName
    );
  }

  /**
   * Handle location autocomplete specifically
   */
  async handleLocationAutocomplete(
    platform: ATSPlatform,
    profile: Profile,
    options: { debugMode?: boolean; fallbackToBasic?: boolean } = {}
  ): Promise<PlaywrightResponse> {
    const { debugMode = this.debugMode, fallbackToBasic = true } = options;

    if (!platform.selectors.location || !profile.personal?.city) {
      throw new Error('Location field or city data not available');
    }

    const currentUrl = window.location.href;
    const location = this.constructLocationString(profile);

    this.log(debugMode, `Handling location autocomplete: "${location}" for ${platform.slug}`);

    try {
      return await this.playwrightService.handleLocationAutocomplete(
        currentUrl,
        platform,
        profile,
        platform.selectors.location,
        location
      );
    } catch (error: any) {
      if (fallbackToBasic) {
        this.log(debugMode, 'Location autocomplete failed, falling back to basic input');
        // Fallback to basic input filling
        const element = document.querySelector(platform.selectors.location) as HTMLInputElement;
        if (element) {
          element.value = location;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          
          return {
            success: true,
            filledFields: 1,
            errors: [],
            warnings: ['Used basic input fallback for location field']
          };
        }
      }
      throw error;
    }
  }

  /**
   * Advanced form analysis and recommendations
   */
  async analyzeForm(platform: ATSPlatform, profile: Profile): Promise<{
    complexity: 'simple' | 'moderate' | 'complex';
    recommendedStrategy: string;
    detectedFields: string[];
    potentialIssues: string[];
    optimizations: string[];
  }> {
    const complexFields = identifyComplexFields(platform, profile);
    const availableFields = this.detectAvailableFields(platform);
    
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (complexFields.length > 0) complexity = 'moderate';
    if (complexFields.length > 3 || platform.slug === 'workday') complexity = 'complex';

    const potentialIssues = this.identifyPotentialIssues(platform, profile, availableFields);
    const optimizations = this.suggestOptimizations(platform, profile, complexFields);

    return {
      complexity,
      recommendedStrategy: this.getRecommendedStrategy(complexity, platform, complexFields),
      detectedFields: availableFields,
      potentialIssues,
      optimizations
    };
  }

  // Helper methods
  private getAllFieldsAsComplex(platform: ATSPlatform, profile: Profile): ComplexFieldRequest[] {
    const fields: ComplexFieldRequest[] = [];
    
    // Convert all basic fields to complex handling for Playwright
    if (platform.selectors.firstName && profile.personal?.firstName) {
      fields.push({ type: 'dynamic_dropdown', selector: platform.selectors.firstName, value: profile.personal.firstName });
    }
    if (platform.selectors.lastName && profile.personal?.lastName) {
      fields.push({ type: 'dynamic_dropdown', selector: platform.selectors.lastName, value: profile.personal.lastName });
    }
    if (platform.selectors.email && profile.personal?.email) {
      fields.push({ type: 'dynamic_dropdown', selector: platform.selectors.email, value: profile.personal.email });
    }
    if (platform.selectors.phone && profile.personal?.phone) {
      fields.push({ type: 'dynamic_dropdown', selector: platform.selectors.phone, value: profile.personal.phone });
    }

    // Add the identified complex fields
    fields.push(...identifyComplexFields(platform, profile));

    return fields;
  }

  private addPlatformSpecificRecommendations(platform: ATSPlatform, result: EnhancedFillResult): void {
    switch (platform.slug) {
      case 'workday':
        result.recommendations.push('Check for "Continue" or "Next" buttons to proceed to additional steps');
        result.recommendations.push('Workday forms often have multiple pages - monitor for navigation requirements');
        if (result.totalFieldsFilled > 0) {
          result.recommendations.push('Verify that required fields show green checkmarks');
        }
        break;

      case 'lever':
        if (result.usedPlaywright && result.playwrightFields > 0) {
          result.recommendations.push('Verify location autocomplete selection is correct');
        }
        result.recommendations.push('Lever may require manual resume upload verification');
        break;

      case 'greenhouse':
        result.recommendations.push('Check for additional custom questions below the main form');
        if (result.totalFieldsFilled < 5) {
          result.recommendations.push('Greenhouse forms typically have many fields - ensure profile is complete');
        }
        break;

      case 'ashby':
        result.recommendations.push('Ashby forms may have conditional fields that appear based on selections');
        break;
    }

    // General recommendations
    if (result.errors.length > 0) {
      result.recommendations.push('Check browser console for detailed error information');
    }
    
    if (result.usedPlaywright && result.playwrightFields === 0) {
      result.recommendations.push('Playwright was attempted but no fields were filled - form may need manual review');
    }
  }

  private addHybridSpecificAnalysis(platform: ATSPlatform, result: EnhancedFillResult, strategy: any): void {
    if (result.contentScriptFields === 0 && result.playwrightFields > 0) {
      result.warnings.push('Content script phase failed but Playwright succeeded - form may be complex');
    }
    
    if (result.contentScriptFields > 0 && result.playwrightFields === 0) {
      result.warnings.push('Content script worked but Playwright phase failed - complex fields may need manual handling');
    }

    const expectedFields = this.estimateExpectedFields(platform, strategy);
    if (result.totalFieldsFilled < expectedFields * 0.7) {
      result.warnings.push(`Only filled ${result.totalFieldsFilled}/${expectedFields} expected fields`);
    }
  }

  private addContentScriptSpecificAnalysis(platform: ATSPlatform, result: EnhancedFillResult): void {
    if (result.contentScriptFields === 0) {
      result.warnings.push('No fields filled - form may not be ready or selectors may be outdated');
      result.recommendations.push('Try refreshing the page and waiting for form to fully load');
    }

    // Platform-specific content script analysis
    if (platform.slug === 'lever' && result.contentScriptFields > 0) {
      result.warnings.push('Lever location field may not work properly without Playwright');
    }
  }

  private generateFailureRecommendations(error: any, platform: ATSPlatform, profile: Profile): string[] {
    const recommendations = [
      'Refresh the page and try again',
      'Ensure your profile is complete in extension settings',
      'Check that the form is fully loaded before attempting to fill'
    ];

    if (error.message.includes('timeout')) {
      recommendations.push('Form may be loading slowly - wait longer before trying again');
    }

    if (error.message.includes('selector')) {
      recommendations.push('Form structure may have changed - extension may need updates');
    }

    return recommendations;
  }

  private generatePlaywrightFailureRecommendations(error: any, platform: ATSPlatform): string[] {
    return [
      'Try using content script mode instead of Playwright',
      'Check if browser allows Playwright automation on this site',
      'Verify that complex fields are actually present on the form'
    ];
  }

  private generateContentScriptFailureRecommendations(error: any, platform: ATSPlatform): string[] {
    return [
      'Try enabling Playwright mode for better reliability',
      'Ensure form is fully loaded and visible',
      'Check for any blocking overlays or modals'
    ];
  }

  private getFileUploadConfig(platform: ATSPlatform, fileType: 'resume' | 'coverLetter') {
    const configs = {
      resume: {
        selector: platform.selectors.resume || 'input[type="file"][name*="resume"]',
        fileName: 'resume.pdf',
        available: !!platform.selectors.resume
      },
      coverLetter: {
        selector: platform.selectors.coverLetter || 'input[type="file"][name*="cover"]',
        fileName: 'cover_letter.pdf',
        available: !!platform.selectors.coverLetter
      }
    };

    return configs[fileType];
  }

  private constructLocationString(profile: Profile): string {
    if (!profile.personal?.city) return '';
    
    if (profile.personal.state) {
      return `${profile.personal.city}, ${profile.personal.state}`;
    }
    
    return profile.personal.city;
  }

  private detectAvailableFields(platform: ATSPlatform): string[] {
    const fields: string[] = [];
    Object.entries(platform.selectors).forEach(([key, selector]) => {
      if (selector && document.querySelector(selector)) {
        fields.push(key);
      }
    });
    return fields;
  }

  private identifyPotentialIssues(platform: ATSPlatform, profile: Profile, availableFields: string[]): string[] {
    const issues = [];
    
    if (availableFields.includes('resume') && !profile.documents?.resume) {
      issues.push('Resume upload field detected but no resume in profile');
    }
    
    if (availableFields.includes('location') && !profile.personal?.city) {
      issues.push('Location field detected but no city in profile');
    }

    if (platform.slug === 'workday' && availableFields.length < 3) {
      issues.push('Workday form may not be fully loaded');
    }

    return issues;
  }

  private suggestOptimizations(platform: ATSPlatform, profile: Profile, complexFields: ComplexFieldRequest[]): string[] {
    const optimizations = [];
    
    if (complexFields.length > 0 && !this.playwrightService) {
      optimizations.push('Enable Playwright for better handling of complex fields');
    }
    
    if (platform.slug === 'lever' && complexFields.some(f => f.type === 'location_autocomplete')) {
      optimizations.push('Lever location fields work best with Playwright autocomplete handling');
    }

    return optimizations;
  }

  private getRecommendedStrategy(complexity: string, platform: ATSPlatform, complexFields: ComplexFieldRequest[]): string {
    if (complexity === 'complex' || platform.slug === 'workday') {
      return 'playwright-only';
    }
    
    if (complexity === 'moderate' && complexFields.length > 0) {
      return 'hybrid';
    }
    
    return 'content-script-only';
  }

  private estimateExpectedFields(platform: ATSPlatform, strategy: any): number {
    // Simple heuristic based on platform and detected fields
    const baseFields = ['firstName', 'lastName', 'email', 'phone'].filter(f => platform.selectors[f]).length;
    const complexFields = strategy.complexFields?.length || 0;
    return baseFields + complexFields;
  }

  private async waitForSettling(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(debugMode: boolean, message: string, data?: any): void {
    if (debugMode) {
      console.log(`[EnhancedATSFiller] ${message}`, data || '');
    }
  }
}

/**
 * Factory function to create enhanced ATS filler
 */
export function createEnhancedATSFiller(debugMode = false): EnhancedATSFiller {
  return new EnhancedATSFiller(debugMode);
}

/**
 * Convenience function for enhanced filling with full options
 */
export async function fillATSFieldsEnhanced(
  platform: ATSPlatform,
  profile: Profile,
  options?: EnhancedFillOptions
): Promise<EnhancedFillResult> {
  const filler = createEnhancedATSFiller(options?.debugMode);
  return await filler.fillATSFieldsEnhanced(platform, profile, options);
} 