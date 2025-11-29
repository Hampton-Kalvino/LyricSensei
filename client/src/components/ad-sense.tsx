import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * AdSense component that dynamically loads ads only for non-premium users
 * Premium users (isPremium === true) won't see any ads
 * Loads Google AdSense script only when needed (free users)
 */
export function AdSense() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Only load AdSense for free, non-premium users
    if (isLoading || !user || user.isPremium) {
      return;
    }

    // Load Google AdSense script dynamically
    if ((window as any).adsbygoogle === undefined) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6658492500794509';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        // Initialize AdSense after script loads
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({
          google_ad_client: 'ca-pub-6658492500794509',
          enable_page_level_ads: true
        });
      };
      document.head.appendChild(script);
    }
  }, [user, isLoading]);

  // Don't render anything - this component just manages AdSense loading
  return null;
}
