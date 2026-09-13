import type {
  IncidentSeverity,
} from "../../types/api";


export interface IncidentSeverityStyle {
  badge: string;
  border: string;
  selected: string;
  dot: string;
  text: string;
}


export const SEVERITY_STYLES: Record<
  IncidentSeverity,
  IncidentSeverityStyle
> = {
  CRITICAL: {
    badge:
      "border-red-800/70 bg-red-950/45 text-red-300",

    border:
      "border-red-900/45",

    selected:
      "border-red-800/60 bg-red-950/20",

    dot:
      "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.65)]",

    text:
      "text-red-300",
  },

  HIGH: {
    badge:
      "border-orange-800/70 bg-orange-950/35 text-orange-300",

    border:
      "border-orange-900/40",

    selected:
      "border-orange-800/50 bg-orange-950/15",

    dot:
      "bg-orange-400",

    text:
      "text-orange-300",
  },

  MEDIUM: {
    badge:
      "border-amber-800/60 bg-amber-950/30 text-amber-300",

    border:
      "border-amber-900/35",

    selected:
      "border-amber-800/45 bg-amber-950/10",

    dot:
      "bg-amber-400",

    text:
      "text-amber-300",
  },
};