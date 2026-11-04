"use client";

import * as React from "react";
import { Upload, FileText, X, Download } from "lucide-react";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface CsvUploadProps {
  onNext: (file: File, rawData: string[][]) => void;
  onBack: () => void;
  onCancel: () => void;
}

export function CsvUpload({ onNext, onBack, onCancel }: CsvUploadProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [rawData, setRawData] = React.useState<string[][]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // Simple CSV parsing (handles basic cases)
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      alert("Please upload a CSV file");
      return;
    }

    const text = await selectedFile.text();
    const parsed = parseCSV(text);

    setFile(selectedFile);
    setRawData(parsed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setRawData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={2}
        stepLabel="Upload CSV"
        title="Upload Your CSV File"
        description="Import contacts from your spreadsheet"
      />

      {/* Upload Area */}
      {!file ? (
        <div className="mb-12">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border border-dashed px-6 py-12 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent-muted"
                : "border-border-strong bg-muted/50 hover:border-accent hover:bg-accent-muted/60"
            }`}
          >
            <Upload className="mx-auto mb-3 size-6 text-secondary" />
            <h3 className="mb-1 text-base font-semibold">Drop your CSV here</h3>
            <p className="mb-3 text-base text-secondary">or click to choose a file</p>
            <p className="text-sm text-secondary">Supports .csv files up to 10MB</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-base text-secondary">
            <Download className="h-4 w-4" />
            <button className="font-semibold text-accent hover:underline">
              Download sample CSV template
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-12">
          {/* File Info */}
          <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-muted">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-primary">{file.name}</p>
                <p className="text-base text-secondary">
                  {(file.size / 1024).toFixed(1)} KB • {rawData.length} rows
                </p>
              </div>
            </div>
            <button
              onClick={removeFile}
              className="rounded-md p-2 text-secondary transition-colors hover:bg-error-muted hover:text-error"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Preview */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border bg-muted px-6 py-3">
              <p className="text-base font-semibold text-primary">Preview (first 3 rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    {rawData[0]?.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-sm font-medium text-secondary"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(1, 4).map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-base text-primary">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <WizardFooter
        onBack={onBack}
        onCancel={onCancel}
        onNext={() => file && onNext(file, rawData)}
        nextLabel="Next: Map Fields"
        nextDisabled={!file}
      />
    </WizardContainer>
  );
}
