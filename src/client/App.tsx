import logoUrl from "./assets/logo.png";
import { ServerStatus } from "./components/ServerStatus.tsx";

/** Root application component — currently a themed hello-world landing page. */
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <img
        src={logoUrl}
        alt="DoughFolio — a happy dumpling hugging a treasure chest full of crypto coins"
        className="w-full max-w-xl drop-shadow-md"
      />

      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Welcome to <span className="text-dough">Dough</span>
          <span className="text-matcha-dark">Folio</span>!
        </h1>
        <p className="mx-auto max-w-md text-lg text-ink-soft">
          Your cute self-hosted crypto portfolio tracker. Fresh out of the steamer&nbsp;🥟
        </p>
      </div>

      <ServerStatus />
    </main>
  );
}
