import { EnhancedATSFiller, EnhancedFillOptions } from '../ats-enhanced';
import { ATSPlatform } from '../ats';
import { Profile } from '../../types/profile';
import { getPlaywrightService } from '../playwright-background-service';

// Mock the playwright service
jest.mock('../playwright-background-service');
const mockPlaywrightService = getPlaywrightService as jest.MockedFunction<typeof getPlaywrightService>;

describe('Playwright Integration Tests', () => {
  let enhancedFiller: EnhancedATSFiller;
  let mockPlatform: ATSPlatform;
  let mockProfile: Profile;
  let mockPlaywrightServiceInstance: any;

  beforeEach(() => {
    // Setup mock Playwright service
    mockPlaywrightServiceInstance = {
      handleComplexForm: jest.fn(),
      handleFileUpload: jest.fn(),
      handleLocationAutocomplete: jest.fn(),
      initialize: jest.fn(),
      dispose: jest.fn()
    };

    mockPlaywrightService.mockReturnValue(mockPlaywrightServiceInstance);

    enhancedFiller = new EnhancedATSFiller(true); // Enable debug mode

    mockPlatform = {
      name: 'Test ATS',
      slug: 'test',
      description: 'Test platform',
      urlPatterns: [/test\.com/],
      selectors: {
        firstName: 'input[name="firstName"]',
        lastName: 'input[name="lastName"]',
        email: 'input[name="email"]',
        phone: 'input[name="phone"]',
        location: 'input[name="location"]',
        resume: 'input[type="file"][name="resume"]',
        coverLetter: 'textarea[name="coverLetter"]'
      }
    };

    mockProfile = {
      personal: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '(555) 123-4567',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        address: '123 Main St'
      },
      documents: {
        resume: 'Resume content here',
        coverLetter: 'Cover letter content'
      },
      eeo: {},
      workExperience: [],
      education: [],
      skills: []
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Strategy Selection', () => {
    test('should select content-script-only for simple forms', async () => {
      const simplePlatform = {
        ...mockPlatform,
        selectors: {
          firstName: 'input[name="firstName"]',
          email: 'input[name="email"]'
        }
      };

      const result = await enhancedFiller.fillATSFieldsEnhanced(simplePlatform, mockProfile);

      expect(result.usedPlaywright).toBe(false);
      expect(result.platformSpecificInfo?.platform).toBe('test');
    });

    test('should select hybrid strategy for forms with complex fields', async () => {
      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);
      
      // Since we have file upload fields in the mock profile, should consider Playwright
      expect(result.platformSpecificInfo?.platform).toBe('test');
    });

    test('should select playwright-only for Workday platform', async () => {
      const workdayPlatform = {
        ...mockPlatform,
        slug: 'workday'
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 5,
        errors: [],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(workdayPlatform, mockProfile);

      expect(result.usedPlaywright).toBe(true);
      expect(result.platformSpecificInfo?.requiresManualSteps).toBe(true);
    });

    test('should force Playwright when specified in options', async () => {
      const options: EnhancedFillOptions = {
        forcePlaywright: true,
        debugMode: true
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 3,
        errors: [],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, options);

      expect(result.usedPlaywright).toBe(true);
      expect(mockPlaywrightServiceInstance.handleComplexForm).toHaveBeenCalledWith(
        expect.any(String),
        mockPlatform,
        mockProfile,
        expect.any(Array)
      );
    });
  });

  describe('Enhanced Fill Result Structure', () => {
    test('should return comprehensive result structure', async () => {
      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('totalFieldsFilled');
      expect(result).toHaveProperty('contentScriptFields');
      expect(result).toHaveProperty('playwrightFields');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('usedPlaywright');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('platformSpecificInfo');
    });

    test('should provide detailed platform information', async () => {
      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);

      expect(result.platformSpecificInfo).toMatchObject({
        platform: 'test',
        detectedComplexFields: expect.any(Array),
        requiresManualSteps: expect.any(Boolean)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid platform gracefully', async () => {
      const invalidPlatform = {
        ...mockPlatform,
        selectors: {}
      };

      const result = await enhancedFiller.fillATSFieldsEnhanced(invalidPlatform, mockProfile);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    test('should handle incomplete profile data', async () => {
      const incompleteProfile: Profile = {
        ...mockProfile,
        personal: {
          firstName: 'John',
          lastName: '',
          email: '',
          phone: ''
          // Minimal required fields
        }
      };

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, incompleteProfile);

      expect(result).toBeDefined();
      expect(result.totalFieldsFilled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Options Handling', () => {
    test('should respect forceContentScript option', async () => {
      const options: EnhancedFillOptions = {
        forceContentScript: true
      };

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, options);

      expect(result.usedPlaywright).toBe(false);
    });

    test('should handle debug mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, {
        debugMode: true
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Complex Field Handling', () => {
    test('should handle file uploads with Playwright', async () => {
      const profileWithFiles = {
        ...mockProfile,
        documents: {
          resume: 'PDF content buffer',
          coverLetter: 'Cover letter PDF content'
        }
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 2,
        errors: [],
        warnings: ['File upload completed']
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, profileWithFiles);

      expect(result.usedPlaywright).toBe(true);
      expect(result.warnings).toContain('File upload completed');
    });

    test('should handle location autocomplete for Lever', async () => {
      const leverPlatform = {
        ...mockPlatform,
        slug: 'lever'
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 1,
        errors: [],
        warnings: ['Lever location field may require manual verification']
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(leverPlatform, mockProfile);

      expect(result.warnings).toEqual(
        expect.arrayContaining(['Lever location field may require manual verification'])
      );
    });

    test('should provide fallback for failed Playwright operations', async () => {
      mockPlaywrightServiceInstance.handleComplexForm.mockRejectedValue(
        new Error('Playwright timeout')
      );

      // Mock the content script fallback to succeed
      const originalFillATSFields = require('../ats').fillATSFields;
      require('../ats').fillATSFields = jest.fn().mockResolvedValue(3);

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);

      expect(result.contentScriptFields).toBe(3);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Playwright')])
      );

      // Restore original function
      require('../ats').fillATSFields = originalFillATSFields;
    });
  });

  describe('Platform-Specific Features', () => {
    test('should provide Workday-specific recommendations', async () => {
      const workdayPlatform = {
        ...mockPlatform,
        slug: 'workday'
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 4,
        errors: [],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(workdayPlatform, mockProfile);

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Continue'),
          expect.stringContaining('multiple pages')
        ])
      );
    });

    test('should provide Lever-specific recommendations', async () => {
      const leverPlatform = {
        ...mockPlatform,
        slug: 'lever'
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 2,
        errors: [],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(leverPlatform, mockProfile);

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('location autocomplete'),
          expect.stringContaining('resume upload')
        ])
      );
    });

    test('should provide Greenhouse-specific recommendations', async () => {
      const greenhousePlatform = {
        ...mockPlatform,
        slug: 'greenhouse'
      };

      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: true,
        filledFields: 2, // Low count triggers recommendation
        errors: [],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(greenhousePlatform, mockProfile);

      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('custom questions'),
          expect.stringContaining('many fields')
        ])
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle Playwright service initialization failure', async () => {
      mockPlaywrightServiceInstance.handleComplexForm.mockRejectedValue(
        new Error('Failed to initialize browser')
      );

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, {
        forcePlaywright: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Failed to initialize browser')])
      );
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should provide comprehensive error analysis', async () => {
      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: false,
        filledFields: 0,
        errors: ['Selector not found', 'Timeout waiting for element'],
        warnings: ['Form may not be loaded']
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);

      expect(result.errors).toEqual(
        expect.arrayContaining(['Selector not found', 'Timeout waiting for element'])
      );
      expect(result.warnings).toEqual(
        expect.arrayContaining(['Form may not be loaded'])
      );
    });

    test('should handle mixed success scenarios', async () => {
      // Mock content script to succeed partially
      const originalFillATSFields = require('../ats').fillATSFields;
      require('../ats').fillATSFields = jest.fn().mockResolvedValue(2);

      // Mock Playwright to fail
      mockPlaywrightServiceInstance.handleComplexForm.mockResolvedValue({
        success: false,
        filledFields: 0,
        errors: ['Complex field handling failed'],
        warnings: []
      });

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile);

      expect(result.contentScriptFields).toBe(2);
      expect(result.playwrightFields).toBe(0);
      expect(result.totalFieldsFilled).toBe(2);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Playwright phase failed')])
      );

      // Restore original function
      require('../ats').fillATSFields = originalFillATSFields;
    });
  });

  describe('Advanced Options', () => {
    test('should respect disabled feature flags', async () => {
      const options: EnhancedFillOptions = {
        enableFileUploads: false,
        enableLocationAutocomplete: false,
        enableMultiStepFlow: false
      };

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, options);

      // Should default to content script only when complex features are disabled
      expect(result.usedPlaywright).toBe(false);
    });

    test('should provide detailed debug information when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await enhancedFiller.fillATSFieldsEnhanced(mockPlatform, mockProfile, {
        debugMode: true
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancedATSFiller]'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Form Analysis', () => {
    test('should analyze form complexity correctly', async () => {
      const complexPlatform = {
        ...mockPlatform,
        slug: 'workday'
      };

      const analysis = await enhancedFiller.analyzeForm(complexPlatform, mockProfile);

      expect(analysis.complexity).toBe('complex');
      expect(analysis.recommendedStrategy).toBe('playwright-only');
      expect(analysis.detectedFields).toEqual(expect.any(Array));
      expect(analysis.potentialIssues).toEqual(expect.any(Array));
      expect(analysis.optimizations).toEqual(expect.any(Array));
    });

    test('should identify missing profile data', async () => {
      const incompleteProfile = {
        ...mockProfile,
        documents: {} // No resume
      };

      const analysis = await enhancedFiller.analyzeForm(mockPlatform, incompleteProfile);

      expect(analysis.potentialIssues).toEqual(
        expect.arrayContaining([expect.stringContaining('resume')])
      );
    });
  });
}); 