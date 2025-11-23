import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Play, Volume2 } from "lucide-react";

interface VideoAdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoAdModal({ isOpen, onClose }: VideoAdModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setCanSkip(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" data-testid="dialog-video-ad">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Video Advertisement</span>
            {canSkip && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-ad"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {canSkip 
              ? "You can now close this ad" 
              : `Please wait ${countdown} seconds...`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden" data-testid="video-ad-container">
          {/* Video Ad Placeholder - This would be replaced with actual ad integration */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Play className="h-12 w-12 text-primary" />
              <Volume2 className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold mb-2">Premium Translation Feature</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Upgrade to Premium for unlimited ad-free translations!
              </p>
            </div>
            
            {!canSkip && (
              <div className="absolute bottom-4 right-4 bg-background/90 px-3 py-1 rounded-full">
                <span className="text-sm font-medium">Ad: {countdown}s</span>
              </div>
            )}
          </div>

          {/* Google AdSense / Ad Network Integration Point */}
          {/* Replace this div with actual video ad code from ad network */}
          <div className="hidden" data-ad-slot="video-ad-slot" />
        </div>

        {canSkip && (
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} data-testid="button-skip-ad">
              Continue to Translation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
