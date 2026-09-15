import {
  useState,
} from "react";

import {
  Route,
  Routes,
} from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import SplashScreen from "./components/layout/SplashScreen";
import NotFoundPage from "./pages/NotFoundPage";

import AnomaliesPage from "./pages/AnomaliesPage";
import AnomalyDetailPage from "./pages/AnomalyDetailPage";
import IncidentsPage from "./pages/IncidentsPage";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import ModelPage from "./pages/ModelPage";
import OverviewPage from "./pages/OverviewPage";


function App() {
  const [
    showSplash,
    setShowSplash,
  ] = useState(true);


  return (
    <>
      {showSplash && (
        <SplashScreen
          onComplete={() => {
            setShowSplash(false);
          }}
        />
      )}

      <AppShell>
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage />
            }
          />

          <Route
            path="/incidents"
            element={
              <IncidentsPage />
            }
          />

          <Route
            path="/incidents/:incidentId"
            element={
              <IncidentDetailPage />
            }
          />

          <Route
            path="/anomalies"
            element={
              <AnomaliesPage />
            }
          />

          <Route
            path="/anomalies/:eventId"
            element={
              <AnomalyDetailPage />
            }
          />

          <Route
            path="/model"
            element={
              <ModelPage />
            }
          />

          <Route
            path="*"
            element={
              <NotFoundPage />
            }
          />
        </Routes>
      </AppShell>
    </>
  );
}


export default App;