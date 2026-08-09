import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Mascot } from "../components/Mascot.tsx";

export function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Mascot size={110} />
      <h1 className="font-display text-4xl font-bold">404</h1>
      <Link to="/" className="font-semibold text-dough-dark underline underline-offset-4">
        {t("common.appName")} →
      </Link>
    </main>
  );
}
