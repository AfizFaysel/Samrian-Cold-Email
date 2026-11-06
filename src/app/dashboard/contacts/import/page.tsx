"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { Page } from "@/components/page-header";
import { Stepper } from "@/components/stepper";
import { MethodSelection } from "@/components/add-contacts-wizard/method-selection";
import { CsvUpload } from "@/components/add-contacts-wizard/csv-upload";
import { ManualEntry } from "@/components/add-contacts-wizard/manual-entry";
import { FieldMapping } from "@/components/add-contacts-wizard/field-mapping";
import {
  ReviewValidation,
  type ImportResult,
} from "@/components/add-contacts-wizard/review-validation";
import { Success } from "@/components/add-contacts-wizard/success";
import type { WizardStep, ImportMethod, ContactData } from "@/components/add-contacts-wizard";

export default function ImportContactsPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<WizardStep>("method");
  const [method, setMethod] = React.useState<ImportMethod>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [rawData, setRawData] = React.useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>({});
  const [contacts, setContacts] = React.useState<ContactData[]>([]);
  const [importResult, setImportResult] = React.useState<ImportResult>({
    created: 0,
    updated: 0,
    skipped: 0,
  });

  const handleCancel = () => {
    router.push("/dashboard/contacts");
  };

  const handleSuccess = () => {
    router.push("/dashboard/contacts");
  };

  // Progress indicator
  const steps = [
    { id: "method", label: "Method", number: 1 },
    { id: "upload", label: method === "csv" ? "Upload" : "Enter details", number: 2 },
    { id: "mapping", label: "Map fields", number: 3 },
    { id: "review", label: "Review", number: 4 },
    { id: "success", label: "Done", number: 5 },
  ];

  // Filter steps based on method
  const visibleSteps =
    method === "manual"
      ? steps.filter((s) => s.id !== "mapping")
      : steps.filter((s) => s.id !== "method" || step !== "method");

  const currentStepIndex = visibleSteps.findIndex((s) => s.id === step);

  return (
    <Page
      title="Add contacts"
      description="Import a CSV or type contacts in. Duplicates and invalid emails are caught before anything is saved."
      breadcrumbs={[{ label: "Contacts", href: "/dashboard/contacts" }, { label: "Add contacts" }]}
      width="narrow"
      className="max-w-5xl"
    >
      {step !== "method" && (
        <Stepper
          steps={visibleSteps.map((s, index) => ({ id: index + 1, name: s.label }))}
          current={currentStepIndex + 1}
        />
      )}

      {/* Step Content */}
      <Card padding={0} className="overflow-hidden">
        {step === "method" && (
          <MethodSelection
            onSelect={(selectedMethod) => {
              setMethod(selectedMethod);
              setStep("upload");
            }}
            onCancel={handleCancel}
          />
        )}

        {step === "upload" && method === "csv" && (
          <CsvUpload
            onNext={(uploadedFile, data) => {
              setFile(uploadedFile);
              setRawData(data);
              setStep("mapping");
            }}
            onBack={() => setStep("method")}
            onCancel={handleCancel}
          />
        )}

        {step === "upload" && method === "manual" && (
          <ManualEntry
            onNext={(manualContacts) => {
              setContacts(manualContacts);
              setStep("review");
            }}
            onBack={() => setStep("method")}
            onCancel={handleCancel}
          />
        )}

        {step === "mapping" && (
          <FieldMapping
            rawData={rawData}
            onNext={(mapping, mappedContacts) => {
              setFieldMapping(mapping);
              setContacts(mappedContacts);
              setStep("review");
            }}
            onBack={() => setStep("upload")}
            onCancel={handleCancel}
          />
        )}

        {step === "review" && (
          <ReviewValidation
            contacts={contacts}
            onImport={(result) => {
              setImportResult(result);
              setStep("success");
            }}
            onBack={() => setStep(method === "manual" ? "upload" : "mapping")}
            onCancel={handleCancel}
          />
        )}

        {step === "success" && <Success result={importResult} onClose={handleSuccess} />}
      </Card>
    </Page>
  );
}
