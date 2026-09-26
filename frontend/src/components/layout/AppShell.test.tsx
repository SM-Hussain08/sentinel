import {
  act,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getOperationsStatus,
} from "../../services/api";

import {
  makeOperationsStatus,
  makeProcessorRuntimeStatus,
} from "../../test/fixtures/operations";

import AppShell from "./AppShell";


vi.mock(
  "../../services/api",
  async (
    importOriginal,
  ) => {
    const actual =
      await importOriginal<
        typeof import(
          "../../services/api"
        )
      >();

    return {
      ...actual,

      getOperationsStatus:
        vi.fn(),
    };
  },
);


const mockedGetOperationsStatus =
  vi.mocked(
    getOperationsStatus,
  );


function RouteProbe() {
  const location =
    useLocation();

  return (
    <div data-testid="route-probe">
      {location.pathname}
    </div>
  );
}


function renderShell(
  path = "/",
) {
  return render(
    <MemoryRouter
      initialEntries={[
        path,
      ]}
    >
      <AppShell>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <RouteProbe />

                <div>
                  Workspace Content
                </div>
              </>
            }
          />
        </Routes>
      </AppShell>
    </MemoryRouter>,
  );
}


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetOperationsStatus
      .mockResolvedValue(
        makeOperationsStatus(),
      );
  },
);


describe(
  "AppShell navigation",
  () => {
    it(
      "renders all primary workspace destinations",
      async () => {
        renderShell();

        await waitFor(
          () => {
            expect(
              mockedGetOperationsStatus,
            ).toHaveBeenCalledTimes(
              1,
            );
          },
        );

        expect(
          screen.getByText(
            "Workspace Content",
          ),
        ).toBeInTheDocument();

        for (
          const label of [
            "Overview",
            "Incidents",
            "Anomalies",
            "Employees",
            "Model",
            "Architecture",
            "Simulation",
          ]
        ) {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  new RegExp(
                    label,
                    "i",
                  ),
              },
            ),
          ).toBeInTheDocument();
        }
      },
    );


    it.each([
      [
        "Incidents",
        "/incidents",
      ],

      [
        "Anomalies",
        "/anomalies",
      ],

      [
        "Employees",
        "/employees",
      ],

      [
        "Model",
        "/model",
      ],

      [
        "Architecture",
        "/architecture",
      ],

      [
        "Simulation",
        "/simulation",
      ],
    ])(
      "navigates to %s",
      async (
        label,
        destination,
      ) => {
        const user =
          userEvent.setup();

        renderShell();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  label,
                  "i",
                ),
            },
          ),
        );

        expect(
          screen.getByTestId(
            "route-probe",
          ),
        ).toHaveTextContent(
          destination,
        );
      },
    );


    it(
      "navigates back to Overview",
      async () => {
        const user =
          userEvent.setup();

        renderShell(
          "/incidents",
        );

        expect(
          screen.getByTestId(
            "route-probe",
          ),
        ).toHaveTextContent(
          "/incidents",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Overview/i,
            },
          ),
        );

        expect(
          screen.getByTestId(
            "route-probe",
          ),
        ).toHaveTextContent(
          "/",
        );
      },
    );


    it(
      "treats incident detail routes as part of the Incidents workspace",
      () => {
        renderShell(
          "/incidents/INC-001",
        );

        const incidentsButton =
          screen.getByRole(
            "button",
            {
              name:
                /Incidents/i,
            },
          );

        expect(
          incidentsButton.className,
        ).toContain(
          "bg-cyan-950/30",
        );
      },
    );


    it(
      "treats anomaly detail routes as part of the Anomalies workspace",
      () => {
        renderShell(
          "/anomalies/EVT-001",
        );

        const anomaliesButton =
          screen.getByRole(
            "button",
            {
              name:
                /Anomalies/i,
            },
          );

        expect(
          anomaliesButton.className,
        ).toContain(
          "bg-cyan-950/30",
        );
      },
    );


    it(
      "treats employee detail routes as part of the Employees workspace",
      () => {
        renderShell(
          "/employees/EMP-001",
        );

        const employeesButton =
          screen.getByRole(
            "button",
            {
              name:
                /Employees/i,
            },
          );

        expect(
          employeesButton.className,
        ).toContain(
          "bg-cyan-950/30",
        );
      },
    );


    it(
      "collapses and expands the desktop sidebar",
      async () => {
        const user =
          userEvent.setup();

        renderShell();

        const collapseButton =
          screen.getByRole(
            "button",
            {
              name:
                "Collapse sidebar",
            },
          );

        await user.click(
          collapseButton,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Expand sidebar",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Security operations",
          ),
        ).not.toBeInTheDocument();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Expand sidebar",
            },
          ),
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Collapse sidebar",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Security operations",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens and closes the mobile navigation drawer",
      async () => {
        const user =
          userEvent.setup();

        renderShell();

        const toggle =
          screen.getByRole(
            "button",
            {
              name:
                "Toggle navigation",
            },
          );

        expect(
          screen.getAllByText(
            "Workspace",
          ),
        ).toHaveLength(
          1,
        );

        await user.click(
          toggle,
        );

        expect(
          screen.getAllByText(
            "Workspace",
          ),
        ).toHaveLength(
          2,
        );

        await user.click(
          toggle,
        );

        expect(
          screen.getAllByText(
            "Workspace",
          ),
        ).toHaveLength(
          1,
        );
      },
    );


    it(
      "closes the mobile drawer after navigating",
      async () => {
        const user =
          userEvent.setup();

        renderShell();

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Toggle navigation",
            },
          ),
        );

        expect(
          screen.getAllByText(
            "Workspace",
          ),
        ).toHaveLength(
          2,
        );

        const incidentsButtons =
          screen.getAllByRole(
            "button",
            {
              name:
                /Incidents/i,
            },
          );

        await user.click(
          incidentsButtons[
            incidentsButtons.length
              - 1
          ],
        );

        expect(
          screen.getByTestId(
            "route-probe",
          ),
        ).toHaveTextContent(
          "/incidents",
        );

        expect(
          screen.getAllByText(
            "Workspace",
          ),
        ).toHaveLength(
          1,
        );
      },
    );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


it(
  "does not mark Overview active for an unknown route",
  () => {
    renderShell(
      "/not-a-real-workspace",
    );

    const overviewButton =
      screen.getByRole(
        "button",
        {
          name:
            /Overview/i,
        },
      );

    expect(
      overviewButton.className,
    ).not.toContain(
      "bg-cyan-950/30",
    );
  },
);


describe(
  "AppShell accessibility",
  () => {
    it(
      "marks the active workspace as the current page",
      () => {
        renderShell(
          "/incidents/INC-001",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Incidents/i,
            },
          ),
        ).toHaveAttribute(
          "aria-current",
          "page",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Overview/i,
            },
          ),
        ).not.toHaveAttribute(
          "aria-current",
        );
      },
    );


    it(
      "does not expose a current workspace on an unknown route",
      () => {
        renderShell(
          "/not-a-real-workspace",
        );

        const currentButtons =
          screen.queryAllByRole(
            "button",
            {
              current:
                "page",
            },
          );

        expect(
          currentButtons,
        ).toHaveLength(
          0,
        );
      },
    );


    it(
      "exposes mobile navigation expanded state and controlled drawer",
      async () => {
        const user =
          userEvent.setup();

        renderShell();

        const toggle =
          screen.getByRole(
            "button",
            {
              name:
                "Toggle navigation",
            },
          );

        toggle.focus();

        expect(
          toggle,
        ).toHaveFocus();

        expect(
          toggle,
        ).toHaveAttribute(
          "aria-expanded",
          "false",
        );

        expect(
          toggle,
        ).toHaveAttribute(
          "aria-controls",
          "sentinel-mobile-navigation",
        );

        await user.click(
          toggle,
        );

        expect(
          toggle,
        ).toHaveAttribute(
          "aria-expanded",
          "true",
        );

        expect(
          document.getElementById(
            "sentinel-mobile-navigation",
          ),
        ).not.toBeNull();

        await user.click(
          toggle,
        );

        expect(
          toggle,
        ).toHaveAttribute(
          "aria-expanded",
          "false",
        );

        toggle.focus();

        await user.keyboard(
          "{Enter}",
        );

        expect(
          toggle,
        ).toHaveAttribute(
          "aria-expanded",
          "true",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Toggle navigation",
            },
          ),
        ).toHaveFocus();
      },
    );
  },
);


describe(
  "AppShell runtime status",
  () => {
    it(
      "shows an operational system when the processor is healthy",
      async () => {
        renderShell();

        expect(
          await screen.findByText(
            "Systems Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Detection, correlation, and investigation engines online.",
          ),
        ).toBeInTheDocument();
      },
    );


    it.each([
      [
        "ERROR",
        false,
        "System Error",
        "Operational processing has reported a runtime failure.",
      ],

      [
        "STALE",
        false,
        "System Stale",
        "Processor heartbeat is outside the expected runtime window.",
      ],

      [
        "STOPPED",
        false,
        "System Stopped",
        "The SENTINEL operational event processor is not running.",
      ],

      [
        "UNKNOWN",
        false,
        "Status Unknown",
        "Operational processor status is currently unavailable.",
      ],
    ] as const)(
      "renders %s processor health correctly",
      async (
        health,
        operational,
        expectedLabel,
        expectedDescription,
      ) => {
        mockedGetOperationsStatus
          .mockResolvedValue(
            makeOperationsStatus({
              sentinel:
                makeProcessorRuntimeStatus({
                  health,
                  operational,
                }),
            }),
          );

        renderShell();

        expect(
          await screen.findByText(
            expectedLabel,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            expectedDescription,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows unknown status when the initial operations request fails",
      async () => {
        mockedGetOperationsStatus
          .mockRejectedValueOnce(
            new Error(
              "operations unavailable",
            ),
          );

        renderShell();

        expect(
          await screen.findByText(
            "Status Unknown",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Operational processor status is currently unavailable.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "refreshes processor status every ten seconds",
      async () => {
        vi.useFakeTimers();

        mockedGetOperationsStatus
          .mockResolvedValueOnce(
            makeOperationsStatus(),
          )
          .mockResolvedValueOnce(
            makeOperationsStatus({
              sentinel:
                makeProcessorRuntimeStatus({
                  health:
                    "STALE",

                  operational:
                    false,
                }),
            }),
          );

        renderShell();

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        expect(
          screen.getByText(
            "Systems Operational",
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetOperationsStatus,
        ).toHaveBeenCalledTimes(
          1,
        );

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              10_000,
            );
          },
        );

        expect(
          mockedGetOperationsStatus,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          screen.getByText(
            "System Stale",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "preserves the last known processor state when a background poll fails",
      async () => {
        vi.useFakeTimers();

        mockedGetOperationsStatus
          .mockResolvedValueOnce(
            makeOperationsStatus(),
          )
          .mockRejectedValueOnce(
            new Error(
              "temporary polling failure",
            ),
          );

        renderShell();

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        expect(
          screen.getByText(
            "Systems Operational",
          ),
        ).toBeInTheDocument();

        await act(
          async () => {
            await vi.advanceTimersByTimeAsync(
              10_000,
            );
          },
        );

        expect(
          mockedGetOperationsStatus,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          screen.getByText(
            "Systems Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Status Unknown",
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);