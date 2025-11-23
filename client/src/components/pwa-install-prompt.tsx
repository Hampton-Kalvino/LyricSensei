import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { cn } from "@/lib/utils";

interface PWAInstallPromptProps {
  trigger: 'login' | 'recognition' | null;
  onClose?: () => void;
}

export function PWAInstallPrompt({ trigger, onClose }: PWAInstallPromptProps) {
  const { isInstallable, isInstalled, showInstallPrompt, dismissPrompt } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [hasShownForLogin, setHasShownForLogin] = useState(false);

  useEffect(() => {
    // Don't show if already installed or not installable
    if (isInstalled || !isInstallable) {
      return;
    }

    // Show prompt based on trigger
    if (trigger === 'login' && !hasShownForLogin) {
      // Delay slightly after login to let page settle
      const timer = setTimeout(() => {
        setIsVisible(true);
        setHasShownForLogin(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (trigger === 'recognition') {
      // Show immediately after song recognition
      setIsVisible(true);
    }
  }, [trigger, isInstallable, isInstalled, hasShownForLogin]);

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();
    
    if (accepted) {
      setIsVisible(false);
      onClose?.();
    } else {
      // User dismissed, close the prompt
      setIsVisible(false);
      onClose?.();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismissPrompt(); // Clear PWA state to prevent showing again until new event
    onClose?.();
  };

  if (!isVisible || !isInstallable || isInstalled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
      <Card className={cn(
        "w-full max-w-md pointer-events-auto shadow-lg animate-in slide-in-from-bottom-4 duration-300",
        "border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5"
      )}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Install Lyric Sensei</h3>
                <p className="text-sm text-muted-foreground">
                  Add to your home screen for quick access
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8"
              data-testid="button-dismiss-pwa-prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleInstall}
              className="flex-1"
              data-testid="button-install-pwa"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              data-testid="button-not-now-pwa"
            >
              Not Now
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Get offline access, faster loading, and a better experience
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
