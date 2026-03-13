import { AppError } from './error-handler';

/** Extract and validate the required projectId query parameter. */
export function getProjectId(req: { query: Record<string, unknown> }): string {
  const pid = req.query.projectId;
  if (!pid || typeof pid !== 'string') {
    throw new AppError('projectId query parameter is required', 400);
  }
  return pid;
}

/** Extract the authenticated user's email. */
export function getUser(req: { user?: { email: string } }): string {
  return req.user?.email ?? 'unknown';
}
