import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { useApp } from "../context/app-context";
import { menuItems } from "../data/mock";
import { formatRs } from "../lib/utils";

export function MenuPage() {
  const { t, language } = useApp();

  return (
    <div>
      <PageHeader
        title={t.pages.menuTitle}
        subtitle={t.pages.menuSub}
        actions={
          <>
            <Button variant="secondary">{t.common.export}</Button>
            <Button>{t.common.add} item</Button>
          </>
        }
      />
      <Card>
        <Table
          headers={[
            t.common.name,
            "Category",
            t.common.amount,
            "Prep",
            t.status,
            t.common.actions,
          ]}
        >
          {menuItems.map((item) => (
            <Tr key={item.id}>
              <Td className="font-semibold">
                {language === "ur" ? item.nameUr : item.name}
              </Td>
              <Td>
                <Badge tone="muted">
                  {language === "ur" ? item.categoryUr : item.category}
                </Badge>
              </Td>
              <Td className="font-bold">{formatRs(item.price, t.common.rs)}</Td>
              <Td className="text-muted">{item.prepMinutes}m</Td>
              <Td>
                <Badge tone={item.available ? "success" : "danger"}>
                  {item.available ? "Available" : "86'd"}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost">
                    {t.common.edit}
                  </Button>
                  <Button size="sm" variant="secondary">
                    Toggle
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
