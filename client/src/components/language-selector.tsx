import { Check, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LanguageSelectorProps {
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
}

export function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLang = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === selectedLanguage
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="button-language-selector"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span>
              {selectedLang ? `${selectedLang.name}` : "Select language"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search language..." />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <CommandItem
                  key={lang.code}
                  value={lang.name}
                  onSelect={() => {
                    onLanguageChange(lang.code);
                    setOpen(false);
                  }}
                  data-testid={`option-language-${lang.code}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedLanguage === lang.code
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="mr-2">{lang.flag}</span>
                  {lang.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
