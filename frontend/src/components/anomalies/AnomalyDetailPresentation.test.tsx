import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  makeMLEventAnalysis,
  makeMLModelInfo,
} from "../../test/fixtures/anomalies";

import AnomalyDetailHero from "./AnomalyDetailHero";
import AnomalyDetailKpiCard from "./AnomalyDetailKpiCard";
import AnomalyDetectorContext from "./AnomalyDetectorContext";
import AnomalyExplanation from "./AnomalyExplanation";
import AnomalyStatCard from "./AnomalyStatCard";


describe(
  "anomaly detail presentation",
  () => {
    it(
      "renders core anomaly identity, percentile and configured threshold",
      () => {
        render(
          <AnomalyDetailHero
            analysis={
              makeMLEventAnalysis()
            }
            model={
              makeMLModelInfo()
            }
          />,
        );


        expect(
          screen.getByText(
            "EVT-ANOM-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "EMP-001",
            {
              exact:
                false,
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "CRITICAL",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "98.2%",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /threshold\s+95%/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /not an attack probability/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "falls back to the default 99 percent threshold when model metadata is unavailable",
      () => {
        render(
          <AnomalyDetailHero
            analysis={
              makeMLEventAnalysis()
            }
            model={
              null
            }
          />,
        );


        expect(
          screen.getByText(
            /threshold\s+99%/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders anomaly KPI and stat cards across their tone variants",
      () => {
        const {
          rerender,
        } = render(
          <AnomalyDetailKpiCard
            eyebrow="Detection Rank"
            value="98.2%"
            label="Historical anomaly percentile"
            tone="critical"
          />,
        );


        expect(
          screen.getByText(
            "Detection Rank",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "98.2%",
          ),
        ).toHaveAttribute(
          "title",
          "98.2%",
        );


        rerender(
          <AnomalyDetailKpiCard
            eyebrow="Detector"
            value="Isolation Forest"
            label="Selected model"
            tone="cyan"
          />,
        );


        expect(
          screen.getByText(
            "Isolation Forest",
          ),
        ).toBeInTheDocument();


        rerender(
          <AnomalyDetailKpiCard
            eyebrow="Recorded Features"
            value="17"
            label="Model inputs"
          />,
        );


        expect(
          screen.getByText(
            "17",
          ),
        ).toBeInTheDocument();


        rerender(
          <AnomalyStatCard
            eyebrow="Risk"
            value="CRITICAL"
            label="Current classification"
            tone="critical"
          />,
        );


        expect(
          screen.getByText(
            "CRITICAL",
          ),
        ).toBeInTheDocument();


        rerender(
          <AnomalyStatCard
            eyebrow="Events"
            value="42"
            label="Related observations"
            tone="cyan"
          />,
        );


        expect(
          screen.getByText(
            "42",
          ),
        ).toBeInTheDocument();


        rerender(
          <AnomalyStatCard
            eyebrow="Version"
            value="1.2"
            label="Detector lineage"
          />,
        );


        expect(
          screen.getByText(
            "1.2",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders detector lineage, raw score and recorded feature count",
      () => {
        render(
          <AnomalyDetectorContext
            analysis={
              makeMLEventAnalysis({
                feature_snapshot: {
                  failed_logins_10m:
                    7,

                  outside_work_hours:
                    1,

                  events_5m:
                    12,
                },
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "Isolation Forest Analysis",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "v1.2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "-0.184000",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "3",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "isolation-forest",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the explicit explanation and reached-threshold decision",
      () => {
        render(
          <AnomalyExplanation
            analysis={
              makeMLEventAnalysis()
            }
          />,
        );


        expect(
          screen.getByText(
            "ALERT THRESHOLD REACHED",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Historical percentile-based anomaly score.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /crossed the configured critical alert boundary/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Recorded threshold:\s*0.95/i,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "uses safe interpretation fallbacks when optional explanation fields are absent",
      () => {
        const base =
          makeMLEventAnalysis();


        render(
          <AnomalyExplanation
            analysis={
              makeMLEventAnalysis({
                alert_threshold_reached:
                  false,

                explanation: {
                  ...base.explanation,

                  score_interpretation:
                    undefined,

                  alert_threshold:
                    undefined,

                  alert_threshold_reached:
                    undefined,
                },
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "BELOW ALERT THRESHOLD",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /historical percentile relative to the learned normal baseline/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /did not cross the configured critical alert boundary/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /Recorded threshold:/i,
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);