import fs from 'node:fs';
import type { WaitlistStore } from '../beta/waitlist';

/** Local-dev waitlist store: appends to a JSONL file named by WAITLIST_FILE. Not for production (serverless disks are ephemeral). */
export function fileWaitlistStore(path: string): WaitlistStore {
  return {
    async add(e) {
      const seen = fs.existsSync(path) && fs.readFileSync(path, 'utf8').split('\n').some((l) => l && JSON.parse(l).email === e.email);
      if (!seen) fs.appendFileSync(path, JSON.stringify(e) + '\n');
    },
  };
}
