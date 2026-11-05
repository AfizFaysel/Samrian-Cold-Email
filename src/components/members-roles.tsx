"use client";

import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SettingsCard } from "@/components/settings-card";
import { errorMessage, requestJson, responseError } from "@/lib/request";

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
  const [pendingDelete, setPendingDelete] = React.useState<Role | null>(null);
  const [email, setEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");
  const [status, setStatus] = React.useState("Loading members and roles...");
  const [loaded, setLoaded] = React.useState(false);

  const loadRoles = React.useCallback(async () => {
    const data = await requestJson<{ roles: Role[]; permissions: string[] }>("/api/settings/roles");
    setRoles(data.roles);
    setPermissions(data.permissions);
  }, []);

  const loadMembers = React.useCallback(async () => {
    setMembers(await requestJson<Member[]>("/api/settings/members"));
  }, []);

  React.useEffect(() => {
    Promise.all([loadRoles(), loadMembers()])
      .then(() => {
        setStatus("");
        setLoaded(true);
      })
      .catch((error) => setStatus(errorMessage(error)));
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
    if (!response.ok) return setStatus(await responseError(response));
    resetEditor();
    await loadRoles();
    setStatus(editing ? "Role updated" : "Role created");
  }

  function resetEditor() {
    setEditing(null);
    setName("");
    setSelected([]);
  }

  function editRole(role: Role) {
    setEditing(role);
    setName(role.name);
    setSelected(role.permissions);
  }

  async function deleteRole(role: Role) {
    setStatus("Deleting role...");
    const response = await fetch(`/api/settings/roles/${role.id}`, { method: "DELETE" });
    setPendingDelete(null);
    if (!response.ok) return setStatus(await responseError(response));
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
    if (!response.ok) return setStatus(await responseError(response));
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
    if (!response.ok) return setStatus(await responseError(response));
    setEmail("");
    setStatus("Invitation sent");
  }

  const roleOptions = roles.map((role) => ({ value: role.slug, label: role.name }));
  const builtIn = roles.filter((role) => role.builtIn);
  const custom = roles.filter((role) => !role.builtIn);

  return (
    <SettingsCard
      title="Members and roles"
      description="Who can use this workspace, and what each role is allowed to do."
    >
      {status ? (
        <Text role="status" type="supporting">
          {status}
        </Text>
      ) : null}

      <HStack gap={3} vAlign="end" wrap="wrap">
        <TextInput
          label="Invite email"
          type="email"
          width={280}
          value={email}
          onChange={setEmail}
          placeholder="teammate@example.com"
        />
        <Selector
          label="Invite role"
          width={200}
          value={inviteRole}
          onChange={setInviteRole}
          options={roleOptions}
        />
        <Button
          label="Send invite"
          variant="primary"
          isDisabled={!email.trim()}
          onClick={() => void invite()}
        />
      </HStack>

      <VStack gap={2}>
        <Heading level={4}>Members</Heading>
        {members.length > 0 ? (
          // Rows wrap so the role picker drops below the name on narrow screens.
          <VStack gap={0}>
            {members.map((member, index) => (
              <VStack key={member.id} gap={0}>
                {index > 0 ? <Divider /> : null}
                <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap" paddingBlock={2}>
                  <VStack gap={0} className="min-w-0">
                    <Text weight="medium" maxLines={1}>
                      {member.name || member.email || member.userId}
                    </Text>
                    {member.name && member.email ? (
                      <Text type="supporting" maxLines={1}>
                        {member.email}
                      </Text>
                    ) : null}
                  </VStack>
                  <Selector
                    label={`Role for ${member.email || member.userId}`}
                    isLabelHidden
                    width={200}
                    value={member.role}
                    onChange={(role) => void changeMember(member, role)}
                    options={roleOptions}
                  />
                </HStack>
              </VStack>
            ))}
          </VStack>
        ) : loaded ? (
          <Text type="supporting">No members found.</Text>
        ) : null}
      </VStack>

      <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={5}>
        <RoleList title="Built-in roles" roles={builtIn} />
        <RoleList
          title="Custom roles"
          roles={custom}
          onDelete={setPendingDelete}
          onEdit={editRole}
        />
      </Grid>

      <Divider />

      <VStack gap={4}>
        <Heading level={4}>{editing ? `Edit ${editing.name}` : "New custom role"}</Heading>
        <TextInput label="Role name" width="100%" value={name} onChange={setName} />
        <CheckboxList label="Permissions" density="compact" value={selected} onChange={setSelected}>
          {permissions.map((permission) => (
            <CheckboxListItem key={permission} value={permission} label={permission} />
          ))}
        </CheckboxList>
        <HStack gap={2}>
          <Button
            label={editing ? "Update role" : "Create role"}
            variant="primary"
            isDisabled={!name.trim()}
            onClick={() => void saveRole()}
          />
          {editing ? <Button label="Cancel" variant="secondary" onClick={resetEditor} /> : null}
        </HStack>
      </VStack>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "this role"}?`}
        description="Members with this role become members. This can't be undone."
        confirmText="Delete role"
        variant="destructive"
        onConfirm={() => (pendingDelete ? deleteRole(pendingDelete) : undefined)}
      />
    </SettingsCard>
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
    <VStack gap={2}>
      <Heading level={4}>{title}</Heading>
      {roles.length > 0 ? (
        <List hasDividers edge="flush">
          {roles.map((role) => (
            <ListItem
              key={role.id}
              label={role.name}
              description={`${role.permissions.length} permissions`}
              endContent={
                onEdit || onDelete ? (
                  <HStack gap={1}>
                    {onEdit ? (
                      <IconButton
                        label={`Edit ${role.name}`}
                        tooltip="Edit"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon={Pencil} />}
                        onClick={() => onEdit(role)}
                      />
                    ) : null}
                    {onDelete ? (
                      <IconButton
                        label={`Delete ${role.name}`}
                        tooltip="Delete"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon={Trash2} />}
                        onClick={() => onDelete(role)}
                      />
                    ) : null}
                  </HStack>
                ) : undefined
              }
            />
          ))}
        </List>
      ) : (
        <Text type="supporting">None yet.</Text>
      )}
    </VStack>
  );
}
