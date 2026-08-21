import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, Select, TextArea } from "../components/ui/Page";
import { Table, Td, Tr } from "../components/ui/Table";
import { PERMISSIONS, type PermissionId } from "../config/permissions";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import {
  createManagedUser,
  createRole,
  subscribeRoles,
  subscribeUsers,
  type ManagedUserDoc,
  type RoleDoc,
} from "../services/userManagement";
import { cn } from "../lib/utils";

const statusTone = {
  active: "success",
  invited: "info",
  disabled: "muted",
} as const;

const emptyUserForm = {
  name: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  roleId: "",
};

const emptyRoleForm = {
  name: "",
  description: "",
};

function isHiddenAdminRole(role: RoleDoc) {
  const name = role.name.trim().toLowerCase();
  return role.id === "admin" || role.system === true || name === "admin";
}

function PermissionGrid({
  selected,
  onChange,
  language,
}: {
  selected: PermissionId[];
  onChange: (next: PermissionId[]) => void;
  language: "en" | "ur";
}) {
  const { t } = useApp();

  function toggle(id: PermissionId) {
    onChange(
      selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id],
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="cursor-pointer text-xs font-bold text-[var(--accent)] hover:underline"
          onClick={() => onChange(PERMISSIONS.map((p) => p.id))}
        >
          {t.pages.selectAll}
        </button>
        <span className="text-muted">·</span>
        <button
          type="button"
          className="cursor-pointer text-xs font-bold text-muted hover:underline"
          onClick={() => onChange([])}
        >
          {t.pages.clearAll}
        </button>
      </div>
      <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-app bg-app p-3 sm:grid-cols-2">
        {PERMISSIONS.map((perm) => {
          const checked = selected.includes(perm.id);
          return (
            <label
              key={perm.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition",
                checked
                  ? "border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-accent-soft"
                  : "border-transparent hover:bg-elevated",
              )}
            >
              <input
                type="checkbox"
                className="cursor-pointer accent-[var(--accent)]"
                checked={checked}
                onChange={() => toggle(perm.id)}
              />
              <span className="font-medium">
                {language === "ur" ? perm.labelUr : perm.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function UserManagementPage() {
  const { t, language } = useApp();
  const { success: toastSuccess, error: toastError } = useToast();
  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [users, setUsers] = useState<ManagedUserDoc[]>([]);
  const [roleModal, setRoleModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userPerms, setUserPerms] = useState<PermissionId[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const unsubRoles = subscribeRoles(setRoles);
    const unsubUsers = subscribeUsers(setUsers);
    return () => {
      unsubRoles();
      unsubUsers();
    };
  }, []);

  const visibleRoles = useMemo(
    () => roles.filter((role) => !isHiddenAdminRole(role)),
    [roles],
  );

  const selectedRole = useMemo(
    () => visibleRoles.find((r) => r.id === userForm.roleId) ?? null,
    [visibleRoles, userForm.roleId],
  );

  function openRoleModal() {
    setFormError(null);
    setRoleForm(emptyRoleForm);
    setRoleModal(true);
  }

  function openUserModal() {
    setFormError(null);
    setUserForm(emptyUserForm);
    setUserPerms([]);
    setUserModal(true);
  }

  function onRolePick(roleId: string) {
    setUserForm((prev) => ({ ...prev, roleId }));
  }

  async function submitRole(e: React.FormEvent) {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setFormError("Role name is required.");
      return;
    }
    if (roleForm.name.trim().toLowerCase() === "admin") {
      setFormError("The admin role is reserved and cannot be created.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const id = await createRole({
        name: roleForm.name,
        description: roleForm.description,
      });
      setRoles((prev) => {
        if (prev.some((r) => r.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            name: roleForm.name.trim(),
            description: roleForm.description.trim(),
            permissions: [],
            system: false,
          },
        ].sort((a, b) => a.name.localeCompare(b.name));
      });
      setRoleModal(false);
      toastSuccess(t.pages.roleCreated, roleForm.name.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create role.";
      setFormError(message);
      toastError("Could not add role", message);
    } finally {
      setSaving(false);
    }
  }

  async function submitUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) {
      setFormError(t.pages.noRolesYet);
      return;
    }
    if (userForm.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (userPerms.length === 0) {
      setFormError("Select at least one permission.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const uid = await createManagedUser({
        name: userForm.name,
        username: userForm.username,
        phone: userForm.phone,
        email: userForm.email,
        password: userForm.password,
        roleId: selectedRole.id,
        roleName: selectedRole.name,
        permissions: userPerms,
      });
      setUsers((prev) => {
        if (prev.some((u) => u.id === uid)) return prev;
        return [
          ...prev,
          {
            id: uid,
            name: userForm.name.trim(),
            username: userForm.username.trim().toLowerCase(),
            phone: userForm.phone.trim(),
            email: userForm.email.trim().toLowerCase(),
            roleId: selectedRole.id,
            roleName: selectedRole.name,
            permissions: userPerms,
            status: "active" as const,
            lastActive: "Just now",
          },
        ].sort((a, b) => a.name.localeCompare(b.name));
      });
      setUserModal(false);
      toastSuccess(t.pages.userCreated, userForm.name.trim());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create user.";
      const clean = message.replace("Firebase:", "").trim();
      setFormError(clean);
      toastError("Could not add user", clean);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t.pages.usersTitle}
        subtitle={t.pages.usersSub}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer hover:scale-[1.02] hover:border-[var(--accent)]"
              onClick={openRoleModal}
            >
              {t.pages.addRole}
            </Button>
            <Button
              type="button"
              className="cursor-pointer hover:scale-[1.02]"
              onClick={openUserModal}
            >
              {t.pages.addUser}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRoles.length === 0 ? (
          <Card className="!p-4 sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-muted">{t.pages.noRolesYet}</p>
            <Button
              type="button"
              size="sm"
              variant="gold"
              className="mt-3 cursor-pointer"
              onClick={openRoleModal}
            >
              {t.pages.addRole}
            </Button>
          </Card>
        ) : (
          visibleRoles.map((role) => (
            <Card key={role.id} className="!p-4 transition hover:border-[var(--accent)]">
              <p className="text-sm font-bold">{role.name}</p>
              <p className="mt-1 text-xs text-muted">{role.description || "—"}</p>
            </Card>
          ))
        )}
      </div>

      <Card>
        <Table
          headers={[
            t.common.name,
            t.pages.username,
            t.common.phone,
            t.common.email,
            t.common.role,
            t.status,
            t.common.actions,
          ]}
        >
          {users.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={7}>
                {t.common.empty}
              </Td>
            </Tr>
          ) : (
            users.map((user) => (
              <Tr key={user.id}>
                <Td className="font-semibold">{user.name}</Td>
                <Td className="text-muted">@{user.username}</Td>
                <Td className="text-muted">{user.phone || "—"}</Td>
                <Td className="text-muted">{user.email}</Td>
                <Td>
                  <Badge tone="gold">{user.roleName}</Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone[user.status] ?? "muted"}>
                    {user.status}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="cursor-pointer">
                      {t.common.edit}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </Table>
      </Card>

      <Modal
        open={roleModal}
        onClose={() => !saving && setRoleModal(false)}
        title={t.pages.addRole}
        subtitle={t.pages.addRoleSub}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => setRoleModal(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="add-role-form"
              className="cursor-pointer"
              disabled={saving}
            >
              {saving ? t.pages.creating : t.common.save}
            </Button>
          </>
        }
      >
        <form id="add-role-form" className="space-y-4" onSubmit={submitRole}>
          {formError && roleModal ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}
          <Field label={t.pages.roleName}>
            <Input
              required
              value={roleForm.name}
              onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Night Manager"
            />
          </Field>
          <Field label={t.pages.roleDescription}>
            <TextArea
              value={roleForm.description}
              onChange={(e) =>
                setRoleForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="What this role can do"
              rows={2}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={userModal}
        onClose={() => !saving && setUserModal(false)}
        title={t.pages.addUser}
        subtitle={t.pages.addUserSub}
        wide
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => setUserModal(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="add-user-form"
              className="cursor-pointer"
              disabled={saving || visibleRoles.length === 0}
            >
              {saving ? t.pages.creating : t.common.save}
            </Button>
          </>
        }
      >
        <form id="add-user-form" className="space-y-4" onSubmit={submitUser}>
          {formError && userModal ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.common.name}>
              <Input
                required
                value={userForm.name}
                onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </Field>
            <Field label={t.pages.username}>
              <Input
                required
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="e.g. hassan.reception"
                autoComplete="off"
              />
            </Field>
            <Field label={t.common.phone}>
              <Input
                required
                value={userForm.phone}
                onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="03XX-XXXXXXX"
              />
            </Field>
            <Field label={t.common.email}>
              <Input
                required
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@tabarak.pk"
                autoComplete="off"
              />
            </Field>
            <Field label={t.pages.password}>
              <Input
                required
                type="password"
                minLength={6}
                value={userForm.password}
                onChange={(e) =>
                  setUserForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
            </Field>
            <Field label={t.pages.selectRole}>
              <Select
                required
                value={userForm.roleId}
                onChange={(e) => onRolePick(e.target.value)}
              >
                <option value="" disabled>
                  {visibleRoles.length === 0 ? t.pages.noRolesYet : t.pages.selectRole}
                </option>
                {visibleRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t.pages.permissions}>
            <PermissionGrid
              selected={userPerms}
              onChange={setUserPerms}
              language={language}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
