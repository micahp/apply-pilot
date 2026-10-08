// Minimal Chrome extension API stub; individual tests override what they need.
(globalThis as any).chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
  },
  storage: {
    local: { get: jest.fn(), set: jest.fn() },
  },
  tabs: { query: jest.fn(), sendMessage: jest.fn(), onUpdated: { addListener: jest.fn() } },
};
