// Helper functions to normalize incoming values to the canonical casing used across the codebase
export const VALID_RECORD_TYPES = ['FIR', 'Evidence', 'Report', 'WitnessStatement'];
export const VALID_CASE_STATUSES = ['Open', 'Closed', 'Under Investigation'];
export const VALID_ORG_MSPS = ['Org1MSP', 'Org2MSP'];
export const VALID_ROLES = ['investigator', 'admin', 'forensics', 'judge'];

function canonicalizeInput(v: any): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function looseEquals(a: string, b: string) {
  return a.replace(/[^a-z0-9]+/gi, '').toLowerCase() === b.replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

export function normalizeRecordType(value: any): string {
  const v = canonicalizeInput(value);
  if (!v) return v;
  const found = VALID_RECORD_TYPES.find((t) => looseEquals(t, v));
  return found ?? v; // return original if no match so validation can catch it
}

export function normalizeStatus(value: any): string {
  const v = canonicalizeInput(value);
  if (!v) return v;
  const found = VALID_CASE_STATUSES.find((s) => looseEquals(s, v));
  return found ?? v;
}

export function normalizeOrgMspId(value: any): string {
  const v = canonicalizeInput(value);
  if (!v) return v;
  // handle common forms like 'org1', 'org1msp', 'ORG1MSP', etc.
  const found = VALID_ORG_MSPS.find((o) => looseEquals(o, v) || looseEquals(o.replace('MSP', ''), v));
  return found ?? v;
}

export function normalizeRole(value: any): string {
  const v = canonicalizeInput(value);
  if (!v) return v;
  const found = VALID_ROLES.find((r) => r.toLowerCase() === v.toLowerCase());
  return found ?? v.toLowerCase();
}
