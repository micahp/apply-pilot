/**
 * Default profile data — Micah Peoples
 * Extracted from resume (Summer 2025, July version).
 * Used when no profile has been configured in extension storage.
 */
import type { PartialProfile } from '../types/profile';

export const DEFAULT_PROFILE: PartialProfile = {
  personal: {
    firstName: 'Micah',
    lastName: 'Peoples',
    email: '',
    phone: '',
    linkedIn: '',
    github: '',
    website: 'micahp.github.io',
    city: 'Austin',
    state: 'TX',
  },
  workExperience: [
    {
      company: 'Shana Care',
      title: 'Lead Front End Engineer',
      startDate: '2024-10',
      endDate: '',
      current: true,
      location: 'Remote',
      description: 'Rebuilt React Native pipeline (EAS build, Fastlane), pulling App Store launch forward 7 months. Opened HIPAA-compliant booking pipeline.',
    },
    {
      company: 'Innovative Hype Labs',
      title: 'Product Manager / Engineer',
      startDate: '2021-01',
      endDate: '',
      current: true,
      location: 'Remote',
      description: 'Shipped YapGPT (multi-LLM chat w/ Claude, OpenAI, Gemini) in <6 weeks. Built Fine Photo Gen (AI image/video gen). Led JudeAI assistant for real estate.',
    },
    {
      company: 'Neiman Marcus',
      title: 'Product Manager',
      startDate: '2021-12',
      endDate: '2022-12',
      location: 'Remote',
      description: 'Built KPI dashboard segmenting customers; boosted associate outreach 20% and per-associate sales 10%. Ran contextual interviews at Austin Domain location.',
    },
    {
      company: 'Keller Williams Realty International',
      title: 'Product Manager',
      startDate: '2018-07',
      endDate: '2019-12',
      location: 'Austin, TX',
      description: 'Led vision-to-launch of consumer app features; grew home-search usage from 60M to 122M searches/quarter. Re-architected mobile flow, cutting perceived wait-time from ~15s to <3s.',
    },
  ],
  education: [
    {
      institution: 'The University of Texas at Austin',
      degree: "Bachelor's",
      fieldOfStudy: 'Computer Science',
      startDate: '2013',
      endDate: '2017-05',
      gpa: '3.8',
    },
  ],
  skills: [
    { name: 'React' },
    { name: 'React Native' },
    { name: 'TypeScript' },
    { name: 'Node.js' },
    { name: 'Next.js' },
    { name: 'GraphQL' },
    { name: 'PostgreSQL' },
    { name: 'MongoDB' },
    { name: 'Python' },
    { name: 'Docker' },
    { name: 'AWS' },
    { name: 'GCP' },
    { name: 'Elasticsearch' },
    { name: 'LLM Integration' },
    { name: 'AI Product Development' },
    { name: 'Product Management' },
  ],
  eeo: {},
  documents: {},
};

export default DEFAULT_PROFILE;
