import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    console.log('[PWA] Is standalone:', isStandalone);
    
    if (isStandalone) {
      setIsInstalled(true);
      console.log('[PWA] App already installed');
      return;
    }

    console.log('[PWA] Setting up beforeinstallprompt listener');

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      
      console.log('[PWA] Install prompt ready - button will now appear');
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const showInstallPrompt = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for user choice
      const choiceResult = await deferredPrompt.userChoice;
      
      console.log('[PWA] User choice:', choiceResult.outcome);
      
      // Clear the deferred prompt and mark as not installable
      // This prevents showing the prompt again until a new beforeinstallprompt event
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      // Return whether user accepted
      return choiceResult.outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      // Clear state on error too
      setDeferredPrompt(null);
      setIsInstallable(false);
      return false;
    }
  };

  const dismissPrompt = () => {
    // User dismissed without installing - clear state
    // This prevents showing the prompt again until a new beforeinstallprompt event
    setDeferredPrompt(null);
    setIsInstallable(false);
    console.log('[PWA] Prompt dismissed by user');
  };

  return {
    isInstallable,
    isInstalled,
    showInstallPrompt,
    dismissPrompt,
    hasPrompt: !!deferredPrompt,
  };
}
