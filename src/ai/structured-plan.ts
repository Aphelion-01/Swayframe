import { z } from 'zod';
import { AIError, type ChatRequest, type ChatResponse } from './contracts';
/** Strict JSON envelope transport for text-only compatible APIs. The same host
 * plan/tool validators still own meaning and permissions. No partial/fenced JSON. */
export function structuredPlanRequest(request: ChatRequest): ChatRequest {
  if (!request.tools?.length) return request;
  return {
    ...request,
    tools: undefined,
    toolChoice: undefined,
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          'Return only one complete JSON object {"text":"optional brief explanation","toolCalls":[{"name":"registered_name","arguments":{...}}]}. No markdown, code, partial JSON or prose outside this envelope. Required tool: ' +
          (request.toolChoice ?? 'one of supplied tools') +
          '. Authoritative contracts: ' +
          JSON.stringify(request.tools),
      },
      ...request.messages.map((m) => ({
        role: m.role === 'tool' ? ('user' as const) : m.role,
        content: m.toolCalls
          ? JSON.stringify({ text: m.content, toolCalls: m.toolCalls })
          : m.content,
        images: m.images,
      })),
    ],
  };
}
export function normalizeStructuredResponse(
  response: ChatResponse,
  request: ChatRequest,
): ChatResponse {
  if (!request.tools?.length) return response;
  let raw: unknown;
  try {
    raw = JSON.parse(response.text);
  } catch {
    throw new AIError('invalid_response', '结构计划不是完整 JSON', {
      kind: 'invalid-json',
      incomplete: true,
    });
  }
  const parsed = z
    .object({
      text: z.string().max(12000).optional(),
      toolCalls: z
        .array(
          z
            .object({
              name: z.string().min(1).max(64),
              arguments: z.record(z.string(), z.unknown()),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict()
    .safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.toolCalls.some(
      (t) => !request.tools!.some((d) => d.name === t.name),
    ) ||
    (request.toolChoice &&
      (parsed.data.toolCalls.length !== 1 ||
        parsed.data.toolCalls[0]?.name !== request.toolChoice))
  )
    throw new AIError('invalid_response', '结构计划不符合当前工具契约', {
      kind: 'protocol',
      incomplete: true,
    });
  return {
    ...response,
    text: parsed.data.text ?? '',
    toolCalls: parsed.data.toolCalls.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
    })),
  };
}
