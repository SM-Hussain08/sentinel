import {
  fireEvent,
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

import AnomalyFilters from "./AnomalyFilters";


const riskCounts = {
  ALL: 25,
  CRITICAL: 2,
  HIGH: 4,
  MEDIUM: 6,
  LOW: 13,
};


describe(
  "AnomalyFilters",
  () => {
    it(
      "renders every anomaly risk filter with its count",
      () => {
        render(
          <AnomalyFilters
            riskFilter="ALL"
            searchQuery=""
            riskCounts={riskCounts}
            onRiskChange={vi.fn()}
            onSearchQueryChange={vi.fn()}
            onSearch={vi.fn()}
          />,
        );

        for (
          const label
          of [
            "ALL",
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
          ]
        ) {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  new RegExp(
                    label,
                    "i",
                  ),
              },
            ),
          ).toBeInTheDocument();
        }

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "ALL risk filter",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "CRITICAL risk filter",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "ALL risk filter",
            },
          ),
        ).toHaveTextContent(
          "25",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "CRITICAL risk filter",
            },
          ),
        ).toHaveTextContent(
          "2",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "HIGH risk filter",
            },
          ),
        ).toHaveTextContent(
          "4",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "MEDIUM risk filter",
            },
          ),
        ).toHaveTextContent(
          "6",
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "LOW risk filter",
            },
          ),
        ).toHaveTextContent(
          "13",
        );
      },
    );


    it(
      "calls onRiskChange when a risk filter is selected",
      async () => {
        const user =
          userEvent.setup();

        const onRiskChange =
          vi.fn();

        render(
          <AnomalyFilters
            riskFilter="ALL"
            searchQuery=""
            riskCounts={riskCounts}
            onRiskChange={onRiskChange}
            onSearchQueryChange={vi.fn()}
            onSearch={vi.fn()}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "CRITICAL risk filter",
            },
          ),
        );

        expect(
          onRiskChange,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onRiskChange,
        ).toHaveBeenCalledWith(
          "CRITICAL",
        );
      },
    );


    it(
      "reports changes to the anomaly search query",
      () => {
        const onSearchQueryChange =
          vi.fn();

        render(
          <AnomalyFilters
            riskFilter="ALL"
            searchQuery=""
            riskCounts={riskCounts}
            onRiskChange={vi.fn()}
            onSearchQueryChange={
              onSearchQueryChange
            }
            onSearch={vi.fn()}
          />,
        );

        fireEvent.change(
          screen.getByPlaceholderText(
            "Search all anomalies...",
          ),
          {
            target: {
              value:
                "EMP-001",
            },
          },
        );

        expect(
          onSearchQueryChange,
        ).toHaveBeenCalledWith(
          "EMP-001",
        );
      },
    );


    it(
      "runs a search when the Search button is clicked",
      async () => {
        const user =
          userEvent.setup();

        const onSearch =
          vi.fn();

        render(
          <AnomalyFilters
            riskFilter="HIGH"
            searchQuery="EMP-001"
            riskCounts={riskCounts}
            onRiskChange={vi.fn()}
            onSearchQueryChange={vi.fn()}
            onSearch={onSearch}
          />,
        );

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Search",
            },
          ),
        );

        expect(
          onSearch,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "runs a search when Enter is pressed in the search field",
      async () => {
        const user =
          userEvent.setup();

        const onSearch =
          vi.fn();

        render(
          <AnomalyFilters
            riskFilter="ALL"
            searchQuery="EVT-001"
            riskCounts={riskCounts}
            onRiskChange={vi.fn()}
            onSearchQueryChange={vi.fn()}
            onSearch={onSearch}
          />,
        );

        const searchInput =
          screen.getByPlaceholderText(
            "Search all anomalies...",
          );

        searchInput.focus();

        await user.keyboard(
          "{Enter}",
        );

        expect(
          onSearch,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "does not run a search for ordinary key presses",
      () => {
        const onSearch =
          vi.fn();

        render(
          <AnomalyFilters
            riskFilter="ALL"
            searchQuery=""
            riskCounts={riskCounts}
            onRiskChange={vi.fn()}
            onSearchQueryChange={vi.fn()}
            onSearch={onSearch}
          />,
        );

        fireEvent.keyDown(
          screen.getByPlaceholderText(
            "Search all anomalies...",
          ),
          {
            key:
              "Escape",
          },
        );

        expect(
          onSearch,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
