import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface AdBannerProps {
  className?: string;
  slot?: string; // For AdSense slot ID
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
}

export function AdBanner({ className, slot = "placeholder", format = "auto" }: AdBannerProps) {
  // In production, this would be replaced with actual Google AdSense code
  // For now, showing a placeholder that can be easily replaced
  
  return (
    <Card 
      className={`p-4 bg-muted/30 border-dashed ${className}`}
      data-ad-slot={slot}
      data-ad-format={format}
      data-testid="ad-banner"
    >
      <div className="flex flex-col items-center justify-center gap-2 min-h-[100px] text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground/70">
          Advertisement
        </p>
        <p className="text-xs text-muted-foreground/50">
          {format === "vertical" ? "300x600" : format === "horizontal" ? "728x90" : "Responsive Ad"}
        </p>
      </div>
    </Card>
  );
}
