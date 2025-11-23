import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Monitor, Chrome } from "lucide-react";
import { useEffect, useState } from "react";

interface PWAInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PWAInstallModal({ open, onOpenChange }: PWAInstallModalProps) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [browser, setBrowser] = useState<'chrome' | 'safari' | 'firefox' | 'edge' | 'other'>('other');

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isFirefox = /firefox/.test(userAgent);
    const isEdge = /edg/.test(userAgent);

    if (isIOS) {
      setPlatform('ios');
      setBrowser('safari');
    } else if (isAndroid) {
      setPlatform('android');
      setBrowser(isChrome ? 'chrome' : 'other');
    } else {
      setPlatform('desktop');
      if (isChrome) setBrowser('chrome');
      else if (isSafari) setBrowser('safari');
      else if (isFirefox) setBrowser('firefox');
      else if (isEdge) setBrowser('edge');
      else setBrowser('other');
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="modal-pwa-install">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install Lyric Sensei
          </DialogTitle>
          <DialogDescription>
            Follow these steps to install the app on your device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {platform === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">iOS / Safari Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Tap the Share button (box with arrow)</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to confirm</li>
                    <li>Find the app on your home screen</li>
                  </ol>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Make sure you're using Safari browser on iOS
              </p>
            </div>
          )}

          {platform === 'android' && browser === 'chrome' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Android / Chrome Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Tap the menu (⋮) in the top right</li>
                    <li>Tap "Add to Home screen" or "Install app"</li>
                    <li>Tap "Add" or "Install" to confirm</li>
                    <li>Find the app on your home screen</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {platform === 'desktop' && (browser === 'chrome' || browser === 'edge') && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Monitor className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Desktop / Chrome Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Click the install icon (⊕) in the address bar</li>
                    <li>Or click menu (⋮) → "Install Lyric Sensei"</li>
                    <li>Click "Install" to confirm</li>
                    <li>Find the app in your applications</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {platform === 'desktop' && browser === 'firefox' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Chrome className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Desktop / Firefox:</p>
                  <p className="text-muted-foreground">
                    Firefox doesn't fully support PWA installation on desktop. Please use Chrome, Edge, or Safari for the best experience.
                  </p>
                </div>
              </div>
            </div>
          )}

          {browser === 'other' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Chrome className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Installation Not Available</p>
                  <p className="text-muted-foreground">
                    Your browser doesn't support app installation. Please use Chrome, Edge, or Safari for the best experience.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Why install?</strong> Get instant access from your home screen, work offline, and enjoy a native app experience.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="w-full"
            data-testid="button-close-install-modal"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
