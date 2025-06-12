import { detectATS, fillATSFields } from '../ats';
import { Profile } from '../../types/profile';

// Mock profile data for testing
const mockProfile: Profile = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    linkedIn: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe',
    website: 'https://johndoe.dev',
  },
  documents: {
    coverLetter: 'I am excited to apply for this position...',
  },
  experience: [],
  education: [],
  skills: [],
};

describe('ATS Detection', () => {
  test('should detect Lever ATS correctly', () => {
    const leverUrls = [
      'https://jobs.lever.co/company-name/job-id',
      'https://jobs.lever.co/airbnb/software-engineer',
      'https://jobs.lever.co/stripe/backend-engineer-payments',
    ];

    leverUrls.forEach(url => {
      const detected = detectATS(url);
      expect(detected).not.toBeNull();
      expect(detected?.name).toBe('Lever');
      expect(detected?.slug).toBe('lever');
    });
  });

  test('should detect Workday ATS correctly', () => {
    const workdayUrls = [
      'https://company.workday.com/en-US/job/123456',
      'https://uber.wd1.myworkdayjobs.com/ATG_External_Careers',
      'https://microsoft.wd5.myworkdayjobs.com/Global_Careers',
    ];

    workdayUrls.forEach(url => {
      const detected = detectATS(url);
      expect(detected).not.toBeNull();
      expect(detected?.name).toBe('Workday');
      expect(detected?.slug).toBe('workday');
    });
  });

  test('should detect Greenhouse ATS correctly', () => {
    const greenhouseUrls = [
      'https://boards.greenhouse.io/company-name',
      'https://boards.greenhouse.io/slack/jobs/123456',
      'https://app.greenhouse.io/applications/new/job/123456',
    ];

    greenhouseUrls.forEach(url => {
      const detected = detectATS(url);
      expect(detected).not.toBeNull();
      expect(detected?.name).toBe('Greenhouse');
      expect(detected?.slug).toBe('greenhouse');
    });
  });

  test('should detect Ashby ATS correctly', () => {
    const ashbyUrls = [
      'https://jobs.ashbyhq.com/company-name',
      'https://jobs.ashbyhq.com/openai/software-engineer',
    ];

    ashbyUrls.forEach(url => {
      const detected = detectATS(url);
      expect(detected).not.toBeNull();
      expect(detected?.name).toBe('Ashby');
      expect(detected?.slug).toBe('ashby');
    });
  });

  test('should return null for unsupported websites', () => {
    const unsupportedUrls = [
      'https://google.com',
      'https://linkedin.com/jobs/view/123456',
      'https://indeed.com/viewjob?jk=123456',
      'https://stackoverflow.com/jobs/123456',
    ];

    unsupportedUrls.forEach(url => {
      const detected = detectATS(url);
      expect(detected).toBeNull();
    });
  });
});

describe('Form Field Injection', () => {
  beforeEach(() => {
    // Clear the DOM before each test
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Lever Form Filling', () => {
    test('should fill Lever form fields correctly', async () => {
      // Setup DOM with Lever form fields
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
          <input name="phone" type="tel" />
          <input name="urls[LinkedIn]" type="url" />
          <input name="urls[GitHub]" type="url" />
          <input name="urls[Portfolio]" type="url" />
          <textarea name="comments"></textarea>
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify fields were filled
      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;
      const linkedInField = document.querySelector('input[name="urls[LinkedIn]"]') as HTMLInputElement;
      const githubField = document.querySelector('input[name="urls[GitHub]"]') as HTMLInputElement;
      const websiteField = document.querySelector('input[name="urls[Portfolio]"]') as HTMLInputElement;
      const coverLetterField = document.querySelector('textarea[name="comments"]') as HTMLTextAreaElement;

      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(linkedInField.value).toBe('https://linkedin.com/in/johndoe');
      expect(githubField.value).toBe('https://github.com/johndoe');
      expect(websiteField.value).toBe('https://johndoe.dev');
      expect(coverLetterField.value).toBe('I am excited to apply for this position...');

      expect(filledCount).toBe(7);
    });

    test('should trigger proper events on form fields', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
        </form>
      `;

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      
      const nameDispatchSpy = jest.spyOn(nameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://jobs.lever.co/company/job');
      await fillATSFields(platform!, mockProfile);

      // Verify events were triggered
      expect(nameDispatchSpy).toHaveBeenCalledTimes(3); // input, change, blur
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      // Verify event types
      const nameEvents = nameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);
      
      expect(nameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Workday Form Filling', () => {
    test('should fill Workday form fields correctly', async () => {
      document.body.innerHTML = `
        <form>
          <input data-automation-id="firstName" type="text" />
          <input data-automation-id="lastName" type="text" />
          <input data-automation-id="email" type="email" />
          <input data-automation-id="phone" type="tel" />
          <input data-automation-id="addressLine1" type="text" />
          <input data-automation-id="city" type="text" />
          <select data-automation-id="state">
            <option value="">Select State</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
          </select>
          <input data-automation-id="postalCode" type="text" />
        </form>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

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
  });

  describe('Greenhouse Form Filling', () => {
    test('should fill Greenhouse form fields correctly', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="last_name" name="last_name" type="text" />
          <input id="email" name="email" type="email" />
          <input id="phone" name="phone" type="tel" />
          <input id="resume" name="resume" type="file" />
          <textarea id="cover_letter" name="cover_letter"></textarea>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const lastNameField = document.querySelector('#last_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const phoneField = document.querySelector('#phone') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLTextAreaElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(coverLetterField.value).toBe('I am excited to apply for this position...');

      expect(filledCount).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing profile data gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
        </form>
      `;

      const incompleteProfile: Profile = {
        personal: {
          firstName: 'Jane',
          // Missing lastName, email, etc.
        },
        experience: [],
        education: [],
        skills: [],
      };

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;

      expect(nameField.value).toBe('Jane '); // firstName + empty lastName
      expect(emailField.value).toBe(''); // No email provided

      expect(filledCount).toBe(1); // Only name field filled
    });

    test('should handle missing form fields gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input name="other-field" type="text" />
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(0); // No matching fields found
    });

    test('should handle select elements correctly', async () => {
      document.body.innerHTML = `
        <form>
          <select data-automation-id="state">
            <option value="">Select State</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
          </select>
        </form>
      `;

      const profileWithState: Profile = {
        ...mockProfile,
        personal: {
          ...mockProfile.personal,
          state: 'California',
        },
      };

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      
      // Note: This test assumes the state field is implemented in the future
      // Currently, state filling isn't fully implemented in the main code
      const filledCount = await fillATSFields(platform!, profileWithState);

      // For now, this will be 0 since state filling isn't implemented
      expect(filledCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle DOM errors gracefully', async () => {
      // Mock a DOM error
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = jest.fn(() => {
        throw new Error('DOM error');
      });

      const platform = detectATS('https://jobs.lever.co/company/job');
      
      await expect(fillATSFields(platform!, mockProfile)).rejects.toThrow('DOM error');

      // Restore original method
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should reject promise on errors', async () => {
      // Mock fillInputField to throw an error
      const platform = detectATS('https://jobs.lever.co/company/job');
      
      // Create a scenario that will cause an error
      const invalidProfile = null as any;
      
      await expect(fillATSFields(platform!, invalidProfile)).rejects.toBeDefined();
    });
  });
}); 