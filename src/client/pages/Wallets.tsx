import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { Splash } from "../components/Splash.tsx";
import { Button } from "../components/ui/Button.tsx";
import { GroupSection } from "../components/wallets/GroupSection.tsx";
import { InlineNameForm } from "../components/wallets/InlineNameForm.tsx";
import { useWalletStructure } from "../hooks/useWalletStructure.ts";
import { translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, postJson } from "../lib/api.ts";

/** The wallets page — steamers with their baskets (wallet-structure spec). */
export function Wallets() {
  const { t } = useTranslation();
  const { state, reload } = useWalletStructure();
  const [addingGroup, setAddingGroup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (state.phase === "loading") return <Splash />;
  if (state.phase === "failed") return <Splash failed />;

  const { groups, wallets, storageTypes } = state;

  function showError(error: unknown) {
    setErrorMessage(
      translateServerKey(error instanceof ApiRequestError ? error.messageKey : "errors.network"),
    );
  }

  async function refresh() {
    setErrorMessage(null);
    await reload();
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-10 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{t("wallets.title")}</h1>
            <p className="text-ink-soft">{t("wallets.subtitle")}</p>
          </div>
          <Link
            to="/import"
            className="font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            ⬆️ {t("dataTools.importButton")}
          </Link>
        </div>

        {errorMessage && (
          <p role="alert" className="wobbly bg-blush/20 px-4 py-2 font-semibold text-blush-dark">
            {errorMessage}
          </p>
        )}

        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            wallets={wallets.filter((w) => w.groupId === group.id)}
            groups={groups}
            storageTypes={storageTypes}
            onChanged={refresh}
            onError={showError}
          />
        ))}

        {addingGroup ? (
          <InlineNameForm
            placeholder={t("wallets.groupNamePlaceholder")}
            submitLabel={t("common.add")}
            onSubmit={async (name) => {
              try {
                await postJson("/api/groups", { name });
                await refresh();
                setAddingGroup(false);
              } catch (error) {
                showError(error);
              }
            }}
            onCancel={() => setAddingGroup(false)}
          />
        ) : (
          <Button onClick={() => setAddingGroup(true)}>+ {t("wallets.addGroup")}</Button>
        )}
      </main>
    </AppShell>
  );
}
