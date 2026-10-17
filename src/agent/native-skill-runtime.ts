import manifest0 from './native-skills/shape-creation/manifest.json';
import workflow0 from './native-skills/shape-creation/workflow.json';
import instructions0 from './native-skills/shape-creation/SKILL.md?raw';
import manifest1 from './native-skills/typography/manifest.json';
import workflow1 from './native-skills/typography/workflow.json';
import instructions1 from './native-skills/typography/SKILL.md?raw';
import manifest2 from './native-skills/gradient-fill/manifest.json';
import workflow2 from './native-skills/gradient-fill/workflow.json';
import instructions2 from './native-skills/gradient-fill/SKILL.md?raw';
import manifest3 from './native-skills/keyframe-animation/manifest.json';
import workflow3 from './native-skills/keyframe-animation/workflow.json';
import instructions3 from './native-skills/keyframe-animation/SKILL.md?raw';
import manifest4 from './native-skills/compositing/manifest.json';
import workflow4 from './native-skills/compositing/workflow.json';
import instructions4 from './native-skills/compositing/SKILL.md?raw';
import { z } from 'zod';
import coreManifest from './native-skills/core-execution/manifest.json';
import coreWorkflow from './native-skills/core-execution/workflow.json';
import coreInstructions from './native-skills/core-execution/SKILL.md?raw';
import { contentHash } from '../core/content-hash';
import { activeComposition, type Project } from '../core/project-model';
import { AgentExecutionError } from './execution-error';
import type { AgentPlan } from './session';
import type { AgentToolRegistry } from './tool-registry';
const list = z.array(z.string().min(1).max(200)).max(80);
export const nativeSkillManifestSchema = z
  .object({
    id: z.string().regex(/^sf\.[a-z-]+$/),
    name: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    description: z.string().max(1000),
    supportedTasks: list,
    requiredCapabilities: list,
    optionalCapabilities: list,
    supportedObjectTypes: list,
    inputs: z.record(z.string(), z.string()),
    outputs: z.record(z.string(), z.string()),
    prerequisites: list,
    permissionRequirements: z
      .array(z.literal('existing-user-scope'))
      .min(1)
      .max(1),
    compatibility: z.object({ runtime: z.literal(1) }).strict(),
    recoveryPolicy: z.literal('shared-bounded-controller'),
    keywords: list,
  })
  .strict();
export const nativeSkillWorkflowSchema = z
  .object({
    actions: list,
    entryActions: list.optional(),
    constraints: z
      .array(
        z.enum([
          'registered-tools',
          'actual-object-binding',
          'dependency-validation',
          'shared-command-transaction',
          'bounded-recovery',
          'scene-verification',
          'render-verification',
        ]),
      )
      .min(1),
    validationRules: z
      .array(
        z.enum([
          'valid-plan',
          'native-scene',
          'native-render',
          'text-visible',
          'animation-evaluation',
          'graph-output',
        ]),
      )
      .min(1),
    sequence: list,
  })
  .strict();
export interface NativeSkill {
  manifest: z.infer<typeof nativeSkillManifestSchema>;
  workflow: z.infer<typeof nativeSkillWorkflowSchema>;
  instructions: string;
  hash: string;
}
const packages = [
  { manifest: manifest0, workflow: workflow0, instructions: instructions0 },
  { manifest: manifest1, workflow: workflow1, instructions: instructions1 },
  { manifest: manifest2, workflow: workflow2, instructions: instructions2 },
  { manifest: manifest3, workflow: workflow3, instructions: instructions3 },
  { manifest: manifest4, workflow: workflow4, instructions: instructions4 },
  {
    manifest: coreManifest,
    workflow: coreWorkflow,
    instructions: coreInstructions,
  },
];
/** Only compiled, app-owned packages are executable guidance. Arbitrary SKILL.md
 * and legacy user prompts cannot install an action, compiler or permission. */
export class NativeSkillRegistry {
  private readonly entries = new Map<string, NativeSkill>();
  constructor() {
    for (const source of packages) {
      const manifest = nativeSkillManifestSchema.parse(source.manifest);
      const workflow = nativeSkillWorkflowSchema.parse(source.workflow);
      const skill = {
        manifest,
        workflow,
        instructions: source.instructions,
        hash: contentHash(source),
      };
      if (this.entries.has(manifest.id)) throw Error('重复原生 Skill');
      this.entries.set(manifest.id, skill);
    }
  }
  all() {
    return [...this.entries.values()].map((s) => structuredClone(s));
  }
  load(id: string, disabled: readonly string[] = []) {
    const skill = this.entries.get(id);
    if (!skill || disabled.includes(id))
      throw new AgentExecutionError({
        code: 'CAPABILITY_UNAVAILABLE',
        phase: 'preflight',
        recoverable: false,
        message: '原生 Skill 不可用：' + id,
      });
    return structuredClone(skill);
  }
  validatePackage(raw: unknown) {
    const parsed = z
      .object({
        manifest: nativeSkillManifestSchema,
        workflow: nativeSkillWorkflowSchema,
        instructions: z.string().max(12000),
      })
      .strict()
      .parse(raw);
    const builtin = this.entries.get(parsed.manifest.id);
    if (!builtin || builtin.hash !== contentHash(parsed))
      throw new AgentExecutionError({
        code: 'UNSAFE_OPERATION',
        phase: 'preflight',
        recoverable: false,
        message: '仅允许当前应用内置精确版本的 Skill',
      });
    return this.load(parsed.manifest.id);
  }
}
export class NativeSkillRuntime {
  readonly registry = new NativeSkillRegistry();
  private selected: NativeSkill[] = [];
  private enabled = true;
  private disabled: readonly string[] = [];
  constructor(private readonly tools: AgentToolRegistry) {}
  route(goal: string, enabled = true, disabled: readonly string[] = []) {
    this.enabled = enabled;
    this.disabled = disabled;
    this.selected = [];
    if (!enabled) return [];
    const ids = [
      'sf.core-execution',
      ...this.registry
        .all()
        .filter((s) =>
          s.manifest.keywords.some((k) =>
            goal.toLowerCase().includes(k.toLowerCase()),
          ),
        )
        .map((s) => s.manifest.id),
    ];
    this.load(ids);
    return this.context();
  }
  private load(ids: readonly string[]) {
    const available = new Set(this.tools.catalog().map((t) => t.name));
    for (const id of new Set(ids)) {
      if (this.disabled.includes(id)) continue;
      if (this.selected.some((s) => s.manifest.id === id)) continue;
      const skill = this.registry.load(id, this.disabled);
      const missing = skill.manifest.requiredCapabilities.filter(
        (c) => !available.has(c),
      );
      if (missing.length)
        throw new AgentExecutionError({
          code: 'CAPABILITY_UNAVAILABLE',
          phase: 'preflight',
          recoverable: false,
          message: 'Skill 缺少真实能力：' + id,
          cause: { missing },
        });
      this.selected.push(skill);
    }
  }
  validate(plan: AgentPlan, project: Project) {
    if (!this.enabled) return;
    // Relevant skills can also be selected from an actual late-discovered plan.
    this.load(
      this.registry
        .all()
        .filter((s) =>
          (s.workflow.entryActions ?? []).some((a) =>
            plan.steps.some((p) => p.tool === a),
          ),
        )
        .map((s) => s.manifest.id),
    );
    const c = activeComposition(project);
    if (!c) throw Error('Skill 缺少当前合成');
    // Tool/argument/scope checks are deliberately owned by the real Registry and Transaction.
  }
  context() {
    return this.selected.map((s) => ({
      id: s.manifest.id,
      version: s.manifest.version,
      hash: s.hash,
      inputs: s.manifest.inputs,
      outputs: s.manifest.outputs,
      requiredCapabilities: s.manifest.requiredCapabilities,
      workflow: s.workflow,
      instructions: s.instructions,
    }));
  }
  validationRules() {
    return [
      ...new Set(this.selected.flatMap((s) => s.workflow.validationRules)),
    ];
  }
  selectedTools() {
    return [...new Set(this.selected.flatMap((s) => s.workflow.actions))];
  }
}
