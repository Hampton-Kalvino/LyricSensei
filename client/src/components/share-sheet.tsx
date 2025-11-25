import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Instagram,
  MessageCircle,
  Twitter,
  Copy,
  MoreHorizontal,
  Loader2,
  Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  generateStoryCard,
  generateStoryCardCanvas,
} from "@/lib/share-utils";
import type { Song } from "@shared/schema";

declare global {
  interface Window {
    plugins?: {
      socialsharing?: {
        shareViaInstagramToStory: (
          backgroundImage: string,
          stickerImage: string | null,
          backgroundTopColor: string,
          backgroundBottomColor: string,
          successCallback: () => void,
          errorCallback: (error: string) => void
        ) => void;
        shareVia: (
          appName: string,
          message: string,
          subject: string | null,
          file: string | null,
          url: string | null,
          successCallback: () => void,
          errorCallback: (error: string) => void
        ) => void;
        share: (
          message: string,
          subject: string | null,
          file: string | null,
          url: string | null,
          successCallback: () => void,
          errorCallback: (error: string) => void
        ) => void;
      };
    };
  }
}

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song;
  albumArtUrl?: string;
  userName?: string;
}

export function ShareSheet({
  open,
  onOpenChange,
  song,
  albumArtUrl = "",
  userName = "User",
}: ShareSheetProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const songUrl = `https://lyricsensei.com/song/${song.id}`;


  const shareToInstagram = async () => {
    try {
      setIsGenerating(true);
      console.log("[Instagram] 1. Starting share...");

      // Generate image
      console.log("[Instagram] 2. Generating story card...");
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(
          song.title,
          song.artist,
          albumArtUrl
        );
      } catch (error) {
        console.warn("[Instagram] 2. Canvas fallback...", error);
        imageBlob = await generateStoryCardCanvas(
          song.title,
          song.artist,
          albumArtUrl
        );
      }

      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      console.log("[Instagram] 3. File created:", file.size, "bytes");

      // Use Web Share API which handles Instagram on mobile
      if (navigator.share) {
        console.log("[Instagram] 4. Using Web Share API...");

        await navigator.share({
          files: [file],
          title: song.title,
          text: `Check out "${song.title}" by ${song.artist}!`,
        });

        console.log("[Instagram] 5. Share successful!");
        toast({
          title: "Shared!",
          description: "Opening Instagram...",
        });
        onOpenChange(false);
      } else {
        console.log("[Instagram] Web Share not available");
        toast({
          title: "Share Not Supported",
          description: "Please copy the link instead",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Instagram] Error:", errorMessage);

      if (!errorMessage.includes("cancelled")) {
        toast({
          title: "Share Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToSnapchat = async () => {
    try {
      setIsGenerating(true);
      console.log("[Snapchat] 1. Starting share...");

      // Generate image
      console.log("[Snapchat] 2. Generating story card...");
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(
          song.title,
          song.artist,
          albumArtUrl
        );
      } catch (error) {
        console.warn("[Snapchat] 2. Canvas fallback...", error);
        imageBlob = await generateStoryCardCanvas(
          song.title,
          song.artist,
          albumArtUrl
        );
      }

      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      console.log("[Snapchat] 3. File created:", file.size, "bytes");

      if (navigator.share) {
        console.log("[Snapchat] 4. Using Web Share API...");

        await navigator.share({
          files: [file],
          title: song.title,
          text: `Listening to "${song.title}" by ${song.artist} on Lyric Sensei!`,
        });

        console.log("[Snapchat] 5. Share successful!");
        toast({ title: "Shared to Snapchat!" });
        onOpenChange(false);
      } else {
        console.log("[Snapchat] Web Share not available");
        toast({
          title: "Share Not Supported",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Snapchat] Error:", errorMessage);

      if (!errorMessage.includes("cancelled")) {
        toast({
          title: "Share Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToTwitter = async () => {
    try {
      setIsGenerating(true);
      console.log("[Twitter] 1. Starting share...");

      // Generate image
      console.log("[Twitter] 2. Generating story card...");
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(
          song.title,
          song.artist,
          albumArtUrl
        );
      } catch (error) {
        console.warn("[Twitter] 2. Canvas fallback...", error);
        imageBlob = await generateStoryCardCanvas(
          song.title,
          song.artist,
          albumArtUrl
        );
      }

      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      console.log("[Twitter] 3. File created:", file.size, "bytes");

      if (navigator.share) {
        console.log("[Twitter] 4. Using Web Share API...");

        const text = `Listening to "${song.title}" by ${song.artist} on Lyric Sensei!\n\n${songUrl}`;

        await navigator.share({
          files: [file],
          title: song.title,
          text: text,
        });

        console.log("[Twitter] 5. Share successful!");
        toast({ title: "Shared to Twitter!" });
        onOpenChange(false);
      } else {
        console.log("[Twitter] Web Share not available");
        const text = `Listening to "${song.title}" by ${song.artist} on Lyric Sensei!\n\n${songUrl}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, "_blank");
        onOpenChange(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Twitter] Error:", errorMessage);

      if (!errorMessage.includes("cancelled")) {
        toast({
          title: "Share Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(songUrl);
      toast({
        title: "Link Copied!",
        description: "Song link copied to clipboard",
      });
      onOpenChange(false);
    } catch (error) {
      const input = document.createElement("input");
      input.value = songUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      toast({ title: "Link Copied!" });
      onOpenChange(false);
    }
  };

  const shareMore = async () => {
    try {
      setIsGenerating(true);
      console.log("[Share] 1. Starting share...");

      // Generate image
      console.log("[Share] 2. Generating story card...");
      let imageBlob: Blob;
      try {
        imageBlob = await generateStoryCard(
          song.title,
          song.artist,
          albumArtUrl
        );
      } catch (error) {
        console.warn(
          "[Share] 2. html-to-image failed, using canvas fallback:",
          error
        );
        imageBlob = await generateStoryCardCanvas(
          song.title,
          song.artist,
          albumArtUrl
        );
      }

      console.log("[Share] 3. Image blob created:", imageBlob.size, "bytes");

      // Create file from blob
      const file = new File(
        [imageBlob],
        `lyric-sensei-${song.title.replace(/\s+/g, "-")}.png`,
        { type: "image/png" }
      );
      console.log("[Share] 4. File created:", file.name, file.size);

      // Check if navigator.share is available with file support
      if (navigator.share) {
        console.log("[Share] 5. Using Web Share API with image...");

        await navigator.share({
          files: [file],
          title: song.title,
          text: `Check out "${song.title}" by ${song.artist} on Lyric Sensei!`,
          url: songUrl,
        });

        console.log("[Share] 6. Share successful!");
        toast({
          title: "Shared!",
          description: "Your image is being shared...",
        });
        onOpenChange(false);
      } else {
        console.log("[Share] 5. Web Share not available");
        toast({
          title: "Share Not Supported",
          description: "Please copy the link instead",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Share] Error:", errorMessage);

      if (errorMessage.includes("AbortError") || errorMessage.includes("cancelled")) {
        console.log("[Share] User cancelled");
      } else {
        toast({
          title: "Share Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "-10000px",
          top: "-10000px",
          width: "1080px",
          height: "1920px",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: "1080px",
            height: "1920px",
            position: "relative",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Blurred Background with album art */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              left: "-50px",
              right: "-50px",
              bottom: "-50px",
              backgroundImage: `url(${albumArtUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) brightness(0.3)",
              opacity: 0.6,
            }}
          />

          {/* Content Container */}
          <div
            style={{
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "100px 80px",
              zIndex: 1,
            }}
          >
            {/* Top: App Logo and Tagline */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "56px",
                  fontWeight: "900",
                  color: "white",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                  textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                Lyric Sensei
              </div>
              <div
                style={{
                  fontSize: "28px",
                  color: "rgba(255,255,255,0.8)",
                  marginTop: "16px",
                  fontWeight: "500",
                }}
              >
                Learn Lyrics in Any Language
              </div>
            </div>

            {/* Middle: Album Art & Info */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "60px",
              }}
            >
              {/* Album Artwork with Premium Frame */}
              <div
                style={{
                  width: "700px",
                  height: "700px",
                  borderRadius: "40px",
                  overflow: "hidden",
                  boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
                  border: "8px solid rgba(255,255,255,0.1)",
                }}
              >
                <img
                  src={albumArtUrl}
                  alt={song.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  crossOrigin="anonymous"
                />
              </div>

              {/* Song Info */}
              <div
                style={{
                  textAlign: "center",
                  maxWidth: "900px",
                }}
              >
                <div
                  style={{
                    fontSize: "80px",
                    fontWeight: "900",
                    color: "white",
                    lineHeight: 1.1,
                    marginBottom: "24px",
                    textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {song.title}
                </div>
                <div
                  style={{
                    fontSize: "52px",
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: "600",
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                  }}
                >
                  {song.artist}
                </div>
              </div>
            </div>

            {/* Bottom: Call to Action */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "44px",
                  color: "rgba(255,255,255,0.95)",
                  fontWeight: "700",
                  marginBottom: "12px",
                  textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                }}
              >
                Download Lyric Sensei
              </div>
              <div
                style={{
                  fontSize: "36px",
                  color: "rgba(255,255,255,0.75)",
                  fontWeight: "500",
                }}
              >
                lyricsensei.com
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Song</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Music shared from Lyric Sensei can be opened on other services
            </p>

            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={shareToInstagram}
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

            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={shareToSnapchat}
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

            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={shareToTwitter}
              disabled={isGenerating}
              data-testid="button-share-twitter"
            >
              <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center mr-3 flex-shrink-0">
                <Twitter className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Twitter</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={copyLink}
              disabled={isGenerating}
              data-testid="button-copy-link"
            >
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center mr-3 flex-shrink-0">
                <Link2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">Copy track link</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-14 px-3 rounded-lg"
              onClick={shareMore}
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
