import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@shared/currencies.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { currencyLabel } from "../../lib/currency.ts";
import { TextInput } from "../ui/TextInput.tsx";
import { StepShell } from "./StepShell.tsx";

/** Currencies shown first — everything else is one search away. */
const PROMOTED: readonly SupportedCurrency[] = ["usd", "eur", "czk", "gbp", "btc"];

type CurrencyStepProps = {
  baseCurrency: SupportedCurrency;
  onBaseCurrencyChange: (currency: SupportedCurrency) => void;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
};

export function CurrencyStep({
  baseCurrency,
  onBaseCurrencyChange,
  stepIndex,
  stepCount,
  onBack,
  onNext,
}: CurrencyStepProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");

  const ordered = [...PROMOTED, ...SUPPORTED_CURRENCIES.filter((c) => !PROMOTED.includes(c))];
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? ordered.filter((code) => {
        const label = currencyLabel(code, i18n.language)?.toLowerCase() ?? "";
        return code.includes(needle) || label.includes(needle);
      })
    : ordered;

  return (
    <StepShell
      title={t("setup.currency.title")}
      subtitle={t("setup.currency.hint")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onNext={onNext}
    >
      <div className="space-y-3">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("setup.currency.search")}
          aria-label={t("setup.currency.search")}
        />
        <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {visible.map((code) => {
            const selected = code === baseCurrency;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() => onBaseCurrencyChange(code)}
                className={`wobbly-2 border-2 px-3 py-2 text-left transition-transform active:scale-95 ${
                  selected ? "border-ink bg-dough" : "border-ink/15 bg-surface hover:border-ink/40"
                }`}
              >
                <span className="block font-display font-bold">{code.toUpperCase()}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {currencyLabel(code, i18n.language) ?? " "}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}
