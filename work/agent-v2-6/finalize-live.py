"""Finalize only the authorized V2-6 run; preserve initial failures and usage."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path('.').resolve()
out = root / 'outputs/agent-v2-6'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text())
git = lambda cwd, *args: subprocess.check_output(['git', '-C', str(cwd), *args]).decode().strip()
first = read(out / 'live/report.json')
final = read(out / 'live-recheck/report.json')
summary = read(out / 'live-summary.json')
assert len(first['rows']) == 7 and sum(r['pass'] for r in first['rows']) == 4
assert final['rows'][0]['pass'] and final['budget']['requests'] == 11
assert final['budget']['inputTokens'] == 113767 and final['budget']['outputTokens'] == 11608
assert final['budget']['unknownUsage'] == 0
assert read(out / 'live-recheck/calls.json')[:10] == read(out / 'live/calls.json')
for entry in summary['firstRunEvidenceHashes']:
    assert sha(root / entry['path']) == entry['sha256'], entry['path']
for n in range(6):
    assert all(r['exitCode'] == 0 for r in read(out / f'quality/phase{n}/result.json'))
tests = read(out / 'quality/phase5/tests.json')
assert tests['success'] and tests['numPassedTests'] == 781
for report in ['packaged-smoke.json', 'native-mac-startup.json', 'ui/report.json']:
    assert read(out / report)['pass'], report
assert 'is VALID' in (out / 'dmg-verify-live.log').read_text()

parent = root.parent.parent
original = parent / 'referenced-chatgpt-conversation-this-is-an'
protected = read(parent / 'Swayframe_Publications/20261011/PROTECTED_STATE.json')
changed, missing = [], []
for entry in protected['codeFiles']:
    p = original / entry['path']
    if not p.exists(): missing.append(entry['path'])
    elif sha(p) != entry['sha256']: changed.append(entry['path'])
index = Path(git(original, 'rev-parse', '--git-path', 'index'))
if not index.is_absolute(): index = original / index
baseline = root.parent / '1.0.1'
historical = git(baseline, 'ls-files', 'outputs/agent-v2-5').splitlines()
historical_changed = [f for f in historical if (baseline / f).read_bytes() != subprocess.check_output(['git', '-C', str(baseline), 'show', '801008a:' + f])]
protection = {
    'originalCodeFiles': len(protected['codeFiles']),
    'originalChangedFiles': changed, 'originalMissingFiles': missing,
    'originalHeadUnchanged': git(original, 'rev-parse', 'HEAD') == protected['originalHead'],
    'originalBranchUnchanged': git(original, 'branch', '--show-current') == protected['originalBranch'],
    'originalIndexUnchanged': sha(index) == protected['originalIndexSHA256'],
    'protectedPathsPresent': all(Path(p).exists() for p in protected['mustRemain']),
    'v2_5EvidenceCount': len(historical), 'v2_5Changed': historical_changed,
    'baseline1_0_1Head': git(baseline, 'rev-parse', 'HEAD'),
    'baseline1_0_1Clean': not git(baseline, 'status', '--porcelain'),
}
protection['pass'] = not changed and not missing and not historical_changed and all(protection[k] for k in ['originalHeadUnchanged', 'originalBranchUnchanged', 'originalIndexUnchanged', 'protectedPathsPresent', 'baseline1_0_1Clean']) and protection['baseline1_0_1Head'] == '801008a0c8feb75d8348823fbeef8b293302fc36'
assert protection['pass'], protection
(out / 'protected-state-check.json').write_text(json.dumps(protection, indent=2) + '\n')

manifest = read(out / 'RELEASE_MANIFEST.json')
files = {r['path'] for r in manifest['reviewFiles']}
for args in [('diff', '--name-only'), ('diff', '--cached', '--name-only'), ('ls-files', '--others', '--exclude-standard')]:
    files.update(git(root, *args).splitlines())
files.add('work/agent-v2-6/finalize-live.py')
files.discard('outputs/agent-v2-6/RELEASE_MANIFEST.json')
assert not any('userdata' in f or f.endswith(('.exe', '.dmg')) for f in files)
manifest.update({
    'preLiveCommit': 'a5f8e0d',
    'paidRequests': 11, 'usage': final['budget'],
    'liveStatus': 'COMPLETE WITH FIRST-RUN FAILURES PRESERVED; L3 FIX AND RECHECK PASS',
    'liveFirstRun': summary['initialRun'], 'liveRecheck': summary['recheck'],
    'canary': 'NOT READY',
    'quality': 'Phase0-5 all five gates PASS; 781 tests; original live failures retained; L3 offline replay and paid recheck PASS',
    'protectedState': f"PASS original {len(protected['codeFiles'])} code hashes, HEAD, branch, index; {len(historical)} V2-5 evidence files; 1.0.1 clean",
    'artifacts': [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted((root / 'release').glob('*')) if p.suffix in ['.exe', '.dmg']],
    'reviewFiles': [{'path': f, 'sha256': sha(root / f)} for f in sorted(files) if (root / f).is_file()],
})
manifest['mac']['dmgChecksum'] = 'VALID; see dmg-verify-live.log'
manifest['mac']['nativeStartup'] = 'PASS rebuilt native executable, 8s isolated profile'
(out / 'RELEASE_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'protection': protection['pass'], 'historicalFiles': len(historical), 'paidRequests': 11, 'reviewFiles': len(manifest['reviewFiles']), 'artifacts': manifest['artifacts']}, ensure_ascii=False))
