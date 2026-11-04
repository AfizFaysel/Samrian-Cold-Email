"use client";

import { scopes, type Scope } from "@samrian/contracts";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [selected, setSelected] = React.useState<Scope[]>([]);
  const [created, setCreated] = React.useState<string>();
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const response = await fetch("/api/settings/api-keys");
    if (!response.ok) throw new Error("Could not load API keys");
    setKeys(await response.json());
  }, []);

  React.useEffect(() => {
    load().catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : "Could not load API keys")
    );
  }, [load]);

  async function create() {
    setError("");
    const response = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scopes: selected }),
    });
    if (!response.ok) {
      setError("Could not create API key");
      return;
    }
    const result = (await response.json()) as KeyMetadata & { value: string };
    setCreated(result.value);
    setKeys((current) => [result, ...current]);
    setName("");
    setSelected([]);
  }

  async function revoke(key: KeyMetadata) {
    const response = await fetch(`/api/settings/api-keys/${encodeURIComponent(key.id)}/revoke`, {
      method: "POST",
    });
    if (!response.ok) {
      setError("Could not revoke API key");
      return;
    }
    await load();
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">API keys</h2>
        <p className="text-base text-secondary">Create separate scoped keys for CLI and CI use.</p>
      </div>

      {created ? (
        <div className="rounded-sm border border-warning/30 bg-warning-muted p-3 text-base">
          <p className="font-medium text-warning">Key shown once</p>
          <code className="mt-2 block break-all text-warning">{created}</code>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key-name">Key name</Label>
        <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>

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

      <div>
        <Button disabled={!name.trim() || selected.length === 0} onClick={create}>
          Create key
        </Button>
      </div>

      <div className="divide-y divide-border border-t border-border">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-primary">{key.name}</p>
              <p className="truncate text-base text-secondary">{key.scopes.join(", ")}</p>
            </div>
            <Button variant="outline" onClick={() => revoke(key)} aria-label={`Revoke ${key.name}`}>
              Revoke
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-base text-error">{error}</p> : null}
    </section>
  );
}
