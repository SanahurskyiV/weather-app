/** Confirms the D1 binding answers a query. Repos for feature data live next to this file. */
export async function pingDatabase(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return row?.ok === 1;
}
