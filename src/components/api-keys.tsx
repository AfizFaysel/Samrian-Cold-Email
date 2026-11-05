"use client";

import { scopePresets, scopes, type Scope } from "@samrian/contracts";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import * as React from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SettingsCard } from "@/components/settings-card";
import { errorMessage, requestJson } from "@/lib/request";

type Access = keyof typeof scopePresets | "custom";

// Presets come from the public contracts, so the CLI and this form grant the same scopes.
const ACCESS_OPTIONS: Array<{ value: Access; label: string; description: string }> = [
  {
    value: "read-only",
    label: "Read only",
    description: "Dashboards and reports. Can't change anything.",
  },
  {
    value: "operator",
    label: "Operator",
    description: "Manage contacts, groups and campaigns. Can't launch campaigns or send replies.",
  },
  {
    value: "sender",
    label: "Full access",
    description: "Everything, including launching campaigns and replying from the inbox.",
  },
  { value: "custom", label: "Custom", description: "Pick each scope yourself." },
];

type KeyMetadata = {
  id: string;
  name: string;
  scopes: Scope[];
  createdAt: string;
  obfuscatedValue?: string;
};

export function ApiKeys() {
  const [keys, setKeys] = React.useState<KeyMetadata[]>([]);
  const [name, setName] = React.useState("");
  const [access, setAccess] = React.useState<Access>("read-only");
  const [selected, setSelected] = React.useState<Scope[]>([]);
  const chosenScopes: Scope[] = access === "custom" ? selected : [...scopePresets[access]];

  const chooseAccess = (next: Access) => {
    // Custom starts from the preset that was picked, so small tweaks stay small.
    if (next === "custom" && access !== "custom") setSelected([...scopePresets[access]]);
    setAccess(next);
  };
  const [created, setCreated] = React.useState<string>();
  const [error, setError] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [pendingRevoke, setPendingRevoke] = React.useState<KeyMetadata | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);

  const load = React.useCallback(async () => {
    setKeys(await requestJson<KeyMetadata[]>("/api/settings/api-keys"));
  }, []);

  React.useEffect(() => {
    load().catch((loadError: unknown) => setError(errorMessage(loadError)));
  }, [load]);

  async function create() {
    setError("");
    setIsCreating(true);
    try {
      const result = await requestJson<KeyMetadata & { value: string }>("/api/settings/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes: chosenScopes }),
      });
      setCreated(result.value);
      setKeys((current) => [result, ...current]);
      setName("");
      setSelected([]);
      setAccess("read-only");
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setIsCreating(false);
    }
  }

  async function revoke(key: KeyMetadata) {
    setError("");
    setIsRevoking(true);
    try {
      await requestJson(`/api/settings/api-keys/${encodeURIComponent(key.id)}/revoke`, {
        method: "POST",
      });
      await load();
    } catch (revokeError) {
      setError(errorMessage(revokeError));
    } finally {
      setIsRevoking(false);
      setPendingRevoke(null);
    }
  }

  return (
    <SettingsCard
      title="API keys"
      description="Separate keys for the CLI, CI and integrations, each limited to the scopes it needs."
    >
      {created ? (
        <Banner
          status="warning"
          title="Copy this key now. It's shown once."
          description="Store it in your secret manager. If you lose it, revoke it and create a new one."
          collapsible={false}
        >
          <CodeBlock code={created} />
        </Banner>
      ) : null}
      {error ? <Banner status="error" title={error} /> : null}

      <TextInput label="Key name" width="100%" value={name} onChange={setName} placeholder="CI" />
      <RadioList label="Access" value={access} onChange={(value) => chooseAccess(value as Access)}>
        {ACCESS_OPTIONS.map((option) => (
          <RadioListItem
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
          />
        ))}
      </RadioList>
      {access === "custom" ? (
        <CheckboxList
          label="Scopes"
          density="compact"
          value={selected}
          onChange={(values) => setSelected(values as Scope[])}
        >
          {scopes.map((scope) => (
            <CheckboxListItem key={scope} value={scope} label={scope} />
          ))}
        </CheckboxList>
      ) : (
        <Text type="supporting">
          {chosenScopes.length} scopes: {chosenScopes.join(", ")}
        </Text>
      )}
      <HStack>
        <Button
          label="Create key"
          variant="primary"
          isLoading={isCreating}
          isDisabled={!name.trim() || chosenScopes.length === 0}
          onClick={() => void create()}
        />
      </HStack>

      {keys.length > 0 ? (
        <List hasDividers edge="flush" header={<Text weight="medium">Active keys</Text>}>
          {keys.map((key) => (
            <ListItem
              key={key.id}
              label={key.name}
              description={
                <Text type="supporting" maxLines={1}>
                  {key.scopes.join(", ")}
                </Text>
              }
              endContent={
                <Button
                  label={`Revoke ${key.name}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => setPendingRevoke(key)}
                >
                  Revoke
                </Button>
              }
            />
          ))}
        </List>
      ) : null}

      <ConfirmDialog
        isOpen={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title={`Revoke ${pendingRevoke?.name ?? "this key"}?`}
        description="Anything using this key stops working at once. This can't be undone."
        confirmText="Revoke key"
        variant="destructive"
        isLoading={isRevoking}
        onConfirm={() => (pendingRevoke ? revoke(pendingRevoke) : undefined)}
      />
    </SettingsCard>
  );
}
