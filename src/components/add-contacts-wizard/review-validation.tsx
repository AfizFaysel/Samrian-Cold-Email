"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ContactData } from "./index";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface ReviewValidationProps {
  contacts: ContactData[];
  onImport: (validContacts: ContactData[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function ReviewValidation({ contacts, onImport, onBack, onCancel }: ReviewValidationProps) {
  const [isImporting, setIsImporting] = React.useState(false);
  const [skipInvalid, setSkipInvalid] = React.useState(true);

  const validContacts = contacts.filter((c) => isValidEmail(c.email));
  const invalidContacts = contacts.filter((c) => !isValidEmail(c.email));

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const contactsToImport = skipInvalid ? validContacts : contacts;

      await requestJson("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          contacts: contactsToImport.map((c) => ({
            email: c.email,
            customVars: c.customVars,
            timezone: c.timezone,
          })),
        }),
      });

      onImport(contactsToImport);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import contacts. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={4}
        stepLabel="Review & Validation"
        title="Review Contacts"
        description="Verify your contacts before importing"
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-2xl font-semibold text-primary">{contacts.length}</p>
          <p className="text-base text-secondary">Total Contacts</p>
        </div>
        <div className="rounded-lg border border-success/30 bg-success-muted p-6">
          <p className="text-2xl font-semibold text-success">{validContacts.length}</p>
          <p className="text-base text-success">Valid Emails</p>
        </div>
        <div className="rounded-lg border border-error/30 bg-error-muted p-6">
          <p className="text-2xl font-semibold text-error">{invalidContacts.length}</p>
          <p className="text-base text-error">Invalid Emails</p>
        </div>
      </div>

      {/* Options */}
      <div className="mb-8 space-y-3">
        <label className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <input
            type="checkbox"
            checked={skipInvalid}
            onChange={(e) => setSkipInvalid(e.target.checked)}
            className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
          />
          <span className="text-base font-medium text-primary">Skip invalid emails</span>
        </label>
      </div>

      {/* Contact List */}
      <div className="mb-12 max-h-96 overflow-y-auto rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-sm font-medium text-secondary">Email</th>
              <th className="px-4 py-2.5 text-left text-sm font-medium text-secondary">Name</th>
              <th className="px-4 py-2.5 text-left text-sm font-medium text-secondary">Company</th>
              <th className="px-4 py-2.5 text-center text-sm font-medium text-secondary">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.map((contact, i) => {
              const isValid = isValidEmail(contact.email);
              return (
                <tr key={i} className={!isValid ? "bg-error-muted/50" : ""}>
                  <td className="px-6 py-4 text-base text-primary">{contact.email}</td>
                  <td className="px-6 py-4 text-base text-primary">
                    {contact.customVars?.firstName} {contact.customVars?.lastName}
                  </td>
                  <td className="px-6 py-4 text-base text-primary">
                    {contact.customVars?.company || "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isValid ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-success" />
                    ) : (
                      <AlertCircle className="mx-auto h-5 w-5 text-error" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WizardFooter
        onBack={onBack}
        onCancel={onCancel}
        onNext={handleImport}
        nextLabel={
          isImporting
            ? "Importing..."
            : `Import ${skipInvalid ? validContacts.length : contacts.length} Contacts`
        }
        nextDisabled={isImporting || (skipInvalid && validContacts.length === 0)}
        isLoading={isImporting}
      />
    </WizardContainer>
  );
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
}
