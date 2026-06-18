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
    '*://*.icims.com/*',
    '*://*.smartrecruiters.com/*',
    '*://*.myworkdayjobs.com/*',
    '*://*.bamboohr.com/*',
    '*://*.breezy.hr/*',
    '*://*.recruitee.com/*',
    '*://*.jazzhr.com/*',
    '*://*.applytojob.com/*',
    '*://*.personio.com/*',
    '*://*.zohorecruit.com/*',
    '*://jobs.lever.co/*',
    '*://boards.greenhouse.io/*',
    '*://*.linkedin.com/*',
    '*://*.indeed.com/*',
    '*://*.ycombinator.com/*',
    '*://*.workatastartup.com/*',
    '*://*.wellfound.com/*',
    '*://*.angel.co/*'
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'assets/icon-16.png',
      '48': 'assets/icon-48.png',
      '128': 'assets/icon-128.png'
    }
  },
  icons: {
    '16': 'assets/icon-16.png',
    '48': 'assets/icon-48.png',
    '128': 'assets/icon-128.png'
  },
  options_page: 'src/options/index.html',
  web_accessible_resources: [
    {
      resources: ['src/jobs/index.html', 'src/jobs/job_listings.js', 'src/jobs/styles.css'],
      matches: ['<all_urls>']
    }
  ],
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
        '*://*.icims.com/*',
        '*://*.smartrecruiters.com/*',
        '*://*.myworkdayjobs.com/*',
        '*://*.bamboohr.com/*',
        '*://*.breezy.hr/*',
        '*://*.recruitee.com/*',
        '*://*.jazzhr.com/*',
        '*://*.applytojob.com/*',
        '*://*.personio.com/*',
        '*://*.zohorecruit.com/*',
        '*://jobs.lever.co/*',
        '*://boards.greenhouse.io/*',
        '*://*.linkedin.com/*',
        '*://*.indeed.com/*',
        '*://*.ycombinator.com/*',
        '*://*.workatastartup.com/*',
        '*://*.wellfound.com/*',
        '*://*.angel.co/*'
      ],
      js: ['src/content.ts'],
      css: ['content.css']
    }
  ]
}); 