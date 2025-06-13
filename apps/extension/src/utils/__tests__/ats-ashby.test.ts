import { detectATS, fillATSFields, isAshbyJobListingPage, clickAshbyApplyButton } from '../ats';
import { Profile } from '../../types/profile';

const mockProfile: Profile = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
  },
  eeo: {},
  workExperience: [],
  education: [],
  skills: [],
  documents: {},
};

describe('Ashby ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect various Ashby URL patterns', () => {
      const ashbyUrls = [
        'https://jobs.ashbyhq.com/company',
        'https://jobs.ashbyhq.com/openai/software-engineer',
        'https://jobs.ashbyhq.com/anthropic/research-scientist',
        'https://jobs.ashbyhq.com/scale/backend-engineer-platform',
      ];

      ashbyUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('Ashby');
        expect(detected?.slug).toBe('ashby');
      });
    });

    test('should not detect non-Ashby URLs', () => {
      const nonAshbyUrls = [
        'https://ashbyhq.com/company-info',
        'https://jobs.lever.co/company',
        'https://boards.greenhouse.io/company',
        'https://company.com/careers',
      ];

      nonAshbyUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('ashby');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard Ashby application form', async () => {
      document.body.innerHTML = `
        <div class="ashby-job-posting">
          <h1>Senior Software Engineer</h1>
          <form class="ashby-application-form">
            <div class="form-section">
              <h3>Personal Information</h3>
              <div class="form-field">
                <label>First Name *</label>
                <input name="first_name" type="text" required />
              </div>
              <div class="form-field">
                <label>Last Name *</label>
                <input name="last_name" type="text" required />
              </div>
              <div class="form-field">
                <label>Email *</label>
                <input type="email" name="email" required />
              </div>
              <div class="form-field">
                <label>Phone Number</label>
                <input type="tel" name="phone" />
              </div>
            </div>
            
            <div class="form-section">
              <h3>Additional Information</h3>
              <div class="form-field">
                <label>Resume *</label>
                <input type="file" name="resume" accept=".pdf,.doc,.docx" required />
              </div>
            </div>
            
            <button type="submit" class="submit-btn">Apply Now</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/openai/software-engineer');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify all fields were filled correctly using Ashby's selector patterns
      const firstNameField = document.querySelector('input[name*="first_name"], input[id*="first_name"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last_name"], input[id*="last_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"], input[name*="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"], input[name*="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle Ashby forms with ID-based selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name_input" type="text" />
          <input id="last_name_input" type="text" />
          <input id="email_address" type="email" />
          <input id="phone_number" type="tel" />
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should match using ID patterns
      const firstNameField = document.querySelector('input[id*="first_name"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[id*="last_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle Ashby forms with generic type selectors', async () => {
      document.body.innerHTML = `
        <form>
          <div class="field-group">
            <label>First Name</label>
            <input type="text" data-field="firstName" />
          </div>
          <div class="field-group">
            <label>Last Name</label>
            <input type="text" data-field="lastName" />
          </div>
          <div class="field-group">
            <label>Email</label>
            <input type="email" data-field="email" />
          </div>
          <div class="field-group">
            <label>Phone</label>
            <input type="tel" data-field="phone" />
          </div>
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use type-based selectors as fallback
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      // Note: firstName/lastName might not be filled without proper name/id attributes
      expect(filledCount).toBeGreaterThanOrEqual(2);
    });

    test('should trigger events correctly on Ashby forms', async () => {
      document.body.innerHTML = `
        <form>
          <input name="first_name" type="text" />
          <input type="email" name="email" />
        </form>
      `;

      const firstNameField = document.querySelector('input[name*="first_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;

      const firstNameDispatchSpy = jest.spyOn(firstNameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      await fillATSFields(platform!, mockProfile);

      expect(firstNameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const firstNameEvents = firstNameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(firstNameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Complex Ashby Forms', () => {
    test('should handle multi-step Ashby application', async () => {
      document.body.innerHTML = `
        <div class="ashby-multi-step-form">
          <div class="step" data-step="1">
            <h3>Basic Information</h3>
            <input name="first_name" type="text" />
            <input name="last_name" type="text" />
          </div>
          
          <div class="step" data-step="2">
            <h3>Contact Details</h3>
            <input type="email" name="email" />
            <input type="tel" name="phone" />
          </div>
          
          <div class="step" data-step="3">
            <h3>Documents</h3>
            <input type="file" name="resume" />
            <textarea name="cover_letter" placeholder="Cover letter..."></textarea>
          </div>
        </div>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill fields across all steps
      const firstNameField = document.querySelector('input[name*="first_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      
      expect(filledCount).toBe(4); // firstName, lastName, email, phone
    });

    test('should handle Ashby forms with custom field variations', async () => {
      document.body.innerHTML = `
        <form>
          <!-- Various ways Ashby might structure name fields -->
          <input name="candidate_first_name" type="text" />
          <input name="candidate_last_name" type="text" />
          
          <!-- Email field variations -->
          <input type="email" name="candidate_email" />
          
          <!-- Phone field variations -->
          <input type="tel" name="candidate_phone" placeholder="Phone number" />
          
          <!-- Fields that shouldn't be filled -->
          <input type="password" name="password" />
          <input type="hidden" name="csrf_token" value="abc123" />
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const firstNameField = document.querySelector('input[name*="first_name"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;
      const passwordField = document.querySelector('input[type="password"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(passwordField.value).toBe(''); // Should not be filled

      expect(filledCount).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    test('should handle Ashby forms with no matching selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input class="custom-field-1" type="text" />
          <input class="custom-field-2" type="text" />
          <textarea class="custom-field-3"></textarea>
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(0);
    });

    test('should handle incomplete profile data', async () => {
      document.body.innerHTML = `
        <form>
          <input name="first_name" type="text" />
          <input name="last_name" type="text" />
          <input type="email" name="email" />
          <input type="tel" name="phone" />
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

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const firstNameField = document.querySelector('input[name*="first_name"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('Jane');
      expect(lastNameField.value).toBe('');
      expect(emailField.value).toBe('jane@example.com');
      expect(phoneField.value).toBe('');

      expect(filledCount).toBe(2); // Only firstName and email filled
    });

    test('should handle dynamically generated Ashby forms', async () => {
      document.body.innerHTML = `
        <div id="ashby-form-container">
          <!-- Simulate dynamic form generation -->
        </div>
      `;

      // Simulate dynamic form creation
      setTimeout(() => {
        const container = document.getElementById('ashby-form-container');
        if (container) {
          container.innerHTML = `
            <form>
              <input name="first_name" type="text" />
              <input type="email" name="email" />
            </form>
          `;
        }
      }, 100);

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      
      // Initial fill might find no fields
      const filledCount = await fillATSFields(platform!, mockProfile);
      expect(filledCount).toBe(0);
    });
  });

  describe('Real-world Ashby Scenarios', () => {
    test('should handle Ashby form with React-style attributes', async () => {
      document.body.innerHTML = `
        <form>
          <input 
            name="first_name" 
            type="text" 
            data-testid="firstName"
            autoComplete="given-name"
          />
          <input 
            name="last_name" 
            type="text" 
            data-testid="lastName"
            autoComplete="family-name"
          />
          <input 
            type="email" 
            name="email" 
            data-testid="email"
            autoComplete="email"
          />
          <input 
            type="tel" 
            name="phone" 
            data-testid="phone"
            autoComplete="tel"
          />
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(4);
      
      // Verify autocomplete attributes are preserved
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      expect(emailField.getAttribute('autoComplete')).toBe('email');
    });

    test('should handle Ashby form with accessibility features', async () => {
      document.body.innerHTML = `
        <form role="form" aria-label="Job Application">
          <fieldset>
            <legend>Personal Information</legend>
            <input 
              name="first_name" 
              type="text" 
              aria-label="First Name"
              aria-required="true"
            />
            <input 
              name="last_name" 
              type="text" 
              aria-label="Last Name"
              aria-required="true"
            />
            <input 
              type="email" 
              name="email" 
              aria-label="Email Address"
              aria-required="true"
            />
          </fieldset>
        </form>
      `;

      const platform = detectATS('https://jobs.ashbyhq.com/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(3);
      
      // Verify accessibility attributes are preserved
      const firstNameField = document.querySelector('input[name*="first_name"]') as HTMLInputElement;
      expect(firstNameField.getAttribute('aria-label')).toBe('First Name');
      expect(firstNameField.getAttribute('aria-required')).toBe('true');
    });
  });

  describe('Ashby Job Listing Detection', () => {
    test('should detect Ashby job listing page with Apply button', () => {
      document.body.innerHTML = `
        <div class="job-page">
          <h1>Senior Software Engineer</h1>
          <div class="job-description">
            <p>We are looking for a talented engineer...</p>
          </div>
          <button class="apply-button">Apply for this Job</button>
        </div>
      `;

      const isJobListing = isAshbyJobListingPage();
      expect(isJobListing).toBe(true);
    });

    test('should not detect job listing page when form fields are present', () => {
      document.body.innerHTML = `
        <div class="application-page">
          <h1>Application Form</h1>
          <form>
            <input name="first_name" type="text" />
            <input type="email" name="email" />
          </form>
          <button type="submit">Submit Application</button>
        </div>
      `;

      const isJobListing = isAshbyJobListingPage();
      expect(isJobListing).toBe(false);
    });

    test('should not detect job listing page without apply elements', () => {
      document.body.innerHTML = `
        <div class="general-page">
          <h1>About Us</h1>
          <p>Company information...</p>
        </div>
      `;

      const isJobListing = isAshbyJobListingPage();
      expect(isJobListing).toBe(false);
    });

    test('should click Apply button successfully', () => {
      document.body.innerHTML = `
        <div class="job-page">
          <h1>Senior Software Engineer</h1>
          <button class="apply-button" id="test-apply-btn">Apply for this Job</button>
        </div>
      `;

      const applyButton = document.getElementById('test-apply-btn') as HTMLButtonElement;
      let clicked = false;
      applyButton.addEventListener('click', () => {
        clicked = true;
      });

      const success = clickAshbyApplyButton();
      expect(success).toBe(true);
      expect(clicked).toBe(true);
    });

    test('should handle missing Apply button gracefully', () => {
      document.body.innerHTML = `
        <div class="job-page">
          <h1>Senior Software Engineer</h1>
          <p>No apply button here</p>
        </div>
      `;

      const success = clickAshbyApplyButton();
      expect(success).toBe(false);
    });

    test('should handle various Apply button text variations', () => {
      const testCases = [
        'Apply for this Job',
        'Apply',
        'APPLY NOW',
        'Apply for this Position'
      ];

      testCases.forEach((buttonText, index) => {
        document.body.innerHTML = `
          <div class="job-page">
            <h1>Test Job ${index}</h1>
            <button class="apply-button" id="test-btn-${index}">${buttonText}</button>
          </div>
        `;

        const button = document.getElementById(`test-btn-${index}`) as HTMLButtonElement;
        let clicked = false;
        button.addEventListener('click', () => {
          clicked = true;
        });

        const success = clickAshbyApplyButton();
        expect(success).toBe(true);
        expect(clicked).toBe(true);
      });
    });
  });
}); 