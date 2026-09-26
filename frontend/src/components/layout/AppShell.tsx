import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import logo from "../../assets/logo.png";
import backgroundLogo from "../../assets/background-light.png";

import {
  getOperationsStatus,
} from "../../services/api";

import type {
  ProcessorRuntimeStatus,
  RuntimeHealthState,
} from "../../types/api";


export type AppPage =
  | "overview"
  | "incidents"
  | "anomalies"
  | "employees"
  | "model"
  | "architecture"
  | "simulation";


interface AppShellProps {
  children:
    React.ReactNode;
}


interface NavigationItem {
  id: AppPage;

  label: string;

  description: string;

  path: string;
}


const SYSTEM_REFRESH_MS =
  10_000;


const NAVIGATION_ITEMS:
  NavigationItem[] = [
    {
      id: "overview",

      label: "Overview",

      description:
        "Security operations",

      path: "/",
    },

    {
      id: "incidents",

      label: "Incidents",

      description:
        "Correlated investigations",

      path: "/incidents",
    },

    {
      id: "anomalies",

      label: "Anomalies",

      description:
        "Behavioral detection",

      path: "/anomalies",
    },

    {
      id: "employees",

      label: "Employees",

      description:
        "Identity intelligence",

      path: "/employees",
    },

    {
      id: "model",

      label: "Model",

      description:
        "Detection intelligence",

      path: "/model",
    },

    {
      id: "architecture",

      label: "Architecture",

      description:
        "System design",

      path: "/architecture",
    },

    {
      id: "simulation",

      label: "Simulation",

      description:
        "Synthetic environment",

      path: "/simulation",
    },
  ];


// ============================================================
// Navigation iconography
// ============================================================

interface NavigationIconProps {
  page: AppPage;
}


function NavigationIcon({
  page,
}: NavigationIconProps) {
  const commonProps = {
    width: 18,
    height: 18,

    viewBox:
      "0 0 24 24",

    fill:
      "none",

    stroke:
      "currentColor",

    strokeWidth:
      1.7,

    strokeLinecap:
      "round" as const,

    strokeLinejoin:
      "round" as const,

    "aria-hidden":
      true,
  };


  switch (page) {
    case "overview":
      return (
        <svg {...commonProps}>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
          />

          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
          />

          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
          />

          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
          />
        </svg>
      );


    case "incidents":
      return (
        <svg {...commonProps}>
          <path
            d="
              M12 3
              21 19
              H3
              L12 3Z
            "
          />

          <path
            d="
              M12 9
              V13
            "
          />

          <path
            d="
              M12 17
              H12.01
            "
          />
        </svg>
      );


    case "anomalies":
      return (
        <svg {...commonProps}>
          <path
            d="
              M3 12
              H6
              L8.2 6
              L11.7 18
              L14.6 10
              L16.5 14
              H21
            "
          />
        </svg>
      );


    case "employees":
      return (
        <svg {...commonProps}>
          <circle
            cx="12"
            cy="8"
            r="3.5"
          />

          <path
            d="
              M5 20
              C5.8 15.9
              8.2 14
              12 14
              C15.8 14
              18.2 15.9
              19 20
            "
          />
        </svg>
      );


    case "model":
      return (
        <svg {...commonProps}>
          <circle
            cx="6"
            cy="7"
            r="2"
          />

          <circle
            cx="18"
            cy="7"
            r="2"
          />

          <circle
            cx="12"
            cy="17"
            r="2"
          />

          <path
            d="
              M7.8 8
              L10.5 15
            "
          />

          <path
            d="
              M16.2 8
              L13.5 15
            "
          />

          <path
            d="
              M8 7
              H16
            "
          />
        </svg>
      );


    case "architecture":
      return (
        <svg {...commonProps}>
          <path
            d="
              M12 3
              L20 7.5
              L12 12
              L4 7.5
              L12 3Z
            "
          />

          <path
            d="
              M4 12
              L12 16.5
              L20 12
            "
          />

          <path
            d="
              M4 16.5
              L12 21
              L20 16.5
            "
          />
        </svg>
      );


    case "simulation":
      return (
        <svg {...commonProps}>
          <circle
            cx="12"
            cy="12"
            r="8.5"
          />

          <circle
            cx="12"
            cy="12"
            r="2"
          />

          <path
            d="
              M12 3.5
              V7
            "
          />

          <path
            d="
              M12 17
              V20.5
            "
          />

          <path
            d="
              M3.5 12
              H7
            "
          />

          <path
            d="
              M17 12
              H20.5
            "
          />
        </svg>
      );


    default:
      return null;
  }
}


// ============================================================
// Runtime status presentation
// ============================================================

interface SystemPresentation {
  label: string;

  description: string;

  dotClass: string;

  textClass: string;

  borderClass: string;

  backgroundClass: string;
}


function systemPresentation(
  health:
    RuntimeHealthState,
  operational: boolean,
): SystemPresentation {
  if (
    health === "HEALTHY"
    && operational
  ) {
    return {
      label:
        "Systems Operational",

      description:
        "Detection, correlation, and investigation engines online.",

      dotClass:
        "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]",

      textClass:
        "text-slate-300",

      borderClass:
        "border-emerald-900/30",

      backgroundClass:
        "bg-emerald-950/[0.06]",
    };
  }


  if (
    health === "ERROR"
  ) {
    return {
      label:
        "System Error",

      description:
        "Operational processing has reported a runtime failure.",

      dotClass:
        "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.72)]",

      textClass:
        "text-rose-300",

      borderClass:
        "border-rose-900/35",

      backgroundClass:
        "bg-rose-950/[0.08]",
    };
  }


  if (
    health === "STALE"
  ) {
    return {
      label:
        "System Stale",

      description:
        "Processor heartbeat is outside the expected runtime window.",

      dotClass:
        "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]",

      textClass:
        "text-amber-300",

      borderClass:
        "border-amber-900/35",

      backgroundClass:
        "bg-amber-950/[0.08]",
    };
  }


  if (
    health === "STOPPED"
  ) {
    return {
      label:
        "System Stopped",

      description:
        "The SENTINEL operational event processor is not running.",

      dotClass:
        "bg-slate-500",

      textClass:
        "text-slate-400",

      borderClass:
        "border-slate-800",

      backgroundClass:
        "bg-slate-950/40",
    };
  }


  return {
    label:
      "Status Unknown",

    description:
      "Operational processor status is currently unavailable.",

    dotClass:
      "bg-slate-600",

    textClass:
      "text-slate-500",

    borderClass:
      "border-slate-800",

    backgroundClass:
      "bg-slate-950/40",
  };
}


// ============================================================
// Shared sidebar status card
// ============================================================

interface SystemStatusCardProps {
  processor:
    ProcessorRuntimeStatus
    | null;

  collapsed?: boolean;
}


function SystemStatusCard({
  processor,
  collapsed = false,
}: SystemStatusCardProps) {
  const presentation =
    systemPresentation(
      processor?.health
      ?? "UNKNOWN",

      processor?.operational
      ?? false,
    );


  if (collapsed) {
    return (
      <div
        title={
          presentation.label
        }
        className={[
          "flex items-center",
          "justify-center",
          "rounded-xl border",
          "p-3",
          "transition-all",
          "duration-200",
          presentation.borderClass,
          presentation.backgroundClass,
        ].join(" ")}
      >
        <span
          className={[
            "h-2.5 w-2.5",
            "rounded-full",
            processor?.operational
              ? "animate-pulse"
              : "",
            presentation.dotClass,
          ].join(" ")}
        />
      </div>
    );
  }


  return (
    <div
      className={[
        "rounded-xl border",
        "p-3.5",
        "transition-all",
        "duration-200",
        presentation.borderClass,
        presentation.backgroundClass,
      ].join(" ")}
    >
      <div
        className="
          flex
          items-center
          gap-2.5
        "
      >
        <span
          className={[
            "h-2 w-2",
            "shrink-0",
            "rounded-full",
            processor?.operational
              ? "animate-pulse"
              : "",
            presentation.dotClass,
          ].join(" ")}
        />

        <p
          className={[
            "text-xs",
            "font-medium",
            presentation.textClass,
          ].join(" ")}
        >
          {presentation.label}
        </p>
      </div>

      <p
        className="
          mt-2
          text-[10px]
          leading-4
          text-slate-600
        "
      >
        {presentation.description}
      </p>
    </div>
  );
}


// ============================================================
// Application shell
// ============================================================

function AppShell({
  children,
}: AppShellProps) {
  const location =
    useLocation();

  const routerNavigate =
    useNavigate();


  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);


  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);


  const [
    processorStatus,
    setProcessorStatus,
  ] = useState<
    ProcessorRuntimeStatus
    | null
  >(null);


  const [
    navScrolling,
    setNavScrolling,
  ] = useState(false);


  const navScrollTimeoutRef =
    useRef<
      number
      | null
    >(null);


  const activePage:
  AppPage | null =
    location.pathname
      .startsWith(
        "/incidents",
      )
      ? "incidents"
      : location.pathname
          .startsWith(
            "/anomalies",
          )
        ? "anomalies"
        : location.pathname
            .startsWith(
              "/employees",
            )
          ? "employees"
          : location.pathname
              .startsWith(
                "/model",
              )
            ? "model"
            : location.pathname
                .startsWith(
                  "/architecture",
                )
              ? "architecture"
              : location.pathname
                  .startsWith(
                    "/simulation",
                  )
                ? "simulation"
                : location.pathname === "/"
                  ? "overview"
                  : null;


  // ==========================================================
  // Live processor status
  // ==========================================================

  useEffect(
    () => {
      let cancelled =
        false;


      async function loadInitialStatus() {
        try {
          const response =
            await getOperationsStatus();

          if (cancelled) {
            return;
          }

          setProcessorStatus(
            response.sentinel,
          );
        } catch {
          if (cancelled) {
            return;
          }

          setProcessorStatus(
            null,
          );
        }
      }


      void loadInitialStatus();


      return () => {
        cancelled =
          true;
      };
    },
    [],
  );


  useEffect(
    () => {
      let cancelled =
        false;


      const interval =
        window.setInterval(
          async () => {
            try {
              const response =
                await getOperationsStatus();

              if (cancelled) {
                return;
              }

              setProcessorStatus(
                response.sentinel,
              );
            } catch {
              if (cancelled) {
                return;
              }

              // Preserve the last known valid processor state when a
              // background refresh fails. A transient telemetry failure
              // should not erase already-established operational context.
            }
          },
          SYSTEM_REFRESH_MS,
        );


      return () => {
        cancelled =
          true;

        window.clearInterval(
          interval,
        );
      };
    },
    [],
  );


  // ==========================================================
  // Scrollbar lifecycle
  // ==========================================================

  useEffect(
    () => {
      return () => {
        if (
          navScrollTimeoutRef
            .current
          !== null
        ) {
          window.clearTimeout(
            navScrollTimeoutRef
              .current,
          );
        }
      };
    },
    [],
  );


  function handleNavigationScroll() {
    setNavScrolling(
      true,
    );


    if (
      navScrollTimeoutRef
        .current
      !== null
    ) {
      window.clearTimeout(
        navScrollTimeoutRef
          .current,
      );
    }


    navScrollTimeoutRef
      .current =
      window.setTimeout(
        () => {
          setNavScrolling(
            false,
          );
        },
        700,
      );
  }


  // ==========================================================
  // Navigation
  // ==========================================================

  function navigate(
    page: AppPage,
  ) {
    const destination =
      NAVIGATION_ITEMS.find(
        (item) =>
          item.id === page,
      );


    if (!destination) {
      return;
    }


    routerNavigate(
      destination.path,
    );


    setMobileOpen(
      false,
    );
  }


  function renderNavigationItem(
    item: NavigationItem,
    mobile = false,
  ) {
    const isActive =
      activePage
      === item.id;


    if (mobile) {
      return (
        <button
          key={item.id}
          type="button"
          aria-current={
            isActive
              ? "page"
              : undefined
          }
          onClick={() =>
            navigate(
              item.id,
            )
          }
          className={[
            "group",
            "flex w-full",
            "items-center",
            "gap-3",
            "rounded-xl",
            "border px-4 py-3",
            "text-left",
            "transition-all",
            "duration-200",
            isActive
              ? (
                "border-cyan-900/70 "
                + "bg-cyan-950/30 "
                + "text-cyan-200"
              )
              : (
                "border-slate-800 "
                + "bg-slate-950/35 "
                + "text-slate-400 "
                + "hover:border-slate-700 "
                + "hover:bg-slate-900/80 "
                + "hover:text-slate-200"
              ),
          ].join(" ")}
        >
          <span
            className={[
              "flex h-9 w-9",
              "shrink-0",
              "items-center",
              "justify-center",
              "rounded-lg border",
              "transition-all",
              "duration-200",
              isActive
                ? (
                  "border-cyan-800/60 "
                  + "bg-cyan-950/40 "
                  + "text-cyan-300"
                )
                : (
                  "border-slate-800 "
                  + "bg-slate-950/40 "
                  + "text-slate-600 "
                  + "group-hover:"
                  + "border-slate-700 "
                  + "group-hover:"
                  + "text-slate-300"
                ),
            ].join(" ")}
          >
            <NavigationIcon
              page={item.id}
            />
          </span>

          <div
            className="
              min-w-0
              flex-1
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
        </button>
      );
    }


    return (
      <button
        key={item.id}
        type="button"
        aria-current={
          isActive
            ? "page"
            : undefined
        }
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
            ? (
              "bg-cyan-950/30 "
              + "text-white"
            )
            : (
              "text-slate-500 "
              + "hover:bg-slate-900 "
              + "hover:text-slate-200"
            ),
        ].join(" ")}
      >
        {/* Active marker */}
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


        {/* Icon */}
        <span
          className={[
            "flex h-9 w-9",
            "shrink-0",
            "items-center",
            "justify-center",
            "rounded-lg",
            "border",
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
                + "group-hover:"
                + "border-slate-700 "
                + "group-hover:"
                + "text-slate-300"
              ),
          ].join(" ")}
        >
          <NavigationIcon
            page={item.id}
          />
        </span>


        {!sidebarCollapsed && (
          <div
            className="
              min-w-0
              flex-1
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
  }


  return (
    <div
      className="
        min-h-screen
        bg-[#070b12]
        text-slate-100
      "
    >
      {/* =====================================================
          BACKGROUND ATMOSPHERE
      ====================================================== */}
      <div
        className="
          pointer-events-none
          fixed
          inset-0
          overflow-hidden
        "
      >
        <div
          className="
            absolute
            -left-40
            -top-40
            h-[520px]
            w-[520px]
            rounded-full
            bg-cyan-500/[0.035]
            blur-[140px]
          "
        />

        <div
          className="
            absolute
            right-[-180px]
            top-[22%]
            h-[480px]
            w-[480px]
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


      {/* =====================================================
          DESKTOP SIDEBAR
      ====================================================== */}
      <aside
        className={[
          "fixed inset-y-0 left-0",
          "z-40 hidden",
          "flex-col",
          "overflow-visible",
          "border-r",
          "border-cyan-900/25",
          "bg-[#080d15]/96",
          "shadow-[18px_0_48px_rgba(0,0,0,0.38),1px_0_0_rgba(34,211,238,0.05)]",
          "backdrop-blur-xl",
          "transition-all",
          "duration-300",
          "lg:flex",
          sidebarCollapsed
            ? "w-[82px]"
            : "w-[270px]",
        ].join(" ")}
      >
        {/* ---------------------------------------------------
            FIXED BRAND HEADER
        ---------------------------------------------------- */}
        <div
          className={[
            "relative",
            "flex h-[92px]",
            "shrink-0",
            "items-center",
            "border-b",
            "border-slate-800/70",
            "transition-all",
            "duration-300",
            sidebarCollapsed
              ? "justify-center px-3"
              : "gap-3 px-6",
          ].join(" ")}
        >
          <div
            className="
              relative
              flex h-11 w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-cyan-900/60
              bg-cyan-950/20
            "
          >
            <div
              className="
                absolute
                inset-0
                rounded-xl
                bg-cyan-400/[0.03]
                shadow-[0_0_30px_rgba(34,211,238,0.06)]
              "
            />

            <img
              src={logo}
              alt="SENTINEL"
              className="
                relative
                h-8
                w-8
                object-contain
              "
            />
          </div>


          {!sidebarCollapsed && (
            <div
              className="
                min-w-0
              "
            >
              <p
                className="
                  text-sm
                  font-semibold
                  tracking-[0.22em]
                  text-white
                "
              >
                SENTINEL
              </p>

              <p
                className="
                  mt-1
                  truncate
                  text-[10px]
                  uppercase
                  tracking-[0.14em]
                  text-slate-600
                "
              >
                Security Intelligence
              </p>
            </div>
          )}


          {/* Collapse */}
          <button
            type="button"
            aria-label={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={() =>
              setSidebarCollapsed(
                (current) =>
                  !current,
              )
            }
            className={[
              "absolute",
              "top-1/2",
              "-translate-y-1/2",
              "flex h-8 w-8",
              "items-center",
              "justify-center",
              "rounded-lg",
              "border",
              "border-slate-800",
              "bg-[#0b111b]",
              "text-xs",
              "text-slate-400",
              "shadow-lg",
              "transition-all",
              "duration-200",
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


        {/* ---------------------------------------------------
            SCROLLABLE NAVIGATION ONLY
        ---------------------------------------------------- */}
        <nav
          onScroll={
            handleNavigationScroll
          }
          className={[
            "sentinel-sidebar-scroll",
            "min-h-0",
            "flex-1",
            "overflow-y-auto",
            "overflow-x-hidden",
            "px-4 py-6",
            navScrolling
              ? "sentinel-sidebar-scroll-active"
              : "",
          ].join(" ")}
        >
          {!sidebarCollapsed && (
            <p
              className="
                mb-3
                px-3
                text-[10px]
                font-medium
                uppercase
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
              (item) =>
                renderNavigationItem(
                  item,
                ),
            )}
          </div>
        </nav>


        {/* ---------------------------------------------------
            FIXED SYSTEM STATUS FOOTER
        ---------------------------------------------------- */}
        <div
          className="
            shrink-0
            border-t
            border-slate-800/70
            bg-[#080d15]/98
            p-4
          "
        >
          <SystemStatusCard
            processor={
              processorStatus
            }
            collapsed={
              sidebarCollapsed
            }
          />
        </div>
      </aside>


      {/* =====================================================
          MOBILE HEADER
      ====================================================== */}
      <header
        className="
          sticky
          top-0
          z-40
          flex
          h-16
          items-center
          justify-between
          border-b
          border-slate-800/80
          bg-[#080d15]/95
          px-4
          backdrop-blur-xl
          lg:hidden
        "
      >
        <div
          className="
            flex
            items-center
            gap-2.5
          "
        >
          <img
            src={logo}
            alt="SENTINEL"
            className="
              h-8
              w-8
              object-contain
            "
          />

          <span
            className="
              text-xs
              font-semibold
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
          aria-expanded={
            mobileOpen
          }
          aria-controls="sentinel-mobile-navigation"
          onClick={() =>
            setMobileOpen(
              (current) =>
                !current,
            )
          }
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-lg
            border
            border-slate-800
            bg-slate-950/50
            text-lg
            text-slate-300
            transition
            hover:border-cyan-900
            hover:bg-cyan-950/20
            hover:text-cyan-300
          "
        >
          {mobileOpen
            ? "×"
            : "☰"}
        </button>
      </header>


      {/* =====================================================
          MOBILE NAVIGATION DRAWER
      ====================================================== */}
      {mobileOpen && (
        <div
          id="sentinel-mobile-navigation"
          className="
            fixed
            inset-x-0
            bottom-0
            top-16
            z-50
            flex
            flex-col
            border-b
            border-slate-800
            bg-[#080d15]/98
            shadow-2xl
            backdrop-blur-xl
            lg:hidden
          "
        >
          {/* Scrollable navigation */}
          <div
            className="
              min-h-0
              flex-1
              overflow-y-auto
              px-4
              py-5
            "
          >
            <p
              className="
                mb-3
                px-1
                text-[10px]
                font-medium
                uppercase
                tracking-[0.16em]
                text-slate-700
              "
            >
              Workspace
            </p>

            <div
              className="
                grid
                gap-2
              "
            >
              {NAVIGATION_ITEMS.map(
                (item) =>
                  renderNavigationItem(
                    item,
                    true,
                  ),
              )}
            </div>
          </div>


          {/* Fixed mobile status */}
          <div
            className="
              shrink-0
              border-t
              border-slate-800/70
              bg-[#080d15]
              p-4
            "
          >
            <SystemStatusCard
              processor={
                processorStatus
              }
            />
          </div>
        </div>
      )}


      {/* =====================================================
          MAIN WORKSPACE
      ====================================================== */}
      <div
        className={[
          "relative",
          "min-h-screen",
          "transition-[padding]",
          "duration-300",
          sidebarCollapsed
            ? "lg:pl-[82px]"
            : "lg:pl-[270px]",
        ].join(" ")}
      >
        <div
          key={
            location.pathname
          }
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