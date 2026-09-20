import type {
  EmployeeRiskLevel,
} from "../../types/api";


export type EmployeeStatusFilter =
  | "all"
  | "active"
  | "inactive";


export type EmployeeRiskFilter =
  | "ALL"
  | EmployeeRiskLevel;


export type EmployeeSortOption =
  | "RISK"
  | "ANOMALIES"
  | "INCIDENTS"
  | "RECENT"
  | "USER_ASC";
