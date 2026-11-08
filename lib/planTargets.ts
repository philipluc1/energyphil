// Plan vs actual (9 Nov 2026): the Base case from Utilo_Financial_Model.xlsx
// (sheet "Monthly Base", default inputs: 400 free checks in month 1, 7% monthly
// growth in year 1, 3% become members, 70% yearly). When the model changes,
// replace these rows with its new Base figures.

export interface PlanMonth {
  /** yyyy-mm */
  month: string;
  /** Free checks (organic + from ads). */
  checks: number;
  newMembers: number;
  /** Active members at the end of the month. */
  active: number;
  /** Payments received that month, A$ including GST. */
  salesIncGst: number;
}

export const PLAN_SOURCE = "Financial model, Base case (9 Nov 2026)";

export const BASE_TARGETS: PlanMonth[] = [
  { month: "2026-11", checks: 493, newMembers: 14.8, active: 15, salesIncGst: 497 },
  { month: "2026-12", checks: 428, newMembers: 12.8, active: 27, salesIncGst: 461 },
  { month: "2027-01", checks: 791, newMembers: 23.7, active: 51, salesIncGst: 852 },
  { month: "2027-02", checks: 823, newMembers: 24.7, active: 75, salesIncGst: 1118 },
  { month: "2027-03", checks: 858, newMembers: 25.7, active: 100, salesIncGst: 1220 },
  { month: "2027-04", checks: 894, newMembers: 26.8, active: 126, salesIncGst: 1326 },
  { month: "2027-05", checks: 600, newMembers: 18.0, active: 142, salesIncGst: 1023 },
  { month: "2027-06", checks: 642, newMembers: 19.3, active: 160, salesIncGst: 1111 },
  { month: "2027-07", checks: 687, newMembers: 20.6, active: 179, salesIncGst: 1203 },
  { month: "2027-08", checks: 735, newMembers: 22.1, active: 199, salesIncGst: 1302 },
  { month: "2027-09", checks: 787, newMembers: 23.6, active: 220, salesIncGst: 1407 },
  { month: "2027-10", checks: 842, newMembers: 25.3, active: 243, salesIncGst: 1519 },
  { month: "2027-11", checks: 876, newMembers: 26.3, active: 264, salesIncGst: 1933 },
  { month: "2027-12", checks: 911, newMembers: 27.3, active: 286, salesIncGst: 1981 },
  { month: "2028-01", checks: 947, newMembers: 28.4, active: 306, salesIncGst: 2314 },
  { month: "2028-02", checks: 985, newMembers: 29.5, active: 327, salesIncGst: 2552 },
  { month: "2028-03", checks: 1024, newMembers: 30.7, active: 349, salesIncGst: 2678 },
  { month: "2028-04", checks: 1065, newMembers: 32.0, active: 372, salesIncGst: 2809 },
  { month: "2028-05", checks: 1108, newMembers: 33.2, active: 398, salesIncGst: 2676 },
  { month: "2028-06", checks: 1152, newMembers: 34.6, active: 424, salesIncGst: 2818 },
  { month: "2028-07", checks: 1198, newMembers: 36.0, active: 451, salesIncGst: 2966 },
  { month: "2028-08", checks: 1246, newMembers: 37.4, active: 479, salesIncGst: 3120 },
  { month: "2028-09", checks: 1296, newMembers: 38.9, active: 508, salesIncGst: 3281 },
  { month: "2028-10", checks: 1348, newMembers: 40.4, active: 538, salesIncGst: 3449 },
  { month: "2028-11", checks: 1375, newMembers: 41.2, active: 567, salesIncGst: 3799 },
  { month: "2028-12", checks: 1402, newMembers: 42.1, active: 595, salesIncGst: 3891 },
  { month: "2029-01", checks: 1430, newMembers: 42.9, active: 623, salesIncGst: 4183 },
  { month: "2029-02", checks: 1459, newMembers: 43.8, active: 650, salesIncGst: 4409 },
  { month: "2029-03", checks: 1488, newMembers: 44.6, active: 678, salesIncGst: 4556 },
  { month: "2029-04", checks: 1518, newMembers: 45.5, active: 706, salesIncGst: 4706 },
  { month: "2029-05", checks: 1548, newMembers: 46.5, active: 736, salesIncGst: 4671 },
  { month: "2029-06", checks: 1579, newMembers: 47.4, active: 766, salesIncGst: 4829 },
  { month: "2029-07", checks: 1611, newMembers: 48.3, active: 796, salesIncGst: 4990 },
  { month: "2029-08", checks: 1643, newMembers: 49.3, active: 826, salesIncGst: 5156 },
  { month: "2029-09", checks: 1676, newMembers: 50.3, active: 857, salesIncGst: 5325 },
  { month: "2029-10", checks: 1710, newMembers: 51.3, active: 887, salesIncGst: 5500 },
];
