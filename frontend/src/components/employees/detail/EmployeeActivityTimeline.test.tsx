import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  EmployeeActivityItem,
} from "../../../types/api";

import {
  makeEmployeeActivityPage,
} from "../../../test/fixtures/employees";

import EmployeeActivityTimeline from "./EmployeeActivityTimeline";


function makeActivityItem(
  overrides:
    Partial<EmployeeActivityItem> = {},
): EmployeeActivityItem {
  const base =
    makeEmployeeActivityPage()
      .items[0];

  return {
    ...base,
    ...overrides,
  };
}


describe(
  "EmployeeActivityTimeline",
  () => {
    it(
      "renders the empty activity state",
      () => {
        render(
          <EmployeeActivityTimeline
            activity={[]}
            totalActivity={0}
            onOpenAnomaly={vi.fn()}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Recent Security Activity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0 of 0",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /No employee activity is currently available/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders populated activity with resource and transfer context",
      () => {
        render(
          <EmployeeActivityTimeline
            activity={[
              makeActivityItem(),
            ]}
            totalActivity={1}
            onOpenAnomaly={vi.fn()}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "1 of 1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "EVT-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Login Failure",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "VPN Gateway",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "203.0.113.25",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Unknown",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "↑ 128 B",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "↓ 64 B",
          ),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Critical",
            ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "INC-001",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "opens anomaly and linked incident intelligence",
      () => {
        const onOpenAnomaly =
          vi.fn();

        const onOpenIncident =
          vi.fn();


        render(
          <EmployeeActivityTimeline
            activity={[
              makeActivityItem(),
            ]}
            totalActivity={1}
            onOpenAnomaly={
              onOpenAnomaly
            }
            onOpenIncident={
              onOpenIncident
            }
          />,
        );


        fireEvent.click(
            screen.getByRole(
                "button",
                {
                name:
                    "Critical",
                },
            ),
        );


        expect(
          onOpenAnomaly,
        ).toHaveBeenCalledWith(
          "EVT-001",
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "INC-001",
            },
          ),
        );


        expect(
          onOpenIncident,
        ).toHaveBeenCalledWith(
          "INC-001",
        );
      },
    );


    it(
      "falls back through resource and location context safely",
      () => {
        render(
          <EmployeeActivityTimeline
            activity={[
              makeActivityItem({
                event_id:
                  "EVT-FALLBACK-1",

                resource_name:
                  null,

                resource_type:
                  "database",

                source_location:
                  null,
              }),

              makeActivityItem({
                event_id:
                  "EVT-FALLBACK-2",

                resource_name:
                  null,

                resource_type:
                  null,

                source_location:
                  null,
              }),
            ]}
            totalActivity={2}
            onOpenAnomaly={vi.fn()}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "database",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "No resource context",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "Unknown location",
          ),
        ).toHaveLength(
          2,
        );
      },
    );


    it(
      "shows only the first two linked incident shortcuts",
      () => {
        render(
          <EmployeeActivityTimeline
            activity={[
              makeActivityItem({
                linked_incident_ids: [
                  "INC-001",
                  "INC-002",
                  "INC-003",
                ],
              }),
            ]}
            totalActivity={1}
            onOpenAnomaly={vi.fn()}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "INC-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "INC-002",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "INC-003",
          ),
        ).not.toBeInTheDocument();
      },
    );


    it(
      "renders a plain observed event when no risk or incident linkage exists",
      () => {
        render(
          <EmployeeActivityTimeline
            activity={[
              makeActivityItem({
                event_id:
                  "EVT-NORMAL-001",

                risk_level:
                  null,

                anomaly_score:
                  null,

                detector_name:
                  null,

                detector_version:
                  null,

                linked_incident_ids:
                  [],
              }),
            ]}
            totalActivity={1}
            onOpenAnomaly={vi.fn()}
            onOpenIncident={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Observed",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                /NORMAL|LOW|MEDIUM|HIGH|CRITICAL/i,
            },
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);