import { Navigate, Route, Routes } from "react-router";
import { Splash } from "./components/Splash.tsx";
import { SetupStatusProvider, useSetupStatus } from "./hooks/useSetupStatus.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Login } from "./pages/Login.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { SetupWizard } from "./pages/SetupWizard.tsx";

/** Root application component. */
export function App() {
  return (
    <SetupStatusProvider>
      <GatedRoutes />
    </SetupStatusProvider>
  );
}

/**
 * Setup/auth gate (setup-wizard spec): an unconfigured instance forces
 * `/setup`, a configured one never shows it again, and a password-protected
 * instance asks for the password before revealing anything.
 */
function GatedRoutes() {
  const state = useSetupStatus();

  if (state.phase === "loading") return <Splash />;
  if (state.phase === "failed") return <Splash failed />;

  const { completed, passwordRequired, authenticated } = state.status;
  if (completed && passwordRequired && !authenticated) return <Login />;

  return (
    <Routes>
      <Route path="/setup" element={completed ? <Navigate to="/" replace /> : <SetupWizard />} />
      <Route path="/" element={completed ? <Dashboard /> : <Navigate to="/setup" replace />} />
      <Route path="*" element={completed ? <NotFound /> : <Navigate to="/setup" replace />} />
    </Routes>
  );
}
