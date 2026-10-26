import type { ReactNode } from "react";
import { EmployeeGate } from "@/components/employee-gate";

export default function PeopleLayout({ children }: { children: ReactNode }) {
  return <EmployeeGate next="/people">{children}</EmployeeGate>;
}
