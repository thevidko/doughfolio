import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import { TextInput } from "../ui/TextInput.tsx";

type InlineNameFormProps = {
  placeholder: string;
  /** Pre-filled value — present when renaming, empty when creating. */
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
};

/** One-field inline form used for creating and renaming structure items. */
export function InlineNameForm({
  placeholder,
  initial = "",
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = true,
}: InlineNameFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <TextInput
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        maxLength={50}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") onCancel?.();
        }}
      />
      <Button variant="secondary" onClick={() => void submit()} disabled={!name.trim() || busy}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}
