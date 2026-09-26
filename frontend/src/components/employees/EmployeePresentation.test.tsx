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

import EmployeeKpiCard from "./EmployeeKpiCard";
import EmployeeKpiGrid from "./EmployeeKpiGrid";
import EmployeePageHeader from "./EmployeePageHeader";

import {
  makeEmployeeWorkforceSummary,
} from "../../test/fixtures/employees";


describe(
  "employee presentation components",
  () => {
    it(
      "renders an employee KPI card",
      () => {
        render(
          <EmployeeKpiCard
            label="Critical Exposure"
            value={12}
            description="Critical employee identities"
            accent="red"
          />,
        );


        expect(
          screen.getByText(
            "Critical Exposure",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "12",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Critical employee identities",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders all workforce KPI metrics",
      () => {
        render(
          <EmployeeKpiGrid
            summary={
              makeEmployeeWorkforceSummary({
                total_employees:
                  1_250,

                scored_employees:
                  1_100,

                critical_risk_employees:
                  8,

                employees_with_open_incidents:
                  14,

                elevated_anomaly_count:
                  57,
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "Workforce",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1,250",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1,100 identities currently have selected-model security scoring.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Critical Exposure",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "8",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Active Cases",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "14",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Behavioral Signals",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "57",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the employee page header and refresh label",
      () => {
        render(
          <EmployeePageHeader
            refreshLabel="Refreshed 30s ago"
            isRefreshing={false}
            onRefresh={vi.fn()}
          />,
        );


        expect(
          screen.getByText(
            "Identity Intelligence",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Employee Security",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Refreshed 30s ago",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Employees",
            },
          ),
        ).toBeEnabled();
      },
    );


    it(
      "calls the employee refresh handler",
      async () => {
        const user =
          userEvent.setup();

        const onRefresh =
          vi.fn();


        render(
          <EmployeePageHeader
            refreshLabel="Refreshed just now"
            isRefreshing={false}
            onRefresh={onRefresh}
          />,
        );


        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh Employees",
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
      "disables employee refresh while refreshing",
      () => {
        render(
          <EmployeePageHeader
            refreshLabel="Refreshed just now"
            isRefreshing
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
  },
);