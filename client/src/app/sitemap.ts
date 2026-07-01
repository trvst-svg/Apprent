import { MetadataRoute } from 'next';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://apprent.dev';

  // 1. Static Routes
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/learner/paths`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/learner/feed`,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.7,
    }
  ];

  // 2. Dynamic Paths (Learning paths index)
  try {
    const pathsRes = await apiFetch('/api/v1/paths');
    if (pathsRes && pathsRes.data) {
      const pathUrls = pathsRes.data.map((p: any) => ({
        url: `${baseUrl}/learner/paths/${p.id}`,
        lastModified: new Date(p.createdAt || new Date()),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      routes.push(...pathUrls);
    }
  } catch (err) {
    console.error('Sitemap generator failed to fetch learning paths:', err);
  }

  return routes;
}
