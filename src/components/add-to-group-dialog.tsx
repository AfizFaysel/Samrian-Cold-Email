"use client";

import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack, Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import * as React from "react";
import { toast } from "sonner";

import { useApi } from "@/hooks/use-api";
import { errorMessage, requestJson } from "@/lib/request";

type Group = { id: string; name: string; isDynamic: boolean; contactIds?: string[] };

const NEW_GROUP = "new";

/** Adds the selected contacts to an existing static group, or creates one with them. */
export function AddToGroupDialog({
  contactIds,
  isOpen,
  onOpenChange,
  onAdded,
}: {
  contactIds: string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdded: () => void;
}) {
  const { data, refetch } = useApi<{ groups: Group[] }>(isOpen ? "/api/groups" : null);
  const groups = (data?.groups ?? []).filter((group) => !group.isDynamic);
  const [choice, setChoice] = React.useState(NEW_GROUP);
  const [name, setName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const count = contactIds.length;
  const isNew = choice === NEW_GROUP;

  const close = () => {
    if (isSaving) return;
    setChoice(NEW_GROUP);
    setName("");
    onOpenChange(false);
  };

  async function save() {
    if (isNew && !name.trim()) {
      toast.error("Name the new group.");
      return;
    }
    setIsSaving(true);
    try {
      let groupName = name.trim();
      if (isNew) {
        await requestJson("/api/groups", {
          method: "POST",
          body: JSON.stringify({ name: groupName, contactIds }),
        });
      } else {
        const { group } = await requestJson<{ group: Group }>(`/api/groups/${choice}`);
        groupName = group.name;
        const merged = Array.from(new Set([...(group.contactIds ?? []), ...contactIds]));
        await requestJson(`/api/groups/${choice}`, {
          method: "PATCH",
          body: JSON.stringify({ contactIds: merged }),
        });
      }
      toast.success(`Added ${count} contact${count === 1 ? "" : "s"} to ${groupName}`);
      refetch();
      setIsSaving(false);
      close();
      onAdded();
    } catch (error) {
      toast.error(errorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && close()} purpose="form" width={440}>
      <Layout
        header={
          <DialogHeader
            title="Add to group"
            subtitle={`Group these ${count} contact${count === 1 ? "" : "s"} so a campaign can target them together.`}
            onOpenChange={close}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <Selector
                label="Group"
                width="100%"
                value={choice}
                onChange={setChoice}
                options={[
                  { value: NEW_GROUP, label: "New group" },
                  ...groups.map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
              {isNew && (
                <TextInput
                  label="Group name"
                  value={name}
                  onChange={setName}
                  placeholder="Q4 founders"
                />
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" isDisabled={isSaving} onClick={close} />
              <Button
                label={isNew ? "Create group" : "Add to group"}
                variant="primary"
                isLoading={isSaving}
                onClick={() => void save()}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
