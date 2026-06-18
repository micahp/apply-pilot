import { execSync } from 'child_process';
import { FullConfig } from '@playwright/test';
import fs from 'fs';

/**
 * Global teardown to ensure all browser processes are cleaned up
 * This helps prevent memory leaks and zombie processes
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global teardown...');
  
  try {
    // Kill any remaining Chrome processes
    if (process.platform === 'darwin') {
      // macOS
      try {
        execSync('pkill -f "Google Chrome for Testing"', { stdio: 'ignore' });
        console.log('✅ Killed Chrome for Testing processes on macOS');
      } catch (error) {
        // Process not found is OK
      }
      
      try {
        execSync('pkill -f "chrome"', { stdio: 'ignore' });
        console.log('✅ Killed any remaining Chrome processes on macOS');
      } catch (error) {
        // Process not found is OK
      }
    } else if (process.platform === 'linux') {
      // Linux
      try {
        execSync('pkill -f "chrome"', { stdio: 'ignore' });
        console.log('✅ Killed Chrome processes on Linux');
      } catch (error) {
        // Process not found is OK
      }
    } else if (process.platform === 'win32') {
      // Windows
      try {
        execSync('taskkill /f /im chrome.exe', { stdio: 'ignore' });
        console.log('✅ Killed Chrome processes on Windows');
      } catch (error) {
        // Process not found is OK
      }
    }
    
    // Clean up temporary user data directories
    try {
      const tempDirs = execSync('find /tmp -name "test-user-data-dir-*" -type d 2>/dev/null || true', { 
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'] 
      }).trim().split('\n').filter(Boolean);
      
      for (const dir of tempDirs) {
        if (dir && fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`🗑️  Cleaned up temp directory: ${dir}`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not clean up temp directories:', error.message);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🧹 Forced garbage collection');
    }
    
    console.log('✅ Global teardown completed');
    
  } catch (error) {
    console.error('❌ Error during global teardown:', error.message);
  }
}

export default globalTeardown; 