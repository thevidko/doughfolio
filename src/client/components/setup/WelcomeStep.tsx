import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@shared/schemas/setup.ts";
import { useTranslation } from "react-i18next";
import { Mascot } from "../Mascot.tsx";
import { StepShell } from "./StepShell.tsx";

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  cs: "Čeština",
};

type WelcomeStepProps = {
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
};

export function WelcomeStep({
  language,
  onLanguageChange,
  stepIndex,
  stepCount,
  onNext,
}: WelcomeStepProps) {
  const { t } = useTranslation();

  return (
    <StepShell
      title={t("setup.welcome.title")}
      subtitle={t("setup.welcome.subtitle")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onNext={onNext}
    >
      <div className="flex flex-col items-center gap-6">
        <Mascot size={120} />
        <fieldset className="w-full">
          <legend className="mb-2 text-center text-sm font-semibold text-ink-soft">
            {t("setup.welcome.language")}
          </legend>
          <div className="flex justify-center gap-3">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                aria-pressed={language === lang}
                onClick={() => onLanguageChange(lang)}
                className={`wobbly border-2 px-5 py-2 font-display font-semibold transition-transform active:scale-95 ${
                  language === lang
                    ? "border-ink bg-dough text-ink"
                    : "border-ink/20 bg-surface text-ink-soft hover:border-ink/50"
                }`}
              >
                {LANGUAGE_NAMES[lang]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </StepShell>
  );
}
