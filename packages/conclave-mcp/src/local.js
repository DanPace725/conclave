import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from '../../../src/store.js';
import { HandoffService } from '../../../src/handoffs.js';

export const defaultDirectory = fileURLToPath(new URL('../../../.conclave/handoffs/', import.meta.url));
export function openHandoffs(directory = process.env.CONCLAVE_HANDOFF_DATA || defaultDirectory) {
  const store = new Store(resolve(directory));
  return { service: new HandoffService(store), close: () => store.close(), directory: store.directory };
}
