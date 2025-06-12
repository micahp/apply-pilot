import { detectATS, fillATSFields } from '../ats';
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

describe('Workable ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect various Workable URL patterns', () => {
      const workableUrls = [
        'https://apply.workable.com/company/',
        'https://apply.workable.com/stripe/j/A1B2C3D4E5/',
        'https://apply.workable.com/airbnb/j/software-engineer-backend/',
        'https://company.workable.com/j/12345/',
        'https://jobs.company.com/j/software-engineer/',
      ];

      workableUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('Workable');
        expect(detected?.slug).toBe('workable');
      });
    });

    test('should not detect non-Workable URLs', () => {
      const nonWorkableUrls = [
        'https://workable.com/company-info',
        'https://jobs.lever.co/company',
        'https://boards.greenhouse.io/company',
        'https://company.com/careers',
      ];

      nonWorkableUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('workable');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard Workable application form', async () => {
      document.body.innerHTML = `
        <div class="workable-application">
          <h1>Software Engineer - Backend</h1>
          <form class="application-form" method="post">
            <div class="form-section">
              <h2>Personal Details</h2>
              <div class="form-group">
                <label for="firstname">First Name *</label>
                <input id="firstname" name="firstname" type="text" required />
              </div>
              <div class="form-group">
                <label for="lastname">Last Name *</label>
                <input id="lastname" name="lastname" type="text" required />
              </div>
              <div class="form-group">
                <label for="email">Email Address *</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div class="form-group">
                <label for="phone">Phone Number</label>
                <input id="phone" name="phone" type="tel" />
              </div>
            </div>
            
            <div class="form-section">
              <h2>Resume & Cover Letter</h2>
              <div class="form-group">
                <label for="resume">Resume *</label>
                <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" required />
              </div>
            </div>
            
            <button type="submit" class="apply-btn">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify all fields were filled correctly using Workable's selector patterns
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const lastNameField = document.querySelector('#lastname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const phoneField = document.querySelector('#phone') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle Workable forms with name-based selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input name="firstname" type="text" />
          <input name="lastname" type="text" />
          <input name="email" type="email" />
          <input name="phone" type="tel" />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use name-based selectors when ID selectors aren't available
      const firstNameField = document.querySelector('input[name="firstname"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name="lastname"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle Workable forms with alternative field names', async () => {
      document.body.innerHTML = `
        <form>
          <input name="first_name" type="text" />
          <input name="last_name" type="text" />
          <input name="email_address" type="email" />
          <input name="phone_number" type="tel" />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should match alternative naming patterns
      const firstNameField = document.querySelector('input[name*="first"], input[name*="firstname"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last"], input[name*="lastname"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle file upload fields appropriately', async () => {
      document.body.innerHTML = `
        <form>
          <input id="firstname" name="firstname" type="text" />
          <input id="email" name="email" type="email" />
          <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" />
          <input id="cover_letter" name="cover_letter" type="file" accept=".pdf,.doc,.txt" />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // File inputs should not be filled automatically
      const resumeField = document.querySelector('#resume') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLInputElement;
      
      expect(resumeField.value).toBe('');
      expect(coverLetterField.value).toBe('');

      // But text fields should be filled
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      
      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      
      expect(filledCount).toBe(2); // Only text fields
    });

    test('should trigger events correctly on Workable forms', async () => {
      document.body.innerHTML = `
        <form>
          <input id="firstname" name="firstname" type="text" />
          <input id="email" name="email" type="email" />
        </form>
      `;

      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;

      const firstNameDispatchSpy = jest.spyOn(firstNameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      await fillATSFields(platform!, mockProfile);

      expect(firstNameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const firstNameEvents = firstNameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(firstNameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Complex Workable Forms', () => {
    test('should handle multi-section Workable application', async () => {
      document.body.innerHTML = `
        <div class="workable-job-application">
          <form>
            <section class="personal-info">
              <h3>Personal Information</h3>
              <input id="firstname" name="firstname" type="text" />
              <input id="lastname" name="lastname" type="text" />
              <input id="email" name="email" type="email" />
              <input id="phone" name="phone" type="tel" />
            </section>
            
            <section class="documents">
              <h3>Documents</h3>
              <input id="resume" name="resume" type="file" />
              <textarea name="cover_letter" placeholder="Cover letter..."></textarea>
            </section>
            
            <section class="additional-info">
              <h3>Additional Questions</h3>
              <textarea name="motivation" placeholder="Why do you want to work here?"></textarea>
            </section>
          </form>
        </div>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill fields across all sections
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const phoneField = document.querySelector('#phone') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      
      expect(filledCount).toBe(4); // All text fields (not file upload)
    });

    test('should handle Workable forms with conditional fields', async () => {
      document.body.innerHTML = `
        <form>
          <input id="firstname" name="firstname" type="text" />
          <input id="email" name="email" type="email" />
          
          <!-- Conditional section that might be shown/hidden -->
          <div class="conditional-section" style="display: block;">
            <input id="phone" name="phone" type="tel" />
            <input id="linkedin" name="linkedin" type="url" />
          </div>
          
          <!-- Hidden section -->
          <div class="hidden-section" style="display: none;">
            <input name="github" type="url" />
          </div>
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(3); // Should fill visible fields and attempt hidden ones
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing profile data gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input id="firstname" name="firstname" type="text" />
          <input id="lastname" name="lastname" type="text" />
          <input id="email" name="email" type="email" />
          <input id="phone" name="phone" type="tel" />
        </form>
      `;

      const incompleteProfile: Profile = {
        personal: {
          firstName: 'Jane',
          lastName: '',
          email: '',
          phone: '(555) 987-6543',
        },
        eeo: {},
        workExperience: [],
        education: [],
        skills: [],
        documents: {},
      };

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const lastNameField = document.querySelector('#lastname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const phoneField = document.querySelector('#phone') as HTMLInputElement;

      expect(firstNameField.value).toBe('Jane');
      expect(lastNameField.value).toBe('');
      expect(emailField.value).toBe('');
      expect(phoneField.value).toBe('(555) 987-6543');

      expect(filledCount).toBe(2); // Only firstName and phone filled
    });

    test('should handle forms with no matching selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input class="custom-field-1" type="text" />
          <input class="custom-field-2" type="email" />
          <textarea class="custom-field-3"></textarea>
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(0);
    });

    test('should handle Workable forms with validation attributes', async () => {
      document.body.innerHTML = `
        <form>
          <input 
            id="firstname" 
            name="firstname" 
            type="text" 
            required 
            minlength="2"
            maxlength="50"
            pattern="[A-Za-z\\s]+"
          />
          <input 
            id="email" 
            name="email" 
            type="email" 
            required 
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
          />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      
      // Verify the fields pass validation
      expect(firstNameField.checkValidity()).toBe(true);
      expect(emailField.checkValidity()).toBe(true);
      
      expect(filledCount).toBe(2);
    });
  });

  describe('Real-world Workable Scenarios', () => {
    test('should handle Workable form with internationalization', async () => {
      document.body.innerHTML = `
        <form>
          <input id="firstname" name="firstname" type="text" placeholder="Prénom" />
          <input id="lastname" name="lastname" type="text" placeholder="Nom de famille" />
          <input id="email" name="email" type="email" placeholder="Adresse e-mail" />
          <input id="phone" name="phone" type="tel" placeholder="Numéro de téléphone" />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(4);
      
      // Should work regardless of placeholder language
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      expect(firstNameField.value).toBe('John');
    });

    test('should handle Workable form with custom validation messages', async () => {
      document.body.innerHTML = `
        <form>
          <input 
            id="firstname" 
            name="firstname" 
            type="text" 
            required 
            data-validation-message="First name is required"
          />
          <input 
            id="email" 
            name="email" 
            type="email" 
            required 
            data-validation-message="Please enter a valid email address"
          />
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(2);
      
      // Verify custom validation attributes are preserved
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      expect(firstNameField.getAttribute('data-validation-message')).toBe('First name is required');
    });

    test('should handle Workable form with progressive enhancement', async () => {
      document.body.innerHTML = `
        <form class="workable-enhanced">
          <fieldset class="form-section">
            <legend>Contact Information</legend>
            <div class="field-wrapper">
              <input 
                id="firstname" 
                name="firstname" 
                type="text" 
                aria-describedby="firstname-help"
                autocomplete="given-name"
              />
              <small id="firstname-help">Enter your first name as it appears on official documents</small>
            </div>
            <div class="field-wrapper">
              <input 
                id="email" 
                name="email" 
                type="email" 
                aria-describedby="email-help"
                autocomplete="email"
              />
              <small id="email-help">We'll use this to contact you about your application</small>
            </div>
          </fieldset>
        </form>
      `;

      const platform = detectATS('https://apply.workable.com/company/j/job-id/');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(2);
      
      // Verify accessibility and enhancement attributes are preserved
      const firstNameField = document.querySelector('#firstname') as HTMLInputElement;
      expect(firstNameField.getAttribute('aria-describedby')).toBe('firstname-help');
      expect(firstNameField.getAttribute('autocomplete')).toBe('given-name');
    });
  });
}); 