import {
  useState,
} from "react";

import logo from "../../assets/logo.png";
import backgroundLogo from "../../assets/background-light.png";


export type AppPage =
  | "overview"
  | "incidents"
  | "anomalies"
  | "model";


interface AppShellProps {
  activePage: AppPage;

  onNavigate: (
    page: AppPage,
  ) => void;

  children:
    React.ReactNode;
}


interface NavigationItem {
  id: AppPage;

  label: string;
  description: string;

  icon: string;
}


const NAVIGATION_ITEMS:
  NavigationItem[] = [
    {
      id: "overview",
      label: "Overview",
      description:
        "Security operations",
      icon: "◈",
    },

    {
      id: "incidents",
      label: "Incidents",
      description:
        "Correlated investigations",
      icon: "◇",
    },

    {
      id: "anomalies",
      label: "Anomalies",
      description:
        "Behavioral detection",
      icon: "⌁",
    },

    {
      id: "model",
      label: "Model",
      description:
        "Detection intelligence",
      icon: "◎",
    },
  ];


function AppShell({
  activePage,
  onNavigate,
  children,
}: AppShellProps) {
  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);


  function navigate(
    page: AppPage,
  ) {
    onNavigate(page);

    setMobileOpen(
      false,
    );
  }


  return (
    <div
      className="
        min-h-screen
        bg-[#070b12]
        text-slate-100
      "
    >
      {/* Background atmosphere */}
      <div
        className="
          pointer-events-none
          fixed inset-0
          overflow-hidden
        "
      >
        <div
          className="
            absolute
            -left-40 -top-40
            h-[520px] w-[520px]
            rounded-full
            bg-cyan-500/[0.035]
            blur-[140px]
          "
        />

        <div
          className="
            absolute
            right-[-180px] top-[22%]
            h-[480px] w-[480px]
            rounded-full
            bg-indigo-500/[0.025]
            blur-[150px]
          "
        />

        <img
          src={backgroundLogo}
          alt=""
          aria-hidden="true"
          className="
            absolute
            bottom-[-120px]
            right-[-80px]
            w-[650px]
            max-w-[55vw]
            opacity-[0.018]
          "
        />
      </div>


      {/* Desktop Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0",
          "z-40 hidden",
          "flex-col",
          "border-r border-cyan-900/25",
          "bg-[#080d15]/96",
          "shadow-[18px_0_48px_rgba(0,0,0,0.38),1px_0_0_rgba(34,211,238,0.05)]",
          "backdrop-blur-xl",
          "transition-all duration-300",
          "lg:flex",
          sidebarCollapsed
            ? "w-[82px]"
            : "w-[270px]",
        ].join(" ")}
      >

        {/* Brand */}
        <div
          className={[
            "relative flex h-[92px]",
            "items-center",
            "border-b border-slate-800/70",
            "transition-all duration-300",
            sidebarCollapsed
              ? "justify-center px-3"
              : "gap-3 px-6",
          ].join(" ")}
        >
          <div
            className="
              relative flex h-11 w-11
              items-center justify-center
              rounded-xl
              border border-cyan-900/60
              bg-cyan-950/20
            "
          >
            <div
              className="
                absolute inset-0
                rounded-xl
                bg-cyan-400/[0.03]
                shadow-[0_0_30px_rgba(34,211,238,0.06)]
              "
            />

            <img
              src={logo}
              alt="SENTINEL"
              className="
                relative h-8 w-8
                object-contain
              "
            />
          </div>

          {!sidebarCollapsed && (
            <div>
              <p
                className="
                  text-sm font-semibold
                  tracking-[0.22em]
                  text-white
                "
              >
                SENTINEL
              </p>

              <p
                className="
                  mt-1 text-[10px]
                  uppercase
                  tracking-[0.14em]
                  text-slate-600
                "
              >
                Security Intelligence
              </p>
            </div>
          )}

          {/* Sidebar Collapse / Expand Button */}
          <button
            type="button"
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() =>
              setSidebarCollapsed(
                (current) => !current,
              )
            }
            className={[
              "absolute",
              "top-1/2",
              "-translate-y-1/2",
              "flex h-8 w-8",
              "items-center justify-center",
              "rounded-lg",
              "border border-slate-800",
              "bg-[#0b111b]",
              "text-xs text-slate-400",
              "shadow-lg",
              "transition-all duration-200",
              "hover:border-cyan-800/70",
              "hover:bg-cyan-950/30",
              "hover:text-cyan-300",
              sidebarCollapsed
                ? "-right-4"
                : "right-4",
            ].join(" ")}
          >
            {sidebarCollapsed
              ? "›"
              : "‹"}
          </button>
        </div>


        {/* Navigation */}
        <nav
          className="
            flex-1 px-4 py-6
          "
        >
          {!sidebarCollapsed && (
            <p
              className="
                mb-3 px-3
                text-[10px]
                font-medium uppercase
                tracking-[0.16em]
                text-slate-700
              "
            >
              Workspace
            </p>
          )}

          <div
            className="
              space-y-1.5
            "
          >
            {NAVIGATION_ITEMS.map(
              (item) => {
                const isActive =
                  activePage
                  === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={
                      sidebarCollapsed
                        ? item.label
                        : undefined
                    }
                    onClick={() =>
                      navigate(
                        item.id,
                      )
                    }
                    className={[
                      "group relative",
                      "flex w-full",
                      "items-center",
                      sidebarCollapsed
                        ? "justify-center"
                        : "gap-3",
                      "overflow-hidden",
                      "rounded-xl",
                      "px-3 py-3",
                      "text-left",
                      "transition-all",
                      "duration-200",
                      isActive
                        ? "bg-cyan-950/30 text-white"
                        : (
                          "text-slate-500 "
                          + "hover:bg-slate-900 "
                          + "hover:text-slate-200"
                        ),
                    ].join(" ")}
                  >

                    {/* Active indicator */}
                    <span
                      className={[
                        "absolute",
                        "left-0 top-1/2",
                        "h-7 w-[2px]",
                        "-translate-y-1/2",
                        "rounded-r-full",
                        "bg-cyan-400",
                        "transition-all",
                        "duration-200",
                        isActive
                          ? "opacity-100"
                          : "opacity-0",
                      ].join(" ")}
                    />

                    {/* Navigation Icon */}
                    <span
                      className={[
                        "flex h-9 w-9",
                        "items-center justify-center",
                        "rounded-lg",
                        "border",
                        "text-base",
                        "transition-all",
                        "duration-200",
                        isActive
                          ? (
                            "border-cyan-800/60 "
                            + "bg-cyan-950/40 "
                            + "text-cyan-300 "
                            + "shadow-[0_0_16px_rgba(34,211,238,0.08)]"
                          )
                          : (
                            "border-slate-800 "
                            + "bg-slate-950/40 "
                            + "text-slate-600 "
                            + "group-hover:border-slate-700 "
                            + "group-hover:text-slate-300"
                          ),
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>

                    {/* Navigation Text */}
                    {!sidebarCollapsed && (
                      <div
                        className="
                          min-w-0 flex-1
                        "
                      >
                        <p
                          className="
                            text-sm
                            font-medium
                          "
                        >
                          {item.label}
                        </p>

                        <p
                          className="
                            mt-0.5
                            truncate
                            text-[11px]
                            text-slate-600
                          "
                        >
                          {item.description}
                        </p>
                      </div>
                    )}
                  </button>
                );
              },
            )}
          </div>
        </nav>


        {/* System Status */}
        <div
          className="
            border-t
            border-slate-800/70
            p-4
          "
        >
          {sidebarCollapsed ? (
            <div
              className="
                flex items-center
                justify-center
                rounded-xl
                border border-slate-800
                bg-slate-950/40
                p-3
              "
              title="Systems Operational"
            >
              <span
                className="
                  h-2.5 w-2.5
                  animate-pulse
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_12px_rgba(52,211,153,0.7)]
                "
              />
            </div>
          ) : (
            <div
              className="
                rounded-xl
                border border-slate-800
                bg-slate-950/40
                p-3.5
              "
            >
              <div
                className="
                  flex items-center
                  gap-2.5
                "
              >
                <span
                  className="
                    h-2 w-2
                    animate-pulse
                    rounded-full
                    bg-emerald-400
                    shadow-[0_0_10px_rgba(52,211,153,0.7)]
                  "
                />

                <p
                  className="
                    text-xs
                    font-medium
                    text-slate-300
                  "
                >
                  Systems Operational
                </p>
              </div>

              <p
                className="
                  mt-2 text-[10px]
                  leading-4
                  text-slate-600
                "
              >
                Detection, correlation,
                and investigation
                engines online.
              </p>
            </div>
          )}
        </div>
      </aside>


      {/* Mobile Header */}
      <header
        className="
          sticky top-0 z-40
          flex h-16
          items-center justify-between
          border-b border-slate-800/80
          bg-[#080d15]/95
          px-4 backdrop-blur-xl
          lg:hidden
        "
      >
        <div
          className="
            flex items-center
            gap-2.5
          "
        >
          <img
            src={logo}
            alt="SENTINEL"
            className="
              h-8 w-8
              object-contain
            "
          />

          <span
            className="
              text-xs font-semibold
              tracking-[0.18em]
              text-white
            "
          >
            SENTINEL
          </span>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() =>
            setMobileOpen(
              (current) =>
                !current,
            )
          }
          className="
            flex h-10 w-10
            items-center justify-center
            rounded-lg
            border border-slate-800
            bg-slate-950/50
            text-lg
            text-slate-300
            transition
            hover:border-cyan-900
            hover:text-cyan-300
          "
        >
          {mobileOpen
            ? "×"
            : "☰"}
        </button>
      </header>


      {/* Mobile Navigation */}
      {mobileOpen && (
        <div
          className="
            fixed inset-x-0 top-16
            z-50
            border-b
            border-slate-800
            bg-[#080d15]/98
            p-4
            shadow-2xl
            backdrop-blur-xl
            lg:hidden
          "
        >
          <div
            className="
              grid gap-2
            "
          >
            {NAVIGATION_ITEMS.map(
              (item) => {
                const isActive =
                  activePage
                  === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        item.id,
                      )
                    }
                    className={[
                      "flex items-center",
                      "gap-3 rounded-xl",
                      "border px-4 py-3",
                      "text-left",
                      "transition-all",
                      isActive
                        ? (
                          "border-cyan-900/70 "
                          + "bg-cyan-950/30 "
                          + "text-cyan-200"
                        )
                        : (
                          "border-slate-800 "
                          + "bg-slate-950/40 "
                          + "text-slate-400 "
                          + "hover:bg-slate-900"
                        ),
                    ].join(" ")}
                  >
                    <span>
                      {item.icon}
                    </span>

                    <div>
                      <p
                        className="
                          text-sm
                          font-medium
                        "
                      >
                        {item.label}
                      </p>

                      <p
                        className="
                          mt-0.5
                          text-[11px]
                          text-slate-600
                        "
                      >
                        {
                          item.description
                        }
                      </p>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>
      )}


      {/* Main Workspace */}
      <div
        className={[
          "relative min-h-screen",
          "transition-[padding]",
          "duration-300",
          sidebarCollapsed
            ? "lg:pl-[82px]"
            : "lg:pl-[270px]",
        ].join(" ")}
      >
        <div
          key={activePage}
          className="
            sentinel-page-enter
            relative
            min-h-screen
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}


export default AppShell;