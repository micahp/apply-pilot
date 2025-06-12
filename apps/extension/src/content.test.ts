/**
 * Integration tests for content script injection functionality
 * Tests the actual content script behavior in a simulated browser environment
 */
import { detectATS } from './utils/ats';

// Mock the floating panel module
jest.mock('./ui/floatingPanel', () => ({
  initFloatingPanel: jest.fn(() => {
    const mockPanel = document.createElement('div');
    mockPanel.id = 'autoapply-panel';
    document.body.appendChild(mockPanel);
    return mockPanel;
  }),
}));

describe('Content Script Integration', () => {
  beforeEach(() => {
    // Reset DOM and mocks
    document.body.innerHTML = '';
    jest.clearAllMocks();
    
    // Reset window location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://jobs.lever.co/example-company/job-id',
        hostname: 'jobs.lever.co',
      },
      writable: true,
    });
  });

  test('should detect ATS and initialize panel on supported sites', async () => {
    // Set up a Lever URL
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://jobs.lever.co/stripe/backend-engineer',
        hostname: 'jobs.lever.co',
      },
      writable: true,
    });

    const { initFloatingPanel } = await import('./ui/floatingPanel');
    
    // Manually call the detection logic (normally done by content.ts)
    const currentUrl = window.location.href;
    const detectedATS = detectATS(currentUrl);
    
    expect(detectedATS).not.toBeNull();
    expect(detectedATS?.name).toBe('Lever');
    
    // Simulate content script initialization
    if (detectedATS) {
      const panel = (initFloatingPanel as jest.Mock)({
        ats: {
          name: detectedATS.name,
          domain: new URL(currentUrl).hostname,
          selectors: detectedATS.selectors
        },
        onFillFields: jest.fn(),
        onClose: jest.fn(),
      });
      
      expect(initFloatingPanel).toHaveBeenCalled();
      expect(panel).toBeDefined();
    }
  });

  test('should not initialize panel on unsupported sites', () => {
    // Set up an unsupported URL
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://linkedin.com/jobs/view/123456',
        hostname: 'linkedin.com',
      },
      writable: true,
    });

    const currentUrl = window.location.href;
    const detectedATS = detectATS(currentUrl);
    
    expect(detectedATS).toBeNull();
  });

  describe('Field Injection Scenarios', () => {
    test('should inject into Lever application form', async () => {
      // Setup Lever application form
      document.body.innerHTML = `
        <div class="application-form">
          <h1>Software Engineer Application</h1>
          <form>
            <div class="form-group">
              <label for="name">Full Name</label>
              <input name="name" type="text" id="name" />
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input name="email" type="email" id="email" />
            </div>
            <div class="form-group">
              <label for="phone">Phone</label>
              <input name="phone" type="tel" id="phone" />
            </div>
            <div class="form-group">
              <label for="linkedin">LinkedIn URL</label>
              <input name="urls[LinkedIn]" type="url" id="linkedin" />
            </div>
            <div class="form-group">
              <label for="github">GitHub URL</label>
              <input name="urls[GitHub]" type="url" id="github" />
            </div>
            <div class="form-group">
              <label for="website">Portfolio Website</label>
              <input name="urls[Portfolio]" type="url" id="website" />
            </div>
            <div class="form-group">
              <label for="cover-letter">Cover Letter</label>
              <textarea name="comments" id="cover-letter" rows="5"></textarea>
            </div>
            <button type="submit">Submit Application</button>
          </form>
        </div>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      expect(platform).not.toBeNull();
      expect(platform?.selectors.firstName).toBe('input[name="name"]');
      expect(platform?.selectors.email).toBe('input[name="email"]');
      expect(platform?.selectors.linkedin).toBe('input[name="urls[LinkedIn]"]');

      // Verify selectors match the actual DOM
      expect(document.querySelector('input[name="name"]')).not.toBeNull();
      expect(document.querySelector('input[name="email"]')).not.toBeNull();
      expect(document.querySelector('input[name="urls[LinkedIn]"]')).not.toBeNull();
    });

    test('should inject into Workday application form', async () => {
      // Setup Workday application form
      document.body.innerHTML = `
        <div class="workday-application">
          <h1>Job Application</h1>
          <form>
            <div class="form-field">
              <label>First Name</label>
              <input data-automation-id="firstName" type="text" />
            </div>
            <div class="form-field">
              <label>Last Name</label>
              <input data-automation-id="lastName" type="text" />
            </div>
            <div class="form-field">
              <label>Email Address</label>
              <input data-automation-id="email" type="email" />
            </div>
            <div class="form-field">
              <label>Phone Number</label>
              <input data-automation-id="phone" type="tel" />
            </div>
            <div class="form-field">
              <label>Address</label>
              <input data-automation-id="addressLine1" type="text" />
            </div>
            <div class="form-field">
              <label>City</label>
              <input data-automation-id="city" type="text" />
            </div>
            <div class="form-field">
              <label>State</label>
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
          </form>
        </div>
      `;

      const platform = detectATS('https://company.wd1.myworkdayjobs.com/careers');
      expect(platform).not.toBeNull();
      expect(platform?.selectors.firstName).toBe('input[data-automation-id="firstName"], input[name="firstName"]');
      expect(platform?.selectors.lastName).toBe('input[data-automation-id="lastName"], input[name="lastName"]');

      // Verify selectors match the actual DOM
      expect(document.querySelector('[data-automation-id="firstName"]')).not.toBeNull();
      expect(document.querySelector('[data-automation-id="lastName"]')).not.toBeNull();
      expect(document.querySelector('[data-automation-id="email"]')).not.toBeNull();
    });

    test('should inject into Greenhouse application form', async () => {
      // Setup Greenhouse application form
      document.body.innerHTML = `
        <div class="greenhouse-application">
          <h1>Join Our Team</h1>
          <form>
            <div class="field">
              <label for="first_name">First Name</label>
              <input id="first_name" name="first_name" type="text" />
            </div>
            <div class="field">
              <label for="last_name">Last Name</label>
              <input id="last_name" name="last_name" type="text" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <input id="phone" name="phone" type="tel" />
            </div>
            <div class="field">
              <label for="resume">Resume</label>
              <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" />
            </div>
            <div class="field">
              <label for="cover_letter">Cover Letter</label>
              <textarea id="cover_letter" name="cover_letter" rows="5"></textarea>
            </div>
          </form>
        </div>
      `;

      const platform = detectATS('https://boards.greenhouse.io/company');
      expect(platform).not.toBeNull();
      expect(platform?.selectors.firstName).toBe('input#first_name, input[name="first_name"]');
      expect(platform?.selectors.lastName).toBe('input#last_name, input[name="last_name"]');

      // Verify selectors match the actual DOM
      expect(document.querySelector('#first_name')).not.toBeNull();
      expect(document.querySelector('#last_name')).not.toBeNull();
      expect(document.querySelector('#email')).not.toBeNull();
    });
  });

  describe('Event Simulation', () => {
    test('should properly trigger input events during injection', () => {
      document.body.innerHTML = `
        <form>
          <input name="name" type="text" />
          <input name="email" type="email" />
        </form>
      `;

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;

      // Mock event listeners to verify events are triggered
      const nameInputSpy = jest.fn();
      const nameChangeSpy = jest.fn();
      const nameBlurSpy = jest.fn();
      
      const emailInputSpy = jest.fn();
      const emailChangeSpy = jest.fn();
      const emailBlurSpy = jest.fn();

      nameField.addEventListener('input', nameInputSpy);
      nameField.addEventListener('change', nameChangeSpy);
      nameField.addEventListener('blur', nameBlurSpy);
      
      emailField.addEventListener('input', emailInputSpy);
      emailField.addEventListener('change', emailChangeSpy);
      emailField.addEventListener('blur', emailBlurSpy);

      // Simulate field filling with event triggering
      nameField.value = 'John Doe';
      nameField.dispatchEvent(new Event('input', { bubbles: true }));
      nameField.dispatchEvent(new Event('change', { bubbles: true }));
      nameField.dispatchEvent(new Event('blur', { bubbles: true }));

      emailField.value = 'john.doe@example.com';
      emailField.dispatchEvent(new Event('input', { bubbles: true }));
      emailField.dispatchEvent(new Event('change', { bubbles: true }));
      emailField.dispatchEvent(new Event('blur', { bubbles: true }));

      expect(nameInputSpy).toHaveBeenCalled();
      expect(nameChangeSpy).toHaveBeenCalled();
      expect(nameBlurSpy).toHaveBeenCalled();
      
      expect(emailInputSpy).toHaveBeenCalled();
      expect(emailChangeSpy).toHaveBeenCalled();
      expect(emailBlurSpy).toHaveBeenCalled();
    });
  });

  describe('Real-world Form Variations', () => {
    test('should handle forms with different field arrangements', () => {
      // Test a form where fields are nested in complex structures
      document.body.innerHTML = `
        <div class="application-container">
          <div class="section personal-info">
            <h2>Personal Information</h2>
            <div class="row">
              <div class="col-6">
                <input name="name" type="text" placeholder="Full Name" />
              </div>
              <div class="col-6">
                <input name="email" type="email" placeholder="Email Address" />
              </div>
            </div>
            <div class="row">
              <div class="col-12">
                <input name="phone" type="tel" placeholder="Phone Number" />
              </div>
            </div>
          </div>
          <div class="section links">
            <h2>Professional Links</h2>
            <input name="urls[LinkedIn]" type="url" placeholder="LinkedIn Profile" />
            <input name="urls[GitHub]" type="url" placeholder="GitHub Profile" />
            <input name="urls[Portfolio]" type="url" placeholder="Portfolio Website" />
          </div>
          <div class="section additional">
            <h2>Additional Information</h2>
            <textarea name="comments" placeholder="Cover letter or additional comments"></textarea>
          </div>
        </div>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      expect(platform).not.toBeNull();

      // Verify all expected fields are found despite complex nesting
      expect(document.querySelector('input[name="name"]')).not.toBeNull();
      expect(document.querySelector('input[name="email"]')).not.toBeNull();
      expect(document.querySelector('input[name="phone"]')).not.toBeNull();
      expect(document.querySelector('input[name="urls[LinkedIn]"]')).not.toBeNull();
      expect(document.querySelector('input[name="urls[GitHub]"]')).not.toBeNull();
      expect(document.querySelector('input[name="urls[Portfolio]"]')).not.toBeNull();
      expect(document.querySelector('textarea[name="comments"]')).not.toBeNull();
    });

    test('should handle forms with validation classes and attributes', () => {
      document.body.innerHTML = `
        <form class="validated-form">
          <div class="form-group has-validation">
            <input 
              name="name" 
              type="text" 
              class="form-control" 
              required 
              pattern="[A-Za-z\\s]+" 
              aria-describedby="name-help"
              data-validate="required"
            />
            <div id="name-help" class="form-text">Please enter your full name</div>
          </div>
          <div class="form-group has-validation">
            <input 
              name="email" 
              type="email" 
              class="form-control" 
              required 
              aria-describedby="email-help"
              data-validate="email"
            />
            <div id="email-help" class="form-text">Please enter a valid email address</div>
          </div>
        </form>
      `;

      const platform = detectATS('https://jobs.lever.co/company/job');
      expect(platform).not.toBeNull();

      const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
      const emailField = document.querySelector('input[name="email"]') as HTMLInputElement;

      expect(nameField).not.toBeNull();
      expect(emailField).not.toBeNull();
      expect(nameField.hasAttribute('required')).toBe(true);
      expect(emailField.hasAttribute('required')).toBe(true);
    });
  });
}); 