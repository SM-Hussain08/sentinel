interface AnomalyFeatureSnapshotProps {
  features:
    Record<
      string,
      unknown
    >;
}


function formatFeatureName(
  feature:
    string,
): string {
  return feature
    .split(
      "_",
    )
    .map(
      (word) =>
        word.length
          === 0
          ? word
          : (
              word.charAt(
                0,
              ).toUpperCase()
              + word.slice(
                  1,
                )
            ),
    )
    .join(
      " ",
    );
}


function formatFeatureValue(
  value:
    unknown,
): string {
  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }

  if (
    typeof value
    === "boolean"
  ) {
    return value
      ? "TRUE"
      : "FALSE";
  }

  if (
    typeof value
    === "number"
  ) {
    if (
      Number.isInteger(
        value,
      )
    ) {
      return String(
        value,
      );
    }

    return value.toFixed(
      4,
    );
  }

  if (
    typeof value
    === "string"
  ) {
    return value;
  }

  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return String(
      value,
    );
  }
}


function AnomalyFeatureSnapshot({
  features,
}: AnomalyFeatureSnapshotProps) {
  const entries =
    Object.entries(
      features,
    )
      .sort(
        (
          [featureA],
          [featureB],
        ) =>
          featureA.localeCompare(
            featureB,
          ),
      );


  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-700/55
        bg-[#101826]/90
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-slate-800
          px-5 py-4
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <div>
          <p
            className="
              text-[10px]
              uppercase
              tracking-[0.17em]
              text-slate-600
            "
          >
            Model Input Evidence
          </p>

          <h2
            className="
              mt-1.5
              text-lg
              font-semibold
              text-white
            "
          >
            Recorded Feature Snapshot
          </h2>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-600
            "
          >
            Complete feature vector
            recorded for this scored event.
          </p>
        </div>

        <span
          className="
            self-start
            rounded-lg
            border
            border-slate-800
            bg-[#0b111c]
            px-2.5 py-1.5
            text-xs
            font-semibold
            text-slate-400
            sm:self-auto
          "
        >
          {entries.length}
        </span>
      </div>


      <div
        className="
          grid
          gap-px
          bg-slate-800/60
          sm:grid-cols-2
          xl:grid-cols-3
        "
      >
        {entries.map(
          ([
            feature,
            value,
          ]) => (
            <div
              key={
                feature
              }
              className="
                group
                min-w-0
                bg-[#0d1521]
                px-5 py-4
                transition-colors
                duration-200
                hover:bg-[#121c2b]
              "
            >
              <p
                className="
                  truncate
                  font-mono
                  text-[9px]
                  text-cyan-700
                "
                title={
                  feature
                }
              >
                {feature}
              </p>

              <p
                className="
                  mt-1.5
                  text-xs
                  text-slate-600
                "
              >
                {formatFeatureName(
                  feature,
                )}
              </p>

              <p
                className="
                  mt-3
                  break-all
                  font-mono
                  text-sm
                  font-semibold
                  text-slate-300
                  transition-colors
                  group-hover:text-slate-100
                "
              >
                {formatFeatureValue(
                  value,
                )}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}


export default AnomalyFeatureSnapshot;