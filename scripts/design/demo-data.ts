/**
 * Sample data for the design preview and the product demo. Development only.
 *
 * Everything here is fictional: people, companies, and domains are invented. The numbers are
 * shaped like a healthy outbound team so screens look real on camera.
 */

const day = 86400000;
const hour = 3600000;

const people = [
  ["Maya Chen", "Head of Growth", "Lumen Labs", "lumenlabs.io", "America/New_York"],
  ["Daniel Okafor", "Founder", "Fieldnote", "fieldnote.app", "Europe/London"],
  ["Priya Raman", "VP Sales", "Northstack", "northstack.dev", "America/Chicago"],
  ["Lucas Meyer", "CTO", "Tidewater", "tidewater.so", "Europe/Berlin"],
  ["Sofia Alvarez", "COO", "Parcelly", "parcelly.co", "America/Los_Angeles"],
  ["Ethan Brooks", "Founder", "Quillmark", "quillmark.io", "America/New_York"],
  ["Aisha Bello", "Head of Marketing", "Orbitly", "orbitly.app", "Europe/London"],
  ["Kenji Watanabe", "Head of Ops", "Kumo Logistics", "kumologistics.jp", "Asia/Tokyo"],
  ["Hannah Schmidt", "Founder", "Verdant", "verdant.eco", "Europe/Berlin"],
  ["Omar Haddad", "Growth Lead", "Sandline", "sandline.io", "Asia/Dubai"],
] as const;

const emailOf = (name: string, domain: string) => `${name.split(" ")[0].toLowerCase()}@${domain}`;

export const sequence = [
  {
    subject: "Quick question about {{company}}'s outbound",
    body: "Hi {{firstName}},\n\nSaw {{company}} is growing the sales team. Most teams we talk to lose replies across a dozen inboxes and burn domains by sending too fast.\n\nSamrian spaces every send like a person would and keeps every reply in one inbox. Worth a 15-minute look?\n\nSam",
  },
  {
    subject: "Re: Quick question about {{company}}'s outbound",
    body: "Hi {{firstName}}, following up in case this got buried. Happy to show how teams like yours set it up in an afternoon.\n\nSam",
    delayDays: 3,
  },
  {
    subject: "Re: Quick question about {{company}}'s outbound",
    body: "Last note from me, {{firstName}}. If outbound isn't a priority right now, no worries at all. I'll check back next quarter.\n\nSam",
    delayDays: 4,
  },
];

// What a recording changes stays changed until resetDemo().
const demo = {
  readThreads: new Set<string>(),
  readNotifications: new Set<string>(),
  sentReplies: new Map<string, { body: string; at: number }[]>(),
  injectedAt: 0,
};

/** Drops a fresh reply into the inbox, for the "a reply just landed" moment of a recording. */
export function injectReply() {
  demo.injectedAt = Date.now();
}

export function resetDemo() {
  demo.readThreads.clear();
  demo.readNotifications.clear();
  demo.sentReplies.clear();
  demo.injectedAt = 0;
}

type Route = [RegExp, (match: RegExpMatchArray) => unknown];

export function fixtures(): Route[] {
  const now = Date.now();
  const campaigns = [
    {
      _id: "cmp_1",
      name: "Seed founders · Q4",
      status: "active",
      _creationTime: now - 12 * day,
      emailsSent: 1842,
      replyRate: 9.6,
      bounceRate: 0.7,
      mailboxIds: ["mb_1", "mb_2", "mb_3"],
    },
    {
      _id: "cmp_2",
      name: "Agency partners",
      status: "active",
      _creationTime: now - 9 * day,
      emailsSent: 964,
      replyRate: 12.4,
      bounceRate: 0.4,
      mailboxIds: ["mb_1", "mb_4"],
    },
    {
      _id: "cmp_3",
      name: "PLG SaaS · Heads of Growth",
      status: "active",
      _creationTime: now - 5 * day,
      emailsSent: 612,
      replyRate: 8.1,
      bounceRate: 1.1,
      mailboxIds: ["mb_2", "mb_3"],
    },
    {
      _id: "cmp_4",
      name: "Webinar follow-up",
      status: "completed",
      _creationTime: now - 40 * day,
      emailsSent: 2310,
      replyRate: 6.2,
      bounceRate: 0.9,
      mailboxIds: ["mb_4"],
    },
    {
      _id: "cmp_5",
      name: "Series A investors",
      status: "paused",
      _creationTime: now - 16 * day,
      emailsSent: 148,
      replyRate: 4.1,
      bounceRate: 0,
      mailboxIds: ["mb_3"],
    },
    {
      _id: "cmp_6",
      name: "Hiring: senior engineers",
      status: "draft",
      _creationTime: now - 2 * hour,
      emailsSent: 0,
      replyRate: 0,
      bounceRate: 0,
    },
  ];

  const mailbox = (
    _id: string,
    name: string,
    provider: string,
    email: string,
    sent: number,
    limit: number,
    ramp?: { current: number; target: number }
  ) => ({
    _id,
    name,
    provider,
    userEmail: email,
    status: "active",
    dailySendLimit: limit,
    emailsSentToday: sent,
    rampEnabled: !!ramp,
    rampStatus: ramp ? "ramping" : "off",
    rampCurrentLimit: ramp?.current,
    rampTargetLimit: ramp?.target ?? 30,
    effectiveDailyLimit: ramp?.current ?? limit,
    availableToday: (ramp?.current ?? limit) - sent,
    lastConnectionTestAt: now - 40 * 60000,
    timezone: "America/New_York",
  });
  const mailboxes = [
    mailbox("mb_1", "Sam (Google)", "google", "sam@brightline.studio", 24, 40),
    mailbox("mb_2", "Sam (warming up)", "google", "sam@trybrightline.com", 14, 40, {
      current: 22,
      target: 40,
    }),
    mailbox("mb_3", "Hello (Microsoft)", "microsoft", "hello@brightlinehq.com", 31, 45),
    mailbox("mb_4", "Team (SMTP)", "smtp", "team@getbrightline.co", 12, 40),
  ];

  const contacts = people.map(([name, title, company, domain, timezone], i) => ({
    _id: "ct_" + i,
    _creationTime: now - (i + 1) * day,
    orgId: "org_1",
    email: emailOf(name, domain),
    customVars: { name, firstName: name.split(" ")[0], company, title },
    timezone,
  }));

  const thread = (
    person: number,
    id: string,
    excerpt: string,
    receivedAt: number,
    unread: boolean
  ) => {
    const [name, , company, domain] = people[person];
    return {
      id,
      sender: { name, address: emailOf(name, domain), suspicious: false },
      subject: `Re: Quick question about ${company}${company.endsWith("s") ? "'" : "'s"} outbound`,
      excerpt,
      unread: unread && !demo.readThreads.has(id),
      receivedAt,
    };
  };
  const threads = [
    ...(demo.injectedAt
      ? [
          thread(
            6,
            "th_new",
            "Perfect timing, we just hired two SDRs. Could you walk us through it tomorrow?",
            demo.injectedAt,
            true
          ),
        ]
      : []),
    thread(
      0,
      "th_1",
      "Yes, this is timely. We're rebuilding our outbound stack this quarter. Free Thursday at 2pm?",
      now - 12 * 60000,
      true
    ),
    thread(
      1,
      "th_2",
      "Love the self-hosted angle. Could you send pricing for 10 mailboxes?",
      now - hour,
      true
    ),
    thread(
      2,
      "th_3",
      "Looping in Jordan from RevOps. Let's find time next week.",
      now - 3 * hour,
      true
    ),
    thread(
      3,
      "th_4",
      "We already run Postgres on Railway, so self-hosting is easy for us. Sharing with the team.",
      now - day,
      false
    ),
    thread(4, "th_5", "Not this quarter, but check back in January.", now - 2 * day, false),
  ];
  const unreadCount = threads.filter((t) => t.unread).length;

  const notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    createdAt: number;
    readAt?: number;
    data?: { threadId: string };
  }> = [
    ...threads
      .filter((t) => t.unread)
      .map((t) => ({
        id: "n_" + t.id,
        type: "reply",
        title: `${t.sender.name} replied`,
        body: t.subject,
        createdAt: t.receivedAt,
        data: { threadId: t.id },
      })),
    {
      id: "n_ramp",
      type: "info",
      title: "sam@trybrightline.com is warming up",
      body: "Now sending up to 22 a day, on the way to 40.",
      createdAt: now - 6 * hour,
      readAt: now,
    },
  ].map((n) => (demo.readNotifications.has(n.id) ? { ...n, readAt: now } : n));

  const analytics = (days: number) => {
    const totalSent = ({ 7: 1140, 30: 4862, 90: 11930 } as Record<number, number>)[days] ?? 4862;
    const replies = Math.round(totalSent * 0.091);
    return {
      totalSent,
      replies,
      estimatedOpenRate: null,
      openTrackingEnabled: false,
      replyRate: (replies / totalSent) * 100,
      bounceRate: 0.8,
      unsubscribeRate: 0.3,
      clickRate: null,
    };
  };

  return [
    [
      /^\/api\/auth\/session/,
      () => ({
        user: { id: "u_1", name: "Sam Rivera", email: "sam@brightline.studio" },
        session: { activeOrganizationId: "org_1" },
      }),
    ],
    [/^\/api\/analytics\/org(?:\?days=(\d+))?/, (m) => analytics(Number(m[1] ?? 30))],
    [
      /^\/api\/campaigns\/([^/]+)\/stats/,
      (m) => {
        const c = campaigns.find((x) => x._id === m[1]) ?? campaigns[0];
        const totalContacts = Math.round(c.emailsSent / 2.4) || 120;
        return {
          totalContacts,
          emailsSent: c.emailsSent,
          replyRate: c.replyRate,
          activeContacts: Math.round(totalContacts * 0.55),
          repliedContacts: Math.round((c.emailsSent * c.replyRate) / 100),
          bouncedContacts: Math.round((c.emailsSent * c.bounceRate) / 100),
          completedContacts: Math.round(totalContacts * 0.3),
        };
      },
    ],
    [
      /^\/api\/campaigns\/[^/]+\/assignments/,
      () => ({
        page: contacts.slice(0, 8).map((c, i) => ({
          _id: "as_" + i,
          contactId: c._id,
          contactName: c.customVars.name,
          contactEmail: c.email,
          status: [
            "replied",
            "replied",
            "replied",
            "active",
            "completed",
            "active",
            "replied",
            "active",
          ][i],
          currentStep: (i % 3) + 1,
          lastEmailSentAt: now - (i + 1) * 5 * hour,
        })),
        isDone: true,
        continueCursor: null,
      }),
    ],
    [
      /^\/api\/campaigns\/([^/?]+)/,
      (m) => ({
        campaign: {
          ...(campaigns.find((c) => c._id === m[1]) ?? campaigns[0]),
          schedule: {
            defaultTimezone: "America/New_York",
            startTime: "09:00",
            endTime: "17:00",
            daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          steps: sequence,
        },
      }),
    ],
    [/^\/api\/campaigns/, () => ({ campaigns })],
    [/^\/api\/mailboxes/, () => ({ mailboxes })],
    [
      /^\/api\/contacts\/([^/?]+)/,
      (m) => ({
        contact: contacts.find((c) => c._id === m[1]) ?? contacts[0],
        history: {
          page: [
            {
              _id: "as_1",
              campaignId: "cmp_1",
              status: "replied",
              currentStep: 2,
              lastEmailSentAt: now - day,
              _creationTime: now - 5 * day,
            },
            {
              _id: "as_2",
              campaignId: "cmp_4",
              status: "completed",
              currentStep: 3,
              _creationTime: now - 30 * day,
            },
          ],
        },
      }),
    ],
    [/^\/api\/contacts/, () => ({ contacts })],
    [
      /^\/api\/groups/,
      () => ({
        groups: [
          { _id: "g_1", name: "Seed founders", count: 420 },
          { _id: "g_2", name: "Agency partners", count: 160 },
        ],
      }),
    ],
    [
      /^\/api\/inbox\/threads\/([^/?]+)/,
      (m) => {
        const t = threads.find((x) => x.id === m[1]) ?? threads[0];
        const firstName = t.sender.name.split(" ")[0];
        const company = people.find(([name]) => name === t.sender.name)?.[2] ?? "your team";
        return {
          thread: t,
          messages: [
            {
              id: "msg_1",
              direction: "sent",
              subject: t.subject.replace(/^Re: /, ""),
              displayText: sequence[0].body
                .replaceAll("{{firstName}}", firstName)
                .replaceAll("{{company}}", company),
              sentAt: t.receivedAt - day,
            },
            {
              id: "msg_2",
              direction: "received",
              from: t.sender.address,
              subject: t.subject,
              displayText: `${t.excerpt}\n\nBest,\n${t.sender.name}`,
              receivedAt: t.receivedAt,
            },
            ...(demo.sentReplies.get(t.id) ?? []).map((reply, i) => ({
              id: `msg_reply_${i}`,
              direction: "sent",
              subject: t.subject,
              displayText: reply.body,
              sentAt: reply.at,
            })),
          ],
        };
      },
    ],
    [/^\/api\/inbox/, () => ({ threads, unreadCount })],
    [
      /^\/api\/notifications/,
      () => ({ notifications, unreadCount: notifications.filter((n) => !n.readAt).length }),
    ],
    [
      /^\/api\/blocklist/,
      () => ({
        page: [
          {
            _id: "b1",
            email: "no.thanks@parcelly.co",
            reason: "unsubscribed",
            createdAt: now - day,
          },
          {
            _id: "b2",
            email: "old.inbox@formerco.com",
            reason: "bounced_hard",
            createdAt: now - 4 * day,
          },
          { _id: "b3", email: "sales@rivalcorp.io", reason: "manual", createdAt: now - 20 * day },
        ],
      }),
    ],
    [
      /^\/api\/settings\/roles/,
      () => ({
        roles: [
          { id: "owner", slug: "owner", name: "Owner", permissions: ["*"], builtIn: true },
          {
            id: "member",
            slug: "member",
            name: "Member",
            permissions: ["campaigns:read"],
            builtIn: true,
          },
          {
            id: "r_ops",
            slug: "campaign-operator",
            name: "Campaign operator",
            permissions: ["campaigns:read", "campaigns:write"],
            builtIn: false,
          },
        ],
        permissions: ["campaigns:read", "campaigns:write", "contacts:read", "contacts:write"],
      }),
    ],
    [
      /^\/api\/settings\/members/,
      () => [
        {
          id: "m1",
          userId: "u_1",
          email: "sam@brightline.studio",
          name: "Sam Rivera",
          role: "owner",
        },
        {
          id: "m2",
          userId: "u_2",
          email: "jordan@brightline.studio",
          name: "Jordan Lee",
          role: "member",
        },
      ],
    ],
    [/^\/api\/settings\/api-keys/, () => []],
    [
      /^\/api\/settings\/compliance/,
      () => ({
        listUnsubscribeEnabled: true,
        physicalAddress: "120 Harbor Way, Suite 4, Oakland, CA",
        defaultSenderName: "Sam from Brightline",
        bouncePauseRate: 0.05,
        unsubscribePauseRate: 0.1,
        complaintPauseRate: 0.001,
      }),
    ],
    [/^\/api\/settings\/notifications/, () => ({})],
    [
      /^\/api\/settings\/sending/,
      () => ({ defaultRampEnabled: true, defaultRampTarget: 40, replyReserve: 2 }),
    ],
  ];
}

/** Keeps the few writes a recording shows on screen. Every other write is accepted and dropped. */
export function recordWrite(method: string, path: string, body: string) {
  const reply = path.match(/^\/api\/inbox\/threads\/([^/?]+)\/reply/);
  if (method === "POST" && reply) {
    const text = (JSON.parse(body || "{}") as { body?: string }).body ?? "";
    demo.sentReplies.set(reply[1], [
      ...(demo.sentReplies.get(reply[1]) ?? []),
      { body: text, at: Date.now() },
    ]);
    return;
  }
  const thread = path.match(/^\/api\/inbox\/threads\/([^/?]+)$/);
  if (method === "PATCH" && thread) demo.readThreads.add(thread[1]);
  const notification = path.match(/^\/api\/notifications\/([^/?]+)$/);
  if (method === "PATCH" && notification) demo.readNotifications.add(notification[1]);
  if (method === "POST" && path.startsWith("/api/notifications/mark-all-read")) {
    for (const thread of ["th_new", "th_1", "th_2", "th_3"])
      demo.readNotifications.add("n_" + thread);
  }
}
