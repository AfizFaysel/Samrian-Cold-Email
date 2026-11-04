"use client";

import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Selector } from "@astryxdesign/core/Selector";
import { Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
  builtIn: boolean;
};

type Member = {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  role: string;
};

export function MembersRoles() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [email, setEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");
  const [status, setStatus] = React.useState("Loading members and roles...");

  const loadRoles = React.useCallback(async () => {
    const response = await fetch("/api/settings/roles");
    if (!response.ok) throw new Error("Could not load roles");
    const data = (await response.json()) as { roles: Role[]; permissions: string[] };
    setRoles(data.roles);
    setPermissions(data.permissions);
  }, []);

  const loadMembers = React.useCallback(async () => {
    const response = await fetch("/api/settings/members");
    if (!response.ok) throw new Error("Could not load members");
    setMembers((await response.json()) as Member[]);
  }, []);

  React.useEffect(() => {
    Promise.all([loadRoles(), loadMembers()])
      .then(() => setStatus(""))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Could not load team"));
  }, [loadMembers, loadRoles]);

  async function saveRole() {
    setStatus(editing ? "Updating role..." : "Creating role...");
    const response = await fetch(
      editing ? `/api/settings/roles/${editing.id}` : "/api/settings/roles",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: selected }),
      }
    );
    if (!response.ok) return setStatus(await readError(response));
    setName("");
    setSelected([]);
    setEditing(null);
    await loadRoles();
    setStatus(editing ? "Role updated" : "Role created");
  }

  function editRole(role: Role) {
    setEditing(role);
    setName(role.name);
    setSelected(role.permissions);
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete ${role.name}? Members using it will become members.`)) return;
    setStatus("Deleting role...");
    const response = await fetch(`/api/settings/roles/${role.id}`, { method: "DELETE" });
    if (!response.ok) return setStatus(await readError(response));
    await Promise.all([loadRoles(), loadMembers()]);
    setStatus("Role deleted");
  }

  async function changeMember(member: Member, role: string) {
    setStatus("Updating member...");
    const response = await fetch("/api/settings/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });
    if (!response.ok) return setStatus(await readError(response));
    await loadMembers();
    setStatus("Member updated");
  }

  async function invite() {
    setStatus("Sending invite...");
    const response = await fetch("/api/settings/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    if (!response.ok) return setStatus(await readError(response));
    setEmail("");
    setStatus("Invitation sent");
  }

  const roleOptions = roles.map((role) => ({ value: role.slug, label: role.name }));
  const builtIn = roles.filter((role) => role.builtIn);
  const custom = roles.filter((role) => !role.builtIn);

  return (
    <section className="flex flex-col gap-6 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Members and roles</h2>
        <p className="text-base text-secondary">
          Control team access with provider-managed roles and permissions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Invite email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Selector
          label="Invite role"
          width="100%"
          value={inviteRole}
          onChange={setInviteRole}
          options={roleOptions}
        />
        <Button onClick={invite} disabled={!email.trim()}>
          Send invite
        </Button>
      </div>

      <div>
        <h3 className="text-base font-medium text-primary">Members</h3>
        <div className="mt-2 divide-y divide-border border-y border-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 py-3 sm:grid-cols-[1fr_180px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-primary">
                  {member.name || member.email || member.userId}
                </p>
                {member.email && <p className="truncate text-sm text-secondary">{member.email}</p>}
              </div>
              <Selector
                label={`Role for ${member.email || member.userId}`}
                isLabelHidden
                width="100%"
                value={member.role}
                onChange={(role) => changeMember(member, role)}
                options={roleOptions}
              />
            </div>
          ))}
          {!members.length && !status && (
            <p className="py-3 text-base text-secondary">No members found.</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <RoleList title="Built-in roles" roles={builtIn} />
        <RoleList title="Custom roles" roles={custom} onDelete={deleteRole} onEdit={editRole} />
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">Role name</Label>
          <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <CheckboxList label="Permissions" density="compact" value={selected} onChange={setSelected}>
          {permissions.map((permission) => (
            <CheckboxListItem key={permission} value={permission} label={permission} />
          ))}
        </CheckboxList>
        <div className="flex gap-2">
          <Button onClick={saveRole} disabled={!name.trim()}>
            {editing ? "Update role" : "Create role"}
          </Button>
          {editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setName("");
                setSelected([]);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {status && (
        <p role="status" className="text-base text-secondary">
          {status}
        </p>
      )}
    </section>
  );
}

function RoleList({
  title,
  roles,
  onDelete,
  onEdit,
}: {
  title: string;
  roles: Role[];
  onDelete?: (role: Role) => void;
  onEdit?: (role: Role) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-medium text-primary">{title}</h3>
      <div className="mt-2 divide-y divide-border border-y border-border">
        {roles.map((role) => (
          <div key={role.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-primary">{role.name}</p>
              <p className="text-sm text-secondary">{role.permissions.length} permissions</p>
            </div>
            <div className="flex">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${role.name}`}
                  title={`Edit ${role.name}`}
                  onClick={() => onEdit(role)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${role.name}`}
                  title={`Delete ${role.name}`}
                  onClick={() => onDelete(role)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {!roles.length && <p className="py-3 text-base text-secondary">None yet.</p>}
      </div>
    </div>
  );
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Operation failed";
}
