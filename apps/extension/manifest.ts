import { defineManifest } from '@crxjs/vite-plugin';

export const manifest = defineManifest({
  manifest_version: 3,
  name: 'AutoApply',
  version: '0.1.0',
  description: 'Automatically fill out job applications on various ATS platforms',
  permissions: [
    'storage',
    'activeTab',
    'scripting'
  ],
  host_permissions: [
    '*://workday.com/*',
    '*://*.workday.com/*',
    '*://greenhouse.io/*',
    '*://*.greenhouse.io/*',
    '*://lever.co/*',
    '*://*.lever.co/*',
    '*://taleo.net/*',
    '*://*.taleo.net/*',
    '*://*.ashbyhq.com/*',
    '*://*.workable.com/*',
    '*://*.icims.com/*'
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'assets/s1.png',
      '48': 'assets/s2.png',
      '128': 'assets/s3.png'
    }
  },
  icons: {
    '16': 'assets/s1.png',
    '48': 'assets/s2.png',
    '128': 'assets/s3.png'
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        '*://workday.com/*',
        '*://*.workday.com/*',
        '*://greenhouse.io/*',
        '*://*.greenhouse.io/*',
        '*://lever.co/*',
        '*://*.lever.co/*',
        '*://taleo.net/*',
        '*://*.taleo.net/*',
        '*://*.ashbyhq.com/*',
        '*://*.workable.com/*',
        '*://*.icims.com/*'
      ],
      js: ['src/content.ts'],
      css: ['content.css']
    }
  ]
}); 