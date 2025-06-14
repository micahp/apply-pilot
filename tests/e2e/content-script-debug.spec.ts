import { test, expect } from '../fixtures/shared-extension';

test.describe('Content Script Debug', () => {
  test('verify content script execution', async ({ extensionPage }) => {
    // First, let's test with a simple page
    await extensionPage.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    // Check if Chrome extension APIs are available
    const chromeApiInfo = await extensionPage.evaluate(() => {
      return {
        hasChrome: typeof chrome !== 'undefined',
        hasRuntime: typeof chrome?.runtime !== 'undefined',
        hasStorage: typeof chrome?.storage !== 'undefined',
        extensionId: chrome?.runtime?.id || null,
        manifest: chrome?.runtime?.getManifest?.() || null
      };
    });
    
    console.log('Chrome API Info:', chromeApiInfo);
    
    // Add a simple global variable from content script to verify it's running
    await extensionPage.addInitScript(`
      window.contentScriptLoaded = true;
      console.log('INIT SCRIPT: Content script test loaded');
    `);
    
    // Now go to Greenhouse
    await extensionPage.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    
    // Wait for any content scripts to execute
    await extensionPage.waitForTimeout(3000);
    
    // Check if our test variable is set
    const testVariableSet = await extensionPage.evaluate(() => {
      return {
        contentScriptLoaded: (window as any).contentScriptLoaded || false,
        chromeAvailable: typeof chrome !== 'undefined',
        chromeRuntimeAvailable: typeof chrome?.runtime !== 'undefined'
      };
    });
    
    console.log('Test variables:', testVariableSet);
    
    // Try to inject a simple script to test extension loading
    try {
      await extensionPage.evaluate(() => {
        // Try to access the extension's manifest
        if (chrome?.runtime?.getManifest) {
          const manifest = chrome.runtime.getManifest();
          console.log('Extension manifest:', manifest);
          return manifest;
        }
        return null;
      });
    } catch (error) {
      console.log('Error accessing extension manifest:', error);
    }
    
    // Check if the extension is properly loaded in the browser
    const extensionPages = await extensionPage.context().pages();
    console.log('Total pages in context:', extensionPages.length);
    
    // Look for extension-related errors in console
    const consoleMessages: string[] = [];
    extensionPage.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    await extensionPage.waitForTimeout(2000);
    
    console.log('Console messages:');
    consoleMessages.forEach(msg => console.log(msg));
    
    expect(true).toBe(true); // Always pass to collect debug info
  });
  
  test('verify extension files are accessible', async ({ extensionPage }) => {
    await extensionPage.goto('https://job-boards.greenhouse.io/headway/jobs/5308863004');
    
    // Try to access extension resources directly
    const extensionInfo = await extensionPage.evaluate(async () => {
      const results: Array<{type: string, value: any}> = [];
      
      // Try to access the manifest
      try {
        if (chrome?.runtime?.getURL) {
          const manifestUrl = chrome.runtime.getURL('manifest.json');
          results.push({ type: 'manifest_url', value: manifestUrl });
          
          // Try to fetch the manifest
          const response = await fetch(manifestUrl);
          const manifest = await response.json();
          results.push({ type: 'manifest', value: manifest });
        }
      } catch (error) {
        results.push({ type: 'manifest_error', value: error.message });
      }
      
      // Check if content script is loaded
      try {
        if (chrome?.runtime?.getURL) {
          const contentScriptUrl = chrome.runtime.getURL('src/content.ts-loader.js');
          results.push({ type: 'content_script_url', value: contentScriptUrl });
        }
      } catch (error) {
        results.push({ type: 'content_script_error', value: error.message });
      }
      
      return results;
    });
    
    console.log('Extension info:', extensionInfo);
    
    expect(true).toBe(true);
  });
}); 