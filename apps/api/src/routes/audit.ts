import { Router } from 'express';
import { listAuditRecords } from '../services/audit-service';
import { getProjectId } from '../middleware/route-helpers';
import type { AuditAction } from '../types/audit';

const router = Router();

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
 * Also neutralises formula injection: cells starting with =, +, -, @, tab are quoted
 * and prefixed with a single-quote so spreadsheets don't execute them. */
function csvEscape(field: string): string {
  // Strip tabs to prevent tab-then-formula injection across cells.
  const sanitised = field.replace(/\t/g, ' ');
  const formulaChar = sanitised.startsWith('=') || sanitised.startsWith('+') ||
    sanitised.startsWith('-') || sanitised.startsWith('@');
  if (/[",\n\r]/.test(sanitised) || formulaChar) {
    return '"' + (formulaChar ? "'" : '') + sanitised.replace(/"/g, '""') + '"';
  }
  return sanitised;
}

// GET /api/audit — list audit records with optional filters
// Pagination: pass `before=<ISO-timestamp>` to get the next page (cursor from last record's performedAt).
router.get('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const { flagKey, action, performedBy, limit, before } = req.query;

    const records = await listAuditRecords({
      projectId,
      flagKey: typeof flagKey === 'string' ? flagKey : undefined,
      action: typeof action === 'string' ? (action as AuditAction) : undefined,
      performedBy: typeof performedBy === 'string' ? performedBy : undefined,
      limit: typeof limit === 'string' ? (parseInt(limit, 10) || undefined) : undefined,
      before: typeof before === 'string' ? before : undefined,
    });

    res.json(records);
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/export — CSV export
router.get('/export', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const { flagKey, action, performedBy } = req.query;

    const records = await listAuditRecords({
      projectId,
      flagKey: typeof flagKey === 'string' ? flagKey : undefined,
      action: typeof action === 'string' ? (action as AuditAction) : undefined,
      performedBy: typeof performedBy === 'string' ? performedBy : undefined,
      limit: 200,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');

    // CSV header
    res.write('id,action,flagKey,performedBy,performedAt\n');
    for (const r of records) {
      const at =
        r.performedAt && 'toDate' in r.performedAt
          ? (r.performedAt as unknown as { toDate: () => Date }).toDate().toISOString()
          : '';
      const fields = [r.id, r.action, r.flagKey ?? '', r.performedBy, at];
      res.write(fields.map(csvEscape).join(',') + '\n');
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
