import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import OverviewMetricCard from "./OverviewMetricCard";


describe(
  "OverviewMetricCard",
  () => {
    it(
      "renders metric content using the default tone",
      () => {
        render(
          <OverviewMetricCard
            eyebrow="Operations"
            value="126"
            label="Analyzed Events"
            helper="Events processed by SENTINEL"
          />,
        );


        expect(
          screen.getByText(
            "Operations",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "126",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Analyzed Events",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Events processed by SENTINEL",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the critical tone",
      () => {
        render(
          <OverviewMetricCard
            eyebrow="Threats"
            value="3"
            label="Critical Incidents"
            helper="Highest-priority investigations"
            tone="critical"
          />,
        );


        expect(
          screen.getByText(
            "3",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Critical Incidents",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the cyan tone",
      () => {
        render(
          <OverviewMetricCard
            eyebrow="Detection"
            value="95.5%"
            label="ML Recall"
            helper="Controlled benchmark recall"
            tone="cyan"
          />,
        );


        expect(
          screen.getByText(
            "95.5%",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "ML Recall",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);