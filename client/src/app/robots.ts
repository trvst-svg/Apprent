import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://apprent.dev';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/learner/paths', '/learner/feed'], // Public landing & path pages
        disallow: [
          '/learner/sandbox', 
          '/learner/profile', 
          '/expert', 
          '/admin', 
          '/api'
        ], // Block isolated workspaces, auth routes & APIs
      },
      {
        // Explicitly allow AI search crawlers to scan public content for citations
        userAgent: ['GPTBot', 'ClaudeBot', 'ChatGPT-User', 'Claude-SearchBot', 'Google-Extended'],
        allow: ['/', '/learner/paths', '/learner/feed'],
        disallow: [
          '/learner/sandbox', 
          '/learner/profile', 
          '/expert', 
          '/admin', 
          '/api'
        ],
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
