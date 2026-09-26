import {
  expect,
  test,
} from "@playwright/test";


test.describe(
  "SENTINEL SOC analyst journeys",
  () => {
    test(
      "analyst moves from overview to incident queue",
      async ({
        page,
      }) => {
        await page.goto(
          "/",
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Security Operations Overview",
            },
          ),
        ).toBeVisible();

        await page.getByRole(
          "button",
          {
            name:
              "Go to Incidents",
          },
        ).click();

        await expect(
          page,
        ).toHaveURL(
          /\/incidents$/,
        );

        await expect(
          page.getByText(
            "Potential Account Compromise",
          ).first(),
        ).toBeVisible();

        await expect(
          page.getByText(
            "INC-2026-0001",
          ).first(),
        ).toBeVisible();
      },
    );


    test(
      "incident workspace exposes deterministic investigation intelligence",
      async ({
        page,
      }) => {
        await page.goto(
          "/incidents/INC-2026-0001",
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Investigation Workspace",
            },
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "INC-2026-0001",
          ).first(),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Potential Account Compromise",
          ).first(),
        ).toBeVisible();

        await expect(
          page.getByText(
            "4 correlated signals",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "5 correlated events",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "5 findings",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Critical severity because repeated authentication failures were followed by successful access and subsequent resource activity.",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Local AI is disabled by configuration.",
          ).first(),
        ).toBeVisible();
      },
    );


    test(
      "analyst navigates from incident to affected identity",
      async ({
        page,
      }) => {
        await page.goto(
          "/incidents/INC-2026-0001",
        );

        await page.getByRole(
          "button",
          {
            name:
              /Affected Identity.*e2e_user_001/i,
          },
        ).click();

        await expect(
          page,
        ).toHaveURL(
          /\/employees\/e2e_user_001$/,
        );

        await expect(
          page.getByText(
            "Employee Investigation",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "E2E Security Analyst",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "CRITICAL SIGNALS",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "4",
            {
              exact: true,
            },
          ).first(),
        ).toBeVisible();
      },
    );


    test(
      "analyst navigates from employee to selected anomaly",
      async ({
        page,
      }) => {
        await page.goto(
          "/employees/e2e_user_001",
        );

        await page.getByRole(
          "button",
          {
            name:
              /E2E-EVT-003.*Login Failure/i,
          },
        ).first().click();

        await expect(
          page,
        ).toHaveURL(
          /\/anomalies\/E2E-EVT-003$/,
        );

        await expect(
          page.getByText(
            "Detection Analysis Workspace",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "E2E-EVT-003",
          ).first(),
        ).toBeVisible();

        await expect(
          page.getByText(
            "ALERT THRESHOLD REACHED",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Historical anomaly percentile relative to the training baseline; not a probability of attack.",
          ),
        ).toBeVisible();
      },
    );


    test(
      "analyst follows anomaly correlation back to incident",
      async ({
        page,
      }) => {
        await page.goto(
          "/anomalies/E2E-EVT-003",
        );

        await page.getByRole(
          "button",
          {
            name:
              /INC-2026-0001.*Potential Account Compromise/i,
          },
        ).click();

        await expect(
          page,
        ).toHaveURL(
          /\/incidents\/INC-2026-0001$/,
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Investigation Workspace",
            },
          ),
        ).toBeVisible();
      },
    );


    test(
      "model workspace exposes selected production detector lineage",
      async ({
        page,
      }) => {
        await page.goto(
          "/model",
        );

        await expect(
          page.getByText(
            "Model Intelligence",
          ),
        ).toBeVisible();

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Isolation Forest v1.2",
            },
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "PRODUCTION DETECTOR",
            {
              exact: true,
            },
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Reproducible Evaluation",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "PASS",
            {
              exact: true,
            },
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Simulator ground-truth labels are used only for offline evaluation and never for operational inference.",
          ),
        ).toBeVisible();
      },
    );


    test(
      "architecture workspace reports deterministic core and graceful AI degradation",
      async ({
        page,
      }) => {
        await page.goto(
          "/architecture",
        );

        await expect(
          page.getByText(
            "SENTINEL Security Intelligence Platform",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "processor-e2e",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Local AI Disabled",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Local AI is disabled by configuration.",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "Detection, correlation and investigation remain operational without a language model.",
          ),
        ).toBeVisible();
      },
    );


    test(
      "simulation workspace degrades cleanly when simulator is offline",
      async ({
        page,
      }) => {
        await page.goto(
          "/simulation",
        );

        await expect(
          page.getByText(
            "Synthetic Enterprise Simulator",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "SIMULATOR OFFLINE",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "No run history",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "No live synthetic enterprise activity is currently being generated.",
          ),
        ).toBeVisible();

        await expect(
          page.getByText(
            "The simulator is an auxiliary SENTINEL service intended for demonstration and testing. The core security platform remains operational when simulation is stopped.",
          ),
        ).toBeVisible();
      },
    );
  },
);
