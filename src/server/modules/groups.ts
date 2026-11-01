import { groupOperators } from "../db/schema/constants";
import type { ContactRecord } from "../ports";
import { extractDomain } from "./contacts";

export type GroupRule = {
  field: string;
  operator: string;
  value?: unknown;
};

export type GroupDefinition = {
  logic: "AND" | "OR";
  rules: GroupRule[];
};

export const GROUP_AUDIENCE_LIMIT = 10_000;

export class GroupRulesError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("; "));
  }
}

const FIELDS = new Set(["email", "domain", "timezone", "bounceStatus", "verificationStatus"]);
const OPERATORS = new Set<string>(groupOperators);

export function validateGroupRules(rules: GroupRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    if (!isKnownField(rule.field)) {
      errors.push(`Unknown group rule field: ${rule.field}`);
    }
    if (!OPERATORS.has(rule.operator)) {
      errors.push(`Unknown group rule operator: ${rule.operator}`);
    } else if (!hasUsableValue(rule)) {
      errors.push(`Group rule on ${rule.field} needs a value`);
    }
  }
  return errors;
}

// With no rules an AND group matches every contact, so an empty definition is never valid.
export function validateGroupDefinition(input: {
  isDynamic: boolean;
  logic: string;
  rules: unknown;
}): string[] {
  if (!input.isDynamic) return [];
  if (input.logic !== "AND" && input.logic !== "OR") return ["Group logic must be AND or OR"];
  if (!Array.isArray(input.rules) || input.rules.length === 0) {
    return ["Dynamic groups need at least one rule"];
  }
  if (input.rules.some((rule) => typeof rule !== "object" || rule === null)) {
    return ["Group rules must be objects"];
  }
  return validateGroupRules(input.rules as GroupRule[]);
}

function hasUsableValue(rule: GroupRule): boolean {
  if (rule.operator === "exists" || rule.operator === "notExists") return true;
  if (rule.operator === "in" || rule.operator === "notIn") return Array.isArray(rule.value);
  return rule.value !== undefined && rule.value !== null;
}

export function matchContactGroup(
  contacts: ContactRecord[],
  definition: GroupDefinition,
  options: { limit?: number } = {}
): ContactRecord[] {
  const errors = validateGroupRules(definition.rules);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const matched: ContactRecord[] = [];
  for (const contact of contacts) {
    const ok =
      definition.logic === "OR"
        ? definition.rules.some((rule) => matchRule(contact, rule))
        : definition.rules.every((rule) => matchRule(contact, rule));

    if (ok) matched.push(contact);
    if (options.limit && matched.length >= options.limit) break;
  }
  return matched;
}

function matchRule(contact: ContactRecord, rule: GroupRule): boolean {
  const actual = getField(contact, rule.field);
  const expected = rule.value;

  switch (rule.operator) {
    case "equals":
      return String(actual ?? "") === String(expected ?? "");
    case "notEquals":
      return String(actual ?? "") !== String(expected ?? "");
    case "contains":
      return String(actual ?? "").includes(String(expected ?? ""));
    case "notContains":
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "startsWith":
      return String(actual ?? "").startsWith(String(expected ?? ""));
    case "endsWith":
      return String(actual ?? "").endsWith(String(expected ?? ""));
    case "in":
      return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ""));
    case "notIn":
      return Array.isArray(expected) && !expected.map(String).includes(String(actual ?? ""));
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "notExists":
      return actual === undefined || actual === null || actual === "";
    default:
      return false;
  }
}

function getField(contact: ContactRecord, field: string): unknown {
  if (field.startsWith("customVars.")) {
    return contact.customVars[field.slice("customVars.".length)];
  }

  if (field === "domain") return contact.domain ?? extractDomain(contact.email);
  return contact[field as keyof ContactRecord];
}

function isKnownField(field: string): boolean {
  return FIELDS.has(field) || /^customVars\.[A-Za-z0-9_-]+$/.test(field);
}
