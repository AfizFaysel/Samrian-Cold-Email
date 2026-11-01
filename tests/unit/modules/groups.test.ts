import { describe, expect, test } from "vitest";

import {
  matchContactGroup,
  validateGroupDefinition,
  validateGroupRules,
} from "../../../src/server/modules/groups";
import type { ContactRecord } from "../../../src/server/ports";

const contacts: ContactRecord[] = [
  {
    id: "contact_1",
    orgId: "org_1",
    email: "ada@example.com",
    domain: "example.com",
    timezone: "UTC",
    customVars: { role: "cto", score: 10 },
    verificationStatus: "valid",
  },
  {
    id: "contact_2",
    orgId: "org_1",
    email: "grace@test.com",
    domain: "test.com",
    timezone: "Africa/Nairobi",
    customVars: { role: "engineer", score: 5 },
    bounceStatus: "hard",
  },
];

describe("group definitions", () => {
  const dynamic = (rules: unknown, logic = "AND") =>
    validateGroupDefinition({ isDynamic: true, logic, rules });

  test.each([[[]], [{}], [null], ["domain"]])("a dynamic group cannot have rules %j", (rules) => {
    expect(dynamic(rules)).toEqual(["Dynamic groups need at least one rule"]);
  });

  test.each([[[null]], [["domain"]]])("rejects the malformed rule list %j", (rules) => {
    expect(dynamic(rules)).toEqual(["Group rules must be objects"]);
  });

  test("rejects unknown logic", () => {
    expect(dynamic([{ field: "domain", operator: "exists" }], "XOR")).toEqual([
      "Group logic must be AND or OR",
    ]);
  });

  test.each([
    [{ field: "domain", operator: "equals" }],
    [{ field: "domain", operator: "notEquals", value: null }],
    [{ field: "domain", operator: "in", value: "example.com" }],
  ])("a rule needs a usable value: %j", (rule) => {
    expect(dynamic([rule])).toHaveLength(1);
  });

  test("exists rules need no value", () => {
    expect(dynamic([{ field: "domain", operator: "exists" }])).toEqual([]);
  });

  test("static groups do not use rules", () => {
    expect(validateGroupDefinition({ isDynamic: false, logic: "AND", rules: {} })).toEqual([]);
  });
});

describe("group matching module", () => {
  test("validates unknown field and operator", () => {
    expect(validateGroupRules([{ field: "unknown", operator: "equals", value: "x" }])).toEqual([
      "Unknown group rule field: unknown",
    ]);
    expect(validateGroupRules([{ field: "email", operator: "near", value: "x" }])).toEqual([
      "Unknown group rule operator: near",
    ]);
  });

  test("matches dynamic AND and OR groups", () => {
    expect(
      matchContactGroup(contacts, {
        logic: "AND",
        rules: [
          { field: "domain", operator: "equals", value: "example.com" },
          { field: "customVars.role", operator: "contains", value: "ct" },
        ],
      }).map((contact) => contact.id)
    ).toEqual(["contact_1"]);

    expect(
      matchContactGroup(contacts, {
        logic: "OR",
        rules: [
          { field: "timezone", operator: "equals", value: "Africa/Nairobi" },
          { field: "verificationStatus", operator: "equals", value: "valid" },
        ],
      }).map((contact) => contact.id)
    ).toEqual(["contact_1", "contact_2"]);
  });

  test("supports operator set and sample limits", () => {
    expect(
      matchContactGroup(
        contacts,
        {
          logic: "AND",
          rules: [
            { field: "email", operator: "endsWith", value: "@example.com" },
            { field: "customVars.score", operator: "gte", value: 10 },
            { field: "bounceStatus", operator: "notExists" },
          ],
        },
        { limit: 1 }
      ).map((contact) => contact.id)
    ).toEqual(["contact_1"]);
  });
});
