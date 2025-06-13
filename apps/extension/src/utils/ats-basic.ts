/**
 * Basic ATS Field Filling (Content Script Only)
 * Handles standard form field filling without Playwright dependency
 */

import { Profile } from '../types/profile';
import { ATSPlatform } from './ats-platforms';

/**
 * Fill fields on the current ATS platform with user profile data
 * Uses content script approach only (no Playwright)
 */
export function fillATSFields(
  platform: ATSPlatform,
  profile: Profile
): Promise<number> {
  return new Promise((resolve, reject) => {
    let filledCount = 0;
    
    try {
      // Personal information
      if (profile.personal) {
        // Special case for Lever which uses full name in firstName field
        if (platform.slug === 'lever' && platform.selectors.firstName) {
          const fullName = `${profile.personal.firstName || ''} ${profile.personal.lastName || ''}`.trim();
          if (fullName && fillInputField(platform.selectors.firstName, fullName)) {
            filledCount++;
          }
        } else {
          // Standard first name / last name handling
          if (profile.personal.firstName && platform.selectors.firstName) {
            if (fillInputField(platform.selectors.firstName, profile.personal.firstName)) {
              filledCount++;
            }
          }
          
          if (profile.personal.lastName && platform.selectors.lastName) {
            if (fillInputField(platform.selectors.lastName, profile.personal.lastName)) {
              filledCount++;
            }
          }
        }
        
        if (profile.personal.email && platform.selectors.email) {
          if (fillInputField(platform.selectors.email, profile.personal.email)) {
            filledCount++;
          }
        }
        
        if (profile.personal.phone && platform.selectors.phone) {
          if (fillInputField(platform.selectors.phone, profile.personal.phone)) {
            filledCount++;
          }
        }
        
        // Location handling (different strategies per platform)
        if (profile.personal.city && platform.selectors.location) {
          const location = constructLocationString(profile.personal);
          
          if (platform.slug === 'lever') {
            // Lever has special autocomplete handling
            if (fillLeverLocationField(platform.selectors.location, location)) {
              filledCount++;
            }
          } else {
            // Standard location field
            if (fillInputField(platform.selectors.location, location)) {
              filledCount++;
            }
          }
        }
        
        // Individual location fields for platforms that separate them
        if (platform.selectors.city && profile.personal.city) {
          if (fillInputField(platform.selectors.city, profile.personal.city)) {
            filledCount++;
          }
        }
        
        if (platform.selectors.state && profile.personal.state) {
          if (fillSelectField(platform.selectors.state, profile.personal.state)) {
            filledCount++;
          }
        }
        
        if (platform.selectors.zip && profile.personal.zip) {
          if (fillInputField(platform.selectors.zip, profile.personal.zip)) {
            filledCount++;
          }
        }
        
        if (platform.selectors.address && profile.personal.address) {
          if (fillInputField(platform.selectors.address, profile.personal.address)) {
            filledCount++;
          }
        }
      }

      // LinkedIn profile URL
      if (profile.personal?.linkedIn && platform.selectors.linkedin) {
        if (fillInputField(platform.selectors.linkedin, profile.personal.linkedIn)) {
          filledCount++;
        }
      }
      
      // GitHub profile URL (mainly for Lever)
      if (profile.personal?.github && platform.selectors.github) {
        if (fillInputField(platform.selectors.github, profile.personal.github)) {
          filledCount++;
        }
      }
      
      // Website/Portfolio URL
      if (profile.personal?.website && platform.selectors.website) {
        if (fillInputField(platform.selectors.website, profile.personal.website)) {
          filledCount++;
        }
      }

      console.log(`[BasicATS] Successfully filled ${filledCount} fields for ${platform.name}`);
      
      // Add a small delay to ensure all fields are processed
      setTimeout(() => {
        resolve(filledCount);
      }, process.env.NODE_ENV === 'test' ? 100 : 1000);
      
    } catch (error: any) {
      console.error(`[BasicATS] Error filling fields for ${platform.name}:`, error);
      reject(error);
    }
  });
}

/**
 * Fill a basic input field with proper event triggering
 */
function fillInputField(selector: string, value: string): boolean {
  try {
    const elements = document.querySelectorAll(selector);
    let filled = false;
    
    elements.forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        // Clear existing value
        element.value = '';
        
        // Focus the field
        element.focus();
        
        // Set the value
        element.value = value;
        
        // Trigger input events to ensure proper validation
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);
        
        // Some frameworks need specific events
        const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
        element.dispatchEvent(blurEvent);
        
        console.log(`[BasicATS] Filled ${selector} with: ${value}`);
        filled = true;
      }
    });
    
    return filled;
  } catch (error) {
    console.error(`[BasicATS] Error filling field ${selector}:`, error);
    return false;
  }
}

/**
 * Fill a select field with proper option selection
 */
function fillSelectField(selector: string, value: string): boolean {
  try {
    const selectElement = document.querySelector(selector) as HTMLSelectElement;
    if (!selectElement) return false;
    
    // Try exact match first
    const exactMatch = Array.from(selectElement.options).find(
      option => option.value.toLowerCase() === value.toLowerCase() ||
                option.text.toLowerCase() === value.toLowerCase()
    );
    
    if (exactMatch) {
      selectElement.value = exactMatch.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[BasicATS] Selected ${selector}: ${exactMatch.text}`);
      return true;
    }
    
    // Try partial match for state abbreviations
    const partialMatch = Array.from(selectElement.options).find(
      option => option.value.toLowerCase().includes(value.toLowerCase()) ||
                option.text.toLowerCase().includes(value.toLowerCase())
    );
    
    if (partialMatch) {
      selectElement.value = partialMatch.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[BasicATS] Selected ${selector}: ${partialMatch.text} (partial match)`);
      return true;
    }
    
    console.warn(`[BasicATS] Could not find matching option for ${selector}: ${value}`);
    return false;
  } catch (error) {
    console.error(`[BasicATS] Error filling select field ${selector}:`, error);
    return false;
  }
}

/**
 * Special handling for Lever location fields with autocomplete
 */
function fillLeverLocationField(selector: string, value: string): boolean {
  try {
    const locationInput = document.querySelector(selector) as HTMLInputElement;
    if (!locationInput) return false;
    
    // Focus and clear the field
    locationInput.focus();
    locationInput.value = '';
    
    // Type character by character to trigger autocomplete
    let currentValue = '';
    const typeInterval = setInterval(() => {
      if (currentValue.length < value.length) {
        currentValue += value[currentValue.length];
        locationInput.value = currentValue;
        
        // Trigger input event for each character
        const inputEvent = new Event('input', { bubbles: true });
        locationInput.dispatchEvent(inputEvent);
      } else {
        clearInterval(typeInterval);
        
        // Wait for autocomplete dropdown, then try to select first option
        setTimeout(() => {
          const autocompleteOptions = document.querySelectorAll(
            '.autocomplete-option, .pac-item, .lever-location-option, [role="option"]'
          );
          
          if (autocompleteOptions.length > 0) {
            (autocompleteOptions[0] as HTMLElement).click();
            console.log(`[BasicATS] Selected Lever location autocomplete option`);
          } else {
            // No autocomplete found, just trigger change event
            locationInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[BasicATS] Filled Lever location field (no autocomplete): ${value}`);
          }
        }, process.env.NODE_ENV === 'test' ? 50 : 750);
      }
    }, 100);
    
    return true;
  } catch (error) {
    console.error(`[BasicATS] Error filling Lever location field:`, error);
    return false;
  }
}

/**
 * Construct location string from profile data
 */
function constructLocationString(personal: Profile['personal']): string {
  if (!personal?.city) return '';
  
  const parts = [personal.city];
  
  if (personal.state) {
    parts.push(personal.state);
  }
  
  if (personal.country && personal.country !== 'United States') {
    parts.push(personal.country);
  }
  
  return parts.join(', ');
}

/**
 * Validate that form fields are properly filled and ready for submission
 */
export function validateFormCompletion(platform: ATSPlatform): boolean {
  const requiredFields = ['firstName', 'lastName', 'email'];
  
  for (const fieldKey of requiredFields) {
    const selector = platform.selectors[fieldKey];
    if (!selector) continue;
    
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element || !element.value.trim()) {
      console.warn(`[BasicATS] Required field ${fieldKey} is empty`);
      return false;
    }
  }
  
  console.log(`[BasicATS] Form validation passed for ${platform.name}`);
  return true;
}

/**
 * Check if form elements are ready for filling
 */
export function isFormReady(platform: ATSPlatform): boolean {
  // Check if at least one key field is present and visible
  const keySelectors = [
    platform.selectors.firstName,
    platform.selectors.email,
    platform.selectors.lastName
  ].filter(Boolean);
  
  for (const selector of keySelectors) {
    const element = document.querySelector(selector);
    if (element && isElementVisible(element as HTMLElement)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if an element is visible and interactable
 */
function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

/**
 * Get summary of fillable fields on current page
 */
export function analyzeAvailableFields(platform: ATSPlatform): {
  availableFields: string[];
  missingFields: string[];
  formReadiness: 'ready' | 'partial' | 'not-ready';
} {
  const availableFields: string[] = [];
  const missingFields: string[] = [];
  
  Object.entries(platform.selectors).forEach(([fieldKey, selector]) => {
    if (selector && document.querySelector(selector)) {
      availableFields.push(fieldKey);
    } else {
      missingFields.push(fieldKey);
    }
  });
  
  let formReadiness: 'ready' | 'partial' | 'not-ready' = 'not-ready';
  
  if (availableFields.length >= 3) {
    formReadiness = 'ready';
  } else if (availableFields.length > 0) {
    formReadiness = 'partial';
  }
  
  return {
    availableFields,
    missingFields,
    formReadiness
  };
} 