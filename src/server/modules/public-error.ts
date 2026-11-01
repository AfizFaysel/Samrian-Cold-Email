// The only errors whose message may reach a client. Anything else can carry provider or SQL text.
export class PublicError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}
