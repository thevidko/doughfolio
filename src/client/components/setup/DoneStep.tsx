import { useTranslation } from "react-i18next";
import { Mascot } from "../Mascot.tsx";
import { StepShell } from "./StepShell.tsx";

type DoneStepProps = {
  stepIndex: number;
  stepCount: number;
  onOpenDashboard: () => void;
};

export function DoneStep({ stepIndex, stepCount, onOpenDashboard }: DoneStepProps) {
  const { t } = useTranslation();

  return (
    <StepShell
      title={t("setup.done.title")}
      subtitle={t("setup.done.subtitle")}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onNext={onOpenDashboard}
      nextLabel={t("setup.done.cta")}
    >
      <div className="flex justify-center py-2">
        <Mascot size={140} />
      </div>
    </StepShell>
  );
}
