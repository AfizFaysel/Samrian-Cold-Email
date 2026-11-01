import { describe, expect, test } from "vitest";

import { sendCampaign } from "../../../src/server/jobs/send";
import type { ComplianceSettings } from "../../../src/server/modules/compliance";
import { FakeNotificationRepo, FakeRepos } from "../../fakes/fake-repos";
import type { MailboxConnector } from "../../../src/server/jobs/types";

function makeConnector(): MailboxConnector & { sent: unknown[] } {
  return {
    sent: [],
    async send(message) {
      this.sent.push(message);
      return { messageId: "message_1", accepted: [message.to], rejected: [] };
    },
    async pollNewMessages() {
      return [];
    },
    async close() {},
  };
}

describe("campaign email compliance", () => {
  const payload = {
    assignmentId: "assignment_1",
    campaignId: "campaign_1",
    contactId: "contact_1",
    mailboxId: "mailbox_1",
    orgId: "org_1",
    stepNumber: 0,
  };

  function seed() {
    return new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          status: "active",
          listUnsubscribeEnabled: false,
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
  }

  function deps(repos: unknown, connector: MailboxConnector, settings: ComplianceSettings) {
    return {
      repos: repos as never,
      connectorForMailbox: async () => connector,
      generateUnsubscribeToken: async () => "token",
      appUrl: "https://app.example.com",
      now: () => Date.parse("2026-07-06T14:00:00.000Z"),
      getComplianceSettings: async () => settings,
    };
  }

  test("keeps the provider thread so replies can be matched", async () => {
    const repos = seed();
    const connector = makeConnector();
    connector.send = async (message) => ({
      messageId: "message_1",
      providerThreadId: "thread_9",
      accepted: [message.to],
      rejected: [],
    });

    await sendCampaign(payload, deps(repos, connector, { physicalAddress: "1 Main St" }));

    expect(repos.threads.data[0]).toMatchObject({ providerThreadId: "thread_9" });
  });

  test("adds the opt-out and address even with List-Unsubscribe off", async () => {
    const connector = makeConnector();

    await sendCampaign(payload, deps(seed(), connector, { physicalAddress: "1 Main St" }));

    expect(connector.sent).toMatchObject([
      {
        html: expect.stringContaining('href="https://app.example.com/api/unsubscribe?'),
        text: expect.stringContaining("1 Main St"),
      },
    ]);
  });

  test("holds sends without an address and notifies once", async () => {
    const repos = seed();
    const notifications = new FakeNotificationRepo();
    const connector = makeConnector();
    const held = deps({ ...repos, notifications }, connector, {});

    await expect(sendCampaign(payload, held)).resolves.toMatchObject({ status: "deferred" });
    await expect(sendCampaign(payload, held)).resolves.toMatchObject({ status: "deferred" });

    expect(connector.sent).toEqual([]);
    expect(repos.assignments.data[0].currentStep).toBe(0);
    expect(notifications.data).toMatchObject([
      {
        type: "campaign_held",
        data: { campaignId: "campaign_1" },
        body: expect.stringContaining("Physical mailing address"),
      },
    ]);
  });

  test("resumes by itself once the address is set", async () => {
    const repos = seed();
    const connector = makeConnector();

    await sendCampaign(payload, deps(repos, connector, {}));
    await expect(
      sendCampaign(payload, deps(repos, connector, { physicalAddress: "1 Main St" }))
    ).resolves.toMatchObject({ status: "sent" });
  });
});

describe("sendCampaign", () => {
  test("keeps provider send outside tenant transaction", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          status: "active",
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    let inTransaction = false;
    const connector = makeConnector();
    connector.send = async (message) => {
      expect(inTransaction).toBe(false);
      return { messageId: "message_1", accepted: [message.to], rejected: [] };
    };

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        transaction: async (operation) => {
          inTransaction = true;
          try {
            return await operation(repos);
          } finally {
            inTransaction = false;
          }
        },
        connectorForMailbox: async () => connector,
        getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 123,
      }
    );
  });

  test("sends email, advances assignment, inserts thread, and increments counter", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          status: "active",
          steps: [{ subject: "Hi {{firstName}}", body: "<p>Hello {{firstName}}</p>" }],
        },
      ],
      contacts: [
        {
          id: "contact_1",
          orgId: "org_1",
          email: "ada@example.com",
          customVars: { firstName: "Ada" },
        },
      ],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "sent", messageId: "message_1" });

    expect(repos.assignments.data[0].currentStep).toBe(1);
    expect(repos.mailboxes.data[0].sentToday).toBe(1);
    expect(repos.threads.data).toHaveLength(1);
    expect(repos.threads.data[0]).toMatchObject({
      messageId: "message_1",
      subject: "Hi Ada",
      textBody: expect.stringContaining("Hello Ada"),
    });
    expect(repos.events.data).toContainEqual(
      expect.objectContaining({
        type: "sent",
        dedupeKey: "sent:assignment_1:0",
      })
    );
  });

  test("returns stale before sending when event step is not current", async () => {
    const repos = new FakeRepos({
      campaigns: [
        { id: "campaign_1", orgId: "org_1", status: "active", name: "Launch", steps: [] },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 1, status: "active" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "stale", currentStep: 1 });

    expect(connector.sent).toHaveLength(0);
    expect(repos.threads.data).toHaveLength(0);
  });

  test("skips blocked contacts", async () => {
    const repos = new FakeRepos({
      campaigns: [
        { id: "campaign_1", orgId: "org_1", status: "active", name: "Launch", steps: [] },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "blocked@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
      blocklist: [{ orgId: "org_1", email: "blocked@example.com", reason: "manual" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "skipped", reason: "blocked" });

    expect(connector.sent).toHaveLength(0);
  });

  test("marks final step completed after successful send", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          status: "active",
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        repos,
        connectorForMailbox: async () => makeConnector(),
        getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 123,
      }
    );

    expect(repos.assignments.data[0]).toMatchObject({
      currentStep: 1,
      status: "completed",
      nextSendAt: undefined,
    });
  });

  test("sets nextSendAt for follow-up step delay", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          status: "active",
          steps: [
            { subject: "Hi", body: "Hello" },
            { subject: "Follow up", body: "Checking in", delayDays: 2 },
          ],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        repos,
        connectorForMailbox: async () => makeConnector(),
        getComplianceSettings: async () => ({ physicalAddress: "1 Main St" }),
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 1000,
      }
    );

    expect(repos.assignments.data[0]).toMatchObject({
      currentStep: 1,
      status: "active",
      nextSendAt: 1000 + 2 * 24 * 60 * 60 * 1000,
    });
  });
});
