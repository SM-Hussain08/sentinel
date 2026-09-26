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

import AnomalyQueue from "./AnomalyQueue";

import {
  makeMLAnomaly,
} from "../../test/fixtures/anomalies";


describe(
  "AnomalyQueue",
  () => {
    it(
      "renders an empty anomaly state",
      () => {
        render(
          <AnomalyQueue
            anomalies={[]}
            totalResults={0}
            currentOffset={0}
            hasPrevious={false}
            hasNext={false}
            onOpenAnomaly={vi.fn()}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            "No anomalies found",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Adjust the search or risk-level filter/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            /0–0 of 0/,
          ),
        ).toHaveLength(
          2,
        );
      },
    );


    it(
      "renders anomaly intelligence and the correct result range",
      () => {
        const anomaly =
          makeMLAnomaly();

        render(
          <AnomalyQueue
            anomalies={[
              anomaly,
            ]}
            totalResults={75}
            currentOffset={25}
            hasPrevious
            hasNext
            onOpenAnomaly={vi.fn()}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByText(
            anomaly.event_id,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            anomaly.employee_user_id,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            /26–26 of 75/,
          ).length,
        ).toBeGreaterThan(
          0,
        );
      },
    );


    it(
      "opens the selected anomaly",
      async () => {
        const user =
          userEvent.setup();

        const anomaly =
          makeMLAnomaly();

        const onOpenAnomaly =
          vi.fn();

        render(
          <AnomalyQueue
            anomalies={[
              anomaly,
            ]}
            totalResults={1}
            currentOffset={0}
            hasPrevious={false}
            hasNext={false}
            onOpenAnomaly={
              onOpenAnomaly
            }
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                new RegExp(
                  anomaly.event_id,
                ),
            },
          ),
        );

        expect(
          onOpenAnomaly,
        ).toHaveBeenCalledWith(
          anomaly.event_id,
        );
      },
    );


    it(
      "disables unavailable anomaly pagination",
      () => {
        render(
          <AnomalyQueue
            anomalies={[]}
            totalResults={0}
            currentOffset={0}
            hasPrevious={false}
            hasNext={false}
            onOpenAnomaly={vi.fn()}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
          />,
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Previous/,
            },
          ),
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Next/,
            },
          ),
        ).toBeDisabled();
      },
    );


    it(
      "runs anomaly pagination callbacks when available",
      async () => {
        const user =
          userEvent.setup();

        const onPrevious =
          vi.fn();

        const onNext =
          vi.fn();

        render(
          <AnomalyQueue
            anomalies={[
              makeMLAnomaly(),
            ]}
            totalResults={100}
            currentOffset={50}
            hasPrevious
            hasNext
            onOpenAnomaly={vi.fn()}
            onPrevious={
              onPrevious
            }
            onNext={
              onNext
            }
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Previous/,
            },
          ),
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Next/,
            },
          ),
        );

        expect(
          onPrevious,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onNext,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
