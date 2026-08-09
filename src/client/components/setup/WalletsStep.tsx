import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import { TextInput } from "../ui/TextInput.tsx";
import { StepShell } from "./StepShell.tsx";

type WalletsStepProps = {
  wallets: string[];
  onWalletsChange: (wallets: string[]) => void;
  submitting: boolean;
  /** Translated server-side error, if the previous submit failed. */
  errorMessage: string | null;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

export function WalletsStep({
  wallets,
  onWalletsChange,
  submitting,
  errorMessage,
  stepIndex,
  stepCount,
  onBack,
  onSkip,
  onFinish,
}: WalletsStepProps) {
  const { t } = useTranslation();

  const update = (index: number, name: string) =>
    onWalletsChange(wallets.map((w, i) => (i === index ? name : w)));
  const remove = (index: number) => onWalletsChange(wallets.filter((_, i) => i !== index));

  return (
    <StepShell
      title={t("setup.wallets.title")}
      subtitle={t("setup.wallets.hint")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onSkip={submitting ? undefined : onSkip}
      onNext={onFinish}
      nextLabel={t("setup.wallets.finish")}
      nextDisabled={submitting || wallets.some((w) => !w.trim())}
    >
      <div className="space-y-3">
        {wallets.map((name, index) => (
          <div
            // Position-keyed rows: entries are bare strings edited in place.
            key={`wallet-${String(index)}`}
            className="flex items-center gap-2"
          >
            <TextInput
              value={name}
              onChange={(e) => update(index, e.target.value)}
              placeholder={t("setup.wallets.placeholder")}
              maxLength={50}
            />
            <Button
              variant="ghost"
              onClick={() => remove(index)}
              aria-label={t("setup.wallets.remove")}
            >
              ✕
            </Button>
          </div>
        ))}
        {wallets.length < 20 && (
          <Button variant="secondary" onClick={() => onWalletsChange([...wallets, ""])}>
            + {t("setup.wallets.add")}
          </Button>
        )}
        {errorMessage && (
          <p role="alert" className="text-sm font-semibold text-blush-dark">
            {errorMessage}
          </p>
        )}
      </div>
    </StepShell>
  );
}
