import { useTranslation } from "react-i18next";
import { TextInput } from "../ui/TextInput.tsx";
import { StepShell } from "./StepShell.tsx";

type NameStepProps = {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
};

export function NameStep({
  displayName,
  onDisplayNameChange,
  stepIndex,
  stepCount,
  onBack,
  onSkip,
  onNext,
}: NameStepProps) {
  const { t } = useTranslation();

  return (
    <StepShell
      title={t("setup.name.title")}
      subtitle={t("setup.name.hint")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <TextInput
        value={displayName}
        onChange={(e) => onDisplayNameChange(e.target.value)}
        placeholder={t("setup.name.placeholder")}
        maxLength={50}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onNext();
        }}
      />
    </StepShell>
  );
}
