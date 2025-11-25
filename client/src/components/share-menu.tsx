import { useState, useRef } from "react";
import { Share2, Instagram, Facebook, Twitter, MessageCircle, Send, Copy, Sparkles } from "lucide-react";
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
  generateShareUrl,
} from "@/lib/social-share";
import {
  generateStoryImageFromComponent,
  shareStoryToNativeApps,
  canShareStories,
} from "@/lib/story-generator";
import { StoryCard } from "@/components/story-card";
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
  const storyCardRef = useRef<HTMLDivElement>(null);

  const handleShareStory = async () => {
    if (!storyCardRef.current) {
      toast({
        title: "Error",
        description: "Failed to generate story",
        variant: "destructive",
      });
      return;
    }

    setIsLoading("story");
    try {
      // Generate high-quality story image
      const imageDataUrl = await generateStoryImageFromComponent(
        storyCardRef.current,
        { quality: 0.95, pixelRatio: 2 }
      );

      // Share to native apps
      const success = await shareStoryToNativeApps(
        imageDataUrl,
        song.title,
        song.artist,
        generateShareUrl(song.id)
      );

      if (success) {
        toast({
          title: "Shared!",
          description: "Story shared to your apps",
        });
      }

      setOpen(false);
      onShareComplete?.();
    } catch (error) {
      console.error("Failed to share story:", error);
      toast({
        title: "Share failed",
        description: "Could not share story. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleShare = async (
    platform: "native" | "instagram" | "facebook" | "twitter" | "whatsapp" | "telegram" | "copy" | "story"
  ) => {
    if (platform === "story") {
      await handleShareStory();
      return;
    }
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

      <PopoverContent className="w-72 p-0" align="end">
        {/* Hidden story card for image generation */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <StoryCard
            ref={storyCardRef}
            song={song}
            userName="User"
          />
        </div>

        <div className="space-y-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Share Song</p>
                <p className="text-xs text-muted-foreground">with your friends</p>
              </div>
            </div>
          </div>

          {/* Share Options */}
          <div className="p-3 space-y-2">
            {/* Share Story (mobile only) */}
            {canShareStories() && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
                onClick={() => handleShare("story")}
                disabled={isLoading !== null}
                data-testid="button-share-story"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">Story</span>
              </Button>
            )}

            {/* Instagram */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("instagram")}
              disabled={isLoading !== null}
              data-testid="button-share-instagram"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-red-500 to-yellow-500 flex items-center justify-center">
                <Instagram className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Instagram</span>
            </Button>

            {/* Facebook */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("facebook")}
              disabled={isLoading !== null}
              data-testid="button-share-facebook"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Facebook className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Facebook</span>
            </Button>

            {/* Twitter */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("twitter")}
              disabled={isLoading !== null}
              data-testid="button-share-twitter"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center">
                <Twitter className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Twitter</span>
            </Button>

            {/* WhatsApp */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("whatsapp")}
              disabled={isLoading !== null}
              data-testid="button-share-whatsapp"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">WhatsApp</span>
            </Button>

            {/* Telegram */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("telegram")}
              disabled={isLoading !== null}
              data-testid="button-share-telegram"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center">
                <Send className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Telegram</span>
            </Button>

            {/* Copy Link */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("copy")}
              disabled={isLoading !== null}
              data-testid="button-copy-link"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Copy Link</span>
            </Button>

            {/* Native Share (general share option) */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2.5 px-3 rounded-lg hover-elevate"
              onClick={() => handleShare("native")}
              disabled={isLoading !== null}
              data-testid="button-share-native"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">
                {isMobileDevice() ? "Share" : "More"}
              </span>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
