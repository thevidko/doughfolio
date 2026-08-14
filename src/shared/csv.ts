/**
 * Minimal RFC-4180-ish CSV parser and serializer (csv-import-export spec).
 * Handles quoted fields, embedded delimiters/newlines/quotes, CRLF, and
 * auto-detects `,` vs `;` (common in Czech locale exports). No dependency —
 * portfolio imports must not hinge on a third-party parser's quirks.
 */

export type CsvTable = {
  headers: string[];
  /** Data rows, each aligned with `headers` (short rows padded with ""). */
  rows: string[][];
  delimiter: "," | ";";
};

export function detectDelimiter(firstLine: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ",") commas++;
    else if (!inQuotes && ch === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.slice(0, clean.indexOf("\n") + 1 || undefined));

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    // Skip fully empty records (trailing newlines).
    if (record.length > 1 || (record[0] ?? "").trim() !== "") records.push(record);
    record = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      pushRecord();
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    pushRecord();
  }

  const headers = (records[0] ?? []).map((h) => h.trim());
  const rows = records.slice(1).map((row) => {
    const aligned = [...row];
    while (aligned.length < headers.length) aligned.push("");
    return aligned.slice(0, headers.length);
  });
  return { headers, rows, delimiter };
}

function escapeField(value: string): string {
  return /[",\n\r;]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function serializeCsv(headers: readonly string[], rows: readonly string[][]): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeField).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
