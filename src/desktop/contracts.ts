import { aiRequestSchemas } from '../ai/desktop-contracts';
import type { DesktopAIAPI } from '../ai/desktop-contracts';
import { z } from 'zod';
export const pathSchema = z
  .string()
  .min(1)
  .max(32768)
  .refine((v) => !v.includes('\0'), 'Invalid path');
export const dialogOptionsSchema = z
  .object({
    title: z.string().max(200).optional(),
    defaultPath: pathSchema.optional(),
    extensions: z
      .array(z.string().regex(/^[a-z0-9]+$/i))
      .max(10)
      .optional(),
    multiple: z.boolean().optional(),
  })
  .strict();
export type DialogOptions = z.infer<typeof dialogOptionsSchema>;
export interface OpenProjectResult {
  path: string;
  data: string;
}
export interface SaveResult {
  path: string;
  saved: boolean;
}
export interface AssetMetadata {
  width: number;
  height: number;
  size: number;
  modifiedAt: number;
}
export interface ImportedAsset {
  path: string;
  name: string;
  mimeType: string;
  url: string;
  metadata: AssetMetadata;
}
export interface RecentProject {
  path: string;
  displayName: string;
  lastOpenedAt: number;
  missing: boolean;
}
export interface PlatformInfo {
  platform: 'darwin' | 'win32' | 'linux';
  primaryModifier: 'Meta' | 'Control';
  version: string;
}
export interface Recovery {
  data: string;
  path: string | null;
  timestamp: number;
}
export type DesktopAction =
  | 'new'
  | 'open'
  | 'save'
  | 'save-as'
  | 'close-project'
  | 'close-window'
  | 'import'
  | 'export'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'duplicate'
  | 'delete'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'actual-size'
  | 'toggle-left'
  | 'toggle-right'
  | 'toggle-bottom'
  | 'keyframe'
  | 'graph'
  | 'motion-curve'
  | 'about';
export const actionSchema = z.enum([
  'new',
  'open',
  'save',
  'save-as',
  'close-project',
  'close-window',
  'import',
  'export',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'select-all',
  'duplicate',
  'delete',
  'zoom-in',
  'zoom-out',
  'fit',
  'actual-size',
  'toggle-left',
  'toggle-right',
  'toggle-bottom',
  'keyframe',
  'graph',
  'motion-curve',
  'about',
]);
const dataSchema = z.string().max(20_000_000);
export const requestSchema = z.discriminatedUnion('method', [
  ...aiRequestSchemas,
  z
    .object({
      method: z.literal('edit.text'),
      action: z.enum([
        'undo',
        'redo',
        'cut',
        'copy',
        'paste',
        'delete',
        'selectAll',
      ]),
    })
    .strict(),
  z.object({ method: z.literal('platform.info') }).strict(),
  z
    .object({ method: z.literal('window.title'), title: z.string().max(500) })
    .strict(),
  z
    .object({ method: z.literal('window.edited'), edited: z.boolean() })
    .strict(),
  z.object({ method: z.literal('window.close') }).strict(),
  z
    .object({ method: z.literal('dialog.open'), options: dialogOptionsSchema })
    .strict(),
  z
    .object({
      method: z.literal('dialog.folder'),
      options: dialogOptionsSchema,
    })
    .strict(),
  z
    .object({ method: z.literal('dialog.save'), options: dialogOptionsSchema })
    .strict(),
  z
    .object({ method: z.literal('dialog.unsaved'), name: z.string().max(200) })
    .strict(),
  z.object({ method: z.literal('project.new') }).strict(),
  z
    .object({ method: z.literal('project.open'), path: pathSchema.optional() })
    .strict(),
  z
    .object({
      method: z.literal('project.save'),
      data: dataSchema,
      path: pathSchema.nullable(),
      saveAs: z.boolean(),
    })
    .strict(),
  z
    .object({
      method: z.literal('assets.import'),
      paths: z.array(pathSchema).max(100).optional(),
    })
    .strict(),
  z.object({ method: z.literal('assets.metadata'), path: pathSchema }).strict(),
  z.object({ method: z.literal('assets.exists'), path: pathSchema }).strict(),
  z
    .object({ method: z.literal('assets.relink'), id: z.string().uuid() })
    .strict(),
  z.object({ method: z.literal('recent.list') }).strict(),
  z
    .object({
      method: z.literal('recent.add'),
      path: pathSchema,
      name: z.string().max(200),
    })
    .strict(),
  z.object({ method: z.literal('recent.remove'), path: pathSchema }).strict(),
  z.object({ method: z.literal('recent.clear') }).strict(),
  z.object({ method: z.literal('recovery.read') }).strict(),
  z
    .object({
      method: z.literal('recovery.write'),
      data: dataSchema,
      path: pathSchema.nullable(),
    })
    .strict(),
  z.object({ method: z.literal('recovery.clear') }).strict(),
  z.object({ method: z.literal('startup.read') }).strict(),
  z
    .object({
      method: z.literal('export.write'),
      path: pathSchema,
      bytes: z
        .instanceof(Uint8Array)
        .refine((bytes) => bytes.byteLength <= 512_000_000),
      sequence: z.boolean(),
    })
    .strict(),
  z
    .object({
      method: z.literal('log.error'),
      category: z.enum(['Renderer', 'Main', 'FileIO', 'Project']),
      message: z.string().max(5000),
    })
    .strict(),
]);
export type DesktopRequest = z.infer<typeof requestSchema>;
export interface DesktopAPI {
  ai?: DesktopAIAPI;
  textEdit(
    action: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete' | 'selectAll',
  ): Promise<void>;
  project: {
    newProject(): Promise<void>;
    open(path?: string): Promise<OpenProjectResult | null>;
    save(data: string, path: string | null): Promise<SaveResult | null>;
    saveAs(data: string, path?: string | null): Promise<SaveResult | null>;
  };
  dialog: {
    openFile(options: DialogOptions): Promise<string[]>;
    openFolder(options: DialogOptions): Promise<string | null>;
    saveFile(options: DialogOptions): Promise<string | null>;
    confirmUnsaved(name: string): Promise<'save' | 'discard' | 'cancel'>;
  };
  assets: {
    importFiles(paths?: string[]): Promise<ImportedAsset[]>;
    readMetadata(path: string): Promise<AssetMetadata>;
    exists(path: string): Promise<boolean>;
    relink(id: string): Promise<ImportedAsset | null>;
    pathsForFiles(files: File[]): Promise<string[]>;
  };
  recentProjects: {
    list(): Promise<RecentProject[]>;
    add(path: string, name: string): Promise<void>;
    remove(path: string): Promise<void>;
    clear(): Promise<void>;
  };
  recovery: {
    read(): Promise<Recovery | null>;
    write(data: string, path: string | null): Promise<void>;
    clear(): Promise<void>;
  };
  window: {
    setTitle(title: string): Promise<void>;
    setDocumentEdited(edited: boolean): Promise<void>;
    close(): Promise<void>;
  };
  platform: { getInfo(): Promise<PlatformInfo> };
  startup(): Promise<string | null>;
  export: {
    write(path: string, bytes: Uint8Array, sequence: boolean): Promise<void>;
  };
  log(
    category: 'Renderer' | 'Main' | 'FileIO' | 'Project',
    message: string,
  ): Promise<void>;
  onAction(
    listener: (action: DesktopAction, path?: string) => void,
  ): () => void;
}
declare global {
  interface Window {
    swayframe?: { desktop: DesktopAPI };
  }
}
