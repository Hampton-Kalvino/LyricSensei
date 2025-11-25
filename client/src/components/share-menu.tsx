import { useState } from "react";
import { Share2, Instagram, Facebook, Twitter, MessageCircle, Send, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  shareToSocialMedia,
  shareToInstagram,
  shareToFacebook,
  shareToTwitter,
  shareToWhatsApp,
  shareToTelegram,
  copyShareLink,
  isMobileDevice,
} from "@/lib/social-share";
import type { Song } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ShareMenuProps {
  song: Song;
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onShareComplete?: () => void;
}

export function ShareMenu({
  song,
  variant = "ghost",
  size = "icon",
  className,
  onShareComplete,
}: ShareMenuProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleShare = async (
    platform: "native" | "instagram" | "facebook" | "twitter" | "whatsapp" | "telegram" | "copy"
  ) => {
    setIsLoading(platform);
    try {
      switch (platform) {
        case "native":
          const success = await shareToSocialMedia({ song });
          if (!success && !isMobileDevice()) {
            toast({
              title: "Link copied!",
              description: "Share link copied to clipboard",
            });
          }
          break;
        case "instagram":
          await shareToInstagram(song);
          break;
        case "facebook":
          await shareToFacebook(song);
          break;
        case "twitter":
          await shareToTwitter(song);
          break;
        case "whatsapp":
          await shareToWhatsApp(song);
          break;
        case "telegram":
          await shareToTelegram(song);
          break;
        case "copy":
          const copied = await copyShareLink(song);
          toast({
            title: copied ? "Copied!" : "Error",
            description: copied
              ? "Share link copied to clipboard"
              : "Failed to copy link",
            variant: copied ? "default" : "destructive",
          });
          break;
      }

      if (platform !== "copy") {
        setOpen(false);
      }
      onShareComplete?.();
    } catch (error) {
      console.error(`Failed to share to ${platform}:`, error);
      toast({
        title: "Share failed",
        description: "Unable to share to this platform",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          data-testid="button-share-menu"
          title="Share song"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-2" align="end">
        <div className="grid grid-cols-3 gap-2">
          {/* Native Share (uses device's native share sheet) */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("native")}
            disabled={isLoading !== null}
            data-testid="button-share-native"
            title={isMobileDevice() ? "Share to any app" : "Copy link"}
          >
            <Share2 className="h-4 w-4" />
            <span className="text-xs">
              {isMobileDevice() ? "Share" : "Copy"}
            </span>
          </Button>

          {/* Instagram */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("instagram")}
            disabled={isLoading !== null}
            data-testid="button-share-instagram"
            title="Share to Instagram"
          >
            <Instagram className="h-4 w-4" />
            <span className="text-xs">Instagram</span>
          </Button>

          {/* Facebook */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("facebook")}
            disabled={isLoading !== null}
            data-testid="button-share-facebook"
            title="Share to Facebook"
          >
            <Facebook className="h-4 w-4" />
            <span className="text-xs">Facebook</span>
          </Button>

          {/* Twitter */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("twitter")}
            disabled={isLoading !== null}
            data-testid="button-share-twitter"
            title="Share to Twitter"
          >
            <Twitter className="h-4 w-4" />
            <span className="text-xs">Twitter</span>
          </Button>

          {/* WhatsApp */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("whatsapp")}
            disabled={isLoading !== null}
            data-testid="button-share-whatsapp"
            title="Share to WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">WhatsApp</span>
          </Button>

          {/* Telegram */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("telegram")}
            disabled={isLoading !== null}
            data-testid="button-share-telegram"
            title="Share to Telegram"
          >
            <Send className="h-4 w-4" />
            <span className="text-xs">Telegram</span>
          </Button>

          {/* Copy Link */}
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
            onClick={() => handleShare("copy")}
            disabled={isLoading !== null}
            data-testid="button-copy-link"
            title="Copy share link"
          >
            <Copy className="h-4 w-4" />
            <span className="text-xs">Copy</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
