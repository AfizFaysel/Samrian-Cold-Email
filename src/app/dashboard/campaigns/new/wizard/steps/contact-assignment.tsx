import * as React from "react";
import type { CampaignDraft } from "../page";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton, ToggleButtonGroup } from "@astryxdesign/core/ToggleButton";
import { Layers, Search, X } from "lucide-react";
import { EmptyState } from "@/components/page-state";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import { StepIntro } from "./step-intro";

interface ContactAssignmentStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

type AssignmentMode = "group" | "specific";

export function ContactAssignmentStep({ draft, setDraft }: ContactAssignmentStepProps) {
  const [mode, setMode] = React.useState<AssignmentMode>(
    draft.targetGroupId ? "group" : "specific"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedContactIds, setSelectedContactIds] = React.useState<Set<string>>(
    new Set(draft.targetContactIds || [])
  );

  const { data: groupData } = useApi<{ groups: any[] }>("/api/groups");
  const { data: contactData } = useApi<{ contacts: any[] }>("/api/contacts?limit=100");
  const contactGroups = groupData?.groups;
  const contacts = contactData;

  const filteredContacts = React.useMemo(() => {
    if (!contacts?.contacts) return [];
    if (!searchQuery.trim()) return contacts.contacts;

    const query = searchQuery.toLowerCase();
    return contacts.contacts.filter(
      (c: any) =>
        c.email.toLowerCase().includes(query) ||
        c.customVars?.name?.toLowerCase().includes(query) ||
        c.customVars?.company?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Update draft when mode or selection changes
  React.useEffect(() => {
    if (mode === "specific") {
      setDraft((prev) => ({
        ...prev,
        targetContactIds: Array.from(selectedContactIds),
        targetGroupId: undefined,
      }));
    }
  }, [mode, selectedContactIds, setDraft]);

  const handleGroupSelect = (groupId: string) => {
    setDraft((prev) => ({
      ...prev,
      targetGroupId: groupId,
      targetContactIds: undefined,
    }));
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StepIntro
        title="Who gets it"
        description="Send to a saved group, or pick contacts one by one."
      />

      <ToggleButtonGroup
        label="Recipients"
        type="single"
        value={mode}
        onChange={(value) => value && setMode(value as AssignmentMode)}
      >
        <ToggleButton value="group" label="A contact group" />
        <ToggleButton value="specific" label="Specific contacts" />
      </ToggleButtonGroup>

      {mode === "group" &&
        (!contactGroups || contactGroups.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No groups yet"
            description="On Contacts, select people and choose Add to group, or pick contacts one by one."
          />
        ) : (
          <RadioList label="Group" value={draft.targetGroupId ?? ""} onChange={handleGroupSelect}>
            {contactGroups.map((group: any) => (
              <RadioListItem
                key={group.id}
                value={group.id}
                label={group.name}
                description={group.description}
                endContent={<Text type="supporting">{group.isDynamic ? "Dynamic" : "Static"}</Text>}
              />
            ))}
          </RadioList>
        ))}

      {mode === "specific" && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email or company"
              aria-label="Search contacts"
              className="pr-8 pl-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-secondary hover:text-primary"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {filteredContacts.length === 0 ? (
            <Text type="supporting">No contacts match.</Text>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <CheckboxList
                label={`Contacts · ${selectedContactIds.size} selected`}
                value={Array.from(selectedContactIds)}
                onChange={(values) => setSelectedContactIds(new Set(values))}
                hasDividers
              >
                {filteredContacts.map((contact: any) => (
                  <CheckboxListItem
                    key={contact._id}
                    value={contact._id}
                    label={contact.customVars?.name || contact.email}
                    description={contact.customVars?.name ? contact.email : undefined}
                  />
                ))}
              </CheckboxList>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
