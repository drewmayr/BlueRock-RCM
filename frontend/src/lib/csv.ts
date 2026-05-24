// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, commas, newlines).
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) out.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) out.push(row);
  }

  const headers = (out.shift() ?? []).map((h) => h.trim());
  return { headers, rows: out };
}

// Map a CSV header to a known lead field by common synonyms.
const SYNONYMS: Record<string, string> = {
  type: "type", "lead type": "type", leadtype: "type",
  "first name": "firstName", firstname: "firstName", first: "firstName", fname: "firstName",
  "last name": "lastName", lastname: "lastName", last: "lastName", lname: "lastName", surname: "lastName",
  name: "name", "full name": "name", fullname: "name",
  email: "email", "e-mail": "email", "email address": "email",
  phone: "phone", "phone number": "phone", mobile: "phone", cell: "phone", telephone: "phone",
  state: "state", province: "state",
  city: "city",
  birthday: "dateOfBirth", dob: "dateOfBirth", "date of birth": "dateOfBirth", birthdate: "dateOfBirth", "birth date": "dateOfBirth",
  anniversary: "anniversary",
  source: "source", "lead source": "source",
  status: "status", stage: "status",
  tags: "tags", tag: "tags",
  notes: "notes", note: "notes", comments: "notes",
  "last contacted": "lastContactedAt", "last contact": "lastContactedAt", lastcontacted: "lastContactedAt",
  "follow up": "followUpDate", "follow-up": "followUpDate", followup: "followUpDate", "follow up date": "followUpDate", "next follow up": "followUpDate",
  assigned: "assignedTo", "assigned user": "assignedTo", "assigned to": "assignedTo", owner: "assignedTo", agent: "assignedTo",
};

export function autoMap(header: string): string {
  const key = header.toLowerCase().trim();
  return SYNONYMS[key] ?? "";
}

export const LEAD_FIELDS = [
  { key: "", label: "— Skip —" },
  { key: "type", label: "Lead Type" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "name", label: "Full Name (split)" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "dateOfBirth", label: "Birthday" },
  { key: "anniversary", label: "Anniversary" },
  { key: "source", label: "Lead Source" },
  { key: "status", label: "Status" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "lastContactedAt", label: "Last Contacted" },
  { key: "followUpDate", label: "Follow-up Date" },
  { key: "assignedTo", label: "Assigned User" },
];
