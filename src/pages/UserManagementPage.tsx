import { Eye, Lock, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Field, Input, PageHeader, TextArea } from "../components/ui/Page";
import { FancySelect, SelectField } from "../components/ui/FancySelect";
import { Table, Td, Tr } from "../components/ui/Table";
import { PERMISSIONS, type PermissionId } from "../config/permissions";
import { useApp } from "../context/app-context";
import { useToast } from "../context/toast-context";
import {
  confirmCurrentUserPassword,
  createManagedUser,
  createRole,
  deleteManagedUser,
  subscribeRoles,
  subscribeUsers,
  updateManagedUser,
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
  status: "active" as ManagedUserDoc["status"],
};

const emptyRoleForm = {
  name: "",
  description: "",
};

type SecureAction = "edit" | "delete";

function isHiddenAdminRole(role: RoleDoc) {
  const name = role.name.trim().toLowerCase();
  return role.id === "admin" || role.system === true || name === "admin";
}

function isHiddenAdminUser(user: ManagedUserDoc) {
  return (
    user.isAdmin === true ||
    user.roleId === "admin" ||
    user.roleName?.trim().toLowerCase() === "admin" ||
    user.username?.trim().toLowerCase() === "admin"
  );
}

function formatCreatedAt(value: unknown) {
  if (!value) return "—";
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (!Number.isNaN(seconds)) return new Date(seconds * 1000).toLocaleString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }
  return "—";
}

function mapReauthError(err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Incorrect password. Try again.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many attempts. Wait a moment and try again.";
  }
  return err instanceof Error ? err.message : "Could not verify password.";
}

function PermissionGrid({
  selected,
  onChange,
  language,
  readOnly,
}: {
  selected: PermissionId[];
  onChange?: (next: PermissionId[]) => void;
  language: "en" | "ur";
  readOnly?: boolean;
}) {
  const { t } = useApp();

  function toggle(id: PermissionId) {
    if (readOnly || !onChange) return;
    onChange(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id]);
  }

  return (
    <div>
      {!readOnly ? (
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="cursor-pointer text-xs font-bold text-[var(--accent)] hover:underline"
            onClick={() => onChange?.(PERMISSIONS.map((p) => p.id))}
          >
            {t.pages.selectAll}
          </button>
          <span className="text-muted">·</span>
          <button
            type="button"
            className="cursor-pointer text-xs font-bold text-muted hover:underline"
            onClick={() => onChange?.([])}
          >
            {t.pages.clearAll}
          </button>
        </div>
      ) : null}
      <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-app bg-app p-3 sm:grid-cols-2">
        {PERMISSIONS.map((perm) => {
          const checked = selected.includes(perm.id);
          return (
            <label
              key={perm.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition",
                readOnly ? "cursor-default" : "cursor-pointer",
                checked
                  ? "border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-accent-soft"
                  : "border-transparent hover:bg-elevated",
              )}
            >
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={checked}
                disabled={readOnly}
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ManagedUserDoc["status"]>("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [roleModal, setRoleModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [secureAction, setSecureAction] = useState<SecureAction | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [activeUser, setActiveUser] = useState<ManagedUserDoc | null>(null);

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

  const staffUsers = useMemo(
    () => users.filter((user) => !isHiddenAdminUser(user)),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staffUsers.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (roleFilter !== "all" && user.roleId !== roleFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.username.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone.toLowerCase().includes(q) ||
        user.roleName.toLowerCase().includes(q)
      );
    });
  }, [staffUsers, search, statusFilter, roleFilter]);

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

  function openView(user: ManagedUserDoc) {
    setActiveUser(user);
    setViewModal(true);
  }

  function requestSecureAction(user: ManagedUserDoc, action: SecureAction) {
    setActiveUser(user);
    setSecureAction(action);
    setAdminPassword("");
    setFormError(null);
    setPasswordModal(true);
  }

  function fillEditForm(user: ManagedUserDoc) {
    setFormError(null);
    setUserForm({
      name: user.name,
      username: user.username,
      phone: user.phone,
      email: user.email,
      password: "",
      roleId: user.roleId,
      status: user.status,
    });
    setUserPerms((user.permissions ?? []) as PermissionId[]);
    setEditModal(true);
  }

  async function submitPasswordGate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUser || !secureAction) return;
    setSaving(true);
    setFormError(null);
    try {
      await confirmCurrentUserPassword(adminPassword);
      setPasswordModal(false);
      setAdminPassword("");
      if (secureAction === "edit") {
        fillEditForm(activeUser);
      } else {
        await deleteManagedUser(activeUser.id);
        setUsers((prev) => prev.filter((u) => u.id !== activeUser.id));
        toastSuccess("User deleted", activeUser.name);
        setActiveUser(null);
      }
      setSecureAction(null);
    } catch (err) {
      setFormError(mapReauthError(err));
    } finally {
      setSaving(false);
    }
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
      const message = err instanceof Error ? err.message : "Failed to create user.";
      const clean = message.replace("Firebase:", "").trim();
      setFormError(clean);
      toastError("Could not add user", clean);
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUser) return;
    const role = visibleRoles.find((r) => r.id === userForm.roleId);
    if (!role) {
      setFormError(t.pages.noRolesYet);
      return;
    }
    if (userPerms.length === 0) {
      setFormError("Select at least one permission.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateManagedUser(activeUser.id, {
        name: userForm.name,
        username: userForm.username,
        phone: userForm.phone,
        roleId: role.id,
        roleName: role.name,
        permissions: userPerms,
        status: userForm.status,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === activeUser.id
            ? {
                ...u,
                name: userForm.name.trim(),
                username: userForm.username.trim().toLowerCase(),
                phone: userForm.phone.trim(),
                roleId: role.id,
                roleName: role.name,
                permissions: userPerms,
                status: userForm.status,
              }
            : u,
        ),
      );
      setEditModal(false);
      setActiveUser(null);
      toastSuccess("User updated", userForm.name.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user.";
      setFormError(message);
      toastError("Could not update user", message);
    } finally {
      setSaving(false);
    }
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U";

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
              className="cursor-pointer hover:border-[var(--accent)]"
              onClick={openRoleModal}
            >
              {t.pages.addRole}
            </Button>
            <Button type="button" className="cursor-pointer" onClick={openUserModal}>
              {t.pages.addUser}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRoles.length === 0 ? (
          <Card className="!p-4 sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-muted">{t.pages.noRolesYet}</p>
            <Button type="button" size="sm" variant="gold" className="mt-3" onClick={openRoleModal}>
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

      <Card className="mb-4 !p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username, email, phone, or role…"
              className="h-11 rounded-2xl ps-10"
            />
          </div>
          <FancySelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
            className="lg:w-44"
            options={[
              { value: "all", label: "All status", description: "Every account state" },
              { value: "active", label: t.common.active, description: "Can sign in" },
              { value: "invited", label: "Invited", description: "Pending first login" },
              { value: "disabled", label: t.common.inactive, description: "Access blocked" },
            ]}
          />
          <FancySelect
            value={roleFilter}
            onChange={setRoleFilter}
            className="lg:w-52"
            options={[
              { value: "all", label: "All roles", description: "Any assigned role" },
              ...visibleRoles.map((role) => ({
                value: role.id,
                label: role.name,
                description: role.description || undefined,
              })),
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Showing {filteredUsers.length} of {staffUsers.length} staff users
        </p>
      </Card>

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
          {filteredUsers.length === 0 ? (
            <Tr>
              <Td className="text-muted" colSpan={7}>
                {staffUsers.length === 0 ? t.common.empty : "No users match your search."}
              </Td>
            </Tr>
          ) : (
            filteredUsers.map((user) => (
              <Tr key={user.id}>
                <Td className="font-semibold">{user.name}</Td>
                <Td className="text-muted">@{user.username}</Td>
                <Td className="text-muted">{user.phone || "—"}</Td>
                <Td className="text-muted">{user.email}</Td>
                <Td>
                  <Badge tone="gold">{user.roleName}</Badge>
                </Td>
                <Td>
                  <Badge tone={statusTone[user.status] ?? "muted"}>{user.status}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="cursor-pointer !bg-sky-600 !text-white hover:!bg-sky-500"
                      icon={<Eye className="h-3.5 w-3.5" />}
                      onClick={() => openView(user)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="gold"
                      className="cursor-pointer"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => requestSecureAction(user, "edit")}
                    >
                      {t.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="cursor-pointer"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => requestSecureAction(user, "delete")}
                    >
                      {t.common.delete}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))
          )}
        </Table>
      </Card>

      {/* Password gate for Edit / Delete */}
      <Modal
        open={passwordModal}
        onClose={() => {
          if (saving) return;
          setPasswordModal(false);
          setAdminPassword("");
          setSecureAction(null);
          setFormError(null);
        }}
        title={secureAction === "delete" ? "Confirm delete" : "Confirm edit"}
        subtitle={
          secureAction === "delete"
            ? `Enter your login password to delete ${activeUser?.name ?? "this user"}.`
            : `Enter your login password to edit ${activeUser?.name ?? "this user"}.`
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setPasswordModal(false);
                setAdminPassword("");
                setSecureAction(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              form="password-gate-form"
              variant={secureAction === "delete" ? "danger" : "gold"}
              disabled={saving}
            >
              {saving
                ? "Verifying…"
                : secureAction === "delete"
                  ? "Verify & delete"
                  : "Verify & edit"}
            </Button>
          </>
        }
      >
        <form id="password-gate-form" className="space-y-4" onSubmit={submitPasswordGate}>
          {formError && passwordModal ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}
          <div className="rounded-xl border border-app bg-app px-4 py-3 text-sm text-muted">
            For security, we re-check <span className="font-semibold text-app">your</span> password
            before {secureAction === "delete" ? "deleting" : "editing"} staff accounts.
          </div>
          <Field label="Your password">
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                required
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your account password"
                className="ps-10"
              />
            </div>
          </Field>
        </form>
      </Modal>

      {/* Add role */}
      <Modal
        open={roleModal}
        onClose={() => !saving && setRoleModal(false)}
        title={t.pages.addRole}
        subtitle={t.pages.addRoleSub}
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setRoleModal(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="add-role-form" disabled={saving}>
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
            />
          </Field>
          <Field label={t.pages.roleDescription}>
            <TextArea
              value={roleForm.description}
              onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </Field>
        </form>
      </Modal>

      {/* Add user */}
      <Modal
        open={userModal}
        onClose={() => !saving && setUserModal(false)}
        title={t.pages.addUser}
        subtitle={t.pages.addUserSub}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setUserModal(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="add-user-form" disabled={saving || visibleRoles.length === 0}>
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
              />
            </Field>
            <Field label={t.pages.username}>
              <Input
                required
                value={userForm.username}
                onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            <Field label={t.common.phone}>
              <Input
                required
                value={userForm.phone}
                onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label={t.common.email}>
              <Input
                required
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            <Field label={t.pages.password}>
              <Input
                required
                type="password"
                minLength={6}
                value={userForm.password}
                onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <SelectField label={t.pages.selectRole}>
              <FancySelect
                required
                value={userForm.roleId}
                onChange={(roleId) => setUserForm((p) => ({ ...p, roleId }))}
                placeholder={
                  visibleRoles.length === 0 ? t.pages.noRolesYet : t.pages.selectRole
                }
                options={visibleRoles.map((role) => ({
                  value: role.id,
                  label: role.name,
                  description: role.description || "Staff role",
                }))}
              />
            </SelectField>
          </div>
          <Field label={t.pages.permissions}>
            <PermissionGrid selected={userPerms} onChange={setUserPerms} language={language} />
          </Field>
        </form>
      </Modal>

      {/* Edit user */}
      <Modal
        open={editModal}
        onClose={() => !saving && setEditModal(false)}
        title={`Edit · ${activeUser?.name ?? "User"}`}
        subtitle="Update profile, role, status, and module access."
        wide
        footer={
          <>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setEditModal(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="edit-user-form" variant="gold" disabled={saving}>
              {saving ? t.pages.creating : t.common.save}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" className="space-y-4" onSubmit={submitEdit}>
          {formError && editModal ? (
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
              />
            </Field>
            <Field label={t.pages.username}>
              <Input
                required
                value={userForm.username}
                onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
              />
            </Field>
            <Field label={t.common.phone}>
              <Input
                required
                value={userForm.phone}
                onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label={t.common.email}>
              <Input value={userForm.email} disabled className="opacity-70" />
            </Field>
            <SelectField label={t.pages.selectRole}>
              <FancySelect
                required
                value={userForm.roleId}
                onChange={(roleId) => setUserForm((p) => ({ ...p, roleId }))}
                options={visibleRoles.map((role) => ({
                  value: role.id,
                  label: role.name,
                  description: role.description || "Staff role",
                }))}
              />
            </SelectField>
            <SelectField label={t.status}>
              <FancySelect
                value={userForm.status}
                onChange={(status) =>
                  setUserForm((p) => ({
                    ...p,
                    status: status as ManagedUserDoc["status"],
                  }))
                }
                options={[
                  { value: "active", label: t.common.active, description: "Can sign in" },
                  { value: "invited", label: "Invited", description: "Pending first login" },
                  {
                    value: "disabled",
                    label: t.common.inactive,
                    description: "Access blocked",
                  },
                ]}
              />
            </SelectField>
          </div>
          <Field label={t.pages.permissions}>
            <PermissionGrid selected={userPerms} onChange={setUserPerms} language={language} />
          </Field>
        </form>
      </Modal>

      {/* View — details only */}
      <Modal
        open={viewModal}
        onClose={() => setViewModal(false)}
        title="User details"
        subtitle="Read-only profile and module access."
        wide
        footer={
          <Button type="button" variant="secondary" onClick={() => setViewModal(false)}>
            Close
          </Button>
        }
      >
        {activeUser ? (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-app bg-gradient-to-br from-[var(--accent-soft)] via-elevated to-app p-6">
              <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-[color-mix(in_oklab,var(--accent)_25%,transparent)]" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-lg font-extrabold text-[var(--accent-text)] shadow-md">
                  {initials(activeUser.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-extrabold tracking-tight">{activeUser.name}</h3>
                  <p className="text-sm text-muted">@{activeUser.username}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="gold">{activeUser.roleName}</Badge>
                    <Badge tone={statusTone[activeUser.status]}>{activeUser.status}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [t.common.email, activeUser.email],
                [t.common.phone, activeUser.phone || "—"],
                [t.common.role, activeUser.roleName],
                ["Role ID", activeUser.roleId],
                ["User ID", activeUser.id],
                ["Last active", activeUser.lastActive || "—"],
                ["Created", formatCreatedAt(activeUser.createdAt)],
                [t.status, activeUser.status],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-app bg-app px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 text-sm font-semibold break-all">{value}</p>
                </div>
              ))}
            </div>

            <Field label={t.pages.permissions}>
              <PermissionGrid
                selected={(activeUser.permissions ?? []) as PermissionId[]}
                language={language}
                readOnly
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
