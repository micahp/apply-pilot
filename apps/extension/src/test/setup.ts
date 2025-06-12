// Mock Chrome extension APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        // Mock default profile data
        const mockProfile = {
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
        };
        callback({ profile: mockProfile });
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
    },
  },
} as any;

// Mock DOM methods for testing form filling
Object.defineProperty(HTMLElement.prototype, 'dispatchEvent', {
  value: jest.fn(),
  writable: true,
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Simple location mock for tests - don't try to redefine the property
// Tests will need to mock specific URL values as needed
const mockLocation = {
  href: 'https://jobs.lever.co/example-company/job-id',
  hostname: 'jobs.lever.co',
  origin: 'https://jobs.lever.co',
  pathname: '/example-company/job-id',
  search: '',
  hash: '',
  protocol: 'https:',
  port: '',
  host: 'jobs.lever.co',
  replace: jest.fn(),
  reload: jest.fn(),
  assign: jest.fn(),
  toString: () => 'https://jobs.lever.co/example-company/job-id',
}; 