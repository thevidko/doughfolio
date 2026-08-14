import type { StorageTypeDto, WalletDto, WalletGroupDto } from "@shared/api.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteJson, patchJson, postJson } from "../../lib/api.ts";
import { Button } from "../ui/Button.tsx";
import { InlineNameForm } from "./InlineNameForm.tsx";
import { WalletCard } from "./WalletCard.tsx";

type GroupSectionProps = {
  group: WalletGroupDto;
  wallets: WalletDto[];
  groups: WalletGroupDto[];
  storageTypes: StorageTypeDto[];
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
};

/** One "steamer": heading with actions, its baskets, and an add form. */
export function GroupSection({
  group,
  wallets,
  groups,
  storageTypes,
  onChanged,
  onError,
}: GroupSectionProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await onChanged();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        {renaming ? (
          <InlineNameForm
            placeholder={t("wallets.groupNamePlaceholder")}
            initial={group.name}
            submitLabel={t("common.save")}
            onSubmit={async (name) => {
              await mutate(() => patchJson(`/api/groups/${group.id}`, { name }));
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <h2 className="text-2xl font-bold">🧺 {group.name}</h2>
            {group.isDefault && (
              <span className="wobbly bg-cream-dark px-2 py-0.5 text-xs font-semibold text-ink-soft">
                {t("wallets.defaultBadge")}
              </span>
            )}
            <Button variant="ghost" onClick={() => setRenaming(true)}>
              {t("common.edit")}
            </Button>
            {!group.isDefault && (
              <Button
                variant="ghost"
                aria-label={t("common.delete")}
                onClick={() => {
                  if (confirm(t("wallets.confirmDeleteGroup", { name: group.name }))) {
                    void mutate(() => deleteJson(`/api/groups/${group.id}`));
                  }
                }}
              >
                ✕
              </Button>
            )}
          </>
        )}
      </div>

      {wallets.length === 0 && <p className="text-ink-soft">{t("wallets.emptyGroup")}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet, index) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            groups={groups}
            storageTypes={storageTypes}
            neighbors={{ prev: wallets[index - 1], next: wallets[index + 1] }}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </div>

      {adding ? (
        <InlineNameForm
          placeholder={t("wallets.walletNamePlaceholder")}
          submitLabel={t("common.add")}
          onSubmit={async (name) => {
            await mutate(() => postJson("/api/wallets", { name, groupId: group.id }));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + {t("wallets.addWallet")}
        </Button>
      )}
    </section>
  );
}
