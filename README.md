# SaaS Landing Template

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![next-intl](https://img.shields.io/badge/next--intl-3.26-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

A production-ready, modern SaaS landing page template built with Next.js 15, React 19, TypeScript, and Tailwind CSS. Features multilingual support (DE, EN, ES), smooth animations, and full Docker deployment support.

---

## Features

### Core Features
- **Modern Stack**: Next.js 15 with React 19, TypeScript, Tailwind CSS v3
- **Internationalization**: Built-in support for German, English, and Spanish via next-intl
- **Smooth Animations**: Framer Motion integration with custom cursor and noise overlay effects
- **Fully Responsive**: Mobile-first design optimized for all screen sizes
- **Production Ready**: Docker deployment with standalone output
- **TypeScript Strict**: Type-safe codebase with zero `any` types
- **Performance Optimized**: AVIF/WebP image formats, optimized bundle size
- **SEO Friendly**: Structured metadata and Open Graph support

### Design Features
- **10 Landing Page Sections**: Hero, LogoCloud, Features, HowItWorks, Pricing, Testimonials, Integrations, FAQ, CTA, Footer
- **Smooth Navigation**: Sticky header with smooth scroll anchors
- **Custom Cursor**: Interactive cursor effect for desktop users
- **Noise Overlay**: Subtle grain texture for premium feel
- **Dark Mode Ready**: Built with dark theme as default

### AI & Automation Ready
- **WebMCP Protocol**: Exposes AI agents, tools, and documentation via `.well-known/agents.json`
- **llms.txt Route**: Machine-readable documentation at `/llms.txt`
- **Vibe Coding Ready**: Pre-configured for AI-assisted development with CLAUDE.md
- **Demo Banner Support**: Optional Aklow Labs demo banner via environment variables

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone or download the template
git clone <repository-url>
cd saas-landing

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your landing page.

### Available Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm start           # Start production server
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript type checking
npm test            # Run Vitest unit tests
npm run test:ui     # Run Vitest with UI
npm run test:e2e    # Run Playwright E2E tests
npm run test:e2e:ui # Run Playwright with UI
```

---

## Project Structure

```
saas-landing/
├── app/
│   ├── [locale]/           # Internationalized routes
│   │   ├── layout.tsx      # Root layout with i18n
│   │   └── page.tsx        # Main landing page
│   ├── api/                # API routes
│   │   └── well-known/     # WebMCP protocol endpoints
│   ├── llms.txt/           # AI documentation endpoint
│   └── globals.css         # Global styles
├── components/
│   ├── effects/
│   │   ├── CustomCursor.tsx    # Interactive cursor
│   │   └── NoiseOverlay.tsx    # Grain texture overlay
│   └── sections/
│       ├── Navigation.tsx      # Header navigation
│       ├── HeroSection.tsx     # Hero with CTA
│       ├── LogoCloudSection.tsx # Client logos
│       ├── FeaturesSection.tsx # Feature grid
│       ├── HowItWorksSection.tsx # Process steps
│       ├── PricingSection.tsx  # Pricing cards
│       ├── TestimonialsSection.tsx # Customer reviews
│       ├── IntegrationsSection.tsx # Integration logos
│       ├── FAQSection.tsx      # FAQ accordion
│       ├── CTASection.tsx      # Final CTA
│       └── Footer.tsx          # Footer links
├── messages/               # i18n translation files
│   ├── de.json            # German translations
│   ├── en.json            # English translations
│   └── es.json            # Spanish translations
├── i18n/
│   └── routing.ts         # i18n routing config
├── site.config.ts         # Site configuration
├── middleware.ts          # next-intl middleware
├── Dockerfile             # Docker deployment
├── .env.example           # Environment variables template
└── package.json
```

---

## Configuration

### Site Configuration (`site.config.ts`)

The `site.config.ts` file is your single source of truth for all branding and company data:

```typescript
export const siteConfig = {
  company: {
    name: 'Your SaaS',
    tagline: 'Business Automation Platform',
    description: 'Your company description',
    url: 'https://your-domain.com',
  },
  contact: {
    email: 'hello@your-saas.com',
    phone: '+49 30 123 456 789',
    phoneRaw: '+4930123456789',
  },
  address: {
    street: 'Friedrichstrasse 123',
    zip: '10117',
    city: 'Berlin',
    country: 'Germany',
    countryCode: 'DE',
  },
  social: {
    instagram: '',
    facebook: '',
    youtube: '',
  },
  seo: {
    themeColor: '#0a0a0a',
    ogImage: '/og-image.png',
    accentColor: '#8B5CF6',
  },
  hours: {
    openingHours: 'Mo-Fr 09:00-18:00',
    structured: [...],
  },
  legal: {
    legalName: 'Your SaaS GmbH',
    vatId: 'DE000000000',
  },
};
```

### Environment Variables (`.env`)

Create a `.env` file from `.env.example`:

```bash
# Site URL (required for SEO)
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX

# Optional: Demo Mode (shows Aklow Labs banner)
DEMO_MODE=true
DEMO_TEMPLATE_NAME=SaaS Landing Template
DEMO_BUY_URL=https://aklow-labs.com/en/templates/saas-landing

# Optional: Contact Form (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
CONTACT_EMAIL=hello@your-saas.com
```

---

## Internationalization

This template supports **3 languages** out of the box using `next-intl`:

- **German (DE)** — Default
- **English (EN)**
- **Spanish (ES)**

### Language Routing

- `/de` → German
- `/en` → English
- `/es` → Spanish

The middleware automatically redirects `/` to the user's preferred language based on the `Accept-Language` header.

### Adding/Editing Translations

Edit the JSON files in `messages/`:

```json
// messages/en.json
{
  "hero": {
    "title": "Your SaaS Platform",
    "subtitle": "Automate, Scale, Grow",
    "cta": "Get Started"
  },
  "features": {
    "title": "Features",
    // ...
  }
}
```

### Adding a New Language

1. Create `messages/fr.json` (for French)
2. Update `i18n/routing.ts`:
   ```typescript
   export const routing = defineRouting({
     locales: ['de', 'en', 'es', 'fr'],
     defaultLocale: 'de',
   });
   ```
3. Translate all keys from an existing language file

---

## Sections Overview

### 1. Navigation
Sticky header with logo, menu links, language switcher, and CTA button. Smooth scroll to sections.

### 2. Hero Section
Full-screen hero with headline, subtitle, CTA buttons, animated background gradients, and scroll indicator.

### 3. Logo Cloud
Trust signals showing client/partner logos.

### 4. Features Section
Grid layout showcasing key features with icons, titles, and descriptions.

### 5. How It Works
Step-by-step process visualization with numbered timeline.

### 6. Pricing Section
Pricing cards with feature lists, highlighting popular plans. Toggleable billing periods (monthly/yearly).

### 7. Testimonials
Customer reviews with avatar, name, role, and quote.

### 8. Integrations
Showcase third-party integrations with logos and descriptions.

### 9. FAQ Section
Accordion-style frequently asked questions with expand/collapse animations.

### 10. CTA Section
Final conversion section with strong call-to-action and benefits recap.

### 11. Footer
Multi-column footer with links, social media, contact info, and legal pages.

---

## AI-Ready / WebMCP Integration

This template implements the **WebMCP protocol** for AI agent discovery and interaction:

### Endpoints

- **`/.well-known/agents.json`** — AI agent discovery endpoint (WebMCP standard)
- **`/.well-known/agent-card.json`** — Agent metadata card
- **`/llms.txt`** — Machine-readable documentation for LLMs

### WebMCP Protocol

WebMCP (Web Model Context Protocol) enables AI agents to discover and interact with your landing page. The protocol exposes:

- Available AI agents and their capabilities
- API endpoints for automation
- Documentation in LLM-friendly format
- Structured data for AI reasoning

### Use Cases

- **AI-assisted content updates**: Let LLMs suggest or generate landing page copy
- **Automated localization**: AI agents can translate content to new languages
- **Analytics insights**: AI can analyze user behavior and suggest optimizations
- **A/B testing**: Automated variant generation and testing

### Vibe Coding Ready

The template includes CLAUDE.md and .cursorrules for seamless AI-assisted development:

```bash
# AI pair programming with Claude Code
claude "Update the hero section to emphasize security features"

# AI-powered testing
claude "Write E2E tests for the pricing section"

# AI translation assistance
claude "Translate the FAQ section to Italian"
```

---

## Docker Deployment

### Build and Run

```bash
# Build Docker image
docker build -t saas-landing .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  saas-landing
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SITE_URL=https://your-domain.com
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:
```bash
docker-compose up -d
```

### Dockerfile

The template includes a multi-stage Dockerfile with:
- **Node.js 18 Alpine** base image
- **Standalone output** for minimal image size
- **Health check** endpoint
- **Non-root user** for security
- **Environment variable** injection

### Production Checklist

Before deploying:
- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Configure analytics (GA/GTM) if needed
- [ ] Update `site.config.ts` with real company data
- [ ] Add real images to `/public`
- [ ] Test all language versions
- [ ] Run `npm run typecheck && npm run build` locally
- [ ] Configure SSL certificate (Let's Encrypt recommended)
- [ ] Set up monitoring and error tracking

---

## Customization Guide

### Colors & Branding

Edit `tailwind.config.js` to customize your color palette:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: '#8B5CF6', // Your brand color
        background: '#0a0a0a',
        foreground: '#fafafa',
      },
    },
  },
};
```

Update `site.config.ts` for SEO colors:
```typescript
seo: {
  themeColor: '#0a0a0a',
  accentColor: '#8B5CF6',
}
```

### Typography

Global typography is defined in `app/globals.css`:

```css
body {
  font-family: var(--font-sans);
  @apply bg-background text-foreground;
}
```

Import custom fonts in `app/[locale]/layout.tsx`.

### Animations

Framer Motion animations are defined in each section component. Common patterns:

```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  viewport={{ once: true }}
>
  {/* Content */}
</motion.div>
```

### Custom Cursor

Disable or customize in `components/effects/CustomCursor.tsx`. To disable globally, remove from layout:

```tsx
// app/[locale]/layout.tsx
export default function RootLayout({ children }) {
  return (
    <>
      {/* <CustomCursor /> */} {/* Disabled */}
      {children}
    </>
  );
}
```

### Noise Overlay

Adjust opacity in `components/effects/NoiseOverlay.tsx`:

```tsx
<div className="opacity-30"> {/* Change opacity here */}
```

### Adding New Sections

1. Create component in `components/sections/NewSection.tsx`
2. Add translations in all language files (`messages/*.json`)
3. Import and use in `app/[locale]/page.tsx`:
   ```tsx
   import NewSection from '@/components/sections/NewSection';

   export default function Home() {
     return (
       <>
         <HeroSection />
         <NewSection /> {/* Your new section */}
         {/* ... */}
       </>
     );
   }
   ```

### Removing Sections

Simply comment out or remove the section import and component in `app/[locale]/page.tsx`.

---

## Performance

### Lighthouse Scores (Target)

- **Performance**: 90+
- **Accessibility**: 90+
- **Best Practices**: 100
- **SEO**: 100

### Optimizations Included

- Next.js Image Optimization with AVIF/WebP
- Standalone output for minimal Docker image size
- Code splitting and lazy loading
- Responsive image sizes for different devices
- Optimized fonts with `font-display: swap`
- Minimal third-party scripts

### Monitoring

Add performance monitoring with:
- **Vercel Analytics** (if deploying on Vercel)
- **Google Analytics 4** (via `NEXT_PUBLIC_GA_ID`)
- **Sentry** for error tracking

---

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Testing

### Unit Tests (Vitest)

```bash
npm test
npm run test:ui  # With UI
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui  # With UI
```

### Type Checking

```bash
npm run typecheck
```

---

## Troubleshooting

### Build Errors

**Issue**: `Module not found: Can't resolve 'next-intl'`
**Solution**: Run `npm install` to ensure all dependencies are installed.

**Issue**: TypeScript errors in components
**Solution**: Run `npm run typecheck` to see detailed errors. Check `tsconfig.json` settings.

### i18n Not Working

**Issue**: Language switcher not working
**Solution**: Ensure `middleware.ts` is properly configured and `i18n/routing.ts` includes all locales.

### Docker Issues

**Issue**: Container exits immediately
**Solution**: Check logs with `docker logs <container-id>`. Verify `NEXT_PUBLIC_SITE_URL` is set.

**Issue**: Health check failing
**Solution**: Ensure the app is listening on port 3000 inside the container.

---

## Migration from Other Stacks

### From Create React App

1. Move components to `components/` directory
2. Convert to Next.js pages in `app/[locale]/`
3. Update imports to use Next.js Image component
4. Add i18n with next-intl

### From Vue.js

1. Rewrite Vue components as React functional components
2. Convert Vue Router to Next.js App Router
3. Replace `v-if`, `v-for` with JSX conditionals and `.map()`
4. Use React hooks (`useState`, `useEffect`) instead of Vue Composition API

---

## Contributing

This is a commercial template. For bug reports or feature requests, contact Aklow Labs at hello@aklow-labs.com.

---

## License

**MIT License**

Copyright (c) 2026 Aklow Labs

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Credits

**Developed by Aklow Labs** — Premium Website Templates & SaaS Starter Kits

- Website: [aklow-labs.com](https://aklow-labs.com)
- Email: hello@aklow-labs.com
- GitHub: [@aklow-templates](https://github.com/aklow-templates)

### Technologies

- [Next.js](https://nextjs.org/) — React framework
- [React](https://react.dev/) — UI library
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Framer Motion](https://www.framer.com/motion/) — Animation library
- [next-intl](https://next-intl-docs.vercel.app/) — Internationalization
- [Vitest](https://vitest.dev/) — Unit testing
- [Playwright](https://playwright.dev/) — E2E testing

---

**Made with care by Aklow Labs. Build something amazing.**
