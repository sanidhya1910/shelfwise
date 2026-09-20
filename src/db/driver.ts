/**
 * Type-resolution stub.
 *
 * Metro resolves `./driver` to `driver.native.ts` on Android/iOS and
 * `driver.web.ts` on web; this file exists so TypeScript has something to
 * resolve and so an unexpected platform fails loudly instead of silently.
 */
import type { Repository } from './repository';

export const repository: Repository = new Proxy({} as Repository, {
  get() {
    throw new Error('No storage driver was bundled for this platform.');
  },
});
