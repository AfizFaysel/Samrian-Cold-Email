import { describe, expect, test } from "vitest";

import {
  applyCompliance,
  buildComplianceHeaders,
  buildUnsubscribeUrl,
  validateCompliance,
} from "../../../src/server/modules/compliance";

const rendered = { subject: "Hi", htmlBody: "<p>Hello</p>", textBody: "Hello" };
const unsubscribeUrl = buildUnsubscribeUrl({
  appUrl: "https://app.example.com",
  contactId: "contact_1",
  campaignId: "campaign_1",
  token: "token",
});
const href = unsubscribeUrl.replaceAll("&", "&amp;");
const link = `<a href="${href}">${href}</a>`;

describe("compliance module", () => {
  test("requires a physical address whether or not List-Unsubscribe is on", () => {
    const issue = "Physical mailing address is required";

    expect(validateCompliance({ listUnsubscribeEnabled: false })).toEqual([issue]);
    expect(validateCompliance({ listUnsubscribeEnabled: true, physicalAddress: " " })).toEqual([
      issue,
    ]);
  });

  test("accepts an address alone because the default footer has an opt-out", () => {
    expect(validateCompliance({ physicalAddress: "1 Main St" })).toEqual([]);
  });

  test("rejects a custom footer that has no way to opt out", () => {
    expect(
      validateCompliance({ physicalAddress: "1 Main St", unsubscribeFooter: "Opt out" })
    ).toEqual(["Unsubscribe footer must include {{unsubscribeUrl}}"]);
  });

  test("disabled mode sends no unsubscribe headers", () => {
    expect(
      buildComplianceHeaders({
        enabled: false,
        appUrl: "https://app.example.com",
        contactId: "contact_1",
        campaignId: "campaign_1",
        token: "token",
      })
    ).toEqual({});
  });

  test("enabled mode builds one-click headers with optional mailto", () => {
    expect(
      buildComplianceHeaders({
        enabled: true,
        appUrl: "https://app.example.com",
        contactId: "contact_1",
        campaignId: "campaign_1",
        token: "token",
        mailto: "unsubscribe@example.com",
      })
    ).toEqual({
      "List-Unsubscribe":
        "<https://app.example.com/api/unsubscribe?contactId=contact_1&c=campaign_1&t=token>, <mailto:unsubscribe@example.com>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  test("links the real unsubscribe URL and adds the address to both bodies", () => {
    const result = applyCompliance({
      rendered,
      unsubscribeUrl,
      footer: "Stop these emails: {{unsubscribeUrl}}",
      physicalAddress: "1 Main St",
    });

    expect(result.htmlBody).toBe(`<p>Hello</p><p>Stop these emails: ${link}<br>1 Main St</p>`);
    expect(result.textBody).toBe(`Hello\n\nStop these emails: ${unsubscribeUrl}\n1 Main St`);
  });

  test("uses a default footer when none is configured", () => {
    const result = applyCompliance({ rendered, unsubscribeUrl, physicalAddress: "1 Main St" });

    expect(result.htmlBody).toContain(link);
    expect(result.textBody).toContain(unsubscribeUrl);
  });

  test("does not repeat an address the footer already includes", () => {
    const result = applyCompliance({
      rendered,
      unsubscribeUrl,
      footer: "1 Main St. Unsubscribe: {{unsubscribeUrl}}",
      physicalAddress: "1 Main St",
    });

    expect(result.textBody).toBe(`Hello\n\n1 Main St. Unsubscribe: ${unsubscribeUrl}`);
  });

  test("escapes footer and address text and keeps address lines", () => {
    const result = applyCompliance({
      rendered,
      unsubscribeUrl,
      footer: "<b>Leave</b> {{unsubscribeUrl}}",
      physicalAddress: "1 Main & Co\nSpringfield",
    });

    expect(result.htmlBody).toBe(
      `<p>Hello</p><p>&lt;b&gt;Leave&lt;/b&gt; ${link}<br>1 Main &amp; Co<br>Springfield</p>`
    );
  });
});
