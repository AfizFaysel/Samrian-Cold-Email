export const JOB_NAMES = {
  campaignSend: "campaign.send",
  campaignDispatch: "campaign.dispatch",
  mailboxPoll: "mailbox.poll",
  mailboxPollAll: "mailbox.poll-all",
  mailboxCheck: "mailbox.check",
  mailboxCheckAll: "mailbox.check-all",
  mailboxRamp: "mailbox.ramp",
  emailBounce: "email.bounce",
  resetCounters: "maintenance.reset-counters",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
