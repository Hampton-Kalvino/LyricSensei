import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecognitionButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  progress?: number;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  size?: "sm" | "md" | "lg";
}

export function RecognitionButton({
  isListening,
  isProcessing = false,
  progress = 0,
  onStartListening,
  onStopListening,
  onStart,
  onStop,
  size = "lg",
}: RecognitionButtonProps) {
  const handleClick = () => {
    if (isListening || isProcessing) {
      (onStopListening || onStop)?.();
    } else {
      (onStartListening || onStart)?.();
    }
  };

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-32 w-32",
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  // Compact button for small size (header)
  if (size === "sm") {
    return (
      <button
        onClick={handleClick}
        disabled={isProcessing && progress < 95}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all",
          sizeClasses[size],
          "bg-gradient-to-br from-primary to-primary/80",
          "shadow-md hover:shadow-lg hover-elevate active-elevate-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isListening && "animate-pulse"
        )}
        data-testid="button-recognize-song"
      >
        {isProcessing ? (
          <Loader2 className={cn(iconSizes[size], "text-primary-foreground animate-spin")} />
        ) : (
          <Mic
            className={cn(
              iconSizes[size],
              "text-primary-foreground transition-transform",
              isListening && "scale-110"
            )}
          />
        )}
        {isListening && (
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        )}
        {/* Progress ring */}
        {progress > 0 && progress < 100 && (
          <svg className="absolute inset-0 transform -rotate-90 h-full w-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className="text-primary-foreground transition-all duration-300"
            />
          </svg>
        )}
      </button>
    );
  }

  // Full button with text
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={isProcessing && progress < 95}
          className={cn(
            "relative flex items-center justify-center rounded-full transition-all duration-300",
            sizeClasses[size],
            "hover:scale-105 active:scale-95",
            "bg-gradient-to-br from-primary to-primary/80",
            "shadow-lg hover:shadow-xl",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isListening && "animate-pulse"
          )}
          data-testid="button-recognize-song"
        >
          {isProcessing ? (
            <Loader2 className={cn(iconSizes[size], "text-primary-foreground animate-spin")} />
          ) : (
            <Mic
              className={cn(
                iconSizes[size],
                "text-primary-foreground transition-transform",
                isListening && "scale-110"
              )}
            />
          )}
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          )}
        </button>
        
        {/* Progress indicator */}
        {progress > 0 && progress < 100 && (
          <div className="absolute -inset-2 rounded-full border-2 border-primary/30" style={{
            backgroundImage: `conic-gradient(from 0deg, hsl(var(--primary)), transparent ${progress}%)`
          }} />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          {isProcessing
            ? `Processing... ${progress}%`
            : isListening
            ? "Listening..."
            : "Tap to Recognize"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isProcessing
            ? "Identifying song"
            : isListening
            ? "5 seconds max"
            : "Play a song and tap"}
        </p>
      </div>
    </div>
  );
}
