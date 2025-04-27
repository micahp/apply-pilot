/// <reference types="chrome" />

// This file ensures TypeScript recognizes Chrome APIs
// No additional declarations needed as they're provided by @types/chrome

// Type definitions for Chrome extension API
interface Chrome {
  storage: {
    local: {
      get(keys: string | string[] | Object | null): Promise<any>;
      set(items: Object): Promise<void>;
    }
  }
  runtime: {
    sendMessage(message: any): Promise<any>;
    onMessage: {
      addListener(callback: (message: any, sender: any, sendResponse: Function) => void): void;
    }
  }
  tabs: {
    query(queryInfo: Object): Promise<any[]>;
    sendMessage(tabId: number, message: any): Promise<any>;
  }
}

declare const chrome: Chrome; 