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

import {
  makeEmployeeDetail,
  makeEmployeeSecuritySummary,
} from "../../../test/fixtures/employees";

import EmployeeBehaviorBaseline from "./EmployeeBehaviorBaseline";
import EmployeeDetailHeader from "./EmployeeDetailHeader";
import EmployeeDetailHero from "./EmployeeDetailHero";
import EmployeeSecuritySummary from "./EmployeeSecuritySummary";


describe(
  "employee detail presentation",
  () => {
    it(
      "renders header state and invokes back and refresh actions",
      () => {
        const onBack =
          vi.fn();

        const onRefresh =
          vi.fn();


        render(
          <EmployeeDetailHeader
            refreshLabel="Refreshed just now"
            isRefreshing={false}
            onBack={onBack}
            onRefresh={onRefresh}
          />,
        );


        expect(
          screen.getByText(
            "Employee Investigation",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Refreshed just now",
          ),
        ).toBeInTheDocument();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /Back to Employees/i,
            },
          ),
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /Refresh Employee/i,
            },
          ),
        );


        expect(
          onBack,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          onRefresh,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      "disables refresh while employee intelligence is refreshing",
      () => {
        render(
          <EmployeeDetailHeader
            refreshLabel="Refreshing employee"
            isRefreshing
            onBack={vi.fn()}
            onRefresh={vi.fn()}
          />,
        );


        const refreshButton =
          screen.getByRole(
            "button",
            {
              name:
                /Refreshing/i,
            },
          );


        expect(
          refreshButton,
        ).toBeDisabled();

        expect(
          screen.getByText(
            "Refreshing employee",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders active employee identity and security context",
      () => {
        render(
          <EmployeeDetailHero
            employee={
              makeEmployeeDetail()
            }
          />,
        );


        expect(
          screen.getByText(
            "AK",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Aisha Khan",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "EMP-001",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Financial Analyst",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Finance",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Active Identity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Karachi HQ",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "0.9820",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders inactive identity and missing-score fallback safely",
      () => {
        const base =
          makeEmployeeDetail();


        render(
          <EmployeeDetailHero
            employee={
              makeEmployeeDetail({
                is_active:
                  false,

                security: {
                  ...base.security,

                  highest_anomaly_score:
                    null,

                  highest_risk_level:
                    "NORMAL",

                  last_activity_at:
                    null,
                },
              })
            }
          />,
        );


        expect(
          screen.getByText(
            "Inactive Identity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "—",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "No activity",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Normal",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders the established behavioral baseline",
      () => {
        const employee =
          makeEmployeeDetail();


        render(
          <EmployeeBehaviorBaseline
            baseline={
              employee.baseline
            }
          />,
        );


        expect(
          screen.getByText(
            "Expected Baseline",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "09:00 – 17:00",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "10.10.1.25",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Karachi HQ",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "8 expected logins",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "14 typical files",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "2.5 MB",
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders all employee security summary metrics",
      () => {
        render(
          <EmployeeSecuritySummary
            security={
              makeEmployeeSecuritySummary()
            }
          />,
        );


        expect(
          screen.getByText(
            "Identity Risk Summary",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "120",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /116 events scored by the selected detector/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "8",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /4 medium-or-higher behavioral signals/i,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "2",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /1 incidents currently remain open/i,
          ),
        ).toBeInTheDocument();
      },
    );
  },
);