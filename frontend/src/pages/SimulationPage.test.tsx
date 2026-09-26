import {
  act,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

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
} from "../services/api";

import {
  makeOperationsStatus,
  makeProcessorRuntimeStatus,
  makeSimulationRuntimeStatus,
} from "../test/fixtures/operations";

import SimulationPage from "./SimulationPage";


vi.mock(
  "../services/api",
  async (
    importOriginal,
  ) => {
    const actual =
      await importOriginal<
        typeof import(
          "../services/api"
        )
      >();

    return {
      ...actual,

      getOperationsStatus:
        vi.fn(),
    };
  },
);


const mockedGetOperations =
  vi.mocked(
    getOperationsStatus,
  );


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetOperations
      .mockResolvedValue(
        makeOperationsStatus(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "SimulationPage",
  () => {
    it(
      "loads operational and simulation runtime telemetry",
      async () => {
        render(
          <SimulationPage />,
        );

        expect(
          screen.getByText(
            "Loading runtime telemetry",
          ),
        ).toBeInTheDocument();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Synthetic Enterprise Simulator",
            },
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          screen.getByText(
            "SENTINEL Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Simulator Offline",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows an initial runtime telemetry failure",
      async () => {
        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "runtime unavailable",
            ),
          );

        render(
          <SimulationPage />,
        );

        expect(
          await screen.findByText(
            /Runtime telemetry could not be loaded\./,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Existing telemetry remains visible while SENTINEL retries automatically\./,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "manually refreshes runtime telemetry",
      async () => {
        const user =
          userEvent.setup();

        render(
          <SimulationPage />,
        );

        await screen.findByText(
          "Simulator Offline",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Refresh Runtime/i,
            },
          )
        );

        expect(
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "preserves existing telemetry when manual refresh fails",
      async () => {
        const user =
          userEvent.setup();

        render(
          <SimulationPage />,
        );

        await screen.findByText(
          "Simulator Offline",
        );

        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "refresh unavailable",
            ),
          );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Refresh Runtime/i,
            },
          )
        );

        expect(
          await screen.findByText(
            /Runtime telemetry could not be refreshed\./,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Simulator Offline",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SENTINEL Operational",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes runtime telemetry every ten seconds",
      async () => {
        vi.useFakeTimers();

        render(
          <SimulationPage />,
        );

        await act(
          async () => {
            await Promise.resolve();
            await Promise.resolve();
          },
        );

        expect(
          mockedGetOperations,
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
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "shows online simulator state for a healthy running simulation",
      async () => {
        mockedGetOperations
          .mockResolvedValue(
            makeOperationsStatus({
              simulation:
                makeSimulationRuntimeStatus({
                  running:
                    true,

                  health:
                    "HEALTHY",

                  status:
                    "running",

                  stopped_at:
                    null,
                }),
            }),
          );

        render(
          <SimulationPage />,
        );

        expect(
          await screen.findByText(
            "Simulator Online",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Live Run",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows simulator error state when runtime health reports an error",
      async () => {
        mockedGetOperations
          .mockResolvedValue(
            makeOperationsStatus({
              simulation:
                makeSimulationRuntimeStatus({
                  running:
                    false,

                  health:
                    "ERROR",

                  status:
                    "failed",
                }),
            }),
          );

        render(
          <SimulationPage />,
        );

        expect(
          await screen.findByText(
            "Simulator Error",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Attention",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows stale processor and simulator runtime states",
      async () => {
        mockedGetOperations
          .mockResolvedValue(
            makeOperationsStatus({
              sentinel:
                makeProcessorRuntimeStatus({
                  operational:
                    false,

                  health:
                    "STALE",
                }),

              simulation:
                makeSimulationRuntimeStatus({
                  running:
                    false,

                  health:
                    "STALE",
                }),
            }),
          );

        render(
          <SimulationPage />,
        );

        expect(
          await screen.findByText(
            "Simulator Stale",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Heartbeat Delayed",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SENTINEL STALE",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
