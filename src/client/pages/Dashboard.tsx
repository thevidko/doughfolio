import { useTranslation } from "react-i18next";
import { AppShell } from "../components/AppShell.tsx";
import { HoldingsOverview } from "../components/HoldingsOverview.tsx";
import { PortfolioCharts } from "../components/PortfolioCharts.tsx";
import { QuickActions } from "../components/QuickActions.tsx";
import { ServerStatus } from "../components/ServerStatus.tsx";
import { useSetupStatus } from "../hooks/useSetupStatus.tsx";

/** Placeholder dashboard — real portfolio views arrive with the next features. */
export function Dashboard() {
  const { t } = useTranslation();
  const status = useSetupStatus();
  const setup = status.phase === "ready" ? status.status : null;

  return (
    <AppShell>
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-8 p-6 text-center">
        <h1 className="animate-pop text-3xl font-bold">
          {setup?.displayName
            ? t("dashboard.greeting", { name: setup.displayName })
            : t("dashboard.greetingAnonymous")}
        </h1>

        <QuickActions />

        <PortfolioCharts />

        <HoldingsOverview baseCurrency={setup?.baseCurrency ?? "usd"} />

        <ServerStatus />
      </main>
    </AppShell>
  );
}
