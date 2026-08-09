import { useTranslation } from "react-i18next";
import { TextInput } from "../ui/TextInput.tsx";
import { StepShell } from "./StepShell.tsx";

type PasswordStepProps = {
  protect: boolean;
  password: string;
  passwordConfirm: string;
  onChange: (patch: { protect?: boolean; password?: string; passwordConfirm?: string }) => void;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
};

export function PasswordStep({
  protect,
  password,
  passwordConfirm,
  onChange,
  stepIndex,
  stepCount,
  onBack,
  onNext,
}: PasswordStepProps) {
  const { t } = useTranslation();

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const valid = !protect || (password.length >= 8 && password === passwordConfirm);

  return (
    <StepShell
      title={t("setup.password.title")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!valid}
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={protect}
            onChange={(e) => onChange({ protect: e.target.checked })}
            className="size-5 accent-(--color-dough)"
          />
          <span className="font-semibold">{t("setup.password.protect")}</span>
        </label>

        {protect ? (
          <div className="space-y-3">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder={t("setup.password.placeholder")}
              minLength={8}
              autoFocus
            />
            <TextInput
              type="password"
              value={passwordConfirm}
              onChange={(e) => onChange({ passwordConfirm: e.target.value })}
              placeholder={t("setup.password.confirmPlaceholder")}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <p className="text-sm font-semibold text-blush-dark">
                {t("setup.password.mismatch")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{t("setup.password.skipInfo")}</p>
        )}
      </div>
    </StepShell>
  );
}
