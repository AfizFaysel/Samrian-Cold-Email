import type { Logger, LogFields } from "./logs";
import { redact, redactError } from "./redact";

export interface ErrorReporter {
  capture(error: unknown, fields?: LogFields): void;
}

export function createErrorReporter(options: { logger: Pick<Logger, "error"> }): ErrorReporter {
  return {
    capture(error, fields = {}) {
      options.logger.error("error.captured", {
        ...redact(fields),
        error: normalizeError(error),
      });
    },
  };
}

export function createNoopErrorReporter(): ErrorReporter {
  return { capture: () => {} };
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) return redactError(error);

  return redact({
    name: "NonError",
    message: String(error),
    stack: undefined as string | undefined,
  });
}
