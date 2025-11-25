import { forwardRef } from "react";
import type { Song } from "@shared/schema";

interface StoryCardProps {
  song: Song;
  lyricText?: string;
  userName?: string;
}

export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(
  ({ song, lyricText, userName = "User" }, ref) => {
    return (
      <div
        ref={ref}
        className="story-card-container"
        style={{
          width: "1080px",
          height: "1920px",
          position: "relative",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Blurred background with album art */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${song.albumArt})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) brightness(0.3)",
            opacity: 0.7,
          }}
        />

        {/* Content overlay */}
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "120px 60px",
            zIndex: 1,
          }}
        >
          {/* Header: Branding */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "56px",
                fontWeight: "900",
                color: "white",
                letterSpacing: "3px",
                textShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              🎵 LYRIC SENSEI
            </div>
            <div
              style={{
                fontSize: "28px",
                color: "rgba(255,255,255,0.85)",
                marginTop: "12px",
                fontWeight: "500",
              }}
            >
              Learn lyrics in any language
            </div>
          </div>

          {/* Main content: Album art + song info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "50px",
            }}
          >
            {/* Album artwork */}
            {song.albumArt && (
              <img
                src={song.albumArt}
                alt={song.title}
                style={{
                  width: "520px",
                  height: "520px",
                  borderRadius: "32px",
                  objectFit: "cover",
                  boxShadow:
                    "0 20px 60px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.1)",
                }}
              />
            )}

            {/* Song information */}
            <div style={{ textAlign: "center", maxWidth: "900px" }}>
              <div
                style={{
                  fontSize: "68px",
                  fontWeight: "900",
                  color: "white",
                  marginBottom: "16px",
                  lineHeight: 1.2,
                  textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                {song.title}
              </div>
              <div
                style={{
                  fontSize: "44px",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: "600",
                  textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                by {song.artist}
              </div>
            </div>

            {/* Lyric display (if provided) */}
            {lyricText && (
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(10px)",
                  padding: "50px 40px",
                  borderRadius: "24px",
                  maxWidth: "900px",
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: "40px",
                    color: "white",
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    fontWeight: "500",
                    textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  }}
                >
                  "{lyricText}"
                </div>
              </div>
            )}
          </div>

          {/* Footer: User info */}
          <div
            style={{
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: "bold",
                color: "white",
                border: "2px solid rgba(255,255,255,0.3)",
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div
              style={{
                fontSize: "32px",
                color: "rgba(255,255,255,0.95)",
                fontWeight: "600",
              }}
            >
              @{userName.toLowerCase().replace(" ", "")}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StoryCard.displayName = "StoryCard";
