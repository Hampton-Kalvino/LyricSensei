import { useState, useRef } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { toPng } from "html-to-image";
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

  const generateImage = async (): Promise<string> => {
    if (!cardRef.current) {
      throw new Error("Story card not ready");
    }

    try {
      console.log("[Share] Generating image...");

      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        width: 1080,
        height: 1920,
        cacheBust: true,
        backgroundColor: "#667eea",
      });

      const base64Data = dataUrl.split(",")[1];

      const fileName = `lyric-sensei-story-${Date.now()}.png`;

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      console.log("[Share] Image saved to:", result.uri);

      if (Capacitor.getPlatform() === "android") {
        const stat = await Filesystem.stat({
          path: fileName,
          directory: Directory.Cache,
        });
        console.log("[Share] File stat:", stat);
      }

      return result.uri;
    } catch (error) {
      console.error("[Share] Image generation failed:", error);
      throw error;
    }
  };

  const shareToInstagram = async () => {
    try {
      setIsGenerating(true);
      console.log("[Instagram] Starting share...");

      const imageUri = await generateImage();
      console.log("[Instagram] Image URI:", imageUri);

      if (window.plugins?.socialsharing) {
        console.log("[Instagram] Using native plugin...");

        window.plugins.socialsharing.shareViaInstagramToStory(
          imageUri,
          null,
          "#667eea",
          "#764ba2",
          () => {
            console.log("[Instagram] Share success!");
            toast({
              title: "Shared!",
              description: "Opening Instagram Stories...",
            });
            onOpenChange(false);
          },
          (error) => {
            console.error("[Instagram] Share failed:", error);
            toast({
              title: "Share Failed",
              description: "Instagram may not be installed",
              variant: "destructive",
            });
          }
        );
      } else {
        console.log("[Instagram] Using intent fallback...");

        const instagramUrl = `instagram://library?AssetPath=${encodeURIComponent(imageUri)}`;
        window.location.href = instagramUrl;

        setTimeout(() => {
          toast({
            title: "Opening Instagram",
            description: "Please select the story from your library",
          });
          onOpenChange(false);
        }, 1000);
      }
    } catch (error) {
      console.error("[Instagram] Error:", error);
      toast({
        title: "Share Failed",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToSnapchat = async () => {
    try {
      setIsGenerating(true);
      console.log("[Snapchat] Starting share...");

      const imageUri = await generateImage();

      if (window.plugins?.socialsharing) {
        window.plugins.socialsharing.shareVia(
          "com.snapchat.android",
          `${song.title} by ${song.artist}`,
          null,
          imageUri,
          null,
          () => {
            console.log("[Snapchat] Share success!");
            toast({ title: "Shared to Snapchat!" });
            onOpenChange(false);
          },
          (error) => {
            console.error("[Snapchat] Share failed:", error);
            toast({
              title: "Share Failed",
              description: "Snapchat may not be installed",
              variant: "destructive",
            });
          }
        );
      } else {
        const snapchatUrl = `snapchat://add`;
        window.location.href = snapchatUrl;
        onOpenChange(false);
      }
    } catch (error) {
      console.error("[Snapchat] Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToTwitter = async () => {
    try {
      setIsGenerating(true);
      console.log("[Twitter] Starting share...");

      const text = `🎵 Listening to "${song.title}" by ${song.artist} on Lyric Sensei\n\n${songUrl}`;
      const imageUri = await generateImage();

      if (window.plugins?.socialsharing) {
        window.plugins.socialsharing.shareVia(
          "com.twitter.android",
          text,
          null,
          imageUri,
          null,
          () => {
            console.log("[Twitter] Share success!");
            toast({ title: "Shared to Twitter!" });
            onOpenChange(false);
          },
          (error) => {
            console.error("[Twitter] Share failed:", error);
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(twitterUrl, "_blank");
            onOpenChange(false);
          }
        );
      } else {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, "_blank");
        onOpenChange(false);
      }
    } catch (error) {
      console.error("[Twitter] Error:", error);
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

      const message = `Check out ${song.title} by ${song.artist} on Lyric Sensei`;
      const imageUri = await generateImage();

      if (window.plugins?.socialsharing) {
        window.plugins.socialsharing.share(
          message,
          song.title,
          imageUri,
          songUrl,
          () => {
            console.log("[Share] Success!");
            onOpenChange(false);
          },
          (error) => {
            console.error("[Share] Failed:", error);
          }
        );
      } else {
        if (navigator.share) {
          await navigator.share({
            title: song.title,
            text: message,
            url: songUrl,
          });
          onOpenChange(false);
        } else {
          toast({
            title: "Share Not Supported",
            description: "Please copy the link instead",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("[Share] Error:", error);
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
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: "1080px",
            height: "1920px",
            position: "relative",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${albumArtUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(40px) brightness(0.4)",
              opacity: 0.8,
            }}
          />

          <div
            style={{
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "80px 60px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "48px",
                  fontWeight: "bold",
                  color: "white",
                  letterSpacing: "2px",
                }}
              >
                LYRIC SENSEI
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "40px",
              }}
            >
              <img
                src={albumArtUrl}
                alt={song.title}
                style={{
                  width: "600px",
                  height: "600px",
                  borderRadius: "24px",
                  objectFit: "cover",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                }}
                crossOrigin="anonymous"
              />

              <div style={{ textAlign: "center", maxWidth: "900px" }}>
                <div
                  style={{
                    fontSize: "72px",
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: "20px",
                    lineHeight: 1.2,
                  }}
                >
                  {song.title}
                </div>
                <div
                  style={{
                    fontSize: "48px",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {song.artist}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "36px",
                  color: "rgba(255,255,255,0.9)",
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
