import { migrateLayerGraph } from './compositing-migration';
import { createProperty, createLayerEditor } from './project-model';
import { projectSchema as legacySchema } from './legacy-project-schema';
import type { Project, Layer } from './project-model';
import { projectSchema } from './project-schema';

export class ProjectFileError extends Error {
  constructor(
    readonly code:
      | 'JSON_PARSE'
      | 'INVALID_SCHEMA'
      | 'UNSUPPORTED_VERSION'
      | 'FILE_TOO_LARGE',
    message: string,
    readonly issues: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ProjectFileError';
  }
}
export function migrateProject(raw: unknown): Project {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw))
    throw new ProjectFileError(
      'INVALID_SCHEMA',
      '工程缺少版本信息（schemaVersion）',
    );
  if (
    raw.schemaVersion !== '0.1.0' &&
    raw.schemaVersion !== '0.2.0' &&
    raw.schemaVersion !== '0.3.0' &&
    raw.schemaVersion !== '0.4.0' &&
    raw.schemaVersion !== '0.5.0'
  )
    throw new ProjectFileError(
      'UNSUPPORTED_VERSION',
      `不支持工程版本：此工程由更新版本的 Swayframe 创建，或使用不支持的版本（${String(raw.schemaVersion)}）。请更新应用后再打开。`,
    );
  // Version dispatcher: future migrations must transform older versions before parsing.
  let candidate: unknown = raw;
  if (raw.schemaVersion === '0.1.0') {
    const legacy = legacySchema.safeParse(raw);
    if (!legacy.success)
      throw new ProjectFileError(
        'INVALID_SCHEMA',
        '旧版工程结构无效',
        legacy.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      );
    candidate = {
      ...legacy.data,
      schemaVersion: '0.5.0',
      compositions: legacy.data.compositions.map((c) => ({
        ...c,
        layers: c.layers.map((l) => ({
          ...l,
          editor: createLayerEditor(l as Layer),
        })),
      })),
    };
  }
  if (
    raw.schemaVersion === '0.2.0' ||
    raw.schemaVersion === '0.3.0' ||
    raw.schemaVersion === '0.4.0'
  )
    candidate = { ...raw, schemaVersion: '0.5.0' };
  if (raw.schemaVersion !== '0.5.0')
    candidate = upgradeLegacyEffects(candidate);
  const parsed = projectSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((item) => ({
      path: item.path.join('.'),
      message: item.message,
    }));
    throw new ProjectFileError(
      'INVALID_SCHEMA',
      `工程结构无效：${issues
        .slice(0, 3)
        .map((i) => `${i.path || 'root'}：${i.message}`)
        .join('；')}`,
      issues,
    );
  }
  return projectSchema.parse({
    ...parsed.data,
    compositions: parsed.data.compositions.map((c) => ({
      ...c,
      layers: c.layers.map(migrateLayerGraph),
    })),
  });
}
function checkFileSize(json: string): void {
  if (
    json.length > 20_000_000 ||
    new TextEncoder().encode(json).byteLength > 20_000_000
  )
    throw new ProjectFileError('FILE_TOO_LARGE', '工程文件超过 20 MB');
}
export function loadProject(json: string): Project {
  checkFileSize(json);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ProjectFileError('JSON_PARSE', '无法读取工程：JSON 语法错误');
  }
  return migrateProject(raw);
}
export const saveProject = (project: Project): string => {
  const json = JSON.stringify(migrateProject(project), null, 2);
  checkFileSize(json);
  return json;
};

function upgradeLegacyEffects(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(upgradeLegacyEffects);
  const record = value as Record<string, unknown>;
  if (
    record.kind === 'hueSaturation' &&
    record.parameters &&
    typeof record.parameters === 'object' &&
    !Array.isArray(record.parameters) &&
    !('lightness' in record.parameters)
  )
    return {
      ...record,
      parameters: { ...record.parameters, lightness: createProperty(0) },
    };
  return Object.fromEntries(
    Object.entries(record).map(([key, v]) => [key, upgradeLegacyEffects(v)]),
  );
}
