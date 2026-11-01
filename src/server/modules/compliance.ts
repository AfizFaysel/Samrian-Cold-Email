export type ComplianceSettings = {
  listUnsubscribeEnabled?: boolean;
  clickTrackingEnabled?: boolean;
  openTrackingEnabled?: boolean;
  physicalAddress?: string | null;
  unsubscribeFooter?: string | null;
  unsubscribeMailto?: string | null;
};

export type RenderedEmail = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

const UNSUBSCRIBE_TOKEN = "{{unsubscribeUrl}}";
const DEFAULT_FOOTER = `Unsubscribe: ${UNSUBSCRIBE_TOKEN}`;

// List-Unsubscribe only controls the headers. Cold email needs an opt-out and an address regardless.
export function validateCompliance(settings: ComplianceSettings): string[] {
  const issues: string[] = [];
  if (!settings.physicalAddress?.trim()) {
    issues.push("Physical mailing address is required");
  }
  if (!isUsableFooter(settings.unsubscribeFooter)) {
    issues.push(`Unsubscribe footer must include ${UNSUBSCRIBE_TOKEN}`);
  }
  return issues;
}

export function isUsableFooter(footer?: string | null) {
  return !footer?.trim() || footer.includes(UNSUBSCRIBE_TOKEN);
}

export function buildComplianceHeaders(input: {
  enabled: boolean;
  appUrl: string;
  contactId: string;
  campaignId: string;
  token: string;
  mailto?: string | null;
}): Record<string, string> {
  if (!input.enabled) return {};

  const unsubscribeUrl = buildUnsubscribeUrl(input);
  const values = [`<${unsubscribeUrl}>`];
  if (input.mailto?.trim()) values.push(`<mailto:${input.mailto.trim()}>`);

  return {
    "List-Unsubscribe": values.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function buildUnsubscribeUrl(input: {
  appUrl: string;
  contactId: string;
  campaignId: string;
  token: string;
}) {
  return `${input.appUrl}/api/unsubscribe?contactId=${input.contactId}&c=${input.campaignId}&t=${input.token}`;
}

export function applyCompliance(input: {
  rendered: RenderedEmail;
  unsubscribeUrl: string;
  footer?: string | null;
  physicalAddress?: string | null;
}): RenderedEmail {
  const template = input.footer?.trim() || DEFAULT_FOOTER;
  const address = input.physicalAddress?.trim();
  const footer = address && !template.includes(address) ? `${template}\n${address}` : template;
  const url = escapeHtml(input.unsubscribeUrl);
  const html = footer
    .split(UNSUBSCRIBE_TOKEN)
    .map(escapeHtml)
    .join(`<a href="${url}">${url}</a>`)
    .replace(/\r?\n/g, "<br>");

  return {
    subject: input.rendered.subject,
    htmlBody: `${input.rendered.htmlBody}<p>${html}</p>`,
    textBody: `${input.rendered.textBody}\n\n${footer.replaceAll(UNSUBSCRIBE_TOKEN, input.unsubscribeUrl)}`,
  };
}

export function resolveListUnsubscribeEnabled(input: {
  orgEnabled?: boolean | null;
  campaignEnabled?: boolean | null;
}) {
  return input.campaignEnabled ?? input.orgEnabled ?? false;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
