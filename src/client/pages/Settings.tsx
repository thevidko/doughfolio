import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AppHeader } from "../components/AppHeader.tsx";
import { Splash } from "../components/Splash.tsx";
import { PlPreferences } from "../components/settings/PlPreferences.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card } from "../components/ui/Card.tsx";
import { InlineNameForm } from "../components/wallets/InlineNameForm.tsx";
import { useWalletStructure } from "../hooks/useWalletStructure.ts";
import { translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, deleteJson, patchJson, postJson } from "../lib/api.ts";

/** Settings — storage-type management for now; more preferences arrive later. */
export function Settings() {
  const { t } = useTranslation();
  const { state, reload } = useWalletStructure();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (state.phase === "loading") return <Splash />;
  if (state.phase === "failed") return <Splash failed />;

  async function act(action: () => Promise<unknown>) {
    try {
      setErrorMessage(null);
      await action();
      await reload();
    } catch (error) {
      setErrorMessage(
        translateServerKey(error instanceof ApiRequestError ? error.messageKey : "errors.network"),
      );
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-8 p-6">
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

        <PlPreferences />

        <Card className="space-y-3">
          <div>
            <h2 className="text-xl font-bold">{t("dataTools.title")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("dataTools.hint")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/export/transactions.csv"
              download
              className="wobbly inline-flex items-center gap-2 border-2 border-ink bg-dough px-4 py-2 font-display font-semibold text-ink transition-transform hover:-rotate-1 active:scale-95"
            >
              ⬇️ {t("dataTools.exportButton")}
            </a>
            <Link
              to="/import"
              className="wobbly-2 inline-flex items-center gap-2 border-2 border-ink bg-surface px-4 py-2 font-display font-semibold text-ink transition-transform hover:rotate-1 active:scale-95"
            >
              ⬆️ {t("dataTools.importButton")}
            </Link>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t("settings.storageTypes")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("settings.storageTypesHint")}</p>
          </div>

          {errorMessage && (
            <p role="alert" className="font-semibold text-blush-dark">
              {errorMessage}
            </p>
          )}

          <ul className="space-y-2">
            {state.storageTypes.map((type) => (
              <li key={type.id} className="flex items-center gap-2">
                {renamingId === type.id ? (
                  <InlineNameForm
                    placeholder={t("settings.typeNamePlaceholder")}
                    initial={type.name}
                    submitLabel={t("common.save")}
                    onSubmit={async (name) => {
                      await act(() => patchJson(`/api/storage-types/${type.id}`, { name }));
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <>
                    <span className="wobbly-2 border-2 border-ink/15 bg-cream px-3 py-1 font-semibold">
                      {type.name}
                    </span>
                    {type.behavior === "staking" && (
                      <span className="wobbly bg-matcha/30 px-2 py-0.5 text-xs font-semibold text-matcha-dark">
                        {t("settings.stakingBadge")}
                      </span>
                    )}
                    <Button variant="ghost" onClick={() => setRenamingId(type.id)}>
                      {t("common.edit")}
                    </Button>
                    {!type.builtin && (
                      <Button
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => {
                          if (confirm(t("settings.confirmDeleteType", { name: type.name }))) {
                            void act(() => deleteJson(`/api/storage-types/${type.id}`));
                          }
                        }}
                      >
                        ✕
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>

          <InlineNameForm
            placeholder={t("settings.typeNamePlaceholder")}
            submitLabel={t("common.add")}
            autoFocus={false}
            onSubmit={(name) => act(() => postJson("/api/storage-types", { name }))}
          />
        </Card>
      </main>
    </div>
  );
}
