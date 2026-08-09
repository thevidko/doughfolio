import { useTranslation } from "react-i18next";
import { Mascot } from "./Mascot.tsx";

/** Full-screen mascot shown while the app loads, or when the server is away. */
export function Splash({ failed = false }: { failed?: boolean }) {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Mascot size={120} still={failed} />
      <p className={failed ? "font-semibold text-blush-dark" : "text-ink-soft"} role="status">
        {failed ? t("errors.network") : t("common.loading")}
      </p>
    </main>
  );
}
