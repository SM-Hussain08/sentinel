import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatCount,
  formatHeartbeatAge,
  formatPreset,
  formatRate,
  formatRefreshAge,
  formatRuntimeDuration,
  formatSimulatedDuration,
  formatSpeed,
  formatTimestamp,
} from "./simulationFormatters";


describe(
  "simulation formatters",
  () => {
    describe(
      "runtime duration",
      () => {
        it.each([
          [null, "—"],
          [undefined, "—"],
          [-5, "0s"],
          [0, "0s"],
          [1.4, "1s"],
          [1.6, "2s"],
          [59, "59s"],
          [60, "1m 0s"],
          [90, "1m 30s"],
          [3599, "59m 59s"],
          [3600, "1h 0m"],
          [3665, "1h 1m"],
        ])(
          "formats %s seconds as %s",
          (
            input,
            expected,
          ) => {
            expect(
              formatRuntimeDuration(
                input,
              ),
            ).toBe(
              expected,
            );
          },
        );
      },
    );


    describe(
      "simulated duration",
      () => {
        it.each([
          [null, "—"],
          [undefined, "—"],
          [0, "0 min"],
          [60, "1 min"],
          [3599, "1h 0m"],
          [3600, "1h 0m"],
          [5400, "1h 30m"],
        ])(
          "formats simulated %s seconds as %s",
          (
            input,
            expected,
          ) => {
            expect(
              formatSimulatedDuration(
                input,
              ),
            ).toBe(
              expected,
            );
          },
        );
      },
    );


    it.each([
      [null, "—"],
      [undefined, "—"],
      [0, "0.00"],
      [1, "1.00"],
      [12.345, "12.35"],
    ])(
      "formats rate %s as %s",
      (
        input,
        expected,
      ) => {
        expect(
          formatRate(
            input,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it.each([
      [null, "—"],
      [undefined, "—"],
      [1, "1×"],
      [6, "6×"],
      [1.5, "1.5×"],
      [6.25, "6.3×"],
    ])(
      "formats speed %s as %s",
      (
        input,
        expected,
      ) => {
        expect(
          formatSpeed(
            input,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it.each([
      [null, "—"],
      [undefined, "—"],
      [0, "0"],
      [12612, "12,612"],
    ])(
      "formats count %s as %s",
      (
        input,
        expected,
      ) => {
        expect(
          formatCount(
            input,
          ),
        ).toBe(
          expected,
        );
      },
    );


    it.each([
      [null, "—"],
      [undefined, "—"],
      ["", "—"],
      ["enterprise", "Enterprise"],
      ["CONTINUOUS", "Continuous"],
    ])(
      "formats preset %s as %s",
      (
        input,
        expected,
      ) => {
        expect(
          formatPreset(
            input,
          ),
        ).toBe(
          expected,
        );
      },
    );


    describe(
      "heartbeat age",
      () => {
        const now =
          Date.parse(
            "2026-09-23T12:00:00Z",
          );


        it(
          "returns Unknown for absent heartbeat timestamps",
          () => {
            expect(
              formatHeartbeatAge(
                null,
                now,
              ),
            ).toBe(
              "Unknown",
            );
          },
        );


        it(
          "returns Unknown for invalid heartbeat timestamps",
          () => {
            expect(
              formatHeartbeatAge(
                "invalid",
                now,
              ),
            ).toBe(
              "Unknown",
            );
          },
        );


        it.each([
          [
            "2026-09-23T12:00:00Z",
            "Just now",
          ],
          [
            "2026-09-23T11:59:59Z",
            "Just now",
          ],
          [
            "2026-09-23T11:59:30Z",
            "30s ago",
          ],
          [
            "2026-09-23T11:59:00Z",
            "1m ago",
          ],
          [
            "2026-09-23T11:30:00Z",
            "30m ago",
          ],
          [
            "2026-09-23T10:00:00Z",
            "2h ago",
          ],
        ])(
          "formats heartbeat %s as %s",
          (
            heartbeat,
            expected,
          ) => {
            expect(
              formatHeartbeatAge(
                heartbeat,
                now,
              ),
            ).toBe(
              expected,
            );
          },
        );


        it(
          "clamps future heartbeat timestamps to zero age",
          () => {
            expect(
              formatHeartbeatAge(
                "2026-09-23T12:05:00Z",
                now,
              ),
            ).toBe(
              "Just now",
            );
          },
        );
      },
    );


    describe(
      "refresh age",
      () => {
        const now =
          10_000;


        it(
          "returns Not refreshed when no refresh exists",
          () => {
            expect(
              formatRefreshAge(
                null,
                now,
              ),
            ).toBe(
              "Not refreshed",
            );
          },
        );


        it(
          "returns just now for very recent refreshes",
          () => {
            expect(
              formatRefreshAge(
                9_500,
                now,
              ),
            ).toBe(
              "Refreshed just now",
            );
          },
        );


        it(
          "formats refresh age in seconds",
          () => {
            expect(
              formatRefreshAge(
                5_000,
                now,
              ),
            ).toBe(
              "Refreshed 5s ago",
            );
          },
        );


        it(
          "clamps future refresh timestamps to zero age",
          () => {
            expect(
              formatRefreshAge(
                15_000,
                now,
              ),
            ).toBe(
              "Refreshed just now",
            );
          },
        );
      },
    );


    it(
      "returns a fallback for absent or invalid display timestamps",
      () => {
        expect(
          formatTimestamp(
            null,
          ),
        ).toBe(
          "—",
        );

        expect(
          formatTimestamp(
            undefined,
          ),
        ).toBe(
          "—",
        );

        expect(
          formatTimestamp(
            "invalid",
          ),
        ).toBe(
          "—",
        );
      },
    );
  },
);
