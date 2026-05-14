/**
 * 🤖 COMPREHENSIVE FORM AUTOMATION SYSTEM
 * 
 * The complete solution for bot-detection-resistant job application automation.
 * Addresses the three critical bottlenecks:
 * 
 * 1. 🎯 PRECISE PAGE DETECTION & CONTEXT UNDERSTANDING
 *    - Advanced ATS platform detection
 *    - Multi-step form analysis
 *    - Dynamic content recognition
 * 
 * 2. 🔍 COMPLETE ELEMENT DISCOVERY & CLASSIFICATION  
 *    - Intelligent field identification
 *    - Context-aware field mapping
 *    - Adaptive selector strategies
 * 
 * 3. 🧠 HUMAN-LIKE INTERACTION & VERIFICATION
 *    - Anti-bot detection bypass
 *    - Realistic typing patterns
 *    - CAPTCHA handling
 *    - Field validation
 * 
 * Content Script Only - No Playwright Dependencies
 */

import { HumanLikeAutomation, type HumanBehaviorConfig } from './human-like-automation';
import { CaptchaHandler, type CaptchaInfo } from './captcha-handler';
import { detectATS, type ATSPlatform } from './ats-platforms';

/**
 * Page context information
 */
interface PageContext {
  pageType: 'job-listing' | 'application-form' | 'multi-step' | 'unknown';
  ats: ATSPlatform | null;
  step?: number;
  totalSteps?: number;
  url: string;
  title: string;
  hasProtection: boolean;
  captchas: CaptchaInfo[];
}

/**
 * Field classification and metadata
 */
interface FieldInfo {
  element: HTMLElement;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'file' | 'checkbox' | 'radio';
  fieldKey: string; // What this field represents (firstName, email, etc.)
  label: string;
  required: boolean;
  visible: boolean;
  interactable: boolean;
  isProtected: boolean;
  selector: string;
  priority: number; // Fill order priority
  validationRules?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Automation result with comprehensive feedback
 */
interface AutomationResult {
  success: boolean;
  pageContext: PageContext;
  fieldsDiscovered: number;
  fieldsAttempted: number;
  fieldsFilled: number;
  captchasSolved: number;
  errors: string[];
  warnings: string[];
  nextActions: string[];
  timeTaken: number;
}

/**
 * Profile data structure
 */
interface UserProfile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    linkedIn?: string;
    github?: string;
    website?: string;
    twitter?: string;
  };
  documents?: {
    resumeFile?: File;
    coverLetterText?: string;
  };
  preferences?: {
    currentLocation?: string;
    desiredSalary?: string;
    availableStartDate?: string;
    usWorkAuth?: string;
    sponsorshipRequired?: string;
  };
  workExperience?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    currentlyWorkHere?: boolean;
    description?: string;
    location?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
  }>;
  eeo?: {
    gender?: string;
    ethnicity?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
  };
}

export class ComprehensiveFormAutomation {
  private humanAutomation: HumanLikeAutomation;
  private startTime: number = 0;

  constructor(config?: Partial<HumanBehaviorConfig>) {
    // Configure for job application context - very human-like to avoid reCAPTCHA
    this.humanAutomation = new HumanLikeAutomation({
      minDelay: 150,
      maxDelay: 400,
      typingSpeedWpm: 45, // More conservative typing speed
      scrollBehavior: true,
      mouseMovement: true,
      errorRate: 0.02, // 2% error rate for realism
      ...config
    });
  }

  /**
   * 🎯 BOTTLENECK 1: Comprehensive Page Detection & Context Understanding
   */
  async analyzePageContext(): Promise<PageContext> {
    console.log('[ComprehensiveAutomation] Analyzing page context...');
    
    const context: PageContext = {
      pageType: 'unknown',
      ats: null,
      url: window.location.href,
      title: document.title,
      hasProtection: false,
      captchas: []
    };

    // 1. Detect ATS platform
    context.ats = detectATS(context.url);
    console.log(`[ComprehensiveAutomation] ATS detected: ${context.ats?.name || 'None'}`);

    // 2. Analyze page type based on form complexity and structure  
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input, textarea, select');
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Find submit buttons (can't use :contains() in CSS selectors)
    const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button')).filter(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      return text.includes('apply') || text.includes('submit');
    });

    if (forms.length === 0 && inputs.length === 0) {
      context.pageType = 'job-listing';
    } else if (inputs.length > 8 || fileInputs.length > 0) {
      // Complex form likely an application
      context.pageType = 'application-form';
      
      // Check for multi-step indicators
      const stepIndicators = document.querySelectorAll('[data-step], .step, .page, [class*="step"], [class*="page"]');
      if (stepIndicators.length > 1) {
        context.pageType = 'multi-step';
        context.step = this.detectCurrentStep();
        context.totalSteps = stepIndicators.length;
      }
    } else if (inputs.length > 0) {
      context.pageType = 'application-form';
    }

    // 3. Detect anti-bot protection
    context.hasProtection = this.detectAntiBot();
    
    // 4. Detect CAPTCHAs
    context.captchas = CaptchaHandler.detectCaptchas();
    
    console.log(`[ComprehensiveAutomation] Page analysis complete:`, {
      type: context.pageType,
      inputs: inputs.length,
      protection: context.hasProtection,
      captchas: context.captchas.length
    });

    return context;
  }

  /**
   * 🔍 BOTTLENECK 2: Complete Element Discovery & Classification
   */
  async discoverAllFormElements(atsContext?: ATSPlatform): Promise<FieldInfo[]> {
    console.log('[ComprehensiveAutomation] Discovering all form elements...');
    
    const fields: FieldInfo[] = [];
    
    // Get all potential form elements
    const allElements = document.querySelectorAll(`
      input:not([type="hidden"]):not([type="submit"]):not([type="button"]),
      textarea,
      select
    `);

    let priority = 1;
    
    for (const element of allElements) {
      const fieldInfo = await this.analyzeElement(element as HTMLElement, atsContext, priority++);
      if (fieldInfo) {
        fields.push(fieldInfo);
      }
    }

    // Sort by priority (required fields first, then by logical order)
    fields.sort((a, b) => {
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }
      return a.priority - b.priority;
    });

    console.log(`[ComprehensiveAutomation] Discovered ${fields.length} form fields:`, 
      fields.map(f => ({ key: f.fieldKey, type: f.type, required: f.required, visible: f.visible }))
    );

    return fields;
  }

  /**
   * Analyze individual form element
   */
  private async analyzeElement(element: HTMLElement, atsContext?: ATSPlatform, priority: number = 1): Promise<FieldInfo | null> {
    const fieldInfo: FieldInfo = {
      element,
      type: this.getElementType(element),
      fieldKey: '',
      label: this.getElementLabel(element),
      required: this.isElementRequired(element),
      visible: this.isElementVisible(element),
      interactable: this.isElementInteractable(element),
      isProtected: this.humanAutomation.isProtectedElement(element),
      selector: this.generateSelector(element),
      priority
    };

    // Classify what this field represents
    fieldInfo.fieldKey = this.classifyFieldPurpose(element, fieldInfo.label, atsContext);
    
    // Skip if we can't determine purpose
    if (!fieldInfo.fieldKey || fieldInfo.fieldKey === 'unknown') {
      return null;
    }

    // Extract validation rules
    fieldInfo.validationRules = this.extractValidationRules(element);

    return fieldInfo;
  }

  /**
   * 🤖 BOTTLENECK 3: Human-like Interaction & Verification
   */
  async fillFormWithProfile(profile: UserProfile, fields: FieldInfo[]): Promise<AutomationResult> {
    this.startTime = Date.now();
    console.log('[ComprehensiveAutomation] Starting human-like form filling...');
    
    const result: AutomationResult = {
      success: false,
      pageContext: await this.analyzePageContext(),
      fieldsDiscovered: fields.length,
      fieldsAttempted: 0,
      fieldsFilled: 0,
      captchasSolved: 0,
      errors: [],
      warnings: [],
      nextActions: [],
      timeTaken: 0
    };

    // Handle CAPTCHAs first - be very careful here
    if (result.pageContext.captchas.length > 0) {
      console.log('[ComprehensiveAutomation] CAPTCHAs detected, pausing automation...');
      result.warnings.push(`${result.pageContext.captchas.length} CAPTCHA(s) detected - automation paused`);
      result.nextActions.push('Please solve the CAPTCHA manually, then retry auto-fill');
      
      // Don't attempt to fill fields if CAPTCHAs are present
      result.timeTaken = Date.now() - this.startTime;
      result.success = false;
      return result;
    }

    // Fill fields in priority order
    for (const field of fields) {
      if (!field.visible || !field.interactable) {
        result.warnings.push(`Skipping non-interactable field: ${field.fieldKey}`);
        continue;
      }

      if (field.isProtected) {
        result.warnings.push(`Skipping protected field: ${field.fieldKey}`);
        continue;
      }

      result.fieldsAttempted++;

      try {
        const value = this.getProfileValue(profile, field.fieldKey);
        if (!value) {
          result.warnings.push(`No profile data for field: ${field.fieldKey}`);
          continue;
        }

        console.log(`[ComprehensiveAutomation] Filling ${field.fieldKey} with human-like behavior`);
        
        const success = await this.fillFieldHumanLike(field, value);
        if (success) {
          result.fieldsFilled++;
          
          // Verify the field was actually filled
          await this.verifyFieldFilled(field, value, result);
        } else {
          result.errors.push(`Failed to fill field: ${field.fieldKey}`);
        }

        // Extra human-like pause between fields to avoid reCAPTCHA
        await this.randomDelay(1500, 4000);

      } catch (error: any) {
        console.error(`[ComprehensiveAutomation] Error filling ${field.fieldKey}:`, error);
        result.errors.push(`Error filling ${field.fieldKey}: ${error.message}`);
      }
    }

    // Final verification
    await this.performFinalVerification(result);
    
    result.timeTaken = Date.now() - this.startTime;
    result.success = result.fieldsFilled > 0 && result.errors.length === 0;

    console.log(`[ComprehensiveAutomation] Automation complete:`, {
      success: result.success,
      filled: result.fieldsFilled,
      errors: result.errors.length,
      time: result.timeTaken
    });

    return result;
  }

  /**
   * Fill individual field with human-like behavior
   */
  private async fillFieldHumanLike(field: FieldInfo, value: string): Promise<boolean> {
    try {
      const element = field.element;

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        await this.humanAutomation.typeText(element, value);
        return true;
      } else if (element instanceof HTMLSelectElement) {
        await this.humanAutomation.selectOption(element, value);
        return true;
      } else if (element instanceof HTMLInputElement && element.type === 'file') {
        // File uploads require special handling - return false for now
        console.warn(`[ComprehensiveAutomation] File upload field requires manual handling: ${field.fieldKey}`);
        return false;
      }

      return false;
    } catch (error) {
      console.error(`[ComprehensiveAutomation] Error filling field:`, error);
      return false;
    }
  }

  /**
   * Verify field was properly filled
   */
  private async verifyFieldFilled(field: FieldInfo, expectedValue: string, result: AutomationResult): Promise<void> {
    const element = field.element;
    let actualValue = '';

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      actualValue = element.value;
    } else if (element instanceof HTMLSelectElement) {
      actualValue = element.value;
    }

    if (actualValue !== expectedValue) {
      result.warnings.push(`Field verification failed for ${field.fieldKey}: expected "${expectedValue}", got "${actualValue}"`);
    }

    // Check validation state
    if (element instanceof HTMLInputElement && !element.checkValidity()) {
      result.warnings.push(`Field validation failed for ${field.fieldKey}: ${element.validationMessage}`);
    }
  }

  /**
   * Helper methods for element analysis
   */
  private getElementType(element: HTMLElement): FieldInfo['type'] {
    if (element instanceof HTMLInputElement) {
      switch (element.type) {
        case 'email': return 'email';
        case 'tel':
        case 'phone': return 'tel';
        case 'file': return 'file';
        case 'checkbox': return 'checkbox';
        case 'radio': return 'radio';
        default: return 'text';
      }
    } else if (element instanceof HTMLSelectElement) {
      return 'select';
    } else if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }
    return 'text';
  }

  private getElementLabel(element: HTMLElement): string {
    // Try multiple methods to get the label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // Check for placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder.trim();

    // Check for nearest label
    const parent = element.closest('.form-field, .form-group, .field, .form-row');
    if (parent) {
      const label = parent.querySelector('label');
      if (label?.textContent) return label.textContent.trim();
    }

    return '';
  }

  private isElementRequired(element: HTMLElement): boolean {
    return element.hasAttribute('required') || 
           element.getAttribute('aria-required') === 'true' ||
           this.getElementLabel(element).includes('*');
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           parseFloat(style.opacity) > 0;
  }

  private isElementInteractable(element: HTMLElement): boolean {
    return this.isElementVisible(element) && 
           !(element as HTMLInputElement).disabled &&
           !(element as HTMLInputElement).readOnly;
  }

  private generateSelector(element: HTMLElement): string {
    // Generate unique selector for element
    if (element.id) return `#${element.id}`;
    
    // Check if element has name attribute (for form elements)
    const name = element.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    if (element.className) return `.${element.className.split(' ')[0]}`;
    
    // Fallback to tag with index
    const siblings = Array.from(element.parentElement?.children || []);
    const index = siblings.indexOf(element);
    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
  }

  /**
   * Classify what a field represents based on various indicators
   */
  private classifyFieldPurpose(element: HTMLElement, label: string, atsContext?: ATSPlatform): string {
    const name = element.getAttribute('name') || '';
    const id = element.id || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const type = (element as HTMLInputElement).type || '';
    
    const allText = `${name} ${id} ${label} ${placeholder}`.toLowerCase();

    // Email is easy
    if (type === 'email' || allText.includes('email') || allText.includes('e-mail')) {
      return 'email';
    }

    // Phone
    if (type === 'tel' || allText.match(/(phone|mobile|tel)/)) {
      return 'phone';
    }

    // Name fields
    if (allText.match(/(first.?name|fname|given.?name)/)) {
      return 'firstName';
    }
    if (allText.match(/(last.?name|lname|surname|family.?name)/)) {
      return 'lastName';
    }
    if (allText.includes('name') && !allText.includes('company') && !allText.includes('user')) {
      return 'fullName';
    }

    // Location fields
    if (allText.match(/(address|street)/)) {
      return 'address';
    }
    if (allText.match(/(city|town)/)) {
      return 'city';
    }
    if (allText.match(/(state|province|region)/) && element.tagName === 'SELECT') {
      return 'state';
    }
    if (allText.match(/(state|province|region)/)) {
      return 'state';
    }
    if (allText.match(/(zip|postal|postcode)/)) {
      return 'zipCode';
    }
    if (allText.match(/(country|nation)/)) {
      return 'country';
    }
    if (allText.match(/(location|where)/) && !allText.includes('work')) {
      return 'currentLocation';
    }

    // Professional fields
    if (allText.includes('linkedin')) {
      return 'linkedIn';
    }
    if (allText.includes('github')) {
      return 'github';
    }
    if (allText.match(/(website|portfolio|url)/)) {
      return 'website';
    }
    if (allText.includes('twitter') || allText.includes('x.com')) {
      return 'twitter';
    }

    // Work Experience fields
    if (allText.match(/(company|employer|organization)/) && !allText.includes('previous') && !allText.includes('past')) {
      return 'workExperience_company';
    }
    if (allText.match(/(job.?title|role|position)/) && !allText.includes('previous')) {
      return 'workExperience_title';
    }
    if (allText.match(/(start.?date|from.?date|date.?started)/)) {
      return 'workExperience_startDate';
    }
    if (allText.match(/(end.?date|to.?date|date.?ended)/)) {
      return 'workExperience_endDate';
    }
    if (allText.match(/(currently.?work|current.?job|present)/)) {
      return 'workExperience_currentlyWorkHere';
    }
    if (allText.match(/(job.?description|responsibilities|duties|achievement)/)) {
      return 'workExperience_description';
    }
    if (allText.match(/(work.?location|office.?location|job.?city)/)) {
      return 'workExperience_location';
    }

    // Previous company fields (different from current)
    if (allText.match(/(previous|past|former).*(company|employer|organization)/)) {
      return 'workExperience_previousCompany';
    }
    if (allText.match(/(previous|past|former).*(title|role|position)/)) {
      return 'workExperience_previousTitle';
    }

    // Education fields
    if (allText.match(/(school|university|college|institution)/)) {
      return 'education_institution';
    }
    if (allText.match(/(degree|diploma)/)) {
      return 'education_degree';
    }
    if (allText.match(/(field.?of.?study|major|concentration|area.?of.?study)/)) {
      return 'education_fieldOfStudy';
    }
    if (allText.match(/(edu.*start.*date|edu.*from.*date|enrollment)/)) {
      return 'education_startDate';
    }
    if (allText.match(/(edu.*end.*date|edu.*to.*date|graduation)/)) {
      return 'education_endDate';
    }
    if (allText.match(/(gpa|grade.?point)/)) {
      return 'education_gpa';
    }

    // EEO / Demographic fields
    if (allText.match(/(gender|sex)/)) {
      return 'eeo_gender';
    }
    if (allText.match(/(ethnicity|race|ethnic)/)) {
      return 'eeo_ethnicity';
    }
    if (allText.match(/(veteran|military)/)) {
      return 'eeo_veteranStatus';
    }
    if (allText.match(/(disability|disabled|accessible)/)) {
      return 'eeo_disabilityStatus';
    }

    // Work authorization
    if (allText.match(/(work.?auth|eligible|sponsor|visa|us.?citizen|right.?to.?work)/)) {
      // Check which specific question
      if (allText.match(/(sponsor|visa|require.*sponsor)/)) {
        return 'sponsorshipRequired';
      }
      return 'usWorkAuth';
    }

    // Salary expectations
    if (allText.match(/(salary|compensation|expected.?pay|pay.?range|desired.?salary)/)) {
      return 'desiredSalary';
    }

    // Available start date
    if (allText.match(/(available|start.?date|can.?you.?start|earliest)/)) {
      return 'availableStartDate';
    }

    // File uploads
    if (type === 'file') {
      if (allText.includes('resume') || allText.includes('cv')) {
        return 'resume';
      }
      if (allText.includes('cover')) {
        return 'coverLetter';
      }
      return 'document';
    }

    // Cover letter text
    if (element instanceof HTMLTextAreaElement && allText.includes('cover')) {
      return 'coverLetterText';
    }

    // Generic text areas
    if (element instanceof HTMLTextAreaElement) {
      return 'additionalInfo';
    }

    return 'unknown';
  }

  /**
   * Get value from profile for a specific field
   */
  private getProfileValue(profile: UserProfile, fieldKey: string): string | null {
    const mapping: Record<string, string | undefined> = {
      firstName: profile.personal.firstName,
      lastName: profile.personal.lastName,
      fullName: `${profile.personal.firstName} ${profile.personal.lastName}`.trim(),
      email: profile.personal.email,
      phone: profile.personal.phone,
      address: profile.personal.address,
      city: profile.personal.city,
      state: profile.personal.state,
      zipCode: profile.personal.zipCode,
      country: profile.personal.country,
      linkedIn: profile.personal.linkedIn,
      github: profile.personal.github,
      website: profile.personal.website,
      twitter: profile.personal.twitter,
      currentLocation: profile.preferences?.currentLocation,
      coverLetterText: profile.documents?.coverLetterText,
      desiredSalary: profile.preferences?.desiredSalary,
      availableStartDate: profile.preferences?.availableStartDate,
      usWorkAuth: profile.preferences?.usWorkAuth,
      sponsorshipRequired: profile.preferences?.sponsorshipRequired,
    };

    // Work experience fields — use most recent/current job
    if (fieldKey.startsWith('workExperience_')) {
      const currentJob = profile.workExperience?.[0];
      if (!currentJob) return null;

      const workMap: Record<string, string | undefined> = {
        workExperience_company: currentJob.company,
        workExperience_title: currentJob.title,
        workExperience_startDate: currentJob.startDate,
        workExperience_endDate: currentJob.endDate,
        workExperience_location: currentJob.location,
        workExperience_description: currentJob.description,
        workExperience_currentlyWorkHere: currentJob.currentlyWorkHere ? 'Yes' : undefined,
      };
      if (workMap[fieldKey]) return workMap[fieldKey];

      // Previous job (2nd entry)
      if (fieldKey.startsWith('workExperience_previous')) {
        const prevJob = profile.workExperience?.[1];
        if (!prevJob) return null;
        const prevField = fieldKey.replace('workExperience_previous', '');
        const prevMap: Record<string, string | undefined> = {
          Company: prevJob.company,
          Title: prevJob.title,
        };
        return prevMap[prevField] || null;
      }
    }

    // Education fields
    if (fieldKey.startsWith('education_')) {
      const edu = profile.education?.[0];
      if (!edu) return null;
      const eduField = fieldKey.replace('education_', '');
      const eduMap: Record<string, string | undefined> = {
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate,
        gpa: edu.gpa,
      };
      return eduMap[eduField] || null;
    }

    // EEO fields
    if (fieldKey.startsWith('eeo_')) {
      if (!profile.eeo) return null;
      const eeoField = fieldKey.replace('eeo_', '');
      return (profile.eeo as any)[eeoField] || null;
    }

    return mapping[fieldKey] || null;
  }

  /**
   * Extract validation rules from element
   */
  private extractValidationRules(element: HTMLElement): FieldInfo['validationRules'] {
    const rules: FieldInfo['validationRules'] = {};

    if (element instanceof HTMLInputElement) {
      if (element.pattern) rules.pattern = element.pattern;
      if (element.minLength > 0) rules.minLength = element.minLength;
      if (element.maxLength > 0) rules.maxLength = element.maxLength;
    }

    return Object.keys(rules).length > 0 ? rules : undefined;
  }

  /**
   * Detect current step in multi-step form
   */
  private detectCurrentStep(): number {
    const activeStep = document.querySelector('.step.active, .page.active, [data-step].active');
    if (activeStep) {
      const stepAttr = activeStep.getAttribute('data-step');
      if (stepAttr) return parseInt(stepAttr, 10);
    }

    // Fallback: check for visual indicators
    const progressIndicators = document.querySelectorAll('.progress-step, .step-indicator');
    for (let i = 0; i < progressIndicators.length; i++) {
      if (progressIndicators[i].classList.contains('active') || 
          progressIndicators[i].classList.contains('current')) {
        return i + 1;
      }
    }

    return 1;
  }

  /**
   * Detect anti-bot protection mechanisms
   */
  private detectAntiBot(): boolean {
    const protectionIndicators = [
      'cloudflare',
      'recaptcha',
      'hcaptcha',
      'turnstile',
      'funcaptcha',
      'data-cf-',
      'data-akamai',
      '_pxAppId',
      'px-captcha',
      'bot-detection',
      'anti-bot',
      'data-sitekey', // reCAPTCHA site key
      'g-recaptcha', // reCAPTCHA class
      'protected by recaptcha'
    ];

    const pageContent = document.documentElement.outerHTML.toLowerCase();
    const hasProtection = protectionIndicators.some(indicator => pageContent.includes(indicator));
    
    if (hasProtection) {
      console.warn('[ComprehensiveAutomation] Anti-bot protection detected - will proceed with extra caution');
    }
    
    return hasProtection;
  }

  /**
   * Perform final verification after all fields are filled
   */
  private async performFinalVerification(result: AutomationResult): Promise<void> {
    // Check for validation errors
    const invalidFields = document.querySelectorAll('input:invalid, select:invalid, textarea:invalid');
    if (invalidFields.length > 0) {
      result.warnings.push(`${invalidFields.length} fields have validation errors`);
    }

    // Check for empty required fields
    const emptyRequired = document.querySelectorAll('input[required]:not([value]), select[required]:not([value]), textarea[required]:empty');
    if (emptyRequired.length > 0) {
      result.warnings.push(`${emptyRequired.length} required fields are still empty`);
    }

    // Check if submit button is enabled
    const submitButton = document.querySelector('button[type="submit"], input[type="submit"]') as HTMLButtonElement;
    if (submitButton && submitButton.disabled) {
      result.nextActions.push('Submit button is disabled - check for missing required fields or validation errors');
    } else if (submitButton) {
      result.nextActions.push('Form appears ready for submission');
    }

    // Check for any newly appeared CAPTCHAs
    const newCaptchas = CaptchaHandler.detectCaptchas();
    if (newCaptchas.length > result.pageContext.captchas.length) {
      result.nextActions.push('New CAPTCHAs have appeared - solve them before submitting');
    }
  }

  /**
   * Random delay helper
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Export types and main class
export type { PageContext, FieldInfo, AutomationResult, UserProfile }; 