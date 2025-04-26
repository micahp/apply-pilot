interface AtsInfo {
  ats: string;
  version: string;
}

interface FieldMap {
  fields: Array<{
    selector: string;
    fieldKey: string;
    inputType: string;
    transform?: Record<string, string>;
  }>;
}

// ATS detection heuristics
const ATS_DETECTORS = {
  workday: () => {
    const meta = document.querySelector('meta[name="workday"]');
    return meta ? { ats: 'workday', version: meta.getAttribute('version') || 'unknown' } : null;
  },
  greenhouse: () => {
    if (window.location.hostname.includes('greenhouse.io')) {
      return { ats: 'greenhouse', version: '2024.1' };
    }
    return null;
  },
  lever: () => {
    if (window.location.hostname.includes('lever.co')) {
      return { ats: 'lever', version: 'v5' };
    }
    return null;
  }
};

// Detect which ATS platform we're on
export async function detectAts(): Promise<AtsInfo | null> {
  for (const detector of Object.values(ATS_DETECTORS)) {
    const result = detector();
    if (result) {
      return result;
    }
  }
  return null;
}

// Fill form fields based on the field map
export async function fillFields(fieldMap: FieldMap): Promise<number> {
  let filledCount = 0;
  
  for (const field of fieldMap.fields) {
    const elements = document.querySelectorAll(field.selector);
    
    for (const element of elements) {
      if (element instanceof HTMLInputElement || 
          element instanceof HTMLSelectElement || 
          element instanceof HTMLTextAreaElement) {
        
        // Get the value from the profile
        const value = await getProfileValue(field.fieldKey);
        if (!value) continue;
        
        // Apply any transformations
        const transformedValue = field.transform ? field.transform[value] || value : value;
        
        // Set the value
        element.value = transformedValue;
        
        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        filledCount++;
      }
    }
  }
  
  return filledCount;
}

// Get a value from the user's profile
async function getProfileValue(fieldKey: string): Promise<string | null> {
  try {
    const profile = await chrome.storage.local.get('profile');
    if (!profile) return null;
    
    // Navigate the object path (e.g., "personal.firstName")
    const keys = fieldKey.split('.');
    let value = profile;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return null;
    }
    
    return String(value);
  } catch (error) {
    console.error('AutoApply: Error getting profile value', error);
    return null;
  }
} 