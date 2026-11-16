import type { Deps } from './deps.js';
import type { ExpiredFileCursor } from '../repositories/documentRepository.js';

export const retentionService = (
  d: Pick<Deps, 'repos' | 'store'>,
  onDeleteFailure: (docId: string, error: unknown) => void = (docId, error) => {
    console.error(`Retention cleanup failed for document ${docId}:`, error);
  },
) => ({
  /** Remove expired objects before purging their database rows and facts. */
  async sweep(): Promise<void> {
    let after: ExpiredFileCursor | undefined;
    for (;;) {
      const expired = await d.repos.documents.expiredFiles(after);
      if (!expired.length) return;
      const removedIds: string[] = [];
      for (const doc of expired) {
        try {
          await d.store.remove(doc.file_ref);
          removedIds.push(doc.doc_id);
        } catch (error) {
          // Keep the DB row and facts if object deletion fails so the next sweep can retry.
          onDeleteFailure(doc.doc_id, error);
        }
      }
      if (removedIds.length) await d.repos.documents.purgeExpired(removedIds);
      const last = expired[expired.length - 1]!;
      after = { retentionUntil: last.retention_until, docId: last.doc_id };
    }
  },
});
