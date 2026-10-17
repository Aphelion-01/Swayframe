import { nativeAgentFor } from '../../src/ui/native-agent-controller';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/ui/App';
import {
  sessionFixture,
  existing,
  result,
  rgb,
} from '../../tests/helpers/agent-v2-session-fixture';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../../src/core/project-model';
import { saveProject } from '../../src/core/project-io';
import { command } from '../../src/core/command-system';
import { OutputFrameRenderer } from '../../src/renderers/output-frame';
import { defaultOutputSettings } from '../../src/core/output-settings';
import { coreExecutionTools } from '../../src/agent-v2/editor-adapter';
import '../../src/ui/design-tokens.css';
import '../../src/ui/base.css';
import '../../src/ui/editor-theme.css';
import '../../src/ui/ai/ai.css';
const qa = (window as any).sfUnselectedAgent;
const records: any[] = [],
  traces: any[] = [],
  comparison: any[] = [];
let current = 'startup';
const wait = () => new Promise((r) => setTimeout(r, 30));
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function until(f: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (f()) return;
    await wait();
  }
  throw Error('GUI wait timeout');
}
async function main() {
  await qa.call('init');
  const s = await sessionFixture(),
    store = s.store;
  (window as any).sfAssistantTestManager = s.manager;
  createRoot(document.getElementById('root')!).render(<App store={store} />);
  await until(() => !!document.querySelector('.editor-app'));
  const layers = () => activeComposition(store.commands.getSnapshot()).layers;
  const serialized = () => store.save();
  async function frame(name: string, time = 0) {
    const p = store.commands.getSnapshot(),
      c = activeComposition(p),
      r = new OutputFrameRenderer(p, c, {
        ...defaultOutputSettings(c),
        transparent: true,
      });
    try {
      await r.init();
      const canvas = await r.draw(time);
      await qa.call('pixels', name + '.png', canvas.toDataURL());
      return canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      r.dispose();
    }
  }
  const pixel = (image: ImageData, x: number, y: number) =>
    Array.from(
      image.data.slice(
        (y * image.width + x) * 4,
        (y * image.width + x) * 4 + 4,
      ),
    );
  async function roundTrip() {
    const before = serialized();
    store.undo();
    check(serialized() !== before, 'Undo no Scene delta');
    store.redo();
    check(serialized() === before, 'Redo mismatch');
    const ids = layers().map((l) => l.id);
    check(store.load(before), 'Save/reopen failed');
    check(
      JSON.stringify(ids) === JSON.stringify(layers().map((l) => l.id)) &&
        serialized() === before,
      'Reload identity mismatch',
    );
  }
  async function test(id: string, fn: () => Promise<void>) {
    current = id;
    const start = performance.now();
    const calls = s.calls.length;
    await fn();
    records.push({
      id,
      pass: true,
      durationMs: performance.now() - start,
      fixtureRequests: s.calls.length - calls,
    });
    await wait();
    await qa.call('capture', id);
  }
  async function run(goal: string, actions: any[]) {
    s.enqueue(actions);
    await s.core.run(goal);
    traces.push({
      goal,
      controlledResponseActions: actions,
      modelResponseSource: 'OFFLINE controlled provider fixture, not Live',
      request: s.calls.at(-1),
      state: s.core.state,
      scene: store.commands.getSnapshot(),
      mode: s.core.editMode,
    });
    check(
      s.core.state?.phase === 'COMPLETED',
      JSON.stringify({
        phase: s.core.state?.phase,
        error: s.core.error,
        errors: s.core.state?.errors,
      }),
    );
  }
  await test('T1-no-selection-rectangle', async () => {
    check(store.getSnapshot().selection.length === 0, 'Unexpected selection');
    (
      Array.from(document.querySelectorAll('[role=tab]')).find(
        (e) => e.textContent === '助手',
      ) as HTMLElement
    )?.click();
    await until(() => !!document.querySelector('[aria-label="V2 编辑模式"]'));
    const select = document.querySelector(
      '[aria-label="V2 编辑模式"]',
    ) as HTMLSelectElement;
    select.value = 'direct';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    check(s.core.editMode === 'direct', 'UI mode not bound to controller');
    const goal = '创建一个梯度渐变的正方形',
      actions = [
        {
          id: 'r',
          type: 'createShape',
          shape: 'rectangle',
          width: 160,
          height: 160,
          position: { x: 300, y: 300 },
        },
        {id:'gradient',type:'setFill',target:result('r'),color:rgb(1,0,0),gradient:'linear',endColor:rgb(0,0,1)},
      ];
    s.enqueue(actions as any);
    const input = document.querySelector(
      '[aria-label="V2 Agent 需求"]',
    ) as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(input, goal);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    (
      Array.from(document.querySelectorAll('button')).find(
        (e) => e.textContent === '发送',
      ) as HTMLButtonElement
    ).click();
    await until(
      () =>
        s.core.state?.phase === 'COMPLETED' || s.core.state?.phase === 'FAILED',
    );
    check(s.core.state?.phase === 'COMPLETED', 'Real send UI failed');
    check(input.value === '', 'Direct success input did not clear');
    traces.push({
      goal,
      controlledResponseActions: actions,
      modelResponseSource: 'OFFLINE controlled provider',
      request: s.calls.at(-1),
      state: s.core.state,
      scene: store.commands.getSnapshot(),
      actualUI: true,
    });
    check(
      layers().length === 1 &&
        layers()[0]!.type === 'shape' &&
        (layers()[0] as any).shapeKind === 'rectangle',
      'Wrong geometry',
    );
    check(layers()[0]!.width === layers()[0]!.height && layers()[0]!.editor?.gradient === 'linear', 'Square/gradient actual Scene incorrect');
    const image = await frame('T1-rectangle');
    check(
      pixel(image, 230, 260)[3] === 255 && pixel(image, 370, 340)[3] === 255,
      'Rectangle corners absent',
    );
    check(pixel(image, 210, 300)[3] === 0, 'Wrong rectangle bounds');
    await roundTrip();
  });
  await test('T1b-continuous-color-center-rotation', async () => {
    const id = layers()[0]!.id;
    await run('把它改成红色，移动到画布中央，给它添加两秒旋转动画。', [
      { id: 'red', type: 'setFill', target: existing(id), color: rgb(1, 0, 0), gradient:'none' },
      {
        id: 'center',
        type: 'setProperty',
        target: existing(id),
        property: 'position',
        value: { x: 960, y: 540 },
      },
      ...[0, 2].map((time) => ({
        id: 'k' + time,
        type: 'addKeyframe',
        target: existing(id),
        property: 'rotation',
        time,
        value: 180 * time,
        interpolation: { type: 'linear' },
      })),
    ]);
    check(
      layers().length === 1 && layers()[0]!.id === id,
      'Continuous edit recreated/extras',
    );
    const a = await frame('T1b-chain-0', 0),
      b = await frame('T1b-chain-quarter', 0.25);
    check(
      pixel(a, 1030, 610)[0] === 255 &&
        pixel(a, 1030, 610)[3] === 255 &&
        pixel(b, 1030, 610)[3] === 0,
      'Continuous chain renderer incorrect',
    );
    await roundTrip();
  });
  await test('unselected-implicit-effect-target',async()=>{
    store.select(null); check(store.getSnapshot().selection.length===0,'Selection was not actually empty');const id=layers()[0]!.id;
    await run('帮我添加一个模糊效果',[{id:'blur',type:'addEffect',effect:'gaussianBlur',target:existing(id)}]);
    check(layers().length===1&&layers()[0]!.editor?.graph?.nodes.some(n=>n.type==='gaussianBlur'),'Unselected effect failed');
    await frame('unselected-effect');store.undo();
  });
  await test('T2-no-selection-title', async () => {
    store.select(null); check(store.getSnapshot().selection.length===0,'Selection was not actually empty');
    await run('创建一个标题，内容为 Swayframe', [
      {
        id: 't',
        type: 'createText',
        content: 'Swayframe',
        name: 'Hero',
        fontSize: 64,
        position: { x: 960, y: 200 },
      },
    ]);
    check(
      layers().filter((l) => l.type === 'text' && l.text === 'Swayframe')
        .length === 1,
      'Actual text absent',
    );
    await frame('T2-title');
  });
  const title = () => layers().find((l) => l.type === 'text')!;
  await test('T3-unselected-unique-title-red', async () => {
    store.select(null); check(store.getSnapshot().selection.length===0,'Selection was not actually empty');
    await run('把标题改成红色', [
      {
        id: 'f',
        type: 'setFill',
        target: existing(title().id),
        color: rgb(1, 0, 0),
      },
    ]);
    check(
      JSON.stringify(title().editor?.properties.fill?.baseValue) ===
        '[1,0,0,1]',
      'Title not red',
    );
    const image = await frame('T3-title-red');
    check(
      image.data.some(
        (v, i) =>
          i % 4 === 0 &&
          v > 240 &&
          image.data[i + 1]! < 10 &&
          image.data[i + 2]! < 10 &&
          image.data[i + 3]! > 240,
      ),
      'No red text pixels',
    );
  });
  await test('T4-three-RGB-rectangles', async () => {
    const before = layers().length;
    await run(
      '创建三个矩形，分别为红色、绿色、蓝色，横向排列。',
      [0, 1, 2].flatMap((i) => [
        {
          id: 'r' + i,
          type: 'createShape',
          shape: 'rectangle',
          width: 160,
          height: 100,
          position: { x: 400 + i * 560, y: 700 },
        },
        {
          id: 'f' + i,
          type: 'setFill',
          target: result('r' + i),
          color: rgb(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0),
        },
      ]),
    );
    check(layers().length === before + 3, 'Extra objects');
    const im = await frame('T4-RGB');
    for (let i = 0; i < 3; i++) {
      const px = pixel(im, 400 + i * 560, 700);
      check(px[i] === 255 && px[3] === 255, 'Wrong RGB center ' + i);
    }
  });
  const middle = s.core.session.recentlyCreated[1]!;
  await test('T5-recent-middle-rotation', async () => {
    await run(
      '让刚才创建的中间矩形在两秒内旋转一圈。',
      [0, 2].map((time) => ({
        id: 'k' + time,
        type: 'addKeyframe',
        target: existing(middle),
        property: 'rotation',
        time,
        value: time * 180,
        interpolation: { type: 'linear' },
      })),
    );
    check(
      layers().find((l) => l.id === middle)!.transform.rotation.keyframes
        .length === 2,
      'No rotation keyframes',
    );
    const a = await frame('T5-rotation-0', 0),
      b = await frame('T5-rotation-quarter', 0.5);
    check(
      pixel(a, 1030, 700)[3] === 255 && pixel(b, 1030, 700)[3] === 0,
      'Animation pixels unchanged',
    );
  });
  await test('T6-title-native-blur', async () => {
    await run('给标题添加一个模糊效果。', [
      {
        id: 'blur',
        type: 'addEffect',
        effect: 'gaussianBlur',
        target: existing(title().id),
      },
      {
        id: 'radius',
        type: 'editNative',
        tool: 'setEffectParameter',
        target: existing(title().id),
        args: {
          effectId: { kind: 'stepResult', stepId: 'blur', output: 'effectId' },
          key: 'radius',
          value: 12,
        },
      },
    ]);
    check(
      title().editor?.graph?.nodes.some(
        (n) => n.type === 'gaussianBlur' && n.params.radius?.baseValue === 12,
      ),
      'Native effect missing',
    );
    await frame('T6-blur');
  });
  await test('T7-native-Undo-request', async () => {
    const calls = s.calls.length,
      history = store.commands.undoStack.length;
    await s.core.run('把刚才的修改撤销。');
    check(
      s.calls.length === calls &&
        store.commands.undoStack.length === history - 1,
      'Undo used model or wrong transaction',
    );
    check(
      !title().editor?.graph?.nodes.some((n) => n.type === 'gaussianBlur'),
      'Undo did not remove blur',
    );
    store.redo();
    check(
      title().editor?.graph?.nodes.some((n) => n.type === 'gaussianBlur'),
      'Redo missing',
    );
    store.undo();
    await frame('T7-undo');
  });
  await test('T8-GUI-current-state', async () => {
    const l = layers().find((l) => l.id === middle)!;
    store.select(l.id);
    await until(() => !!document.querySelector('input[aria-label="位置 X"]'));
    (
      document.querySelector('[aria-label="解除位置 X/Y 链接"]') as HTMLElement
    )?.click();
    await wait();
    for (const [axis, value] of [
      ['X', 500],
      ['Y', 400],
    ]) {
      const input = document.querySelector(
        'input[aria-label="位置 ' + axis + '"]',
      ) as HTMLInputElement;
      input.focus();
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      await wait();
    }
    check(
      JSON.stringify(
        layers().find((n) => n.id === l.id)!.transform.position.baseValue,
      ) === '{"x":500,"y":400}',
      'GUI Inspector did not commit actual position',
    );
    await run('把这个矩形放到画布中央。', [
      {
        id: 'center',
        type: 'setProperty',
        target: existing(l.id),
        property: 'position',
        value: { x: 960, y: 540 },
      },
    ]);
    const ctx = JSON.parse(
      s.calls.at(-1)!.messages[0]!.content.split('\n').at(-1)!,
    ).context.session;
    check(
      JSON.stringify(
        ctx.reads.relevantScene[0].properties.find(
          (p: any) => p.path === 'transform.position',
        ).value,
      ) === '{"x":500,"y":400}',
      'Stale GUI coordinates',
    );
    await frame('T8-center');
  });
  await test('T9-late-response-project-switch', async () => {
    let release: any,
      entered = false;
    s.queued.push(async () => {
      entered = true;
      return new Promise((r) => (release = r));
    });
    const p = s.core.run('创建一个矩形');
    await until(() => entered);
    check(
      store.load(saveProject(createDefaultProject())),
      'Project switch failed',
    );
    const before = serialized(),
      history = store.commands.undoStack.length;
    release({
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'late',
          name: 'submitIntent',
          arguments: {
            goal: 'late',
            actions: [{ id: 'r', type: 'createShape', shape: 'rectangle' }],
          },
        },
      ],
    });
    await p;
    check(
      serialized() === before &&
        store.commands.undoStack.length === history &&
        s.core.state?.phase === 'CANCELLED',
      'Stale response pollution',
    );
  });
  await test('T10-exclusive-Cubic', async () => {
    await run('只创建一个文字图层，内容为 Cubic，不要添加其他对象。', [
      { id: 'text', type: 'createText', content: 'Cubic', fontSize: 80 },
    ]);
    check(
      layers().length === 1 &&
        layers()[0]!.type === 'text' &&
        (layers()[0] as any).text === 'Cubic',
      'Cubic extra/missing objects',
    );
    await frame('T10-Cubic');
    await roundTrip();
  });
  await test('review-native-star-mask', async () => {
    s.enqueue([
      {
        id: 'star',
        type: 'createNative',
        tool: 'createStar',
        args: { name: 'Star', position: { x: 500, y: 500 } },
      },
      {
        id: 'mask',
        type: 'editNative',
        tool: 'createMask',
        target: result('star'),
        args: { kind: 'ellipse' },
      },
    ]);
    const before = serialized();
    await s.core.run('创建一个星形，并加椭圆遮罩');
    check(
      s.core.pending && before === serialized() && !!s.core.reviewReason,
      'Unsafe auto-commit',
    );
    s.core.accept();
    check(
      layers().some(
        (l) =>
          l.type === 'shape' &&
          l.shapeKind === 'star' &&
          l.editor?.masks.length === 1,
      ),
      'Native mask absent',
    );
    await frame('native-star-mask');
    await roundTrip();
  });
  await test('remove-effect-forced-review', async () => {
    const l = layers().find((l) => l.type === 'text')!;
    await run('给标题添加模糊', [
      {
        id: 'blur',
        type: 'addEffect',
        target: existing(l.id),
        effect: 'gaussianBlur',
      },
    ]);
    const effectId = layers()
      .find((n) => n.id === l.id)!
      .editor!.graph!.nodes.find((n) => n.type === 'gaussianBlur')!.id;
    const before = serialized();
    s.enqueue([
      {
        id: 'remove',
        type: 'editNative',
        tool: 'removeEffect',
        target: existing(l.id),
        args: { effectId },
      },
    ]);
    await s.core.run('移除标题的模糊效果');
    check(
      s.core.pending && serialized() === before && !!s.core.reviewReason,
      'Destructive removal bypassed review',
    );
    s.core.accept();
    check(
      !layers()
        .find((n) => n.id === l.id)!
        .editor!.graph!.nodes.some((n) => n.id === effectId),
      'Removal failed',
    );
    store.undo();
    check(serialized() === before, 'Removal Undo failed');
    await frame('effect-removal-undo');
  });
  await test('failure-partial-draft-isolation', async () => {
    const before = serialized(),
      history = store.commands.undoStack.length;
    s.enqueue([
      { id: 'r', type: 'createShape', shape: 'rectangle' },
      {
        id: 'bad',
        type: 'setProperty',
        target: result('r'),
        property: 'opacity',
        value: 2,
      },
    ]);
    await s.core.run('创建一个矩形，不透明度设为2');
    check(
      s.core.state?.phase === 'FAILED' &&
        serialized() === before &&
        store.commands.undoStack.length === history,
      'Partial Scene published',
    );
    traces.push({ failure: s.core.state });
  });
  await test('existing-image-asset-native-tools', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 4;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,0,255,0.7)';
    ctx.fillRect(1, 1, 2, 2);
    const asset = {
      id: crypto.randomUUID(),
      name: 'QA transparent image.png',
      mimeType: 'image/png',
      dataUrl: canvas.toDataURL(),
    };
    store.run('GUI add existing native asset', [
      command({ type: 'asset.add', asset }),
    ]);
    const before = serialized();
    s.enqueue([
      {
        id: 'image',
        type: 'createNative',
        tool: 'createLayer',
        args: {
          kind: 'image',
          assetId: asset.id,
          width: 128,
          height: 128,
          position: { x: 1200, y: 400 },
        },
      },
    ]);
    await s.core.run('创建一个图片图层，使用已有素材');
    check(
      s.core.pending && serialized() === before,
      'Image import did not review',
    );
    s.core.accept();
    const l = layers().find((l) => l.type === 'image')!;
    check((l as any).assetId === asset.id, 'Wrong native asset');
    await run('修改这个图片图层的透明度', [
      {
        id: 'alpha',
        type: 'setProperty',
        target: existing(l.id),
        property: 'opacity',
        value: 0.5,
      },
    ]);
    const im = await frame('existing-image-alpha');
    const px = pixel(im, 1200, 400);
    check(
      px[0] > 245 && px[2] > 245 && Math.abs(px[3] - 89) <= 2,
      'Native PNG alpha mismatch ' + JSON.stringify(px),
    );
    await roundTrip();
    check(
      store.commands
        .getSnapshot()
        .assets.some((a) => a.id === asset.id && a.dataUrl === asset.dataUrl),
      'Asset lost after reload',
    );
  });
  await test('fair-native-controllers-6-runs', async () => {
    const base = createDefaultProject(),
      c = activeComposition(base),
      target = createLayer('rectangle', {
        name: 'Target',
        position: { x: 500, y: 300 },
      });
    (c.layers as any[]).push(target);
    const initial = saveProject(base);
    for (const task of ['fill', 'scale', 'rotation'] as const) {
      const images: string[] = [];
      for (const engine of ['legacy-v1', 'core-v2'] as const) {
        check(store.load(initial), 'Initial scene restore');
        s.core.select(engine);
        const start = performance.now(),
          calls = s.calls.length;
        const tool =
            task === 'fill'
              ? 'setFill'
              : task === 'scale'
                ? 'setScale'
                : 'setRotation',
          args =
            task === 'fill'
              ? { color: rgb(1, 0, 0) }
              : { value: task === 'scale' ? { x: 1.5, y: 1.5 } : 45 };
        let intervention = 0;
        if (engine === 'core-v2') {
          s.core.setEditMode('direct');
          await run('修改 Target ' + task, [
            task === 'fill'
              ? {
                  id: 'edit',
                  type: 'setFill',
                  target: existing(target.id),
                  color: rgb(1, 0, 0),
                }
              : {
                  id: 'edit',
                  type: 'setProperty',
                  target: existing(target.id),
                  property: task,
                  value: (args as any).value,
                },
          ]);
        } else {
          s.queued.push(async () => ({
            model: 'fixture',
            text: '',
            toolCalls: [
              {
                id: 'v1',
                name: 'submitPlan',
                arguments: {
                  id: 'matched',
                  goal: '修改 Target ' + task,
                  risk: 'low',
                  steps: [
                    {
                      id: 'edit',
                      label: 'Offline edit',
                      tool,
                      arguments: { layerId: target.id, ...args },
                    },
                  ],
                },
              },
            ],
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          }));
          await s.native.agent.run('修改 Target ' + task);
          let st = s.native.agent.getSnapshot();
          if (st.pendingConfirmation && st.currentPlan) {
            await s.native.agent.preview(st.currentPlan.id);
            st = s.native.agent.getSnapshot();
            if (st.pendingConfirmation && st.currentPlan) {
              intervention++;
              await s.native.agent.apply(st.currentPlan.id);
            }
          }
          check(
            s.native.agent.getSnapshot().status === 'completed',
            JSON.stringify(s.native.agent.getSnapshot().error),
          );
        }
        const after = serialized(),
          im = await frame('fair-' + task + '-' + engine);
        images.push(JSON.stringify(Array.from(im.data)));
        store.undo();
        check(serialized() === initial, 'Fair Undo mismatch');
        store.redo();
        check(serialized() === after, 'Fair Redo mismatch');
        check(store.load(after) && serialized() === after, 'Fair reload');
        comparison.push({
          task,
          engine,
          pass: true,
          intervention,
          durationMs: performance.now() - start,
          fixtureRequests: s.calls.length - calls,
          initialScene: base,
          controlledResponse: {
            tool,
            arguments: { layerId: target.id, ...args },
          },
          requestSettings: {
            provider: 'OFFLINE FIXTURE',
            model: 'fixture',
            maxOutputTokens: s.calls.at(-1)?.maxOutputTokens ?? null,
            responseMode: s.calls.at(-1)?.responseMode ?? null,
          },
          syntheticUsage: 150,
          realModelTokens: null,
          scene: store.commands.getSnapshot(),
          tools:
            engine === 'core-v2'
              ? [...new Set(coreExecutionTools)]
              : s.native.registry.catalog(),
        });
      }
      check(images[0] === images[1], 'V1/V2 renderer mismatch ' + task);
    }
  });
  s.core.select('core-v2');
  (
    Array.from(document.querySelectorAll('[role=tab]')).find(
      (e) => e.textContent === '助手',
    ) as HTMLElement
  )?.click();
  await until(
    () =>
      !!document.querySelector('.agent-v2-editor') &&
      (document.querySelector('.agent-v2-editor') as HTMLElement).offsetWidth >
        0,
  );
  const click = (label: string) => {
    const button = document.querySelector('button[aria-label="' + label + '"]') as HTMLButtonElement;
    check(button && !button.disabled, 'Missing or disabled UI button: ' + label); button.click();
  };
  const inputPrompt = async (text: string) => {
    const input = document.querySelector('textarea[aria-label="V2 Agent 需求"]') as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true })); await wait();
  };
  await test('chat-explicit-layer-reference-and-clear', async () => {
    s.core.setEditMode('direct');
    const layer = layers()[0]!; store.select(layer.id); await wait();
    const chip = document.querySelector('.assistant-composer [data-layer-id]') as HTMLElement;
    check(chip?.dataset.layerId === layer.id && chip.textContent?.includes(layer.name), 'Selected layer missing from prompt');
    s.enqueue([{id:'move',type:'setProperty',target:existing(layer.id),property:'position',value:{x:640,y:420}}]);
    await inputPrompt('移动到640、420'); click('发送');
    await until(() => s.core.state?.phase === 'COMPLETED');
    check(layers()[0]!.transform.position.baseValue.x === 640, 'Referenced object not edited');
    check(document.querySelector('.chat-message-user')?.textContent?.includes(layer.name), 'Chat has no selected-object message');
    check(!(document.querySelector('.agent-plan') as HTMLDetailsElement).open, 'Steps not collapsed');
    await frame('chat-edited-render'); await qa.call('capture', 'chat-message-reference');
    const saved = store.save(), history = store.commands.undoStack.length;
    click('清空上下文'); await wait();
    check(store.save() === saved && store.commands.undoStack.length === history && s.core.session.turn === 0, 'Clear mutated project/history');
    check(!document.querySelector('.chat-message-user'), 'Clear left old messages');
  });
  await test('chat-skill-depth-model-and-file', async () => {
    await s.manager.update(v => ({...v, agent:{...v.agent,nativeSkills:true}})); await wait();
    click('更换 Skill'); await wait();
    const skill = document.querySelector('select[aria-label="Agent Skill"]') as HTMLSelectElement;
    skill.value = 'sf.shape-creation'; skill.dispatchEvent(new Event('change',{bubbles:true})); await wait();
    check(s.core.skillId === 'sf.shape-creation', 'Skill change not bound');
    click('思考深度'); await wait();
    const depth = document.querySelector('select[aria-label="思考深度"]') as HTMLSelectElement;
    depth.value = 'high'; depth.dispatchEvent(new Event('change',{bubbles:true})); await wait();
    check(s.manager.assistantEffort === 'high', 'Depth not bound');
    click('更换模型'); await wait();
    const model = document.querySelector('select[aria-label="助手模型"]') as HTMLSelectElement;
    check(model.options.length > 1 && model.value.includes('fixture'), 'Model menu unavailable');
    await qa.call('capture', 'chat-model-popover');
    click('更换模型'); await wait();
    const file = new File(['将它向右移动20像素'],'prompt.md',{type:'text/markdown'}), data = new DataTransfer(); data.items.add(file);
    const upload = document.querySelector('input[aria-label="上传提示词文件"]') as HTMLInputElement;
    upload.files = data.files; upload.dispatchEvent(new Event('change',{bubbles:true})); await wait();
    check((document.querySelector('textarea[aria-label="V2 Agent 需求"]') as HTMLTextAreaElement).value === '将它向右移动20像素', 'Real prompt file import failed');
    click('清空上下文'); await wait();
  });
  await test('chat-stop-late-provider-no-commit', async () => {
    let release!:()=>void;
    s.queued.push(async()=> {await new Promise<void>(r=>{release=r}); return {model:'fixture',text:'',toolCalls:[{id:'late',name:'submitIntent',arguments:{goal:'late',actions:[{id:'a',type:'createShape',shape:'rectangle'}]}}]};});
    const saved=store.save(), history=store.commands.undoStack.length;
    await inputPrompt('创建一个矩形'); click('发送'); await until(()=>!!release); await wait();
    check(!!document.querySelector('.chat-progress.is-running'), 'Missing animated execution feedback');
    await qa.call('capture','chat-working'); click('停止'); release(); await until(()=>s.core.state?.phase==='CANCELLED');
    check(store.save()===saved && store.commands.undoStack.length===history,'Late result wrote project');
  });
  await test('chat-native-parameter-self-repair', async () => {
    click('清空上下文'); store.select(null); await wait();
    const bad={id:'radius',type:'editNative',tool:'setEffectParameter',target:result('r'),args:{effectId:{kind:'stepResult',stepId:'blur',output:'effectId'},key:'radius',value:'wrong'}};
    s.enqueue([{id:'r',type:'createShape',shape:'rectangle',name:'恢复样例',position:{x:800,y:500}}, {id:'blur',type:'addEffect',effect:'gaussianBlur',target:result('r')},bad] as any);
    s.queued.push(async()=>({model:'fixture',text:'',toolCalls:[{id:'repair',name:'repairAction',arguments:{...bad,dependsOn:[],args:{...bad.args,value:18}}}],usage:{inputTokens:100,outputTokens:50,totalTokens:150}}));
    const history=store.commands.undoStack.length;
    await inputPrompt('创建一个矩形并添加高斯模糊，半径18'); click('发送');
    await until(()=>s.core.state?.phase==='COMPLETED'||s.core.state?.phase==='FAILED');
    check(s.core.state?.phase==='COMPLETED', JSON.stringify(s.core.state?.errors));
    check(s.core.state?.steps[0]?.attempts===1&&s.core.state.steps[1]?.attempts===1&&s.core.state.steps[2]?.attempts===2,'Completed actions replayed');
    check(store.commands.undoStack.length===history+1,'Recovery not one native transaction');
    check(s.core.state?.recoveries.some(r=>r.method==='MODEL_ARGUMENTS'&&r.outcome==='SUCCEEDED'),'Missing audit trail');
    await frame('chat-recovery-render'); await qa.call('capture','chat-recovered');
    store.undo();store.redo();const saved=store.save();check(store.load(saved), 'Native project load failed');check(store.save()===saved,'Recovery result not serializable');
  });
  await test('chat-missing-plan-feedback-regeneration', async()=>{
    click('清空上下文');store.select(null);await wait();
    const before=layers().length;
    s.queued.push(async()=>({model:'fixture',text:'I will create it.',toolCalls:[],usage:{inputTokens:100,outputTokens:50,totalTokens:150}}));
    s.enqueue([{id:'r',type:'createShape',shape:'rectangle',name:'计划修复'}]);
    await inputPrompt('创建一个矩形');click('发送');await until(()=>s.core.state?.phase==='COMPLETED'||s.core.state?.phase==='FAILED');
    check(s.core.state?.phase==='COMPLETED',JSON.stringify(s.core.state?.errors));
    check(layers().length===before+1&&s.core.state?.modelRequests===2,'Regeneration duplicated or skipped action');
    check(s.core.state?.recoveries.some(r=>r.method==='PLAN_REGENERATE'&&r.outcome==='REPAIRED'),'Missing regeneration audit');
    await qa.call('capture','chat-plan-regenerated');
  });
  // Leave a genuine chat turn and selected-layer token visible for viewport review.
  click('清空上下文'); store.select(layers()[0]!.id); await wait();
  s.enqueue([{id:'move',type:'setProperty',target:existing(layers()[0]!.id),property:'position',value:{x:640,y:420}}]);
  await inputPrompt('将选中对象移动到640、420'); click('发送'); await until(()=>s.core.state?.phase==='COMPLETED');
  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await qa.call('viewport', width, height);
    await wait();
    check(
      window.innerWidth === width && window.innerHeight === height,
      'Viewport did not match requested dimensions',
    );
    await qa.call('capture', 'UI-' + width + 'x' + height);
    const panel=document.querySelector('.agent-v2-editor') as HTMLElement, composer=document.querySelector('.assistant-composer') as HTMLElement, text=composer.querySelector('textarea')!;
    const p=panel.getBoundingClientRect(),b=composer.getBoundingClientRect();
    check(p.width>0&&b.top>=p.top&&b.bottom<=p.bottom+1, 'Composer clipped or outside assistant');
    check(composer.scrollWidth<=composer.clientWidth+1,'Composer has horizontal overflow');
    check(getComputedStyle(text).borderTopWidth==='0px','Nested textarea border');
    check(getComputedStyle(panel.querySelector('.chat-transcript')!).overflowY==='auto','Transcript not independently scrollable');
  }
  await test('chat-V1-ui-keeps-native-edit-and-default-choice', async()=>{
    const legacyAgent = nativeAgentFor(store);
    s.core.select('legacy-v1');await wait();
    const layer=layers()[0]!;store.select(layer.id);await wait();
    check(!!document.querySelector('textarea[aria-label="Agent 需求"]'),'V1 composer missing');
    check(document.querySelector('.assistant-composer [data-layer-id]')?.getAttribute('data-layer-id')===layer.id,'V1 selection label missing');
    s.queued.push(async()=>({model:'fixture',text:'',toolCalls:[{id:'v1',name:'submitPlan',arguments:{id:'chat-v1',goal:'修改选中对象',risk:'low',steps:[{id:'edit',label:'调整透明度',tool:'setOpacity',arguments:{layerId:layer.id,value:0.6}}]}}],usage:{inputTokens:100,outputTokens:50,totalTokens:150}}));
    const input=document.querySelector('textarea[aria-label="Agent 需求"]') as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'把选中的对象透明度改为60%');input.dispatchEvent(new Event('input',{bubbles:true}));await wait();click('发送');
    await until(()=>legacyAgent.getSnapshot().pendingConfirmation||legacyAgent.getSnapshot().status==='failed');
    const find=(name:string)=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===name) as HTMLButtonElement;
    await wait();
    const confirm=find('确认并执行计划'), preview=find('预览修改方案');
    check(!!(confirm||preview),'V1 plan review action absent: '+Array.from(document.querySelectorAll('button')).filter(b=>b.offsetWidth>0).map(b=>b.textContent).join('|'));
    if(confirm) confirm.click(); else { preview.click(); await until(()=>!!legacyAgent.getSnapshot().creationProposal); await wait(); const accept=find('接受修改');check(!!accept,'V1 accept absent');accept.click(); }
    await until(()=>legacyAgent.getSnapshot().status==='completed'||legacyAgent.getSnapshot().status==='failed');
    check(legacyAgent.getSnapshot().status==='completed',JSON.stringify(legacyAgent.getSnapshot().error));
    check(layers()[0]!.transform.opacity.baseValue===0.6,'V1 UI edit not applied');
    await frame('chat-V1-render');await qa.call('capture','chat-V1-completed');
    const saved=store.save(),history=store.commands.undoStack.length;click('清空上下文');await wait();
    check(store.save()===saved&&store.commands.undoStack.length===history&&!legacyAgent.getSnapshot().conversation.length,'V1 clear changed Scene/history');
    check(!legacyAgent.getSnapshot().visualReviews && !legacyAgent.getSnapshot().verification && !legacyAgent.getSnapshot().trace, 'V1 clear retained old diagnostics');
    await qa.call('capture','chat-V1-empty');
  });
  await qa.call('done', {
    pass: true,
    scope:
      'OFFLINE controlled provider responses; actual Electron App, controller, native registries, transaction, CommandSystem, real Renderer. No Live model claim.',
    records,
    traces,
    comparison,
    fixtureRequests: s.calls.length,
    renderer: 'OutputFrameRenderer, real Canvas2D',
    inputFixtureSyntheticTokens: true,
  });
}
void main().catch((e) =>
  qa.call('done', {
    pass: false,
    current,
    error: String(e),stack:e instanceof Error?e.stack:null,
    records,
    traces,
    comparison,
  }),
);
