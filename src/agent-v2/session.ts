import {
  activeComposition,
  type Layer,
  type Project,
} from '../core/project-model';
import { contentHash } from '../core/content-hash';
import type { TaskState } from './runtime';
import { problem } from './errors';

export interface CommittedReference {
  id: string;
  projectId: string;
  compositionId: string;
  type: Layer['type'];
  shapeKind?: string;
  role?: 'title' | 'subtitle';
  turnId: string;
  transactionId: string;
}
/** Conversation metadata only. Properties and existence are always read from the current Scene. */
export class ConversationSession {
  readonly id = crypto.randomUUID();
  turn = 0;
  references: CommittedReference[] = [];
  recentlyCreated: string[] = [];
  recentlyModified: string[] = [];
  recentGUI: string[] = [];
  lastAccepted: {
    taskId: string;
    turnId: string;
    transactionId: string;
    animation: {
      layerId: string;
      property: 'position' | 'scale' | 'rotation' | 'opacity';
      keyframeId: string;
    }[];
  } | null = null;
  private previous: Project;
  constructor(project: Project) {
    this.previous = project;
  }
  observe(project: Project, humanChange: boolean) {
    if (project.id !== this.previous.id) {
      this.references = [];
      this.recentlyCreated = [];
      this.recentlyModified = [];
      this.recentGUI = [];
      this.lastAccepted = null;
    } else if (
      project.activeCompositionId !== this.previous.activeCompositionId
    ) {
      this.recentGUI = [];
    } else if (project !== this.previous && humanChange) {
      const old = activeComposition(this.previous);
      this.recentGUI = activeComposition(project)
        .layers.filter((l) => {
          const before = old.layers.find((p) => p.id === l.id);
          return before && contentHash(before) !== contentHash(l);
        })
        .map((l) => l.id);
    }
    this.previous = project;
  }
  accept(
    state: TaskState,
    project: Project,
    userRequest: string,
    turnId: string,
  ) {
    if (state.phase !== 'COMPLETED' || !state.changes?.transactionId)
      throw problem('VERIFICATION_FAILURE', '未提交任务不能更新会话引用');
    const c = activeComposition(project);
    this.recentlyCreated = state.steps
      .filter((s) =>
        ['createShape', 'createText', 'createNative'].includes(s.action.type),
      )
      .flatMap((s) => (s.result?.layerId ? [s.result.layerId] : []));
    this.recentlyModified = [...new Set(state.targets)];
    for (const id of this.recentlyCreated) {
      const l = c.layers.find((l) => l.id === id);
      if (!l) throw problem('INVALID_REFERENCE', '提交后的对象不存在');
      this.references.push({
        id,
        projectId: project.id,
        compositionId: c.id,
        type: l.type,
        ...(l.type === 'shape' ? { shapeKind: l.shapeKind } : {}),
        ...(l.type === 'text' && /标题|title/i.test(userRequest)
          ? {
              role: /副标题|subtitle/i.test(userRequest)
                ? ('subtitle' as const)
                : ('title' as const),
            }
          : {}),
        turnId,
        transactionId: state.changes.transactionId,
      });
    }
    // Keep the earliest identity order stable; never silently renumber old ordinals.
    // Beyond the bounded index users must explicitly select the current Scene object.
    this.references = this.references.slice(0, 100);
    this.lastAccepted = {
      taskId: state.id,
      turnId,
      transactionId: state.changes.transactionId,
      animation: state.steps.flatMap((s) =>
        s.action.type === 'addKeyframe' && s.result?.keyframeId
          ? [
              {
                layerId:
                  s.action.target.kind === 'existing'
                    ? s.action.target.id
                    : s.action.target.kind === 'result'
                      ? (state.references[s.action.target.actionId]?.layerId ??
                        '')
                      : (state.targets[0] ?? ''),
                property: s.action.property,
                keyframeId: s.result.keyframeId,
              },
            ]
          : [],
      ),
    };
    this.recentGUI = [];
    this.previous = project;
  }
  validate(id: string, project: Project, selection: readonly string[] = []) {
    const c = activeComposition(project),
      ref = this.references.find((r) => r.id === id);
    if (ref && (ref.projectId !== project.id || ref.compositionId !== c.id))
      throw problem('INVALID_REFERENCE', '目标属于其他工程或合成，请重新指定');
    const l = c.layers.find((l) => l.id === id);
    if (
      !l &&
      project.compositions.some(
        (other) => other.id !== c.id && other.layers.some((l) => l.id === id),
      )
    )
      throw problem('INVALID_REFERENCE', '目标属于其他合成，请重新指定');
    if (!l)
      throw problem(
        'INVALID_REFERENCE',
        '目标已删除或已被撤销，请重新选择；不会自动重建',
      );
    if (
      ref &&
      (ref.type !== l.type ||
        (ref.shapeKind &&
          (l.type !== 'shape' || ref.shapeKind !== l.shapeKind)))
    )
      throw problem('INVALID_REFERENCE', '对象类型已变化，请重新指定');
    if (l.locked)
      throw problem('PERMISSION_DENIED', '目标图层已锁定，请先解锁');
    void selection;
    return l;
  }
  resolveRequest(
    request: string,
    project: Project,
    selection: readonly string[],
    boundIds?: readonly string[],
  ) {
    const c = activeComposition(project),
      // Creation is authorized by the user's operation, never by Selection or a short noun allowlist.
      // Effects/keyframes modify an owner; do not mistake their "add" verb for layer creation.
      create = request.split(/[，,。；;\n！？!?]/).some((clause) => {
        const verb =
          /创建|新建|绘制|画出|制作|生成|设计|做一个|做一张|做一组|画一个|画一张|\b(?:create|draw|make|generate|design|build|add)\b|添加|增加/i.exec(
            clause,
          );
        if (!verb) return false;
        const prefix = clause.slice(0, verb.index);
        if (
          /(?:刚才|刚刚|之前|已经|上次|上轮|上一轮|先前)\s*(?:新)?\s*$/i.test(
            prefix,
          )
        )
          return false;
        if (
          /(?:不要|不必|无需|禁止|不允许|不能|不|别|不再|do not|don't|never)\s*(?:再|自动)?\s*$/i.test(
            prefix,
          )
        )
          return false;
        const object = clause.slice(verb.index + verb[0].length);
        const ownerOperation =
          /效果|模糊|关键帧|动画|遮罩|描边|effect|blur|keyframe|animation|mask|stroke/i.exec(
            object,
          );
        const layerObject =
          /正方形|矩形|圆形|椭圆|多边形|星形|路径|图形|文字|文本|标题|背景|图片|图层|对象|海报|合成|square|rectangle|circle|ellipse|polygon|star|path|shape|text|title|background|image|layer|object|poster|composition/i.exec(
            object,
          );
        return !ownerOperation || !!layerObject;
      }),
      matches = (l: Layer | CommittedReference) => {
        const shape = /正方形|矩形|square|rectangle/i.test(request)
          ? 'rectangle'
          : /圆形|椭圆|circle|ellipse/i.test(request)
            ? 'ellipse'
            : /多边形|polygon/i.test(request)
              ? 'polygon'
              : /星形|星型|star/i.test(request)
                ? 'star'
                : /路径|path/i.test(request)
                  ? 'path'
                  : null;
        if (shape) return l.type === 'shape' && l.shapeKind === shape;
        const type = /文字|文本|标题|text|title/i.test(request)
          ? 'text'
          : /图片|image/i.test(request)
            ? 'image'
            : /纯色|背景|solid/i.test(request)
              ? 'solid'
              : /空对象|\bnull\b/i.test(request)
                ? 'null'
                : /摄像机|camera/i.test(request)
                  ? 'camera'
                  : /模型|model/i.test(request)
                    ? 'model'
                    : /音频|audio/i.test(request)
                      ? 'audio'
                      : /视频|video/i.test(request)
                        ? 'video'
                        : null;
        return !type || l.type === type;
      };
    let ids: string[] = [];
    const ordinal = request.match(
        /第\s*([一二三四五六七八九十百千零两]+|\d+)\s*(?:个|层)?/,
      ),
      numbers = '一二三四五六七八九十';
    if (
      [
        ...request.matchAll(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ),
      ].length > 1
    )
      throw problem(
        'INVALID_REFERENCE',
        '本轮有多个明确身份，请分别指定操作或使用明确选区',
      );
    const explicitId = request.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    )?.[0];
    const named =
      !create && !ordinal
        ? c.layers.filter(
            (l) =>
              l.name.length > 0 &&
              ![
                '矩形',
                '椭圆',
                '文字',
                '标题',
                '图层',
                '对象',
                '图片',
                '背景',
                '星形',
                '路径',
                '多边形',
              ].includes(l.name) &&
              request.includes(l.name),
          )
        : [];
    if (boundIds?.length) {
      if (boundIds.length > 20 || new Set(boundIds).size !== boundIds.length)
        throw problem('INVALID_REFERENCE', '图层引用无效，请重新选择');
      boundIds.forEach((id) => this.validate(id, project));
      return { ids: [...boundIds], allowCreate: create };
    }
    if (explicitId) ids = [explicitId];
    else if (named.length) ids = named.map((l) => l.id);
    else if (ordinal) {
      const number = Number(ordinal[1]) || numbers.indexOf(ordinal[1]!) + 1,
        refs = this.references.filter(
          (r) =>
            r.projectId === project.id &&
            r.compositionId === c.id &&
            matches(r),
        ),
        candidates = refs.length ? refs : c.layers.filter(matches);
      if (!number)
        throw problem(
          'INVALID_REFERENCE',
          '该中文序号暂不支持，请使用数字序号或直接选择图层',
        );
      const target = candidates[number - 1];
      if (!target)
        throw problem('INVALID_REFERENCE', '指定序号的对象不存在，请选择目标');
      ids = [target.id];
    } else if (/选中|选区|selected/i.test(request)) ids = [...selection];
    else if (/刚才.*(?:移动|手动)|刚移动|GUI/i.test(request))
      ids = [...this.recentGUI];
    else if (/刚才|刚刚|上一轮|这个|它|recent|last/i.test(request)) {
      const source = /创建|添加/.test(request)
        ? this.recentlyCreated
        : this.recentGUI.length
          ? this.recentGUI
          : this.recentlyModified.length
            ? this.recentlyModified
            : this.recentlyCreated;
      ids = source.filter((id) => {
        const ref = this.references.find((r) => r.id === id),
          layer = c.layers.find((l) => l.id === id);
        return !!(ref ?? layer) && matches((ref ?? layer)!);
      });
    } else if (
      !create &&
      /正方形|矩形|圆形|椭圆|多边形|星形|星型|路径|文字|文本|标题|图片|背景|纯色|空对象|摄像机|模型|音频|视频|图层|对象|square|rectangle|circle|ellipse|polygon|star|path|image|solid|camera|model|audio|video|text|title|layer/i.test(
        request,
      )
    ) {
      const role = /副标题/.test(request)
          ? 'subtitle'
          : /标题/.test(request)
            ? 'title'
            : null,
        roles = role
          ? this.references.filter(
              (r) =>
                r.role === role &&
                r.projectId === project.id &&
                r.compositionId === c.id,
            )
          : [];
      ids = roles.length
        ? roles.map((r) => r.id)
        : c.layers.filter(matches).map((l) => l.id);
    } else if (!create) ids = [...selection];
    if (!create && /中间|middle/i.test(request) && ids.length > 1) {
      // Reliable previous creation order only; never guess from arbitrary Scene ordering.
      if (
        ids.length % 2 === 1 &&
        ids.every((id) => this.recentlyCreated.includes(id))
      )
        ids = [ids[Math.floor(ids.length / 2)]!];
    }
    // Explicit selection can disambiguate a plural descriptive group, never a deleted ordinal.
    if (
      ids.length > 1 &&
      selection.length === 1 &&
      ids.includes(selection[0]!) &&
      !ordinal
    )
      ids = [...selection];
    if (
      !create &&
      !ids.length &&
      !explicitId &&
      !ordinal &&
      !/选中|选区|selected|刚才|刚刚|上一轮|这个|它|recent|last/i.test(request)
    ) {
      // A missing Selection is not a missing target when the real Scene has exactly one match.
      ids = c.layers.filter(matches).map((l) => l.id);
    }
    if (!create && ids.length !== 1 && !/选中|选区/.test(request))
      throw problem(
        'INVALID_REFERENCE',
        ids.length
          ? '有多个候选，请明确选择目标图层'
          : '当前合成中没有匹配的目标图层；可直接请求创建图层，或明确已有对象名称',
      );
    if (!create && !ids.length)
      throw problem('INVALID_REFERENCE', '当前没有选中图层');
    if (ids.length > 20)
      throw problem('BUDGET_EXCEEDED', '本轮最多编辑20个明确选中的对象');
    ids.forEach((id) => this.validate(id, project));
    return { ids, allowCreate: create };
  }
  context(project: Project, selection: readonly string[]) {
    const c = activeComposition(project);
    return {
      sessionId: this.id,
      turn: this.turn,
      projectId: project.id,
      compositionId: c.id,
      currentVersion: contentHash(project),
      selection,
      recentlyCreated: this.recentlyCreated,
      recentlyModified: this.recentlyModified,
      recentGUI: this.recentGUI,
      committedReferences: this.references
        .filter((r) => r.projectId === project.id && r.compositionId === c.id)
        .map((r) => ({ ...r, exists: c.layers.some((l) => l.id === r.id) })),
      ordinalRule:
        'Session creation order when known; otherwise current Scene layer order. Never use names to infer identity.',
    };
  }
}
