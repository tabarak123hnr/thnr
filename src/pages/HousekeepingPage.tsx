import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader, StatCard } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { housekeepingTasks } from "../data/mock";

const priorityTone = {
  high: "danger",
  normal: "gold",
  low: "muted",
} as const;

const statusTone = {
  pending: "warning",
  in_progress: "info",
  done: "success",
} as const;

const typeLabel = {
  checkout_clean: "Checkout clean",
  stayover: "Stayover",
  deep_clean: "Deep clean",
  turndown: "Turndown",
};

export function HousekeepingPage() {
  const { t } = useApp();
  const pending = housekeepingTasks.filter((h) => h.status !== "done").length;

  return (
    <div>
      <PageHeader
        title={t.pages.housekeepingTitle}
        subtitle={t.pages.housekeepingSub}
        actions={<Button>{t.common.add} task</Button>}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tasks" value={String(pending)} />
        <StatCard label="In progress" value="1" />
        <StatCard label="Unassigned" value="2" hint="Needs staffing" />
      </div>
      <Card>
        <Table
          headers={[
            t.common.room,
            t.common.type,
            "Priority",
            "Assignee",
            "Due",
            t.status,
            t.common.actions,
          ]}
        >
          {housekeepingTasks.map((task) => (
            <Tr key={task.id}>
              <Td className="font-bold">
                {t.common.room} {task.room}
              </Td>
              <Td>{typeLabel[task.type]}</Td>
              <Td>
                <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
              </Td>
              <Td>{task.assignee}</Td>
              <Td className="text-muted">{task.due}</Td>
              <Td>
                <Badge tone={statusTone[task.status]}>{task.status.replace("_", " ")}</Badge>
              </Td>
              <Td>
                <Button size="sm" variant="secondary">
                  Update
                </Button>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
