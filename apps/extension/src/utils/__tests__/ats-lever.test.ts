import { detectATS, fillATSFields } from '../ats';
import { Profile } from '../../types/profile';

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
  eeo: {},
  workExperience: [],
  education: [],
  skills: [],
  documents: {
    coverLetter: 'I am excited to apply for this position...',
  },
};

describe('Lever ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect standard Lever URLs', () => {
      const leverUrls = [
        'https://jobs.lever.co/company/job-id',
        'https://jobs.lever.co/stripe/backend-engineer',
        'https://jobs.lever.co/airbnb/software-engineer-frontend',
        'https://jobs.lever.co/openai/research-scientist',
      ];

      leverUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('Lever');
        expect(detected?.slug).toBe('lever');
      });
    });

    test('should not detect non-Lever URLs', () => {
      const nonLeverUrls = [
        'https://lever.co/company-page',
        'https://jobs.workday.com/company',
        'https://boards.greenhouse.io/company',
        'https://company.com/careers',
      ];

      nonLeverUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('lever');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard Lever application form', async () => {
      document.body.innerHTML = `
        <div class="application-form">
          <h1>Software Engineer - Backend</h1>
          <form action="/applications" method="post">
            <div class="section">
              <h2>Contact Information</h2>
              <div class="form-group">
                <label for="name">Full Name *</label>
                <input name="name" type="text" id="name" required />
              </div>
              <div class="form-group">
                <label for="email">Email Address *</label>
                <input name="email" type="email" id="email" required />
              </div>
              <div class="form-group">
                <label for="phone">Phone Number</label>
                <input name="phone" type="tel" id="phone" />
              </div>
            </div>
            
            <div class="section">
              <h2>Professional Links</h2>
              <div class="form-group">
                <label for="linkedin">LinkedIn Profile</label>
                <input name="urls[LinkedIn]" type="url" id="linkedin" />
              </div>
              <div class="form-group">
                <label for="github">GitHub Profile</label>
                <input name="urls[GitHub]" type="url" id="github" />
              </div>
              <div class="form-group">
                <label for="portfolio">Portfolio Website</label>
                <input name="urls[Portfolio]" type="url" id="portfolio" />
              </div>
            </div>
            
            <div class="section">
              <h2>Cover Letter</h2>
              <div class="form-group">
                <label for="comments">Additional Comments</label>
                <textarea name="comments" id="comments" rows="5" placeholder="Tell us why you're interested in this role..."></textarea>
              </div>
            </div>
            
            <button type="submit">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://jobs.lever.co/stripe/backend-engineer');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify all fields were filled correctly
      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;
      const linkedInField = document.querySelector('input[name="urls[LinkedIn]"]') as HTMLInputElement;
      const githubField = document.querySelector('input[name="urls[GitHub]"]') as HTMLInputElement;
      const portfolioField = document.querySelector('input[name="urls[Portfolio]"]') as HTMLInputElement;
      const coverLetterField = document.querySelector('textarea[name="comments"]') as HTMLTextAreaElement;

      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(linkedInField.value).toBe('https://linkedin.com/in/johndoe');
      expect(githubField.value).toBe('https://github.com/johndoe');
      expect(portfolioField.value).toBe('https://johndoe.dev');
      expect(coverLetterField.value).toBe('I am excited to apply for this position...');

      expect(filledCount).toBe(7);
    });

    test('should handle Lever form with file upload fields', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
          <input name="phone" type="tel" />
          <input name="resume" type="file" accept=".pdf,.doc,.docx" />
          <textarea name="comments"></textarea>
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // File inputs shouldn't be filled automatically
      const resumeField = document.querySelector('input[name="resume"]') as HTMLInputElement;
      expect(resumeField.value).toBe('');

      // But other fields should be filled
      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      
      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(filledCount).toBe(4); // name, email, phone, comments (not resume)
    });

    test('should handle Lever forms with optional fields', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" required />
          <input name="email" type="email" required />
          <input name="phone" type="tel" />
          <input name="urls[LinkedIn]" type="url" />
          <input name="urls[GitHub]" type="url" />
          <input name="urls[Portfolio]" type="url" />
          <input name="urls[Twitter]" type="url" />
          <textarea name="comments"></textarea>
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Required fields should be filled
      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');

      // Optional fields should be filled where data exists
      const linkedInField = document.querySelector('input[name="urls[LinkedIn]"]') as HTMLInputElement;
      const githubField = document.querySelector('input[name="urls[GitHub]"]') as HTMLInputElement;
      const portfolioField = document.querySelector('input[name="urls[Portfolio]"]') as HTMLInputElement;
      const twitterField = document.querySelector('input[name="urls[Twitter]"]') as HTMLInputElement;

      expect(linkedInField.value).toBe('https://linkedin.com/in/johndoe');
      expect(githubField.value).toBe('https://github.com/johndoe');
      expect(portfolioField.value).toBe('https://johndoe.dev');
      expect(twitterField.value).toBe(''); // No Twitter data in profile

      expect(filledCount).toBe(6); // name, email, phone, LinkedIn, GitHub, Portfolio, comments
    });

    test('should trigger events correctly on Lever forms', async () => {
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

      // Each field should trigger input, change, and blur events
      expect(nameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const nameEvents = nameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(nameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Edge Cases', () => {
    test('should handle Lever forms with missing fields gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <!-- Missing email, phone, etc. -->
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      expect(nameField.value).toBe('John Doe');
      expect(filledCount).toBe(1);
    });

    test('should handle empty profile data gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
        </form>
      `;

      const emptyProfile: Profile = {
        personal: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
        },
        eeo: {},
        workExperience: [],
        education: [],
        skills: [],
        documents: {},
      };

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, emptyProfile);

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;

      expect(nameField.value).toBe(' '); // firstName + ' ' + lastName
      expect(emailField.value).toBe('');
      expect(filledCount).toBe(1); // Only name field gets filled (even if empty)
    });

    test('should handle Lever forms with dynamic field names', async () => {
      // Some Lever forms might have dynamically generated field names
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" data-test="full-name" />
          <input name="email" type="email" data-test="email-address" />
          <input name="phone" type="tel" data-test="phone-number" />
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Fields should still be found and filled using the standard name attributes
      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;

      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(filledCount).toBe(3);
    });
  });

  describe('Real-world Lever Form Variations', () => {
    test('should handle Lever form with nested sections', async () => {
      document.body.innerHTML = `
        <div class="lever-application">
          <div class="section" data-section="contact">
            <h3>Contact Information</h3>
            <div class="field-group">
              <input name="name" type="text" placeholder="Full Name" />
            </div>
            <div class="field-group">
              <input name="email" type="email" placeholder="Email" />
            </div>
          </div>
          
          <div class="section" data-section="links">
            <h3>Professional Links</h3>
            <div class="url-fields">
              <input name="urls[LinkedIn]" type="url" placeholder="LinkedIn URL" />
              <input name="urls[GitHub]" type="url" placeholder="GitHub URL" />
            </div>
          </div>
          
          <div class="section" data-section="additional">
            <textarea name="comments" placeholder="Why are you interested?"></textarea>
          </div>
        </div>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(5); // name, email, LinkedIn, GitHub, comments
    });

    test('should handle Lever form with validation requirements', async () => {
      document.body.innerHTML = `
        <form class="lever-form">
          <input 
            name="name" 
            type="text" 
            required 
            minlength="2"
            pattern="[A-Za-z\\s]+"
            aria-describedby="name-error"
          />
          <input 
            name="email" 
            type="email" 
            required 
            aria-describedby="email-error"
          />
          <input 
            name="phone" 
            type="tel" 
            pattern="\\([0-9]{3}\\)\\s[0-9]{3}-[0-9]{4}"
          />
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;

      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      
      // Check that the form would pass validation
      expect(nameField.checkValidity()).toBe(true);
      expect(emailField.checkValidity()).toBe(true);
      
      expect(filledCount).toBe(3);
    });
  });
}); 