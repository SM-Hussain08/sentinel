import type {
  MLRiskLevel,
} from "../../types/api";


interface RiskStyle {
  badge: string;
  dot: string;
  bar: string;
  border: string;
  text: string;
  hover: string;
}


export const ANOMALY_RISK_STYLES:
  Record<
    MLRiskLevel,
    RiskStyle
  > = {
    NORMAL: {
      badge:
        "border-slate-700 bg-slate-800/70 text-slate-300",

      dot:
        "bg-slate-400",

      bar:
        "bg-slate-500",

      border:
        "border-slate-800",

      text:
        "text-slate-300",

      hover:
        "hover:border-slate-700/80 hover:shadow-[0_12px_30px_rgba(148,163,184,0.035)]",
    },

    LOW: {
      badge:
        "border-cyan-800/60 bg-cyan-950/35 text-cyan-300",

      dot:
        "bg-cyan-400",

      bar:
        "bg-cyan-500",

      border:
        "border-cyan-950/45",

      text:
        "text-cyan-300",

      hover:
        "hover:border-cyan-900/70 hover:shadow-[0_12px_30px_rgba(34,211,238,0.045)]",
    },

    MEDIUM: {
      badge:
        "border-amber-800/60 bg-amber-950/30 text-amber-300",

      dot:
        "bg-amber-400",

      bar:
        "bg-amber-500",

      border:
        "border-amber-950/40",

      text:
        "text-amber-300",

      hover:
        "hover:border-amber-900/65 hover:shadow-[0_12px_30px_rgba(251,191,36,0.04)]",
    },

    HIGH: {
      badge:
        "border-orange-800/70 bg-orange-950/35 text-orange-300",

      dot:
        "bg-orange-400",

      bar:
        "bg-orange-500",

      border:
        "border-orange-950/45",

      text:
        "text-orange-300",

      hover:
        "hover:border-orange-900/65 hover:shadow-[0_12px_30px_rgba(251,146,60,0.045)]",
    },

    CRITICAL: {
      badge:
        "border-red-800/70 bg-red-950/45 text-red-300",

      dot:
        "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]",

      bar:
        "bg-red-500",

      border:
        "border-red-950/50",

      text:
        "text-red-300",

      hover:
        "hover:border-red-900/70 hover:shadow-[0_12px_30px_rgba(248,113,113,0.05)]",
    },
  };