export const OWNER_TRANSPORT_TABLE = "_kb_owner_import_3f7a22a0_chunks";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function readOwnerTransportPage(client: RpcClient, offset: number, limit: number) {
  const { data, error } = await client.rpc("backup_owner_transport_page", { _offset: offset, _limit: limit });
  if (error) return { data: null, count: null, error };
  const result = data as { rows?: unknown; total?: unknown } | null;
  if (!result || !Array.isArray(result.rows) || !Number.isInteger(result.total) || Number(result.total) < 0
    || result.rows.length > limit || result.rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    return { data: null, count: null, error: { message: "Invalid owner transport backup response" } };
  }
  return { data: result.rows as Record<string, unknown>[], count: Number(result.total), error: null };
}
