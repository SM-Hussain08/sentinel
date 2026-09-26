import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import OverviewRefreshControls from "./OverviewRefreshControls";

import {
  makeProcessorRuntimeStatus,
} from "../../test/fixtures/operations";


const CURRENT_TIME_MS =
  Date.parse(
    "2026-09-23T12:00:00Z",
  );


function makeHealthyProcessor() {
  return makeProcessorRuntimeStatus({
    operational:
      true,

    health:
      "HEALTHY",

    last_heartbeat_at:
      "2026-09-23T11:59:59Z",
  });
}


describe(
  "OverviewRefreshControls",
  () => {
    it(
      "renders the operational system state",
      () => {
        render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "SYSTEM OPERATIONAL",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Intelligence",
            },
          ),
        ).toBeEnabled();
      },
    );


    it(
      "calls the manual refresh handler",
      async () => {
        const user =
          userEvent.setup();

        const onRefresh =
          vi.fn();

        render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
              - 4_000
            }
            refreshAgeSeconds={4}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={onRefresh}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Intelligence",
            },
          ),
        );

        expect(
          onRefresh,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "disables manual refresh while intelligence is refreshing",
      () => {
        render(
          <OverviewRefreshControls
            isRefreshing
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Refreshing...",
            },
          ),
        ).toBeDisabled();
      },
    );


    it(
      "renders a not-yet-refreshed state",
      () => {
        render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={null}
            refreshAgeSeconds={0}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "Waiting for refresh",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "marks the controls busy during a background refresh",
      () => {
        const {
          container,
        } = render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          container.firstElementChild,
        ).toHaveAttribute(
          "aria-busy",
          "true",
        );
      },
    );


    it(
      "shows unknown status when processor status is unavailable",
      () => {
        render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={null}
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "STATUS UNKNOWN",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "shows heartbeat information for a non-operational processor",
      () => {
        const processor =
          makeProcessorRuntimeStatus({
            operational:
              false,

            health:
              "STALE",

            last_heartbeat_at:
              "2026-09-23T11:59:30Z",
          });

        render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              processor
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "SYSTEM STALE",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Last heartbeat 30s ago",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "formats refresh age across seconds minutes and older refreshes",
      () => {
        const {
          rerender,
        } = render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
              - 30_000
            }
            refreshAgeSeconds={30}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Refreshed 30s ago",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
              - 60_000
            }
            refreshAgeSeconds={60}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Refreshed 1 min ago",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
              - 120_000
            }
            refreshAgeSeconds={120}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Refreshed 2 mins ago",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
              - 7_200_000
            }
            refreshAgeSeconds={7200}
            processorStatus={
              makeHealthyProcessor()
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            /^Last refreshed at /,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "handles unavailable and limited heartbeat timestamps",
      () => {
        const {
          rerender,
        } = render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  null,
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat unavailable",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "not-a-date",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat unavailable",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "2026-09-23T11:59:59Z",
              })
            }
            currentTimeMs={0}
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat available",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "formats heartbeat age across current minute and older states",
      () => {
        const {
          rerender,
        } = render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "2026-09-23T11:59:58Z",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat just now",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "2026-09-23T11:59:00Z",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat 1 min ago",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "2026-09-23T11:58:00Z",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Last heartbeat 2 mins ago",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STALE",

                last_heartbeat_at:
                  "2026-09-23T10:00:00Z",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            /^Last heartbeat at /,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the remaining processor health presentations",
      () => {
        const {
          rerender,
        } = render(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "ERROR",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "SYSTEM ERROR",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "STOPPED",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "SYSTEM STOPPED",
          ),
        ).toBeInTheDocument();


        rerender(
          <OverviewRefreshControls
            isRefreshing={false}
            isBackgroundRefreshing={false}
            lastRefreshedAt={
              CURRENT_TIME_MS
            }
            refreshAgeSeconds={0}
            processorStatus={
              makeProcessorRuntimeStatus({
                operational:
                  false,

                health:
                  "HEALTHY",
              })
            }
            currentTimeMs={
              CURRENT_TIME_MS
            }
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "STATUS UNKNOWN",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
