import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MusicPlayerProps {
  audioUrl?: string;
  duration: number;
  isSimulatedPlaying?: boolean;
  onTimeUpdate?: (time: number) => void;
  onSeek?: (time: number) => void;
  onPlayPauseToggle?: () => void;
}

export function MusicPlayer({
  audioUrl,
  duration,
  isSimulatedPlaying = false,
  onTimeUpdate,
  onSeek,
  onPlayPauseToggle,
}: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Use simulated playing state if no audio URL available
  const effectiveIsPlaying = audioUrl ? isPlaying : isSimulatedPlaying;

  // Reset playback when audio URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Playback error:", err);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioUrl) {
      setIsPlaying(!isPlaying);
    } else {
      // Use simulated playback
      onPlayPauseToggle?.();
    }
  };

  const handleSeek = (value: number[]) => {
    const time = value[0];
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    onSeek?.(time);
  };

  const skipBackward = () => {
    const newTime = Math.max(0, currentTime - 10);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const skipForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="p-6">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
      
      <div className="space-y-4">
        {/* Waveform/Progress */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
            data-testid="slider-progress"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <span data-testid="text-duration">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              data-testid="button-mute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={(value) => {
                setVolume(value[0]);
                setIsMuted(false);
              }}
              className="w-24"
              data-testid="slider-volume"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              data-testid="button-skip-back"
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12 rounded-full"
              data-testid="button-play-pause"
            >
              {effectiveIsPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-1" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              data-testid="button-skip-forward"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1" />
        </div>
      </div>
    </Card>
  );
}
