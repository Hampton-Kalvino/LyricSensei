import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const UI_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
] as const;

export function UILanguageSelector() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  const currentLanguage = UI_LANGUAGES.find(lang => lang.code === i18n.language) || UI_LANGUAGES[0];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div data-testid="select-ui-language">
          <Select
            value={i18n.language}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-[140px] gap-2">
              <Languages className="h-4 w-4" />
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span>{currentLanguage.flag}</span>
                  <span className="hidden sm:inline">{currentLanguage.name}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {UI_LANGUAGES.map((language) => (
                <SelectItem 
                  key={language.code} 
                  value={language.code}
                  data-testid={`option-ui-language-${language.code}`}
                >
                  <span className="flex items-center gap-2">
                    <span>{language.flag}</span>
                    <span>{language.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('settings.uiLanguage')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
