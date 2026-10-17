import { z } from 'zod';
import {
  actionSchema,
  dependencies,
  intentSchema,
  type TaskIntent,
} from './actions';
import { problem, recoveryFeedback, type CoreError } from './errors';
import type { SemanticAction } from './actions';
import type { ProviderBridge, NormalizedResponse } from './provider';
import type { RepairContext } from './recovery';
/** Format example only; never substituted for the user's goal or executed. */
export const creationAndFillExample: TaskIntent = {
  goal: 'Format example: create and color one rectangle',
  actions: [
    {
      id: 'shape',
      type: 'createShape',
      shape: 'rectangle',
      width: 120,
      height: 80,
      position: { x: 100, y: 100 },
      dependsOn: [],
    },
    {
      id: 'fill',
      type: 'setFill',
      target: { kind: 'result', actionId: 'shape' },
      color: { r: 1, g: 0, b: 0, a: 1 },
      dependsOn: ['shape'],
    },
  ],
};
/** Stable topological ordering. Independent actions preserve model order. */
export function validateIntent(raw: unknown, trustedGoal?: string): TaskIntent {
  const parsed = intentSchema.safeParse(raw);
  if (!parsed.success)
    throw problem('INVALID_ARGUMENTS', '任务意图不符合受支持的动作契约', {
      phase: 'planning',
      field: parsed.error.issues[0]?.path.join('.') ?? '$',
      expected: 'Typed Task Intent',
      actual: parsed.error.issues[0]?.code,
    });
  const intent = parsed.data,
    ids = new Set(intent.actions.map((a) => a.id));
  if (ids.size !== intent.actions.length)
    throw problem(
      'DEPENDENCY_ERROR',
      '动作标识重复；需要重新规划，不能删除或重命名动作',
      {
        phase: 'planning',
        field: 'actions.id',
        expected: 'unique action IDs',
        actual: {
          duplicateIds: [...ids].filter(
            (id) => intent.actions.filter((a) => a.id === id).length > 1,
          ),
          rejectedIntent: intent,
        },
      },
    );
  for (const a of intent.actions)
    if (dependencies(a).some((id) => !ids.has(id) || id === a.id))
      throw problem('DEPENDENCY_ERROR', '依赖引用缺失或指向自身', {
        phase: 'planning',
        actionId: a.id,
      });
  const remaining = [...intent.actions],
    done = new Set<string>(),
    ordered: TaskIntent['actions'] = [];
  while (remaining.length) {
    const index = remaining.findIndex((a) =>
      dependencies(a).every((id) => done.has(id)),
    );
    if (index < 0)
      throw problem('DEPENDENCY_ERROR', '动作依赖存在循环', {
        phase: 'planning',
      });
    const [a] = remaining.splice(index, 1);
    ordered.push(a!);
    done.add(a!.id);
  }
  if (trustedGoal !== undefined) validateCreationContract(intent, trustedGoal);
  return { ...intent, actions: ordered };
}
/** Conservative explicit creation clauses only. Not a natural-language semantic oracle.
 * Host goal is authoritative; model-supplied intent.goal cannot remove constraints.
 * Distinct IDs with equal action payloads remain legal: no content deduplication.
 */
export function creationContract(goal: string) {
  const numbers: Record<string, number> = {
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const clauses = [
    ...goal.matchAll(
      /(?:^|[，。；,;\n])\s*(?:请)?(?:只|仅)?(?:创建|新建|添加)([1-9][0-9]?|一|两|二|三|四|五|六|七|八|九|十)(?:个|层)?(矩形|椭圆|文字|文本|标题)/g,
    ),
  ];
  // Avoid applying a partial count when unrecognized additional creation is requested.
  const creationVerbs = goal.match(/创建|新建|添加/g)?.length ?? 0;
  const prohibitions =
    goal.match(/(?:不要|不再|禁止)(?:创建|新建|添加)/g)?.length ?? 0;
  if (!clauses.length || clauses.length !== creationVerbs - prohibitions)
    return null;
  const counts = { rectangle: 0, ellipse: 0, text: 0 };
  for (const clause of clauses) {
    const count = numbers[clause[1]!] ?? Number(clause[1]);
    const kind =
      clause[2] === '矩形'
        ? 'rectangle'
        : clause[2] === '椭圆'
          ? 'ellipse'
          : 'text';
    counts[kind] += count;
  }
  return counts;
}
export function validateCreationContract(intent: TaskIntent, goal: string) {
  const expected = creationContract(goal);
  if (!expected) return;
  const actual = { rectangle: 0, ellipse: 0, text: 0 };
  for (const action of intent.actions) {
    if (action.type === 'createText') actual.text++;
    if (action.type === 'createShape') actual[action.shape]++;
  }
  if (
    Object.keys(expected).some(
      (key) =>
        expected[key as keyof typeof expected] !==
        actual[key as keyof typeof actual],
    )
  )
    throw problem(
      'VERIFICATION_FAILURE',
      '创建数量或对象类型与用户明确要求不一致；草稿未执行',
      {
        phase: 'planning',
        field: 'actions.creation',
        expected,
        actual: { counts: actual, rejectedIntent: intent },
      },
    );
}
export class AgentPlanner {
  constructor(private readonly bridge: ProviderBridge) {}
  async repair(
    failed: SemanticAction,
    error: CoreError,
    signal: AbortSignal,
    context?: RepairContext,
  ) {
    const selectedSchema = actionSchema.options.find(
      (s) => s.shape.type.value === failed.type,
    )!;
    const schema = z.toJSONSchema(selectedSchema);
    const response = await this.bridge.request(
      {
        stream: false,
        maxOutputTokens: 2000,
        messages: [
          {
            role: 'system',
            content:
              'Repair only the supplied failed action. Preserve id, type, target, dependencies, property path and requested content. Return the action object only. No entire plan or replay. Contract: ' +
              JSON.stringify(schema),
          },
          {
            role: 'user',
            content: JSON.stringify({
              failed,
              error: JSON.parse(recoveryFeedback(error)),
              ...(context
                ? {
                    context: {
                      goal: context.goal.slice(0, 1000),
                      draftVersion: context.draftVersion,
                      completedActions: context.completedActions,
                      target: context.target,
                      allowRepair: context.allowRepair,
                    },
                  }
                : {}),
            }),
          },
        ],
        ...(this.bridge.mode === 'tools'
          ? {
              tools: [
                {
                  name: 'repairAction',
                  description:
                    'Return corrected parameters for the one failed action.',
                  parameters: schema,
                },
              ],
              toolChoice: 'repairAction',
            }
          : {}),
      },
      signal,
      context?.beforeRequest,
    );
    return {
      action: response.payload,
      ...(response.usage
        ? {
            usage: {
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
            },
          }
        : {}),
    };
  }
  async plan(
    goal: string,
    context: unknown,
    capabilities: unknown,
    signal: AbortSignal,
    beforeRequest?: (request: import('../ai/contracts').ChatRequest) => void,
    rejectedPlan?: CoreError,
  ): Promise<{ rawIntent: unknown; response: NormalizedResponse }> {
    const scope =
      context && typeof context === 'object'
        ? (context as { scope?: { allowCreate?: boolean } }).scope
        : undefined;
    const allowCreate = scope?.allowCreate !== false;
    const editActions = actionSchema.options.filter(
      (option) =>
        !['createShape', 'createText', 'createNative'].includes(
          option.shape.type.value,
        ),
    );
    // Advertise the same creation boundary that the host already enforces.
    // Reuse the original action definitions; validation and execution stay strict.
    const scopedIntentSchema = allowCreate
      ? intentSchema
      : intentSchema.extend({
          actions: z
            .array(
              z.discriminatedUnion('type', [
                editActions[0]!,
                ...editActions.slice(1),
              ]),
            )
            .min(1)
            .max(100),
        });
    const schema = z.toJSONSchema(scopedIntentSchema);
    const response = await this.bridge.request(
      {
        stream: false,
        maxOutputTokens: 6000,
        messages: [
          {
            role: 'system',
            content:
              'Return one high-level Task Intent. No UUID generation, raw commands, skills or executable code. You can edit composition content through supplied native tools only. You cannot read/write application source files, patch SF code, run a shell or execute scripts. Reference newly created objects by action result; existing targets only from supplied context. Defaults come from the editor. Supported semantic actions map only to supplied registered capabilities. All actions execute incrementally in an isolated draft. Do not claim success before host verification. ' +
              'Choose each action type before its fields: createShape creates only a rectangle or ellipse (square/正方形 means rectangle with equal width and height; circle/圆形 means ellipse with equal width and height); createText creates actual text and requires content. Never substitute shapes for text. setFill changes an existing/result object; it never creates another shape. Creation followed by styling needs separate create and setFill actions, with target {kind:"result",actionId:creationId}. setDimensions edits width/height, setFont edits fontFamily, setProperty edits position/scale/rotation/opacity/fontSize (rotation in degrees). createNative/editNative are thin adapters to the supplied native tool contracts; args must follow their exact parameters, but omit layerId: host binds target. Use existing imported asset IDs only. Native identity fields default to editor-generated; never invent IDs. Other native object references may use {kind:"stepResult",stepId:actionId,output:"effectId"} etc. Native property-addressed edits must reference a property belonging to target. addKeyframe creates animation and modifyKeyframe edits interpolation. Preserve requested object count and exact content. For radial fill, radialParameters.stops is the authoritative flat [offset,r,g,b,a,...] color list. The exampleIntent below illustrates format and dependency references only. Use the actual goal and context, never copy its object count, dimensions, positions or color. For N requested shapes, emit exactly N creation actions and refer to those same results for styling.\n' +
              JSON.stringify({
                context,
                creationConstraint: creationContract(goal),
                ...(rejectedPlan
                  ? {
                      rejectedPlan,
                      correctionPolicy:
                        'Regenerate the complete intent. Keep the original user goal. Never silently remove actions or guess missing parameters. IDs must be unique; styling targets the created result.',
                    }
                  : {}),
                ...(allowCreate
                  ? { exampleIntent: creationAndFillExample }
                  : {}),
                // Action parameters are defined once by intentSchema. Low-level
                // Command schemas remain authoritative in the host registry.
                capabilities: Array.isArray(capabilities)
                  ? capabilities.map((c: unknown) => {
                      if (!c || typeof c !== 'object' || !('name' in c))
                        return c;
                      const contract = c as Record<string, unknown>;
                      return {
                        name: contract.name,
                        description: contract.description,
                        permission: contract.permission,
                        parameters: contract.parameters,
                        outputSchema: contract.outputSchema,
                        available:
                          !allowCreate &&
                          [
                            'createRectangle',
                            'createEllipse',
                            'createText',
                          ].includes(String(contract.name))
                            ? false
                            : contract.available,
                      };
                    })
                  : capabilities,
                ...(this.bridge.mode === 'structured-plan'
                  ? { intentSchema: schema }
                  : {}),
              }),
          },
          { role: 'user', content: goal },
        ],
        ...(this.bridge.mode === 'tools'
          ? {
              tools: [
                {
                  name: 'submitIntent',
                  description:
                    'Submit a typed high-level task intent; host resolves actual objects and commands incrementally.',
                  parameters: schema,
                },
              ],
              toolChoice: 'submitIntent',
            }
          : {}),
      },
      signal,
      beforeRequest,
    );
    return { rawIntent: response.payload, response };
  }
}
