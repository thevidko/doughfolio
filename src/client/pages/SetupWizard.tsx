import type { SetupCompleteResponse } from "@shared/api.ts";
import type { SupportedCurrency } from "@shared/currencies.ts";
import type { SupportedLanguage } from "@shared/schemas/setup.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CurrencyStep } from "../components/setup/CurrencyStep.tsx";
import { DoneStep } from "../components/setup/DoneStep.tsx";
import { NameStep } from "../components/setup/NameStep.tsx";
import { PasswordStep } from "../components/setup/PasswordStep.tsx";
import { WalletsStep } from "../components/setup/WalletsStep.tsx";
import { WelcomeStep } from "../components/setup/WelcomeStep.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { detectLanguage, translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, postJson } from "../lib/api.ts";

const STEP_COUNT = 6;

type WizardData = {
  language: SupportedLanguage;
  displayName: string;
  protect: boolean;
  password: string;
  passwordConfirm: string;
  baseCurrency: SupportedCurrency;
  wallets: string[];
};

/** First-run setup flow — see docs/features/setup-wizard.md. */
export function SetupWizard() {
  const { i18n } = useTranslation();
  const { refresh } = useSetupStatus();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<WizardData>({
    language: detectLanguage(),
    displayName: "",
    protect: false,
    password: "",
    passwordConfirm: "",
    baseCurrency: "usd",
    wallets: [""],
  });

  const patch = (changes: Partial<WizardData>) => setData((prev) => ({ ...prev, ...changes }));
  const next = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function submit(walletsOverride?: string[]) {
    setSubmitting(true);
    setErrorMessage(null);
    const walletNames = (walletsOverride ?? data.wallets)
      .map((name) => name.trim())
      .filter(Boolean);
    try {
      await postJson<SetupCompleteResponse>("/api/setup/complete", {
        language: data.language,
        displayName: data.displayName.trim() || undefined,
        password: data.protect ? data.password : undefined,
        baseCurrency: data.baseCurrency,
        wallets: walletNames.map((name) => ({ name })),
      });
      next();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? translateServerKey(error.messageKey)
          : translateServerKey("errors.network"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      {step === 0 && (
        <WelcomeStep
          language={data.language}
          onLanguageChange={(language) => {
            patch({ language });
            void i18n.changeLanguage(language);
          }}
          stepIndex={0}
          stepCount={STEP_COUNT}
          onNext={next}
        />
      )}
      {step === 1 && (
        <NameStep
          displayName={data.displayName}
          onDisplayNameChange={(displayName) => patch({ displayName })}
          stepIndex={1}
          stepCount={STEP_COUNT}
          onBack={back}
          onSkip={() => {
            patch({ displayName: "" });
            next();
          }}
          onNext={next}
        />
      )}
      {step === 2 && (
        <PasswordStep
          protect={data.protect}
          password={data.password}
          passwordConfirm={data.passwordConfirm}
          onChange={patch}
          stepIndex={2}
          stepCount={STEP_COUNT}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 3 && (
        <CurrencyStep
          baseCurrency={data.baseCurrency}
          onBaseCurrencyChange={(baseCurrency) => patch({ baseCurrency })}
          stepIndex={3}
          stepCount={STEP_COUNT}
          onBack={back}
          onNext={next}
        />
      )}
      {step === 4 && (
        <WalletsStep
          wallets={data.wallets}
          onWalletsChange={(wallets) => patch({ wallets })}
          submitting={submitting}
          errorMessage={errorMessage}
          stepIndex={4}
          stepCount={STEP_COUNT}
          onBack={back}
          onSkip={() => {
            patch({ wallets: [] });
            void submit([]);
          }}
          onFinish={() => void submit()}
        />
      )}
      {step === 5 && (
        <DoneStep
          stepIndex={5}
          stepCount={STEP_COUNT}
          // Refreshing flips `completed` — the router then swaps in the app.
          onOpenDashboard={() => void refresh()}
        />
      )}
    </main>
  );
}
