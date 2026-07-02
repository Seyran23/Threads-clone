import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static run(store: RequestContextStore, callback: () => void): void {
    asyncLocalStorage.run(store, callback);
  }

  static get correlationId(): string | undefined {
    return asyncLocalStorage.getStore()?.correlationId;
  }
}
