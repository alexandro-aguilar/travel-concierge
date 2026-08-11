export class SessionNotFoundError extends Error {
  public constructor() { super('Session not found'); }
}
export class InvalidTripStateError extends Error {
  public constructor() { super('Messages can only be added while collecting requirements'); }
}
export class ConditionalWriteConflictError extends Error {
  public constructor() { super('The session was updated concurrently'); }
}
export class InvalidCursorError extends Error {
  public constructor() { super('The pagination cursor is invalid'); }
}
