import type { StorageTypeDto, WalletDto, WalletGroupDto } from "@shared/api.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { deleteJson, patchJson } from "../../lib/api.ts";
import { Button } from "../ui/Button.tsx";
import { InlineNameForm } from "./InlineNameForm.tsx";

type WalletCardProps = {
  wallet: WalletDto;
  groups: WalletGroupDto[];
  storageTypes: StorageTypeDto[];
  /** Previous/next wallet in the same group, for reordering. */
  neighbors: { prev?: WalletDto; next?: WalletDto };
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
};

/** One "basket": rename, storage type, group move, reorder, delete. */
export function WalletCard({
  wallet,
  groups,
  storageTypes,
  neighbors,
  onChanged,
  onError,
}: WalletCardProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await onChanged();
    } catch (error) {
      onError(error);
    }
  }

  const swapWith = (other: WalletDto | undefined) => {
    if (!other) return;
    void mutate(async () => {
      // Swap sort positions; two PATCHes are fine at this scale.
      await patchJson(`/api/wallets/${wallet.id}`, { sortOrder: other.sortOrder });
      await patchJson(`/api/wallets/${other.id}`, { sortOrder: wallet.sortOrder });
    });
  };

  const selectClass =
    "wobbly-2 border-2 border-ink/15 bg-cream px-2 py-1 text-sm text-ink-soft focus:border-ink outline-none";

  return (
    <div className="wobbly-2 animate-pop border-2 border-ink/15 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <InlineNameForm
            placeholder={t("wallets.walletNamePlaceholder")}
            initial={wallet.name}
            submitLabel={t("common.save")}
            onSubmit={async (name) => {
              await mutate(() => patchJson(`/api/wallets/${wallet.id}`, { name }));
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <Link
            to={`/wallets/${wallet.id}`}
            className="font-display text-lg font-bold underline-offset-4 hover:underline"
          >
            {wallet.name}
          </Link>
        )}
        {!renaming && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => swapWith(neighbors.prev)}
              aria-label={t("common.moveUp")}
              disabled={!neighbors.prev}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              onClick={() => swapWith(neighbors.next)}
              aria-label={t("common.moveDown")}
              disabled={!neighbors.next}
            >
              ↓
            </Button>
            <Button variant="ghost" onClick={() => setRenaming(true)}>
              {t("common.edit")}
            </Button>
            <Button
              variant="ghost"
              aria-label={t("common.delete")}
              onClick={() => {
                if (confirm(t("wallets.confirmDeleteWallet", { name: wallet.name }))) {
                  void mutate(() => deleteJson(`/api/wallets/${wallet.id}`));
                }
              }}
            >
              ✕
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={wallet.storageTypeId ?? ""}
          aria-label={t("settings.storageTypes")}
          onChange={(e) =>
            void mutate(() =>
              patchJson(`/api/wallets/${wallet.id}`, {
                storageTypeId: e.target.value || null,
              }),
            )
          }
        >
          <option value="">{t("wallets.noStorageType")}</option>
          {storageTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={wallet.groupId}
          aria-label={t("wallets.title")}
          onChange={(e) =>
            void mutate(() => patchJson(`/api/wallets/${wallet.id}`, { groupId: e.target.value }))
          }
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <Link
        to={`/wallets/${wallet.id}`}
        className="wobbly mt-3 inline-flex items-center gap-2 border-2 border-ink bg-dough px-4 py-1.5 font-display font-semibold text-ink transition-transform hover:-rotate-1 active:scale-95"
      >
        📒 {t("wallets.openTransactions")}
      </Link>
    </div>
  );
}
