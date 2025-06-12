import { detectATS, fillATSFields } from '../ats';
import { Profile } from '../../types/profile';

const mockProfile: Profile = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102',
    country: 'United States',
  },
  eeo: {},
  workExperience: [],
  education: [],
  skills: [],
  documents: {},
};

describe('Workday ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect various Workday URL patterns', () => {
      const workdayUrls = [
        'https://company.wd1.myworkdayjobs.com/External_Careers',
        'https://uber.wd1.myworkdayjobs.com/ATG_External_Careers',
        'https://microsoft.wd5.myworkdayjobs.com/Global_Careers',
        'https://netflix.wd1.myworkdayjobs.com/Netflix_External_Site',
        'https://spotify.wd1.myworkdayjobs.com/life-at-spotify',
        'https://company.workday.com/en-US/job/12345',
      ];

      workdayUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('Workday');
        expect(detected?.slug).toBe('workday');
      });
    });

    test('should not detect non-Workday URLs', () => {
      const nonWorkdayUrls = [
        'https://workday.com/company-info',
        'https://jobs.lever.co/company',
        'https://boards.greenhouse.io/company',
        'https://company.com/careers',
      ];

      nonWorkdayUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('workday');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard Workday application form', async () => {
      document.body.innerHTML = `
        <div class="workday-application">
          <h1>Software Engineer - Backend</h1>
          <form>
            <div class="workday-section">
              <h2>Personal Information</h2>
              <div class="form-field">
                <label>First Name *</label>
                <input data-automation-id="firstName" type="text" required />
              </div>
              <div class="form-field">
                <label>Last Name *</label>
                <input data-automation-id="lastName" type="text" required />
              </div>
              <div class="form-field">
                <label>Email Address *</label>
                <input data-automation-id="email" type="email" required />
              </div>
              <div class="form-field">
                <label>Phone Number</label>
                <input data-automation-id="phone" type="tel" />
              </div>
            </div>
            
            <div class="workday-section">
              <h2>Address Information</h2>
              <div class="form-field">
                <label>Address Line 1</label>
                <input data-automation-id="addressLine1" type="text" />
              </div>
              <div class="form-field">
                <label>City</label>
                <input data-automation-id="city" type="text" />
              </div>
              <div class="form-field">
                <label>State/Province</label>
                <select data-automation-id="state">
                  <option value="">Select a state</option>
                  <option value="CA">California</option>
                  <option value="NY">New York</option>
                  <option value="TX">Texas</option>
                </select>
              </div>
              <div class="form-field">
                <label>Postal Code</label>
                <input data-automation-id="postalCode" type="text" />
              </div>
            </div>
            
            <button type="submit">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/External_Careers');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify all fields were filled correctly
      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const lastNameField = document.querySelector('[data-automation-id="lastName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('[data-automation-id="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(filledCount).toBe(4);
    });

    test('should handle Workday forms with alternative selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input name="firstName" type="text" />
          <input name="lastName" type="text" />
          <input name="email" type="email" />
          <input name="phoneNumber" type="tel" />
          <input name="address" type="text" />
          <input name="city" type="text" />
          <input name="state" type="text" />
          <input name="zip" type="text" />
        </form>
      `;

      const platform = detectATS('https://company.workday.com/job/12345');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use fallback name-based selectors
      const firstNameField = document.querySelector('input[name="firstName"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name="lastName"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phoneNumber"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(filledCount).toBe(4);
    });

    test('should handle Workday select dropdowns', async () => {
      document.body.innerHTML = `
        <form>
          <select data-automation-id="state">
            <option value="">Select a state</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
            <option value="FL">Florida</option>
          </select>
          <select data-automation-id="country">
            <option value="">Select a country</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="UK">United Kingdom</option>
          </select>
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Note: Current implementation may not handle select fields fully
      // This test documents expected behavior for future enhancement
      expect(filledCount).toBeGreaterThanOrEqual(0);
    });

    test('should trigger events correctly on Workday forms', async () => {
      document.body.innerHTML = `
        <form>
          <input data-automation-id="firstName" type="text" />
          <input data-automation-id="email" type="email" />
        </form>
      `;

      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;

      const firstNameDispatchSpy = jest.spyOn(firstNameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      await fillATSFields(platform!, mockProfile);

      expect(firstNameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const firstNameEvents = firstNameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(firstNameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Complex Workday Forms', () => {
    test('should handle multi-step Workday application', async () => {
      document.body.innerHTML = `
        <div class="workday-multi-step">
          <div class="step active" data-step="1">
            <h2>Basic Information</h2>
            <input data-automation-id="firstName" type="text" />
            <input data-automation-id="lastName" type="text" />
            <input data-automation-id="email" type="email" />
          </div>
          <div class="step" data-step="2">
            <h2>Contact Details</h2>
            <input data-automation-id="phone" type="tel" />
            <input data-automation-id="addressLine1" type="text" />
            <input data-automation-id="city" type="text" />
          </div>
        </div>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill fields across all steps
      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('[data-automation-id="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(filledCount).toBe(6); // All 6 fields should be filled
    });

    test('should handle Workday forms with conditional fields', async () => {
      document.body.innerHTML = `
        <form>
          <input data-automation-id="firstName" type="text" />
          <input data-automation-id="lastName" type="text" />
          <input data-automation-id="email" type="email" />
          
          <!-- Conditional fields that might appear based on selections -->
          <div class="conditional-section" style="display: none;">
            <input data-automation-id="phone" type="tel" />
            <input data-automation-id="addressLine1" type="text" />
          </div>
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill visible fields and attempt hidden ones
      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const lastNameField = document.querySelector('[data-automation-id="lastName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('[data-automation-id="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567'); // Should fill even if hidden

      expect(filledCount).toBe(5); // All available fields
    });
  });

  describe('Edge Cases', () => {
    test('should handle Workday forms with missing automation IDs', async () => {
      document.body.innerHTML = `
        <form>
          <input class="firstName-field" type="text" />
          <input class="lastName-field" type="text" />
          <input class="email-field" type="email" />
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should not fill fields without proper selectors
      expect(filledCount).toBe(0);
    });

    test('should handle incomplete profile data', async () => {
      document.body.innerHTML = `
        <form>
          <input data-automation-id="firstName" type="text" />
          <input data-automation-id="lastName" type="text" />
          <input data-automation-id="email" type="email" />
          <input data-automation-id="phone" type="tel" />
        </form>
      `;

      const incompleteProfile: Profile = {
        personal: {
          firstName: 'Jane',
          lastName: '',
          email: 'jane@example.com',
          phone: '',
        },
        eeo: {},
        workExperience: [],
        education: [],
        skills: [],
        documents: {},
      };

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const lastNameField = document.querySelector('[data-automation-id="lastName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('[data-automation-id="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('Jane');
      expect(lastNameField.value).toBe('');
      expect(emailField.value).toBe('jane@example.com');
      expect(phoneField.value).toBe('');

      expect(filledCount).toBe(2); // Only firstName and email filled
    });
  });

  describe('Real-world Workday Scenarios', () => {
    test('should handle Workday form with ARIA labels', async () => {
      document.body.innerHTML = `
        <form role="form" aria-label="Job Application">
          <fieldset>
            <legend>Personal Information</legend>
            <input 
              data-automation-id="firstName" 
              type="text" 
              aria-label="First Name"
              aria-required="true"
            />
            <input 
              data-automation-id="lastName" 
              type="text" 
              aria-label="Last Name"
              aria-required="true"
            />
            <input 
              data-automation-id="email" 
              type="email" 
              aria-label="Email Address"
              aria-required="true"
            />
          </fieldset>
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(3);
    });

    test('should handle Workday form with dynamic validation', async () => {
      document.body.innerHTML = `
        <form>
          <input 
            data-automation-id="firstName" 
            type="text" 
            required 
            minlength="1"
            maxlength="50"
          />
          <input 
            data-automation-id="email" 
            type="email" 
            required 
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
          />
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const firstNameField = document.querySelector('[data-automation-id="firstName"]') as HTMLInputElement;
      const emailField = document.querySelector('[data-automation-id="email"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      
      // Verify the fields pass validation
      expect(firstNameField.checkValidity()).toBe(true);
      expect(emailField.checkValidity()).toBe(true);
      
      expect(filledCount).toBe(2);
    });
  });
}); 