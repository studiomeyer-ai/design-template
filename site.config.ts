const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aklow-labs.com';

export const siteConfig = {
  company: {
    name: 'Aklow Labs',
    tagline: 'AI Workspace',
    description:
      'AI Workspace with persistent memory. Your AI remembers context, learns preferences, and gets better over time.',
    url: baseUrl,
  },

  contact: {
    email: 'hello@aklow-labs.com',
    phone: '',
    phoneRaw: '',
  },

  address: {
    street: '',
    zip: '',
    city: 'Germany',
    country: 'Germany',
    countryCode: 'DE',
  },

  social: {
    twitter: 'aklow_labs',
    github: 'AklowLabs',
    telegram: 'aklow_bot',
  },

  seo: {
    themeColor: '#09090b',
    ogImage: '/opengraph-image.webp',
    accentColor: '#8B5CF6',
  },

  hours: {
    openingHours: 'Mo-Su 00:00-23:59',
    structured: [
      {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    ],
  },

  legal: {
    legalName: 'Aklow Labs (Matthias Meyer)',
    vatId: '',
  },

  links: {
    app: 'https://saas.aklow-labs.com',
    telegram: 'https://t.me/aklow_bot',
    github: 'https://github.com/AklowLabs',
    twitter: 'https://x.com/aklow_labs',
    docs: 'https://saas.aklow-labs.com',
  },
} as const;

export type SiteConfig = typeof siteConfig;
