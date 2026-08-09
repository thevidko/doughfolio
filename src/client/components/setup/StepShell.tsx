import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import { Card } from "../ui/Card.tsx";

type StepShellProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  stepIndex: number;
  stepCount: number;
  onBack?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  /** Custom label for the primary action (defaults to "Next"). */
  nextLabel?: string;
  nextDisabled?: boolean;
};

/** Shared frame of every wizard step: card, heading, progress dots, actions. */
export function StepShell({
  title,
  subtitle,
  children,
  stepIndex,
  stepCount,
  onBack,
  onSkip,
  onNext,
  nextLabel,
  nextDisabled = false,
}: StepShellProps) {
  const { t } = useTranslation();

  return (
    // Re-runs the pop animation on every step change.
    <Card key={stepIndex} className="animate-pop w-full max-w-lg">
      <div className="mb-5 flex justify-center gap-2" aria-hidden>
        {Array.from({ length: stepCount }, (_, i) => (
          <span
            // Static decorative list — index is the identity here.
            key={`dot-${String(i)}`}
            className={`size-2.5 rounded-full transition-colors ${
              i === stepIndex ? "bg-dough" : "bg-ink/15"
            }`}
          />
        ))}
      </div>

      <h1 className="text-center text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-ink-soft">{subtitle}</p>}

      {children && <div className="mt-6">{children}</div>}

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              {t("common.skip")}
            </Button>
          )}
          {onNext && (
            <Button onClick={onNext} disabled={nextDisabled}>
              {nextLabel ?? t("common.next")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
