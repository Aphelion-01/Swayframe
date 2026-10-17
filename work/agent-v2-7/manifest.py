from pathlib import Path
import hashlib, json, subprocess

root = Path('.').resolve()
out = root / 'outputs/agent-v2-7'
def read(name):
    return json.loads((out / name).read_text())
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()
quality = {f'phase{i}': read(f'quality/phase{i}/result.json') for i in range(11)}
tests = read('quality/phase10/tests.json')
editor = read('editor/report.json')
restart = read('editor/restart-report.json')
smoke = read('packaged-smoke.json')
startup = read('native-mac-startup.json')
integrity = read('package-integrity.json')
protection = read('protected-state-check.json')
assert tests['numTotalTests'] == tests['numPassedTests'] == 819 and tests['numFailedTests'] == 0
assert all(g['exitCode'] == 0 for gates in quality.values() for g in gates)
assert all(r['pass'] for r in [editor, restart, smoke, startup, integrity, protection])
assert ' is VALID' in (out / 'dmg-verify-scoped-final.log').read_text()
usage = read('LIVE_REQUEST_USAGE.json')
assert usage['actualAPIRequests'] == 39
final_repeat = read('live/final-repeat/acceptance-summary.json')
assert final_repeat['passedTasks'] == 8 and final_repeat['failedTasks'] == 2 and final_repeat['baselinePreserved']
assert read('live/final-repeat/source-integrity.json')['pass']
artifacts = []
for name in ['Swayframe-1.0.3-arm64.dmg', 'Swayframe Setup 1.0.3.exe']:
    p = root / 'release' / name
    artifacts.append({'path': str(p), 'bytes': p.stat().st_size, 'sha256': sha(p), 'signed': False})
changed = set(git('diff', '--name-only', '469470de85cc0e53049cb06a067af3f0b16c44e3').splitlines())
changed.update(git('ls-files', '--others', '--exclude-standard').splitlines())
scripts = ['build.mjs', 'gates.mjs', 'reports.py', 'editor-main.ts', 'editor-renderer.tsx',
           'editor.html', 'editor-preload.cjs', 'packaged-smoke.cjs', 'native-startup.py',
           'protect.py', 'package-integrity.cjs', 'manifest.py', 'live-main.ts',
           'live-renderer.tsx', 'live-preload.cjs', 'live-build.mjs', 'live.html',
           'credential-fixture-main.ts', 'live-product-host.ts',
           'live-product-build.mjs', 'catalog.html', 'catalog.js', 'live-final-host.ts',
           'live-final-renderer.tsx', 'live-final-build.mjs', 'live-final.html', 'final-repeat-report.py']
changed.update('work/agent-v2-7/' + name for name in scripts)
review = [{'path': name, 'bytes': (root/name).stat().st_size, 'sha256': sha(root/name)}
          for name in sorted(changed) if (root/name).is_file()
          and name != 'outputs/agent-v2-7/RELEASE_MANIFEST.json']
report = {
    'version': '1.0.3', 'branch': git('branch', '--show-current'),
    'baseline': '469470de85cc0e53049cb06a067af3f0b16c44e3',
    'defaultRuntime': 'legacy-v1', 'actualAPIRequests': usage['actualAPIRequests'],
    'actualChargedRequests': None, 'billing': 'UNKNOWN', 'liveUsage': usage,
    'liveValidation': 'FIXED-VERSION CREATION FAIL; FRESH C AND THREE MATCHED EDIT PAIRS PASS',
    'authorization': read('authorization.json'), 'additionalAuthorization': read('authorization-round2.json'), 'liveSummary': read('LIVE_VALIDATION_SUMMARY.json'), 'liveBlocked': read('live/blocked-report.json'),
    'finalRepeatAuthorization': read('authorization-round3.json'),
    'finalRepeat': final_repeat, 'frozenProductSource': read('live/final-repeat/source-integrity.json'),
    'canary': 'NOT READY',
    'artifacts': artifacts, 'quality': quality,
    'tests': {'total': 819, 'passed': 819, 'failed': 0, 'added': 38},
    'actualEditorOffline': {'pass': editor['pass'], 'scenarios': len(editor['records']),
        'acceptedTurns': sum(r['acceptedTurns'] for r in editor['records']),
        'fixtureRequests': editor['fixtureRequests'], 'externalNetwork': editor['externalNetwork']},
    'secondProcessReload': {'pass': restart['pass'], 'fixtureRequests': restart['fixtureRequests'],
        'inFlightResume': restart['inFlightResume']},
    'packages': {'mac': {'startup': startup['pass'], 'editorLoad': smoke['pass'], 'dmgIntegrity': True},
        'windows': {'build': True, 'peHeaders': True, 'runtime': 'NOT VERIFIED'},
        'sourceIntegrity': integrity},
    'protectedState': protection, 'reviewFiles': review,
    'limits': ['Offline fixtures do not prove real model reliability',
               'V2 remains explicit Beta; advanced V1 capabilities are not migrated',
               'Both installers unsigned; Windows runtime not tested'],
}
(out/'RELEASE_MANIFEST.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'reviewFiles': len(review), 'reviewBytes': sum(r['bytes'] for r in review),
                  'artifacts': artifacts, 'offlinePass': True}, ensure_ascii=False))
