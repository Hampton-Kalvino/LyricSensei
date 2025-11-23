import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecognitionButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  size?: "sm" | "md" | "lg";
}

export function RecognitionButton({
  isListening,
  isProcessing = false,
  onStartListening,
  onStopListening,
  onStart,
  onStop,
  size = "lg",
}: RecognitionButtonProps) {
  const handleClick = () => {
    if (isListening) {
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
        disabled={isProcessing}
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
      </button>
    );
  }

  // Full button with text
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        disabled={isProcessing}
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
      <div className="text-center">
        <p className="text-sm font-medium">
          {isProcessing
            ? "Processing..."
            : isListening
            ? "Listening..."
            : "Tap to Recognize"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isListening
            ? "Playing music nearby"
            : "Play a song and tap the button"}
        </p>
      </div>
    </div>
  );
}
