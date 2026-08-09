import type { SessionResponse } from "@shared/api.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mascot } from "../components/Mascot.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card } from "../components/ui/Card.tsx";
import { TextInput } from "../components/ui/TextInput.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";
import { translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, postJson } from "../lib/api.ts";

/** Unlock screen for password-protected instances. */
export function Login() {
  const { t } = useTranslation();
  const { refresh } = useSetupStatus();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit() {
    if (!password || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await postJson<SessionResponse>("/api/session", { password });
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError
          ? translateServerKey(error.messageKey)
          : translateServerKey("errors.network"),
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="animate-pop w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <Mascot size={100} />
          <h1 className="text-2xl font-bold">{t("login.title")}</h1>
          <p className="text-center text-sm text-ink-soft">{t("login.subtitle")}</p>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("login.placeholder")}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          {errorMessage && (
            <p role="alert" className="text-sm font-semibold text-blush-dark">
              {errorMessage}
            </p>
          )}
          <Button onClick={() => void submit()} disabled={!password || submitting}>
            {t("login.submit")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
