import { z } from 'zod';
export const providerDiagnosticSchema = z
  .object({
    kind: z.enum([
      'http',
      'invalid-json',
      'partial-tool-arguments',
      'incomplete-stream',
      'finish-reason',
      'protocol',
      'response-limit',
    ]),
    status: z.number().int().min(100).max(599).optional(),
    code: z.string().max(120).optional(),
    field: z.string().max(120).optional(),
    requestId: z.string().max(120).optional(),
    retryAfterMs: z.number().min(0).max(3600000).optional(),
    finishReason: z.string().max(80).optional(),
    incomplete: z.boolean().optional(),
  })
  .strict();
export type ProviderDiagnostic = z.infer<typeof providerDiagnosticSchema>;
export const modelUnavailableMessage =
  '当前服务没有所选模型的可用通道，请在设置 · AI 核对模型或联系服务管理员';
export function isModelUnavailable(details?: ProviderDiagnostic) {
  return ['model_not_found', 'invalid_model', 'model_not_supported'].includes(
    details?.code ?? '',
  );
}
export function safeProviderDiagnostic(raw: unknown) {
  const result = providerDiagnosticSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
function safeToken(value: unknown, secrets: readonly string[]) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_.:/[\]-]{1,120}$/.test(value) ||
    secrets.some((s) => s && value.includes(s))
  )
    return undefined;
  return value;
}
export async function httpDiagnostic(
  response: Response,
  signal: AbortSignal,
  secrets: readonly string[],
): Promise<ProviderDiagnostic> {
  const reader = response.body?.getReader();
  let text = '';
  let bytes = 0;
  try {
    if (reader)
      for (;;) {
        signal.throwIfAborted();
        const v = await reader.read();
        if (v.done) break;
        bytes += v.value.byteLength;
        if (bytes > 8192) break;
        text += new TextDecoder().decode(v.value);
      }
  } finally {
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
  let error: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(text);
    if (raw?.error && typeof raw.error === 'object') error = raw.error;
  } catch {
    /* No untrusted raw HTTP body is retained. */
  }
  const retry = response.headers.get('retry-after');
  const delay = retry
    ? /^\d+(\.\d+)?$/.test(retry)
      ? Number(retry) * 1000
      : Date.parse(retry) - Date.now()
    : undefined;
  return {
    kind: 'http',
    status: response.status,
    ...(safeToken(error.code, secrets)
      ? { code: safeToken(error.code, secrets) }
      : {}),
    ...(safeToken(error.param ?? error.field, secrets)
      ? { field: safeToken(error.param ?? error.field, secrets) }
      : {}),
    ...(safeToken(response.headers.get('x-request-id'), secrets)
      ? { requestId: safeToken(response.headers.get('x-request-id'), secrets) }
      : {}),
    ...(delay !== undefined && Number.isFinite(delay)
      ? { retryAfterMs: Math.min(3600000, Math.max(0, delay)) }
      : {}),
  };
}
