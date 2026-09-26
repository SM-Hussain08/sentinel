import {
  render,
  screen,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
} from "vitest";

import DecisionSupportPanel from "./DecisionSupportPanel";


describe(
  "DecisionSupportPanel",
  () => {
    const analystQuestions = [
      "Was this activity expected?",
      "Did the employee initiate this access?",
    ];

    const containmentActions = [
      {
        urgency:
          "IMMEDIATE" as const,

        action:
          "Temporarily restrict the affected account.",

        condition:
          "If unauthorized account access is confirmed.",
      },

      {
        urgency:
          "CONDITIONAL" as const,

        action:
          "Restrict outbound network access.",

        condition:
          "If suspicious transfer activity continues.",
      },
    ];


    it(
      "renders analyst questions",
      () => {
        render(
          <DecisionSupportPanel
            analystQuestions={
              analystQuestions
            }
            containmentActions={
              containmentActions
            }
          />,
        );

        expect(
          screen.getByText(
            analystQuestions[0],
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            analystQuestions[1],
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "renders containment guidance",
      () => {
        render(
          <DecisionSupportPanel
            analystQuestions={
              analystQuestions
            }
            containmentActions={
              containmentActions
            }
          />,
        );

        expect(
          screen.getByText(
            "IMMEDIATE",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "CONDITIONAL",
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            containmentActions[0]
              .action,
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            containmentActions[1]
              .condition,
          ),
        ).toBeInTheDocument();
      },
    );


    it(
      "supports empty decision-support collections",
      () => {
        render(
          <DecisionSupportPanel
            analystQuestions={[]}
            containmentActions={[]}
          />,
        );

        expect(
          screen.queryByText(
            analystQuestions[0],
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByText(
            containmentActions[0]
              .action,
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);
