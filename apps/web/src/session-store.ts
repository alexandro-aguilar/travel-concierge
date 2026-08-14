const key = 'travel-concierge.session-id';
export const readSessionId = (): string | undefined => localStorage.getItem(key) ?? undefined;
export const saveSessionId = (sessionId: string): void => localStorage.setItem(key, sessionId);
export const clearSessionId = (): void => localStorage.removeItem(key);
