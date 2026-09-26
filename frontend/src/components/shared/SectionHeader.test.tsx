import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import SectionHeader from "./SectionHeader";


describe(
  "SectionHeader",
  () => {
    it(
      "renders eyebrow and title",
      () => {
        render(
          <SectionHeader
            eyebrow="Reconstruction"
            title="Incident Timeline"
          />,
        );

        expect(
          screen.getByText(
            "Reconstruction",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Incident Timeline",
            },
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders helper text when provided",
      () => {
        render(
          <SectionHeader
            eyebrow="Reconstruction"
            title="Incident Timeline"
            helper="4 correlated events"
          />,
        );

        expect(
          screen.getByText(
            "4 correlated events",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "omits helper content when it is not provided",
      () => {
        const {
          container,
        } = render(
          <SectionHeader
            eyebrow="Analysis"
            title="Investigation"
          />,
        );

        expect(
          screen.queryByText(
            "4 correlated events",
          ),
        ).not.toBeInTheDocument();

        expect(
          container.querySelectorAll(
            "p",
          ),
        ).toHaveLength(
          1,
        );
      },
    );
  },
);
