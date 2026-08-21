import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { employees } from "../data/mock";

const statusTone = {
  active: "success",
  on_leave: "warning",
  inactive: "muted",
} as const;

export function EmployeesPage() {
  const { t, language } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.employeesTitle}
        subtitle={t.pages.employeesSub}
        actions={<Button>{t.common.add} employee</Button>}
      />
      <Card>
        <Table
          headers={[
            t.common.name,
            t.common.role,
            t.common.department,
            t.common.phone,
            t.common.shift,
            t.status,
            t.common.actions,
          ]}
        >
          {employees.map((emp) => (
            <Tr key={emp.id}>
              <Td className="font-semibold">
                {language === "ur" ? emp.nameUr : emp.name}
              </Td>
              <Td>
                <Badge tone="gold">{t.roles[emp.role]}</Badge>
              </Td>
              <Td>{emp.department}</Td>
              <Td className="text-muted">{emp.phone}</Td>
              <Td>{emp.shift}</Td>
              <Td>
                <Badge tone={statusTone[emp.status]}>
                  {emp.status === "on_leave" ? "On leave" : emp.status}
                </Badge>
              </Td>
              <Td>
                <Button size="sm" variant="ghost">
                  {t.common.edit}
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
