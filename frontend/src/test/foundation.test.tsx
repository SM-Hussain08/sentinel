import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";


function FoundationProbe() {
  return (
    <main>
      <h1>
        SENTINEL
      </h1>

      <p>
        Frontend test environment operational.
      </p>
    </main>
  );
}


describe(
  "frontend test foundation",
  () => {
    it(
      "renders React components in jsdom",
      () => {
        render(
          <FoundationProbe />,
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name: "SENTINEL",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Frontend test environment operational.",
          ),
        ).toBeInTheDocument();
      },
    );
  },
);
