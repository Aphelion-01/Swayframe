from pathlib import Path
import json,hashlib,subprocess
root=Path('.').resolve();out=root/'outputs/agent-v2-6'
if (out/'live/calls.json').exists():
 raise RuntimeError('Offline manifest only; never reset real paid usage or status.')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
artifacts=[{'path':str(p.resolve()),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted((root/'release').glob('*')) if p.suffix in ['.dmg','.exe']]
for report in ['protected-state-check.json','packaged-smoke.json','native-mac-startup.json','ui/report.json']:
 assert json.loads((out/report).read_text())['pass'],report
for n in range(5):
 assert all(r['exitCode']==0 for r in json.loads((out/f'quality/phase{n}/result.json').read_text())),n
# Hash only tracked/untracked review artifacts, excluding isolated profiles, generated bundles, release files and symlinked dependencies.
files=set(subprocess.check_output(['git','diff','--name-only'],text=True).splitlines())
files.update(subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines())
if (out/'RELEASE_MANIFEST.json').exists():
 files.update(r['path'] for r in json.loads((out/'RELEASE_MANIFEST.json').read_text())['reviewFiles'])
files.update(subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines())
files.update(str(p.relative_to(root)) for p in (root/'work/agent-v2-6').iterdir() if p.suffix in ['.ts','.tsx','.mjs','.py','.html'] or p.name in ['preload.cjs','ui-preload.cjs','ui-main.cjs','packaged-smoke.cjs'])
files.discard('outputs/agent-v2-6/RELEASE_MANIFEST.json')
assert not any('userdata' in f or f.endswith(('.exe','.dmg')) for f in files)
manifest={'version':'1.0.2','branch':'codex/agent-v2-recovery-1.0.2','baselineCommit':'801008a0c8feb75d8348823fbeef8b293302fc36',
 'defaultRuntime':'legacy-v1','paidRequests':0,'liveStatus':'PENDING NEW AUTHORIZATION','canary':'NOT READY',
 'artifacts':artifacts,'mac':{'arch':'arm64','signed':False,'dmgChecksum':'VALID CRC32 65B5D16D','nativeStartup':'PASS 8s isolated profile','packagedMainPreloadRendererV2ESM':'PASS'},
 'windows':{'arch':'x64','format':'NSIS','signed':False,'build':'PASS','runtime':'NOT VERIFIED on Windows'},
 'protectedState':'PASS original 542 code hashes, branch, HEAD, index; 138 V2-5 evidence hashes; 1.0.1 clean',
 'quality':'Phase0-4 all five gates PASS; 779 final tests; 7 Electron scenarios; 60 fixed offline long-task repeats; 4 UI sizes',
 'reviewFiles':[{'path':f,'sha256':sha(root/f)} for f in sorted(files) if (root/f).is_file()]}
(out/'RELEASE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Review files',len(manifest['reviewFiles']),'Release artifacts',len(artifacts))
