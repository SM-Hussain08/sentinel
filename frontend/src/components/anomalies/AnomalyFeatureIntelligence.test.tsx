import {
  render,
  screen,
  within,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  makeMLEventAnalysis,
} from "../../test/fixtures/anomalies";

import AnomalyFeatureSignals from "./AnomalyFeatureSignals";
import AnomalyFeatureSnapshot from "./AnomalyFeatureSnapshot";


describe(
  "anomaly feature intelligence",
  () => {
    it(
      "renders populated behavioral feature signals",
      () => {
        render(
          <AnomalyFeatureSignals
            analysis={
              makeMLEventAnalysis({
                feature_snapshot: {
                  failed_logins_10m:
                    7,

                  events_5m:
                    14,

                  network_events_5m:
                    11,

                  unique_destinations_5m:
                    10,

                  outside_work_hours:
                    1,

                  source_ip_is_baseline:
                    0,

                  file_events_30m:
                    5,

                  data_volume_ratio:
                    2.34567,
                },
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "Feature Signals",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "7",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "14",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "11",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "10",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "YES",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "NO",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "5",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "2.3457",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders safe fallback values when behavioral features are absent",
      () => {
        render(
          <AnomalyFeatureSignals
            analysis={
              makeMLEventAnalysis({
                feature_snapshot: {},
              })
            }
          />,
        );


        expect(
          screen.getAllByText(
            "—",
          ).length,
        ).toBeGreaterThanOrEqual(
          5,
        );

        expect(
          screen.getAllByText(
            "NO",
          ),
        ).toHaveLength(
          2,
        );
      },
    );


    it(
      "formats snapshot feature names and primitive values",
      () => {
        render(
          <AnomalyFeatureSnapshot
            features={{
              boolean_false:
                false,

              boolean_true:
                true,

              decimal_value:
                1.234567,

              integer_value:
                42,

              null_value:
                null,

              string_value:
                "security-value",

              undefined_value:
                undefined,
            }}
          />,
        );


        expect(
          screen.getByText(
            "7",
          ),
        ).toBeInTheDocument();


        const trueCard =
          screen
            .getByTitle(
              "boolean_true",
            )
            .closest(
              "div",
            );

        expect(
          trueCard,
        ).not.toBeNull();

        expect(
          within(
            trueCard!,
          ).getByText(
            "Boolean True",
          ),
        ).toBeInTheDocument();

        expect(
          within(
            trueCard!,
          ).getByText(
            "TRUE",
          ),
        ).toBeInTheDocument();


        const falseCard =
          screen
            .getByTitle(
              "boolean_false",
            )
            .closest(
              "div",
            );

        expect(
          falseCard,
        ).not.toBeNull();

        expect(
          within(
            falseCard!,
          ).getByText(
            "FALSE",
          ),
        ).toBeInTheDocument();


        const integerCard =
          screen
            .getByTitle(
              "integer_value",
            )
            .closest(
              "div",
            );

        expect(
          integerCard,
        ).not.toBeNull();

        expect(
          within(
            integerCard!,
          ).getByText(
            "42",
          ),
        ).toBeInTheDocument();


        const decimalCard =
          screen
            .getByTitle(
              "decimal_value",
            )
            .closest(
              "div",
            );

        expect(
          decimalCard,
        ).not.toBeNull();

        expect(
          within(
            decimalCard!,
          ).getByText(
            "1.2346",
          ),
        ).toBeInTheDocument();


        const stringCard =
          screen
            .getByTitle(
              "string_value",
            )
            .closest(
              "div",
            );

        expect(
          stringCard,
        ).not.toBeNull();

        expect(
          within(
            stringCard!,
          ).getByText(
            "security-value",
          ),
        ).toBeInTheDocument();


        expect(
          screen.getAllByText(
            "—",
          ),
        ).toHaveLength(
          2,
        );
      },
    );


    it(
      "serializes structured snapshot values",
      () => {
        render(
          <AnomalyFeatureSnapshot
            features={{
              object_value: {
                source:
                  "vpn",

                trusted:
                  false,
              },

              array_value: [
                "host-a",
                "host-b",
              ],
            }}
          />,
        );


        expect(
          screen.getByText(
            '{"source":"vpn","trusted":false}',
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            '["host-a","host-b"]',
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "falls back safely when a snapshot value cannot be JSON serialized",
      () => {
        const circular:
          Record<
            string,
            unknown
          > = {};

        circular.self =
          circular;


        render(
          <AnomalyFeatureSnapshot
            features={{
              circular_value:
                circular,
            }}
          />,
        );


        expect(
          screen.getByText(
            "[object Object]",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders an empty feature snapshot without failing",
      () => {
        render(
          <AnomalyFeatureSnapshot
            features={{}}
          />,
        );


        expect(
          screen.getByText(
            "Recorded Feature Snapshot",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);