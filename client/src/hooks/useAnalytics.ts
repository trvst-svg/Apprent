'use client';

import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

export function useAnalytics() {
  const { token } = useAuth();

  const trackEvent = async (
    eventType: 'page_view' | 'click' | 'enroll_intent' | 'run_verify' | 'submit_solution' | 'ai_review' | 'chat_send',
    targetId: string = '',
    targetType: 'learning_path' | 'book' | 'challenge' | 'stream' | 'general' = 'general',
    metadata: Record<string, any> = {}
  ) => {
    try {
      await apiFetch('/api/v1/analytics/log', {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({
          eventType,
          targetId,
          targetType,
          metadata,
        }),
      });
    } catch (err) {
      // Fail silently to prevent analytics issues from disrupting the main user experience
      console.warn('Analytics event logging failed:', err);
    }
  };

  return { trackEvent };
}
