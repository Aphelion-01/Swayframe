from pathlib import Path
import hashlib,json,subprocess
root=Path('.').resolve();out=root/'outputs/agent-v2-7'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
original=root.parent.parent/'referenced-chatgpt-conversation-this-is-an'
protection=json.loads((root.parent.parent/'Swayframe_Publications/20261011/PROTECTED_STATE.json').read_text())
def git(path,*args):return subprocess.check_output(['git','-C',str(path),*args],text=True).strip()
missing=[r['path']for r in protection['codeFiles']if not(original/r['path']).is_file()]
changed=[r['path']for r in protection['codeFiles']if (original/r['path']).is_file() and sha(original/r['path'])!=r['sha256']]
index=Path(git(original,'rev-parse','--git-path','index'))
if not index.is_absolute():index=original/index
v26=json.loads((out/'baseline.json').read_text())['v2_6Evidence']
v25=json.loads((root/'outputs/agent-v2-6/baseline.json').read_text())['v2_5Evidence']
def differs(base,records):return [r['path']for r in records if not(base/r['path']).is_file() or sha(base/r['path'])!=r['sha256']]
report={'originalCodeFiles':len(protection['codeFiles']),'originalChangedFiles':changed,'originalMissingFiles':missing,
 'originalHeadUnchanged':git(original,'rev-parse','HEAD')==protection['originalHead'],
 'originalBranchUnchanged':git(original,'branch','--show-current')==protection['originalBranch'],
 'originalIndexUnchanged':sha(index)==protection['originalIndexSHA256'],
 'protectedPathsPresent':all(Path(p).exists()for p in protection['mustRemain']),
 'v2_6EvidenceCount':len(v26),'v2_6Changed':differs(root.parent/'1.0.2',v26),
 'v2_5EvidenceCount':len(v25),'v2_5Changed':differs(root.parent/'1.0.1',v25),
 'baseline1_0_2Head':git(root.parent/'1.0.2','rev-parse','HEAD'),
 'baseline1_0_2Clean':not git(root.parent/'1.0.2','status','--porcelain'),
 'baseline1_0_1Clean':not git(root.parent/'1.0.1','status','--porcelain')}
report['pass']=not changed and not missing and all(report[k]for k in ['originalHeadUnchanged','originalBranchUnchanged','originalIndexUnchanged','protectedPathsPresent','baseline1_0_2Clean','baseline1_0_1Clean']) and not report['v2_6Changed'] and not report['v2_5Changed'] and report['baseline1_0_2Head']=='469470de85cc0e53049cb06a067af3f0b16c44e3'
(out/'protected-state-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False));assert report['pass']
