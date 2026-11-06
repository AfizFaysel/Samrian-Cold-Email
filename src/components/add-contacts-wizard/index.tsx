// Shared types for the contact import flow at /dashboard/contacts/import.

export type WizardStep = "method" | "upload" | "mapping" | "review" | "success";
export type ImportMethod = "csv" | "manual" | "paste" | null;

export interface ContactData {
  email: string;
  customVars?: Record<string, any>;
  timezone?: string;
}

export interface WizardState {
  step: WizardStep;
  method: ImportMethod;
  file: File | null;
  rawData: string[][];
  fieldMapping: Record<string, string>;
  contacts: ContactData[];
  validContacts: ContactData[];
  invalidContacts: ContactData[];
  duplicates: ContactData[];
}
