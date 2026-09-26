import {
  expect,
  test,
} from "@playwright/test";


test.describe(
  "SENTINEL deployed stack smoke",
  () => {
    test(
      "Nginx health endpoint is reachable",
      async ({
        request,
      }) => {
        const response =
          await request.get(
            "/healthz",
          );

        expect(
          response.ok(),
        ).toBe(
          true,
        );

        expect(
          await response.text(),
        ).toContain(
          "healthy",
        );
      },
    );


    test(
      "Nginx proxies the real FastAPI operations endpoint",
      async ({
        request,
      }) => {
        const response =
          await request.get(
            "/api/v1/operations/status",
          );

        expect(
          response.ok(),
        ).toBe(
          true,
        );

        const body =
          await response.json();

        expect(
          body.sentinel.service,
        ).toBe(
          "event-processor",
        );

        expect(
          body.sentinel.operational,
        ).toBe(
          true,
        );

        expect(
          body.sentinel.health,
        ).toBe(
          "HEALTHY",
        );

        expect(
          body.sentinel.status,
        ).toBe(
          "running",
        );

        expect(
          body.sentinel.detector,
        ).toEqual({
          name:
            "isolation-forest",

          version:
            "1.2",
        });

        expect(
          body.sentinel.counters
            .events_processed,
        ).toBeGreaterThanOrEqual(
          5,
        );

        expect(
          body.sentinel.counters
            .scores_created,
        ).toBeGreaterThanOrEqual(
          5,
        );

        expect(
          body.sentinel.counters
            .incidents_created,
        ).toBeGreaterThanOrEqual(
          1,
        );

        expect(
          body.sentinel.counters
            .live_backlog,
        ).toBe(
          0,
        );
      },
    );


    test(
        "production SPA loads through Nginx",
        async ({
            page,
        }) => {
            await page.goto(
            "/",
            );

            await expect(
            page,
            ).toHaveURL(
            /\/$/,
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

            await expect(
            page.getByRole(
                "button",
                {
                name:
                    /Incidents Correlated investigations/i,
                },
            ),
            ).toBeVisible();

            await expect(
            page.getByRole(
                "button",
                {
                name:
                    /Anomalies Behavioral detection/i,
                },
            ),
            ).toBeVisible();

            await expect(
            page.getByRole(
                "button",
                {
                name:
                    /Employees Identity intelligence/i,
                },
            ),
            ).toBeVisible();

            await expect(
            page.getByRole(
                "button",
                {
                name:
                    /Model Detection intelligence/i,
                },
            ),
            ).toBeVisible();
        },
    );


    test(
      "BrowserRouter deep link resolves through production Nginx",
      async ({
        page,
      }) => {
        const response =
          await page.goto(
            "/incidents",
          );

        expect(
          response?.ok(),
        ).toBe(
          true,
        );

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
      },
    );


    test(
      "processor-generated incident is available through the gateway",
      async ({
        request,
      }) => {
        const response =
          await request.get(
            "/api/v1/incidents",
          );

        expect(
          response.ok(),
        ).toBe(
          true,
        );

        const incidents =
          await response.json();

        const e2eIncident =
          incidents.find(
            (
              incident: {
                incident_id: string;
                incident_type: string;
                primary_employee_user_id:
                  string;
              },
            ) =>
              incident
                .primary_employee_user_id
              === "e2e_user_001",
          );

        expect(
          e2eIncident,
        ).toBeTruthy();

        expect(
          e2eIncident
            .incident_type,
        ).toBe(
          "POTENTIAL_ACCOUNT_COMPROMISE",
        );

        expect(
          e2eIncident
            .incident_id,
        ).toBe(
          "INC-2026-0001",
        );
      },
    );
  },
);