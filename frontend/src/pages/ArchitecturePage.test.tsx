import {
  act,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  MemoryRouter,
  Route,
  Routes,
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
  getAIServiceStatus,
  getOperationsStatus,
} from "../services/api";

import {
  makeOperationsStatus,
  makeProcessorRuntimeStatus,
} from "../test/fixtures/operations";

import type {
  AIServiceStatus,
} from "../types/ai";

import ArchitecturePage from "./ArchitecturePage";


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

      getAIServiceStatus:
        vi.fn(),

      getOperationsStatus:
        vi.fn(),
    };
  },
);


const mockedGetOperations =
  vi.mocked(
    getOperationsStatus,
  );

const mockedGetAIStatus =
  vi.mocked(
    getAIServiceStatus,
  );


function makeAIStatus(
  overrides:
    Partial<AIServiceStatus> = {},
): AIServiceStatus {
  return {
    enabled:
      true,

    available:
      true,

    provider:
      "ollama",

    model:
      "llama3.2:3b",

    message:
      "Local AI is available.",

    ...overrides,
  };
}


function ModelDestination() {
  return (
    <div>
      Model destination
    </div>
  );
}


function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/architecture",
      ]}
    >
      <Routes>
        <Route
          path="/architecture"
          element={
            <ArchitecturePage />
          }
        />

        <Route
          path="/model"
          element={
            <ModelDestination />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}


beforeEach(
  () => {
    vi.clearAllMocks();

    mockedGetOperations
      .mockResolvedValue(
        makeOperationsStatus(),
      );

    mockedGetAIStatus
      .mockResolvedValue(
        makeAIStatus(),
      );
  },
);


afterEach(
  () => {
    vi.useRealTimers();
  },
);


describe(
  "ArchitecturePage",
  () => {
    it(
      "loads processor and Local AI runtime telemetry",
      async () => {
        renderPage();

        expect(
          screen.getByText(
            "Loading platform architecture",
          ),
        ).toBeInTheDocument();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "SENTINEL Security Intelligence Platform",
            },
          ),
        ).toBeInTheDocument();

        expect(
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mockedGetAIStatus,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          screen.getByText(
            "Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Local AI Available",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders successfully when operations telemetry fails but AI status loads",
      async () => {
        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "operations unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Local AI Available",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Runtime Unknown",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Architecture runtime telemetry is currently unavailable.",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "renders successfully when AI status fails but operations telemetry loads",
      async () => {
        mockedGetAIStatus
          .mockRejectedValueOnce(
            new Error(
              "AI unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Local AI Disabled",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Architecture runtime telemetry is currently unavailable.",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "shows an unavailable warning only when both initial telemetry sources fail",
      async () => {
        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "operations unavailable",
            ),
          );

        mockedGetAIStatus
          .mockRejectedValueOnce(
            new Error(
              "AI unavailable",
            ),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Architecture runtime telemetry is currently unavailable.",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "manually refreshes operations and AI telemetry",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          "Local AI Available",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Refresh Architecture/i,
            },
          ),
        );

        expect(
          mockedGetOperations,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mockedGetAIStatus,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "preserves existing status when both manual refresh sources fail",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          "Local AI Available",
        );

        mockedGetOperations
          .mockRejectedValueOnce(
            new Error(
              "operations refresh failed",
            ),
          );

        mockedGetAIStatus
          .mockRejectedValueOnce(
            new Error(
              "AI refresh failed",
            ),
          );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Refresh Architecture/i,
            },
          ),
        );

        expect(
          await screen.findByText(
            "Live architecture telemetry could not be refreshed. Existing status remains visible.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Operational",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Local AI Available",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "silently refreshes both telemetry sources every ten seconds",
      async () => {
        vi.useFakeTimers();

        renderPage();

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

        expect(
          mockedGetAIStatus,
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

        expect(
          mockedGetAIStatus,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );


    it(
      "shows configured but unavailable Local AI separately from the deterministic core",
      async () => {
        mockedGetAIStatus
          .mockResolvedValue(
            makeAIStatus({
              enabled:
                true,

              available:
                false,

              message:
                "Ollama is configured but not reachable.",
            }),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Local AI Unavailable",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Ollama is configured but not reachable.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Operational",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders processor error, stale and stopped states from runtime health",
      async () => {
        mockedGetOperations
          .mockResolvedValueOnce(
            makeOperationsStatus({
              sentinel:
                makeProcessorRuntimeStatus({
                  operational:
                    false,

                  health:
                    "ERROR",
                }),
            }),
          );

        const {
          unmount,
        } = renderPage();

        expect(
          await screen.findByText(
            "Runtime Error",
          ),
        ).toBeInTheDocument();

        unmount();

        mockedGetOperations
          .mockResolvedValueOnce(
            makeOperationsStatus({
              sentinel:
                makeProcessorRuntimeStatus({
                  operational:
                    false,

                  health:
                    "STALE",
                }),
            }),
          );

        renderPage();

        expect(
          await screen.findByText(
            "Heartbeat Stale",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "navigates from architecture to model intelligence",
      async () => {
        const user =
          userEvent.setup();

        renderPage();

        await screen.findByText(
          "Local AI Available",
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /View Model Intelligence/i,
            },
          ),
        );

        expect(
          screen.getByText(
            "Model destination",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
