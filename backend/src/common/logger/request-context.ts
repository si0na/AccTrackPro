import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  userId?: string;
}

/**
 * Single AsyncLocalStorage instance shared across the entire process.
 * The RequestIdMiddleware calls .run() at the HTTP boundary, establishing
 * the store for every async operation within a request's call chain.
 * LoggingInterceptor mutates the same store object to add userId once the
 * JWT guard has populated req.user.
 */
export const als = new AsyncLocalStorage<RequestStore>();
