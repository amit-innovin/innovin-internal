import type { ReactNode } from "react";
import { EmployeeGate } from "@/components/employee-gate";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <EmployeeGate next="/attendance">{children}</EmployeeGate>;
}
