import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
} from "react-router-dom";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import App from "./App";


vi.mock(
  "./components/layout/AppShell",
  () => ({
    default: ({
      children,
    }: {
      children:
        React.ReactNode;
    }) => (
      <div data-testid="app-shell">
        {children}
      </div>
    ),
  }),
);


vi.mock(
  "./components/layout/SplashScreen",
  () => ({
    default: ({
      onComplete,
    }: {
      onComplete:
        () => void;
    }) => (
      <div data-testid="splash-screen">
        <span>
          Splash Screen
        </span>

        <button
          type="button"
          onClick={
            onComplete
          }
        >
          Complete Splash
        </button>
      </div>
    ),
  }),
);


vi.mock(
  "./pages/OverviewPage",
  () => ({
    default:
      () => (
        <div>
          Overview Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/IncidentsPage",
  () => ({
    default:
      () => (
        <div>
          Incidents Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/IncidentDetailPage",
  () => ({
    default:
      () => (
        <div>
          Incident Detail Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/AnomaliesPage",
  () => ({
    default:
      () => (
        <div>
          Anomalies Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/AnomalyDetailPage",
  () => ({
    default:
      () => (
        <div>
          Anomaly Detail Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/EmployeesPage",
  () => ({
    default:
      () => (
        <div>
          Employees Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/EmployeeDetailPage",
  () => ({
    default:
      () => (
        <div>
          Employee Detail Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/ModelPage",
  () => ({
    default:
      () => (
        <div>
          Model Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/ArchitecturePage",
  () => ({
    default:
      () => (
        <div>
          Architecture Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/SimulationPage",
  () => ({
    default:
      () => (
        <div>
          Simulation Route
        </div>
      ),
  }),
);


vi.mock(
  "./pages/NotFoundPage",
  () => ({
    default:
      () => (
        <div>
          Not Found Route
        </div>
      ),
  }),
);


function renderApp(
  path: string,
) {
  return render(
    <MemoryRouter
      initialEntries={[
        path,
      ]}
    >
      <App />
    </MemoryRouter>,
  );
}


describe(
  "App routing",
  () => {
    it(
      "shows the splash and application shell on startup",
      () => {
        renderApp(
          "/",
        );

        expect(
          screen.getByTestId(
            "splash-screen",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByTestId(
            "app-shell",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Overview Route",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "removes the splash after completion while keeping the routed workspace",
      async () => {
        const user =
          userEvent.setup();

        renderApp(
          "/",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Complete Splash",
            },
          ),
        );

        expect(
          screen.queryByTestId(
            "splash-screen",
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.getByText(
            "Overview Route",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByTestId(
            "app-shell",
          ),
        ).toBeInTheDocument();
      },
    );


    it.each([
      [
        "/",
        "Overview Route",
      ],

      [
        "/incidents",
        "Incidents Route",
      ],

      [
        "/incidents/INC-001",
        "Incident Detail Route",
      ],

      [
        "/anomalies",
        "Anomalies Route",
      ],

      [
        "/anomalies/EVT-001",
        "Anomaly Detail Route",
      ],

      [
        "/employees",
        "Employees Route",
      ],

      [
        "/employees/EMP-001",
        "Employee Detail Route",
      ],

      [
        "/model",
        "Model Route",
      ],

      [
        "/architecture",
        "Architecture Route",
      ],

      [
        "/simulation",
        "Simulation Route",
      ],
    ])(
      "routes %s to the expected workspace",
      (
        path,
        expectedText,
      ) => {
        renderApp(
          path,
        );

        expect(
          screen.getByText(
            expectedText,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "routes an unknown path to the not-found workspace",
      () => {
        renderApp(
          "/this-route-does-not-exist",
        );

        expect(
          screen.getByText(
            "Not Found Route",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByTestId(
            "app-shell",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
