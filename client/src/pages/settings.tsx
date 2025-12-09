import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Volume2, VolumeX, Music, ArrowLeft, Check, X, Shield, FileText, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { 
  getSfxSettings, 
  saveSfxSettings, 
  playTestSound 
} from "@/lib/audio-sfx";

export default function Settings() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolume] = useState(50);

  useEffect(() => {
    const settings = getSfxSettings();
    setSfxEnabled(settings.enabled);
    setSfxVolume(Math.round(settings.volume * 100));
  }, []);

  useEffect(() => {
    saveSfxSettings({
      enabled: sfxEnabled,
      volume: sfxVolume / 100
    });
  }, [sfxEnabled, sfxVolume]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth/login");
    return null;
  }

  const handleTestSuccess = () => {
    playTestSound('success');
  };

  const handleTestError = () => {
    playTestSound('error');
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{t('settings.title', 'Settings')}</h1>
            <p className="text-muted-foreground">{t('settings.subtitle', 'Customize your experience')}</p>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('settings.soundEffects', 'Sound Effects')}</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="sfx-toggle" className="text-base font-medium">
                  {t('settings.enableSfx', 'Enable Sound Effects')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.sfxDescription', 'Play sounds for correct and incorrect pronunciations')}
                </p>
              </div>
              <Switch
                id="sfx-toggle"
                checked={sfxEnabled}
                onCheckedChange={setSfxEnabled}
                data-testid="switch-sfx-toggle"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  {t('settings.volume', 'Volume')}
                </Label>
                <div className="flex items-center gap-2">
                  {sfxVolume === 0 ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground w-10 text-right">
                    {sfxVolume}%
                  </span>
                </div>
              </div>
              <Slider
                value={[sfxVolume]}
                onValueChange={(value) => setSfxVolume(value[0])}
                max={100}
                step={5}
                disabled={!sfxEnabled}
                className="w-full"
                data-testid="slider-sfx-volume"
              />
            </div>

            <div className="pt-4 border-t">
              <Label className="text-base font-medium mb-3 block">
                {t('settings.testSounds', 'Test Sounds')}
              </Label>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestSuccess}
                  disabled={!sfxEnabled}
                  className="flex-1"
                  data-testid="button-test-success"
                >
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  {t('settings.successSound', 'Success')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestError}
                  disabled={!sfxEnabled}
                  className="flex-1"
                  data-testid="button-test-error"
                >
                  <X className="h-4 w-4 text-red-500 mr-2" />
                  {t('settings.errorSound', 'Try Again')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('settings.privacy', 'Privacy & Legal')}</h2>
          </div>

          <div className="space-y-2">
            <Link href="/terms">
              <div 
                className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer border"
                data-testid="link-terms-settings"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('settings.termsOfService', 'Terms of Service')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.termsDesc', 'View our terms and conditions')}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/terms">
              <div 
                className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer border"
                data-testid="link-privacy-settings"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('settings.privacyPolicy', 'Privacy Policy')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.privacyDesc', 'Learn how we protect your data')}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              © 2025 Lyric Sensei. All rights reserved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
