import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** Returns '-' outside an active request context (e.g. app bootstrap). */
export function getRequestId(): string {
  return storage.getStore()?.requestId ?? '-';
}
