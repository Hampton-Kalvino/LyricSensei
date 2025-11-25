import { useState, useRef } from "react";
import {
  Loader2,
  Share2,
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  Copy,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  saveImageToFilesystem,
  generateStoryImageFromComponent,
  shareToInstagramStory,
  shareToSnapchat,
  shareToTwitter,
  shareMore,
  canShareStories,
} from "@/lib/story-generator";
import { generateShareUrl } from "@/lib/social-share";
import { StoryCard } from "@/components/story-card";
import type { Song } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song;
  userName?: string;
}

export function ShareSheet({
  open,
  onOpenChange,
  song,
  userName = "User",
}: ShareSheetProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const storyCardRef = useRef<HTMLDivElement>(null);

  const generateAndSaveImage = async (): Promise<string | null> => {
    if (!storyCardRef.current) {
      throw new Error("Story card ref not ready");
    }

    try {
      console.log("[Share] Generating image...");

      // Generate PNG from component
      const dataUrl = await generateStoryImageFromComponent(
        storyCardRef.current,
        { quality: 0.95, pixelRatio: 2 }
      );

      console.log("[Share] Image generated, saving to filesystem...");

      // Save to filesystem if on native platform
      const imageUri = await saveImageToFilesystem(dataUrl);

      console.log("[Share] Image ready:", imageUri);
      return imageUri;
    } catch (error) {
      console.error("[Share] Image generation failed:", error);
      throw error;
    }
  };

  const handleShareToInstagram = async () => {
    try {
      setIsGenerating(true);
      console.log("[Instagram] Starting share...");

      const imageUri = await generateAndSaveImage();

      if (!imageUri) {
        throw new Error("Failed to generate image");
      }

      await shareToInstagramStory(
        imageUri,
        song.title,
        song.artist,
        generateShareUrl(song.id)
      );

      toast({
        title: "Shared!",
        description: "Opening Instagram...",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("[Instagram] Share failed:", error);

      toast({
        title: "Share Failed",
        description:
          error instanceof Error ? error.message : "Could not share to Instagram",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareToSnapchat = async () => {
    try {
      setIsGenerating(true);
      console.log("[Snapchat] Starting share...");

      const imageUri = await generateAndSaveImage();

      if (!imageUri) {
        throw new Error("Failed to generate image");
      }

      await shareToSnapchat(imageUri, song.title, song.artist);

      toast({
        title: "Shared!",
        description: "Opening Snapchat...",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("[Snapchat] Share failed:", error);

      toast({
        title: "Share Failed",
        description: "Could not share to Snapchat",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareToTwitter = async () => {
    try {
      console.log("[Twitter] Starting share...");

      await shareToTwitter(
        song.title,
        song.artist,
        generateShareUrl(song.id)
      );

      toast({
        title: "Shared!",
        description: "Opening Twitter...",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("[Twitter] Share failed:", error);

      toast({
        title: "Share Failed",
        description: "Could not share to Twitter",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = generateShareUrl(song.id);
      await navigator.clipboard.writeText(shareUrl);

      toast({
        title: "Link Copied!",
        description: "Song link copied to clipboard",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to copy:", error);

      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = generateShareUrl(song.id);
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);

      toast({
        title: "Link Copied!",
        description: "Song link copied to clipboard",
      });

      onOpenChange(false);
    }
  };

  const handleShareMore = async () => {
    try {
      setIsGenerating(true);
      console.log("[More] Starting share...");

      let imageUri: string | null = null;
      try {
        imageUri = await generateAndSaveImage();
      } catch (error) {
        console.log("[More] Could not generate image, sharing without it");
      }

      await shareMore(
        imageUri,
        song.title,
        song.artist,
        generateShareUrl(song.id)
      );

      onOpenChange(false);
    } catch (error) {
      console.error("[More] Share failed:", error);

      toast({
        title: "Share Failed",
        description: "Could not open share sheet",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Hidden story card for image generation */}
      <div
        style={{
          position: "absolute",
          left: "-10000px",
          top: "-10000px",
          width: "1080px",
          height: "1920px",
        }}
      >
        <StoryCard ref={storyCardRef} song={song} userName={userName} />
      </div>

      {/* Share Sheet Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Share Song</DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground mb-4">
              Music shared from Lyric Sensei can be opened on other services
            </p>

            {/* Story Button (mobile only) */}
            {canShareStories() && (
              <Button
                variant="ghost"
                className="w-full justify-start h-14 px-3 rounded-lg"
                onClick={handleShareToInstagram}
                disabled={isGenerating}
                data-testid="button-share-instagram-stories"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center mr-3 flex-shrink-0">
                  <Instagram className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">Instagram Stories</span>
                {isGenerating && (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                )}
              </Button>
            )}

            {/* Snapchat */}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={handleShareToSnapchat}
              disabled={isGenerating}
              data-testid="button-share-snapchat"
            >
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center mr-3 flex-shrink-0">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Snapchat</span>
              {isGenerating && (
                <Loader2 className="ml-auto h-4 w-4 animate-spin" />
              )}
            </Button>

            {/* Twitter */}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={handleShareToTwitter}
              disabled={isGenerating}
              data-testid="button-share-twitter"
            >
              <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center mr-3 flex-shrink-0">
                <Twitter className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Twitter</span>
            </Button>

            {/* Copy Link */}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={handleCopyLink}
              disabled={isGenerating}
              data-testid="button-copy-link"
            >
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center mr-3 flex-shrink-0">
                <Copy className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Copy track link</span>
            </Button>

            {/* More Options */}
            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={handleShareMore}
              disabled={isGenerating}
              data-testid="button-share-more"
            >
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-3 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">More</span>
              {isGenerating && (
                <Loader2 className="ml-auto h-4 w-4 animate-spin" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
