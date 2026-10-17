import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
/** Fixed OS queries only: no paths or executable/script supplied by the renderer. */
export function fontQuery(platform: NodeJS.Platform) {
  if (platform === 'darwin')
    return {
      file: '/usr/bin/osascript',
      args: [
        '-l',
        'JavaScript',
        '-e',
        "ObjC.import('AppKit'); JSON.stringify(ObjC.deepUnwrap($.NSFontManager.sharedFontManager.availableFontFamilies))",
      ],
    };
  if (platform === 'win32')
    return {
      file: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; $fonts = New-Object System.Drawing.Text.InstalledFontCollection; try { ConvertTo-Json -Compress -InputObject @($fonts.Families | ForEach-Object { $_.Name }) } finally { $fonts.Dispose() }',
      ],
    };
  return { file: 'fc-list', args: ['--format=%{family}\\n'] };
}
export function parseFontFamilies(output: string, platform: NodeJS.Platform) {
  const parsed: unknown =
    platform === 'linux'
      ? output.split(/[\n,]/)
      : JSON.parse(output.replace(/^\uFEFF/, '').trim());
  if (!Array.isArray(parsed)) throw Error('系统字体列表无效');
  return [
    ...new Set(
      parsed
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= 200),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5000);
}
let cached: { time: number; families: string[] } | undefined;
let pending: Promise<string[]> | undefined;
export async function listSystemFonts() {
  if (cached && Date.now() - cached.time < 60000) return cached.families;
  if (!pending) {
    const { file, args } = fontQuery(process.platform);
    pending = run(file, args, {
      timeout: 15000,
      maxBuffer: 2_000_000,
      windowsHide: true,
      encoding: 'utf8',
    })
      .then(({ stdout }) => {
        const families = parseFontFamilies(stdout, process.platform);
        if (!families.length) throw Error('未读取到系统字体');
        cached = { time: Date.now(), families };
        return families;
      })
      .finally(() => {
        pending = undefined;
      });
  }
  return pending;
}
