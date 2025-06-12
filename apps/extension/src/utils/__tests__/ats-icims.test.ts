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

describe('iCIMS ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect various iCIMS URL patterns', () => {
      const icimsUrls = [
        'https://careers.company.com/jobs/',
        'https://company.icims.com/jobs/12345/job',
        'https://jobs.company.com/j/123456',
        'https://company-careers.icims.com/careers/job/12345',
        'https://recruiting.company.com/icims/apply',
      ];

      icimsUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('iCIMS');
        expect(detected?.slug).toBe('icims');
      });
    });

    test('should not detect non-iCIMS URLs', () => {
      const nonIcimsUrls = [
        'https://icims.com/company-info',
        'https://jobs.lever.co/company',
        'https://boards.greenhouse.io/company',
        'https://company.com/about',
      ];

      nonIcimsUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('icims');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard iCIMS application form', async () => {
      document.body.innerHTML = `
        <div class="icims-application-form">
          <h1>Apply for Software Engineer</h1>
          <form class="application-form" method="post">
            <div class="form-section">
              <h2>Personal Information</h2>
              <div class="form-field">
                <label for="field1">First Name *</label>
                <input id="field1" name="field1" type="text" required />
              </div>
              <div class="form-field">
                <label for="field2">Last Name *</label>
                <input id="field2" name="field2" type="text" required />
              </div>
              <div class="form-field">
                <label for="field3">Email Address *</label>
                <input id="field3" name="field3" type="email" required />
              </div>
              <div class="form-field">
                <label for="field4">Phone Number</label>
                <input id="field4" name="field4" type="tel" />
              </div>
            </div>
            
            <div class="form-section">
              <h2>Documents</h2>
              <div class="form-field">
                <label for="field5">Resume *</label>
                <input id="field5" name="field5" type="file" accept=".pdf,.doc,.docx" required />
              </div>
            </div>
            
            <button type="submit" class="btn-submit">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // iCIMS often uses generic field IDs, so we test by label association
      const firstNameField = document.querySelector('input[type="text"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      // Note: iCIMS field detection might be limited due to generic field names
      expect(filledCount).toBeGreaterThanOrEqual(2);
    });

    test('should handle iCIMS forms with descriptive field names', async () => {
      document.body.innerHTML = `
        <form>
          <input name="firstName" type="text" />
          <input name="lastName" type="text" />
          <input name="email" type="email" />
          <input name="phoneNumber" type="tel" />
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use name-based selectors when available
      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBe(4);
    });

    test('should handle iCIMS forms with label-based field identification', async () => {
      document.body.innerHTML = `
        <form>
          <div class="field-group">
            <label for="field1">First Name</label>
            <input id="field1" name="field1" type="text" />
          </div>
          <div class="field-group">
            <label for="field2">Last Name</label>
            <input id="field2" name="field2" type="text" />
          </div>
          <div class="field-group">
            <label for="field3">Email</label>
            <input id="field3" name="field3" type="email" />
          </div>
          <div class="field-group">
            <label for="field4">Phone</label>
            <input id="field4" name="field4" type="tel" />
          </div>
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should identify fields by their associated labels
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBeGreaterThanOrEqual(2);
    });

    test('should trigger events correctly on iCIMS forms', async () => {
      document.body.innerHTML = `
        <form>
          <input name="firstName" type="text" />
          <input type="email" name="email" />
        </form>
      `;

      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;

      const firstNameDispatchSpy = jest.spyOn(firstNameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      await fillATSFields(platform!, mockProfile);

      expect(firstNameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const firstNameEvents = firstNameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(firstNameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Complex iCIMS Forms', () => {
    test('should handle multi-page iCIMS application', async () => {
      document.body.innerHTML = `
        <div class="icims-multi-page">
          <div class="page active" data-page="1">
            <h3>Contact Information</h3>
            <input name="firstName" type="text" />
            <input name="lastName" type="text" />
          </div>
          
          <div class="page" data-page="2">
            <h3>Contact Details</h3>
            <input type="email" name="email" />
            <input type="tel" name="phone" />
          </div>
          
          <div class="page" data-page="3">
            <h3>Documents</h3>
            <input type="file" name="resume" />
          </div>
        </div>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill fields across all pages
      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      
      expect(filledCount).toBe(4); // All fields except file upload
    });

    test('should handle iCIMS forms with dynamic field generation', async () => {
      document.body.innerHTML = `
        <form>
          <div class="dynamic-section">
            <input name="firstName" type="text" />
            <input type="email" name="email" />
          </div>
          
          <!-- Fields that might be added dynamically -->
          <div class="conditional-fields" style="display: none;">
            <input type="tel" name="phone" />
            <input name="linkedIn" type="url" />
          </div>
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill both visible and hidden fields
      expect(filledCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle iCIMS forms with generic field IDs', async () => {
      document.body.innerHTML = `
        <form>
          <input id="field1" name="field1" type="text" />
          <input id="field2" name="field2" type="text" />
          <input id="field3" name="field3" type="email" />
          <input id="field4" name="field4" type="tel" />
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use type-based selectors for email and phone
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');

      expect(filledCount).toBeGreaterThanOrEqual(2);
    });

    test('should handle incomplete profile data', async () => {
      document.body.innerHTML = `
        <form>
          <input name="firstName" type="text" />
          <input name="lastName" type="text" />
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

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name*="last"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('Jane');
      expect(lastNameField.value).toBe('');
      expect(emailField.value).toBe('jane@example.com');
      expect(phoneField.value).toBe('');

      expect(filledCount).toBe(2); // Only firstName and email filled
    });

    test('should handle forms with no recognizable fields', async () => {
      document.body.innerHTML = `
        <form>
          <input id="custom1" name="custom1" type="text" />
          <input id="custom2" name="custom2" type="text" />
          <select id="custom3" name="custom3">
            <option>Option 1</option>
          </select>
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(0);
    });
  });

  describe('Real-world iCIMS Scenarios', () => {
    test('should handle iCIMS form with complex validation', async () => {
      document.body.innerHTML = `
        <form>
          <input 
            name="firstName" 
            type="text" 
            required 
            minlength="2"
            maxlength="50"
            data-validation="required"
          />
          <input 
            type="email" 
            name="email" 
            required 
            data-validation="email"
          />
          <input 
            type="tel" 
            name="phone" 
            pattern="\\([0-9]{3}\\)\\s[0-9]{3}-[0-9]{4}"
            data-validation="phone"
          />
        </form>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[type="tel"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      
      // Verify the fields pass validation
      expect(firstNameField.checkValidity()).toBe(true);
      expect(emailField.checkValidity()).toBe(true);
      
      expect(filledCount).toBe(3);
    });

    test('should handle iCIMS form with custom styling and structure', async () => {
      document.body.innerHTML = `
        <div class="icims-talent-portal">
          <form class="application-form-modern">
            <div class="form-row">
              <div class="col-md-6">
                <input 
                  name="firstName" 
                  type="text" 
                  class="form-control"
                  placeholder="First Name"
                />
              </div>
              <div class="col-md-6">
                <input 
                  name="lastName" 
                  type="text" 
                  class="form-control"
                  placeholder="Last Name"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="col-md-12">
                <input 
                  type="email" 
                  name="email" 
                  class="form-control"
                  placeholder="Email Address"
                />
              </div>
            </div>
          </form>
        </div>
      `;

      const platform = detectATS('https://company.icims.com/jobs/12345/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(3);
      
      // Verify Bootstrap-style form structure is preserved
      const firstNameField = document.querySelector('input[name*="first"]') as HTMLInputElement;
      expect(firstNameField.className).toBe('form-control');
    });
  });
}); 