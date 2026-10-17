// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AgentPanel } from '../src/ui/AgentPanel';
import {
  sessionFixture,
  existing,
  result,
  rgb,
} from './helpers/agent-v2-session-fixture';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import { activeComposition } from '../src/core/project-model';
import { validateRepair } from '../src/agent-v2/recovery';
import { validateIntent } from '../src/agent-v2/planner';
import { AIError } from '../src/ai/contracts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup() {
  const s = await sessionFixture();
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 1 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  return s;
}
const layers = (s: Awaited<ReturnType<typeof setup>>) =>
  activeComposition(s.store.commands.getSnapshot()).layers;
const send = (text: string) => {
  fireEvent.change(screen.getByLabelText('V2 Agent 需求'), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
};
it('selected duplicate-name layer becomes an explicit stable reference; unnamed request edits only it; clear keeps Scene and Undo', async () => {
  const s = await setup();
  await s.turn('创建两个矩形', [
    { id: 'a', type: 'createShape', shape: 'rectangle', name: '同名' },
    { id: 'b', type: 'createShape', shape: 'rectangle', name: '同名' },
  ]);
  const id = layers(s)[1]!.id;
  s.store.select(id);
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  expect(
    screen
      .getByLabelText('提示词中的图层引用')
      .querySelector('[data-layer-id]')
      ?.getAttribute('data-layer-id'),
  ).toBe(id);
  s.enqueue([
    { id: 'fill', type: 'setFill', target: existing(id), color: rgb(0, 0, 1) },
  ]);
  send('改成蓝色');
  await waitFor(() => expect(s.core.pending).toBe(true));
  const request = s.calls.at(-1)!.messages[0]!.content;
  expect(request).toContain('explicitReferences');
  expect(request).toContain(id);
  expect(layers(s)[1]!.editor?.properties.fill?.baseValue).not.toEqual([
    0, 0, 1, 1,
  ]);
  fireEvent.click(screen.getByText('接受修改'));
  expect(layers(s)[1]!.editor?.properties.fill?.baseValue).toEqual([
    0, 0, 1, 1,
  ]);
  expect(layers(s)[0]!.editor?.properties.fill?.baseValue).not.toEqual([
    0, 0, 1, 1,
  ]);
  const scene = s.store.save(),
    history = s.store.commands.undoStack.length;
  fireEvent.click(screen.getByRole('button', { name: '清空上下文' }));
  expect(s.core.session.turn).toBe(0);
  expect(s.store.save()).toBe(scene);
  expect(s.store.commands.undoStack.length).toBe(history);
  expect(screen.queryByText('改成蓝色')).toBeNull();
});
it('model, compiled Skill and planning depth actually reach the existing planner without expanding scope', async () => {
  const s = await setup();
  await s.manager.update((v) => ({
    ...v,
    agent: { ...v.agent, nativeSkills: true },
    providers: v.providers.map((p) => ({
      ...p,
      models: [
        ...p.models,
        { id: 'fixture-2', name: 'Other', capabilities: ['text'] },
      ],
    })),
  }));
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  fireEvent.click(screen.getByRole('button', { name: '更换模型' }));
  fireEvent.change(screen.getByLabelText('助手模型'), {
    target: { value: s.manager.resolve('planning').provider.id + '/fixture-2' },
  });
  await waitFor(() =>
    expect(s.manager.resolve('planning').model).toBe('fixture-2'),
  );
  fireEvent.click(screen.getByRole('button', { name: '思考深度' }));
  fireEvent.change(screen.getByRole('combobox', { name: '思考深度' }), {
    target: { value: 'high' },
  });
  fireEvent.click(screen.getByRole('button', { name: '更换 Skill' }));
  fireEvent.change(screen.getByLabelText('Agent Skill'), {
    target: { value: 'sf.shape-creation' },
  });
  s.enqueue([{ id: 'a', type: 'createShape', shape: 'rectangle' }]);
  send('创建一个矩形');
  await waitFor(() => expect(s.core.pending).toBe(true));
  expect(s.calls.at(-1)!.model).toBe('fixture-2');
  expect(s.calls.at(-1)!.messages[0]!.content).toContain('sf.shape-creation');
  expect(s.calls.at(-1)!.messages[0]!.content).toContain('"level":"high"');
  expect(s.core.state?.budget.modelRequests).toBe(3);
  expect(s.core.state?.budget.recoveries).toBe(2);
  expect(s.store.commands.undoStack).toHaveLength(0);
});
it('upload is text-only and bounded; late file reading cannot overwrite a newer prompt or clear', async () => {
  const s = await setup();
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  const file = new File(['创建矩形'], 'task.md', { type: 'text/markdown' });
  Object.defineProperty(file, 'text', { value: async () => '创建矩形' });
  fireEvent.change(screen.getByLabelText('上传提示词文件'), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(
      (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
    ).toBe('创建矩形'),
  );
  let release!: (v: string) => void;
  const late = new File(['late'], 'late.txt');
  Object.defineProperty(late, 'text', {
    value: () =>
      new Promise<string>((r) => {
        release = r;
      }),
  });
  fireEvent.change(screen.getByLabelText('上传提示词文件'), {
    target: { files: [late] },
  });
  fireEvent.click(screen.getByRole('button', { name: '清空上下文' }));
  await act(async () => {
    release('不应出现');
    await Promise.resolve();
  });
  expect(
    (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('');
  expect(s.calls).toHaveLength(0);
});
it('interrupt stops a running request; an ignored abort and late response cannot publish', async () => {
  const s = await setup();
  let release!: () => void;
  s.queued.push(async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return {
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'a',
          name: 'submitIntent',
          arguments: validateIntent({
            goal: 'create',
            actions: [{ id: 'a', type: 'createShape', shape: 'rectangle' }],
          }),
        },
      ],
    };
  });
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  send('创建矩形');
  await waitFor(() => expect(s.calls).toHaveLength(1));
  expect(
    screen.getByRole('button', { name: '停止' }).querySelector('svg'),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '停止' }));
  await act(async () => {
    release();
    await Promise.resolve();
  });
  await waitFor(() => expect(s.core.state?.phase).toBe('CANCELLED'));
  expect(layers(s)).toHaveLength(0);
  expect(s.store.commands.undoStack).toHaveLength(0);
});
it('original native effect value failure is repaired, preceding steps retained and repair audited before one commit', async () => {
  const s = await setup();
  const bad = {
    id: 'radius',
    type: 'editNative' as const,
    tool: 'setEffectParameter' as const,
    target: result('a'),
    args: {
      effectId: { kind: 'stepResult', stepId: 'blur', output: 'effectId' },
      key: 'radius',
      value: 'wrong',
    },
  };
  s.enqueue([
    { id: 'a', type: 'createShape', shape: 'rectangle' },
    {
      id: 'blur',
      type: 'addEffect',
      target: result('a'),
      effect: 'gaussianBlur',
    },
    bad,
  ]);
  s.queued.push(async (r) => {
    expect(r.toolChoice).toBe('repairAction');
    return {
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'repair',
          name: 'repairAction',
          arguments: {
            ...bad,
            dependsOn: [],
            args: { ...bad.args, value: 24 },
          },
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
  });
  await s.core.run('创建一个矩形并添加高斯模糊，半径24');
  expect(s.core.state?.phase, JSON.stringify(s.core.state?.errors)).toBe(
    'AWAITING_ACCEPTANCE',
  );
  expect(layers(s)).toHaveLength(0);
  expect(s.core.state?.steps[0]?.attempts).toBe(1);
  expect(s.core.state?.steps[1]?.attempts).toBe(1);
  expect(s.core.state?.steps[2]?.attempts).toBe(2);
  expect(s.core.state?.recoveries).toContainEqual(
    expect.objectContaining({
      method: 'MODEL_ARGUMENTS',
      outcome: 'SUCCEEDED',
    }),
  );
  s.core.accept();
  expect(s.store.commands.undoStack).toHaveLength(1);
  expect(
    layers(s)[0]?.editor?.graph?.nodes.find((n) => n.type === 'gaussianBlur')
      ?.params.radius?.baseValue,
  ).toBe(24);
  const a = validateIntent({
    goal: 'repair',
    actions: [
      {
        ...bad,
        target: existing(layers(s)[0]!.id),
        args: { ...bad.args, effectId: crypto.randomUUID() },
      },
    ],
  }).actions[0]!;
  expect(() =>
    validateRepair(a, { ...a, args: { ...bad.args, key: 'other', value: 24 } }),
  ).toThrow();
});
it('generic invalid plan is regenerated once from feedback, with original goal and no Scene pollution', async () => {
  const s = await setup();
  s.queued.push(async () => ({
    model: 'fixture',
    text: '',
    toolCalls: [
      {
        id: 'a',
        name: 'submitIntent',
        arguments: {
          goal: 'invalid',
          actions: [{ id: 'a', type: 'createShape', shape: 'triangle' }],
        },
      },
    ],
  }));
  s.enqueue([{ id: 'a', type: 'createShape', shape: 'rectangle' }]);
  await s.core.run('创建一个矩形');
  expect(s.core.pending, JSON.stringify(s.core.state?.errors)).toBe(true);
  expect(s.calls).toHaveLength(2);
  expect(s.calls[1]?.messages[0]?.content).toContain('rejectedPlan');
  expect(layers(s)).toHaveLength(0);
});
it('transient service failure retries same route once; auth errors stop and expose safe diagnostic without provider body', async () => {
  const s = await setup();
  s.queued.push(async () => {
    throw new AIError('network', 'SECRET PROVIDER BODY');
  });
  s.enqueue([{ id: 'a', type: 'createShape', shape: 'rectangle' }]);
  await s.core.run('创建一个矩形');
  expect(s.core.pending).toBe(true);
  expect(s.core.state?.providerRetries).toBe(1);
  expect(s.calls).toHaveLength(2);
  s.core.reject();
  s.queued.push(async () => {
    throw new AIError('invalid_key', 'SECRET KEY', {
      kind: 'http',
      status: 401,
    });
  });
  await s.core.run('创建一个矩形');
  expect(s.core.state?.phase).toBe('FAILED');
  expect(s.calls).toHaveLength(3);
  expect(s.core.state?.errors.at(-1)?.message).toContain('HTTP 401');
  expect(s.core.state?.errors.at(-1)?.message).not.toContain('SECRET');
  expect(layers(s)).toHaveLength(0);
});

it('unavailable compiled Skill fails before runtime starts; it cannot wedge the composer', async () => {
  const s = await setup();
  await s.manager.update((v) => ({
    ...v,
    agent: {
      ...v.agent,
      nativeSkills: true,
      disabledNativeSkills: ['sf.shape-creation'],
    },
  }));
  s.core.skillId = 'sf.shape-creation';
  await expect(s.core.run('创建一个矩形')).rejects.toThrow('原生 Skill 不可用');
  expect(s.core.running).toBe(false);
  expect(s.calls).toHaveLength(0);
  expect(layers(s)).toHaveLength(0);
  s.core.newSession();
  expect(s.core.lastOperation).toBe('');
});
it('clearing an already empty prompt still invalidates a pending prompt-file read', async () => {
  const s = await setup();
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  let release!: (v: string) => void;
  const file = new File(['late'], 'late.md');
  Object.defineProperty(file, 'text', {
    value: () =>
      new Promise<string>((r) => {
        release = r;
      }),
  });
  fireEvent.change(screen.getByLabelText('上传提示词文件'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: '清空上下文' }));
  await act(async () => {
    release('不应出现');
    await Promise.resolve();
  });
  expect(
    (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('');
});

it('explanation without a tool plan is regenerated once on the same protocol, never treated as success', async () => {
  const s = await setup();
  s.queued.push(async () => ({
    model: 'fixture',
    text: 'I will make it.',
    toolCalls: [],
  }));
  s.enqueue([{ id: 'a', type: 'createShape', shape: 'rectangle' }]);
  await s.core.run('创建一个矩形');
  expect(s.core.pending).toBe(true);
  expect(s.calls).toHaveLength(2);
  expect(s.calls[1]?.messages[0]?.content).toContain(
    'one complete submitIntent tool call',
  );
  expect(layers(s)).toHaveLength(0);
  expect(s.core.state?.recoveries).toContainEqual(
    expect.objectContaining({ method: 'PLAN_REGENERATE', outcome: 'REPAIRED' }),
  );
  s.core.reject();
  for (let i = 0; i < 2; i++)
    s.queued.push(async () => ({
      model: 'fixture',
      text: 'Still no plan.',
      toolCalls: [],
    }));
  await s.core.run('创建一个矩形');
  expect(s.core.state?.phase).toBe('FAILED');
  expect(s.core.state?.modelRequests).toBe(2);
  expect(s.core.state?.recoveryAttempts).toBe(1);
  expect(layers(s)).toHaveLength(0);
  expect(s.store.commands.undoStack).toHaveLength(0);
});
