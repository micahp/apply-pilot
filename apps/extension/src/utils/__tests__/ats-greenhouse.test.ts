import { detectATS, fillATSFields } from '../ats';
import { Profile } from '../../types/profile';

const mockProfile: Profile = {
  personal: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    linkedIn: 'https://linkedin.com/in/johndoe',
  },
  eeo: {},
  workExperience: [],
  education: [],
  skills: [],
  documents: {
    resume: 'resume.pdf',
    coverLetter: 'I am passionate about software engineering...',
  },
};

describe('Greenhouse ATS Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('URL Detection', () => {
    test('should detect various Greenhouse URL patterns', () => {
      const greenhouseUrls = [
        'https://boards.greenhouse.io/company',
        'https://boards.greenhouse.io/slack/jobs/123456',
        'https://boards.greenhouse.io/airbnb/jobs/software-engineer',
        'https://app.greenhouse.io/applications/new/job/123456',
        'https://boards.greenhouse.io/stripe/jobs/4567890',
      ];

      greenhouseUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected).not.toBeNull();
        expect(detected?.name).toBe('Greenhouse');
        expect(detected?.slug).toBe('greenhouse');
      });
    });

    test('should not detect non-Greenhouse URLs', () => {
      const nonGreenhouseUrls = [
        'https://greenhouse.io/company-info',
        'https://jobs.lever.co/company',
        'https://company.wd1.myworkdayjobs.com/careers',
        'https://company.com/careers',
      ];

      nonGreenhouseUrls.forEach(url => {
        const detected = detectATS(url);
        expect(detected?.slug).not.toBe('greenhouse');
      });
    });
  });

  describe('Form Field Injection', () => {
    test('should inject into standard Greenhouse application form', async () => {
      document.body.innerHTML = `
        <div class="greenhouse-application">
          <h1>Software Engineer Application</h1>
          <form id="application_form" method="post">
            <div class="section">
              <h2>Basic Information</h2>
              <div class="field">
                <label for="first_name">First Name *</label>
                <input id="first_name" name="first_name" type="text" required />
              </div>
              <div class="field">
                <label for="last_name">Last Name *</label>
                <input id="last_name" name="last_name" type="text" required />
              </div>
              <div class="field">
                <label for="email">Email *</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div class="field">
                <label for="phone">Phone</label>
                <input id="phone" name="phone" type="tel" />
              </div>
            </div>
            
            <div class="section">
              <h2>Documents</h2>
              <div class="field">
                <label for="resume">Resume *</label>
                <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" required />
              </div>
              <div class="field">
                <label for="cover_letter">Cover Letter</label>
                <textarea id="cover_letter" name="cover_letter" rows="8" placeholder="Tell us about yourself..."></textarea>
              </div>
            </div>
            
            <div class="section">
              <h2>Additional Information</h2>
              <div class="field">
                <label for="linkedin_url">LinkedIn Profile</label>
                <input 
                  name="job_application[answers_attributes][0][text_value]" 
                  type="url" 
                  aria-label="LinkedIn Profile URL"
                />
              </div>
            </div>
            
            <button type="submit">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company/jobs/123456');
      expect(platform).not.toBeNull();

      const filledCount = await fillATSFields(platform!, mockProfile);

      // Verify all fields were filled correctly
      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const lastNameField = document.querySelector('#last_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const phoneField = document.querySelector('#phone') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLTextAreaElement;
      const linkedInField = document.querySelector('input[name="job_application[answers_attributes][0][text_value]"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(coverLetterField.value).toBe('I am passionate about software engineering...');
      expect(linkedInField.value).toBe('https://linkedin.com/in/johndoe');

      expect(filledCount).toBe(6); // All fields except file upload
    });

    test('should handle Greenhouse forms with alternative selectors', async () => {
      document.body.innerHTML = `
        <form>
          <input name="first_name" type="text" />
          <input name="last_name" type="text" />
          <input name="email" type="email" />
          <input name="phone" type="tel" />
          <textarea name="cover_letter"></textarea>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should use name-based selectors when ID selectors aren't available
      const firstNameField = document.querySelector('input[name="first_name"]') as HTMLInputElement;
      const lastNameField = document.querySelector('input[name="last_name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;
      const phoneField = document.querySelector('input[name="phone"]') as HTMLInputElement;
      const coverLetterField = document.querySelector('textarea[name="cover_letter"]') as HTMLTextAreaElement;

      expect(firstNameField.value).toBe('John');
      expect(lastNameField.value).toBe('Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(phoneField.value).toBe('(555) 123-4567');
      expect(coverLetterField.value).toBe('I am passionate about software engineering...');

      expect(filledCount).toBe(5);
    });

    test('should handle file upload fields appropriately', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
          <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" />
          <input id="cover_letter_file" name="cover_letter_file" type="file" accept=".pdf,.doc,.txt" />
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // File inputs should not be filled automatically
      const resumeField = document.querySelector('#resume') as HTMLInputElement;
      const coverLetterFileField = document.querySelector('#cover_letter_file') as HTMLInputElement;
      
      expect(resumeField.value).toBe('');
      expect(coverLetterFileField.value).toBe('');

      // But text fields should be filled
      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      
      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      
      expect(filledCount).toBe(2); // Only text fields
    });

    test('should handle complex LinkedIn URL field patterns', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
          
          <!-- Complex Greenhouse LinkedIn field pattern -->
          <input 
            name="job_application[answers_attributes][0][text_value]" 
            type="url" 
            aria-label="LinkedIn Profile URL"
            data-question="LinkedIn Profile"
          />
          
          <!-- Alternative LinkedIn pattern -->
          <input 
            name="job_application[answers_attributes][1][text_value]" 
            type="url" 
            aria-label="Portfolio Website"
            data-question="Portfolio"
          />
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill the LinkedIn field with the correct pattern
      const linkedInField = document.querySelector('input[name="job_application[answers_attributes][0][text_value]"][aria-label*="LinkedIn"]') as HTMLInputElement;
      
      expect(linkedInField?.value).toBe('https://linkedin.com/in/johndoe');
      expect(filledCount).toBe(3); // firstName, email, LinkedIn
    });

    test('should trigger events correctly on Greenhouse forms', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
        </form>
      `;

      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;

      const firstNameDispatchSpy = jest.spyOn(firstNameField, 'dispatchEvent');
      const emailDispatchSpy = jest.spyOn(emailField, 'dispatchEvent');

      const platform = detectATS('https://boards.greenhouse.io/company');
      await fillATSFields(platform!, mockProfile);

      expect(firstNameDispatchSpy).toHaveBeenCalledTimes(3);
      expect(emailDispatchSpy).toHaveBeenCalledTimes(3);

      const firstNameEvents = firstNameDispatchSpy.mock.calls.map(call => call[0].type);
      const emailEvents = emailDispatchSpy.mock.calls.map(call => call[0].type);

      expect(firstNameEvents).toEqual(['input', 'change', 'blur']);
      expect(emailEvents).toEqual(['input', 'change', 'blur']);
    });
  });

  describe('Complex Greenhouse Forms', () => {
    test('should handle multi-section Greenhouse application', async () => {
      document.body.innerHTML = `
        <div class="greenhouse-job-board">
          <form class="job-application-form">
            <section class="basic-info">
              <h3>Contact Information</h3>
              <input id="first_name" name="first_name" type="text" />
              <input id="last_name" name="last_name" type="text" />
              <input id="email" name="email" type="email" />
              <input id="phone" name="phone" type="tel" />
            </section>
            
            <section class="documents">
              <h3>Resume & Cover Letter</h3>
              <input id="resume" name="resume" type="file" />
              <textarea id="cover_letter" name="cover_letter" placeholder="Cover letter..."></textarea>
            </section>
            
            <section class="additional-questions">
              <h3>Additional Questions</h3>
              <div class="question">
                <label>LinkedIn Profile URL</label>
                <input 
                  name="job_application[answers_attributes][0][text_value]" 
                  type="url" 
                  aria-label="LinkedIn Profile URL"
                />
              </div>
              <div class="question">
                <label>Years of Experience</label>
                <select name="job_application[answers_attributes][1][text_value]">
                  <option value="">Select...</option>
                  <option value="0-2">0-2 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="6+">6+ years</option>
                </select>
              </div>
            </section>
          </form>
        </div>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill fields across all sections
      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLTextAreaElement;
      const linkedInField = document.querySelector('input[name="job_application[answers_attributes][0][text_value]"]') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(coverLetterField.value).toBe('I am passionate about software engineering...');
      expect(linkedInField.value).toBe('https://linkedin.com/in/johndoe');
      
      expect(filledCount).toBe(6); // All text fields (not file or select)
    });

    test('should handle Greenhouse forms with conditional sections', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
          
          <!-- Section that might be shown/hidden based on user selections -->
          <div class="conditional-section" style="display: block;">
            <input id="phone" name="phone" type="tel" />
            <textarea id="cover_letter" name="cover_letter"></textarea>
          </div>
          
          <!-- Hidden section -->
          <div class="hidden-section" style="display: none;">
            <input name="secondary_email" type="email" />
          </div>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(4); // Should fill visible and hidden fields
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing profile data gracefully', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="last_name" name="last_name" type="text" />
          <input id="email" name="email" type="email" />
          <textarea id="cover_letter" name="cover_letter"></textarea>
        </form>
      `;

      const incompleteProfile: Profile = {
        personal: {
          firstName: 'Jane',
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

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, incompleteProfile);

      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const lastNameField = document.querySelector('#last_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLTextAreaElement;

      expect(firstNameField.value).toBe('Jane');
      expect(lastNameField.value).toBe('');
      expect(emailField.value).toBe('');
      expect(coverLetterField.value).toBe('');

      expect(filledCount).toBe(1); // Only firstName filled
    });

    test('should handle forms with no matching fields', async () => {
      document.body.innerHTML = `
        <form>
          <input name="unknown_field_1" type="text" />
          <input name="unknown_field_2" type="email" />
          <textarea name="unknown_field_3"></textarea>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      expect(filledCount).toBe(0);
    });
  });

  describe('Real-world Greenhouse Scenarios', () => {
    test('should handle Greenhouse form with GDPR compliance fields', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
          <textarea id="cover_letter" name="cover_letter"></textarea>
          
          <!-- GDPR compliance section -->
          <div class="gdpr-section">
            <input type="checkbox" id="gdpr_consent" name="gdpr_consent" required />
            <label for="gdpr_consent">I consent to processing of my personal data</label>
            
            <input type="checkbox" id="marketing_consent" name="marketing_consent" />
            <label for="marketing_consent">I consent to receive marketing communications</label>
          </div>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      // Should fill text fields but not checkboxes
      const firstNameField = document.querySelector('#first_name') as HTMLInputElement;
      const emailField = document.querySelector('#email') as HTMLInputElement;
      const coverLetterField = document.querySelector('#cover_letter') as HTMLTextAreaElement;
      const gdprCheckbox = document.querySelector('#gdpr_consent') as HTMLInputElement;

      expect(firstNameField.value).toBe('John');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(coverLetterField.value).toBe('I am passionate about software engineering...');
      expect(gdprCheckbox.checked).toBe(false); // Should not auto-check

      expect(filledCount).toBe(3);
    });

    test('should handle Greenhouse form with custom question patterns', async () => {
      document.body.innerHTML = `
        <form>
          <input id="first_name" name="first_name" type="text" />
          <input id="email" name="email" type="email" />
          
          <!-- Various custom question patterns -->
          <input 
            name="job_application[answers_attributes][0][text_value]" 
            type="url" 
            aria-label="Please provide your LinkedIn profile URL"
          />
          
          <input 
            name="job_application[answers_attributes][1][text_value]" 
            type="url" 
            aria-label="GitHub profile (optional)"
          />
          
          <textarea 
            name="job_application[answers_attributes][2][text_value]" 
            aria-label="Why are you interested in this role?"
          ></textarea>
        </form>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      const filledCount = await fillATSFields(platform!, mockProfile);

      const linkedInField = document.querySelector('input[aria-label*="LinkedIn"]') as HTMLInputElement;
      
      expect(linkedInField?.value).toBe('https://linkedin.com/in/johndoe');
      expect(filledCount).toBe(3); // firstName, email, LinkedIn
    });
  });
}); 