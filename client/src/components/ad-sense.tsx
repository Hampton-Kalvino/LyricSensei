import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * AdSense component that only renders ads for non-premium users
 * Premium users (isPremium === true) won't see any ads
 */
export function AdSense() {
  const { user, isLoading } = useAuth();

  // Don't render if still loading or if user is premium
  if (isLoading || !user || user.isPremium) {
    return null;
  }

  // Script for free users only
  useEffect(() => {
    // Initialize AdSense for this free user
    if ((window as any).adsbygoogle === undefined) {
      (window as any).adsbygoogle = [];
    }
  }, []);

  return null;
}
