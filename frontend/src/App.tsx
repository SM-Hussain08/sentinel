import {
  useState,
} from "react";

import AppShell from "./components/layout/AppShell";
import SplashScreen from "./components/layout/SplashScreen";

import type {
  AppPage,
} from "./components/layout/AppShell";

import AnomaliesPage from "./pages/AnomaliesPage";
import IncidentsPage from "./pages/IncidentsPage";
import ModelPage from "./pages/ModelPage";
import OverviewPage from "./pages/OverviewPage";


function App() {
  const [
    showSplash,
    setShowSplash,
  ] = useState(true);

  const [
    activePage,
    setActivePage,
  ] = useState<AppPage>(
    "overview",
  );


  function renderPage() {
    switch (activePage) {
      case "incidents":
        return (
          <IncidentsPage />
        );

      case "anomalies":
        return (
          <AnomaliesPage />
        );

      case "model":
        return (
          <ModelPage />
        );

      case "overview":
      default:
        return (
          <OverviewPage />
        );
    }
  }


  return (
    <>
      {showSplash && (
        <SplashScreen
          onComplete={() => {
            setShowSplash(false);
          }}
        />
      )}

      <AppShell
        activePage={activePage}
        onNavigate={
          setActivePage
        }
      >
        {renderPage()}
      </AppShell>
    </>
  );
}


export default App;