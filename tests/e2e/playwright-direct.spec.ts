import { test, expect } from '@playwright/test';

test.describe('AutoApply Direct Playwright Testing', () => {
  test('should fill Greenhouse form using Playwright directly', async ({ page }) => {
    // Navigate to the Greenhouse job page
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Inject our ATS detection logic directly into the page
    await page.addInitScript(() => {
      // Simplified ATS detection for testing
      window.playwrightAutoApply = {
        detectForms: () => {
          const forms = document.querySelectorAll('form');
          const inputs = document.querySelectorAll('input, textarea, select');
          return {
            formCount: forms.length,
            inputCount: inputs.length,
            hasFirstName: !!document.querySelector('#first_name, input[name*="first"], input[placeholder*="first" i]'),
            hasLastName: !!document.querySelector('#last_name, input[name*="last"], input[placeholder*="last" i]'),
            hasEmail: !!document.querySelector('#email, input[type="email"], input[name*="email"]'),
            hasResume: !!document.querySelector('input[type="file"]')
          };
        },
        createPanel: () => {
          if (document.getElementById('autoapply-panel')) return;
          
          const panel = document.createElement('div');
          panel.id = 'autoapply-panel';
          panel.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; z-index: 10000; 
                        background: white; border: 2px solid #007bff; border-radius: 8px;
                        padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <h3>AutoApply Panel (Playwright)</h3>
              <p>✅ ATS Detected: Greenhouse</p>
              <button id="fill-form-btn">Fill Form</button>
            </div>
          `;
          document.body.appendChild(panel);
          
          // Add click handler for fill button
          document.getElementById('fill-form-btn')?.addEventListener('click', () => {
            console.log('Playwright: Filling form...');
            // This would be handled by Playwright, not content script
          });
        }
      };
    });
    
    // Execute our detection logic
    const formInfo = await page.evaluate(() => {
      return window.playwrightAutoApply.detectForms();
    });
    
    console.log('Form detection results:', formInfo);
    
    // Verify form detection worked
    expect(formInfo.formCount).toBeGreaterThan(0);
    expect(formInfo.inputCount).toBeGreaterThan(0);
    expect(formInfo.hasFirstName).toBe(true);
    expect(formInfo.hasLastName).toBe(true);
    expect(formInfo.hasEmail).toBe(true);
    
    // Create the AutoApply panel using Playwright
    await page.evaluate(() => {
      window.playwrightAutoApply.createPanel();
    });
    
    // Verify panel was created
    const panel = page.locator('#autoapply-panel');
    await expect(panel).toBeVisible();
    
    // Test form filling with Playwright (no extension needed)
    const testProfile = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '555-123-4567'
    };
    
    // Fill form fields directly with Playwright
    const firstNameField = page.locator('#first_name').first();
    if (await firstNameField.isVisible()) {
      await firstNameField.fill(testProfile.firstName);
    }
    
    const lastNameField = page.locator('#last_name').first();
    if (await lastNameField.isVisible()) {
      await lastNameField.fill(testProfile.lastName);
    }
    
    const emailField = page.locator('#email').first();
    if (await emailField.isVisible()) {
      await emailField.fill(testProfile.email);
    }
    
    const phoneField = page.locator('#phone').first();
    if (await phoneField.isVisible()) {
      await phoneField.fill(testProfile.phone);
    }
    
    // Verify fields were filled
    await expect(firstNameField).toHaveValue(testProfile.firstName);
    await expect(lastNameField).toHaveValue(testProfile.lastName);
    await expect(emailField).toHaveValue(testProfile.email);
    await expect(phoneField).toHaveValue(testProfile.phone);
    
    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/playwright-direct-fill.png' });
    
    console.log('✅ Playwright direct form filling successful!');
  });
  
  test('should handle file upload with Playwright', async ({ page }) => {
    await page.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    await page.waitForLoadState('networkidle');
    
    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    
    if (await fileInput.isVisible()) {
      // Create a dummy resume file for testing
      const dummyResume = Buffer.from('Dummy Resume Content');
      
      // Upload file
      await fileInput.setInputFiles({
        name: 'resume.pdf',
        mimeType: 'application/pdf',
        buffer: dummyResume
      });
      
      console.log('✅ File upload test completed');
    } else {
      console.log('ℹ️  No file input found on this page');
    }
  });
});

// Global type declaration for our injected script
declare global {
  interface Window {
    playwrightAutoApply: {
      detectForms: () => any;
      createPanel: () => void;
    };
  }
} 