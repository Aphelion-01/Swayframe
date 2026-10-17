from pathlib import Path
import json,hashlib
out=Path('outputs/agent-v2-7'); live=out/'live'; final=live/'final-repeat'
read=lambda p:json.loads(p.read_text())
write=lambda p,v:p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
rows=read(live/'calls.json');old=read(live/'calls-before-round3.json');assert rows[:28]==old and len(rows)==39
r=rows[28:]; report=read(final/'report.json');assert len(r)==11 and report['baselinePreserved'] and report['fixtureReplayRequests']==0
assert all(x.get('status')==200 and x.get('usage')for x in r)
auth=read(out/'authorization-round3.json')
assert len(r)<=auth['requests'] and all(sum(c['caseId']==k for c in r)<=v for k,v in auth['caseCaps'].items())
assert all(sum(x['turnId']==c['turnId']for x in r)<=2 for c in r if c['caseId']=='Matched')
known=lambda rs,k:sum(c.get('usage',{}).get(k,0)for c in rs)
account=lambda rs,k,u:sum(c.get('usage',{}).get(k,c[u])for c in rs)
assert account(r,'inputTokens','inputUpper')<=400000 and account(r,'outputTokens','outputUpper')<=40000
assert account(rows,'inputTokens','inputUpper')<=1104968 and account(rows,'outputTokens','outputUpper')<=69425
for n in ['LIVE_REQUEST_USAGE.json','LIVE_VALIDATION_SUMMARY.json','RELEASE_MANIFEST.json']:
 p=out/n; archive=final/('before-'+n)
 if not archive.exists():archive.write_bytes(p.read_bytes())
usage=read(final/'before-LIVE_REQUEST_USAGE.json')
usage.update(actualAPIRequests=len(rows),chatRequests=sum(c.get('kind','chat')=='chat'for c in rows),knownUsageRequests=sum('usage'in c for c in rows),knownResponseInputTokens=known(rows,'inputTokens'),knownResponseOutputTokens=known(rows,'outputTokens'),inputAccounted=account(rows,'inputTokens','inputUpper'),outputAccounted=account(rows,'outputTokens','outputUpper'),historicalTwentyEightCallsUnchanged=True,historicalTwentyEightLedgerSHA256=hashlib.sha256((live/'calls-before-round3.json').read_bytes()).hexdigest(),stopReason='Fixed-version acceptance finished; A/B dependent turns blocked by fresh creation failures, not request budget exhaustion')
usage['round3']={**report['roundBudget'],'remainingRequests':9,'remainingInput':400000-known(r,'inputTokens'),'remainingOutput':40000-known(r,'outputTokens'),'caseRequests':{k:sum(c['caseId']==k for c in r)for k in auth['caseCaps']},'reservedNotSpent':True,'actualCost':None,'fees':'School account rate unknown'}
write(out/'LIVE_REQUEST_USAGE.json',usage)
summary=read(final/'before-LIVE_VALIDATION_SUMMARY.json');historical={k:summary[k]for k in ['actualRequests','additionalRequests','fullSessions','comparison','freshAcceptedTasks']}
records=report['records'];assert len(records)==10 and sum(x['pass']for x in records)==8
notrun=[{'id':i,'status':'NOT_RUN','reason':'Prerequisite fresh creation failed; no fabricated baseline or replacement object'}for i in ['A2','A3','A4','B2','B3','B4']]
matched=[]
for kind in ['fill','dimensions','font']:
 pair=[]
 for engine in ['legacy-v1','core-v2']:
  tid='M-'+kind+'-'+engine;rr=[c for c in r if c['turnId']==tid];record=next(x for x in records if x['id']==tid)
  pair.append({'engine':engine,'pass':record['pass'],'requests':len(rr),'inputTokens':known(rr,'inputTokens'),'outputTokens':known(rr,'outputTokens'),'elapsedMs':record['elapsedMs'],'extraReadRequests':sum(any(t.get('function',{}).get('name')=='inspectToolContract'for t in c.get('response',{}).get('choices',[{}])[0].get('message',{}).get('tool_calls',[]))for c in rr)})
 matched.append({'kind':kind,'variants':pair,'sameInitialSceneAndTarget':True,'sameGoalProviderModelWriteSubsetAndMaxOutput':True,'protectedObjectUnchanged':True,'limitations':'One paired sample per operation; prompts and native READ surfaces differ by runtime; no general superiority claim'})
fixed={**{k:report[k]for k in ['roundId','modelRequested','providerEndpoint','roundBudget','budget','activeLiveDurationMs','baselinePreserved','imagesSent','privateProjectsSent','fixtureReplayRequests']},'attemptedTasks':10,'passedTasks':8,'failedTasks':2,'notRunTasks':notrun,'fullSessions':{'A':'FAIL at A1; duplicate action IDs and incorrect creation/fill semantics; A2-A4 not run','B':'FAIL at B1; extra rectangle plus text; B2-B4 not run','C':'PASS: two fresh requests, actual Renderer, same UUID and latest GUI transform/gradient preserved'},'matched':matched,'failedInputsRetained':all(x['inputRetained']for x in records if not x['pass']),'failedFormalSceneUnchanged':all(x['layerIds']==[]for x in records if not x['pass']),'freshOnly':True,'verdict':'CANARY NOT READY; EDITING SAMPLE PASS, CREATION RELIABILITY FAIL','productSourceChanged':False,'unusedRequestAllowance':9,'unusedAllowanceNotReasonToRerunUntilSuccess':True}
write(final/'acceptance-summary.json',fixed)
summary.update(status='CANARY NOT READY; FIXED-VERSION CREATION FAIL',actualRequests=39,additionalRequests=31,fullSessions=fixed['fullSessions'],comparison='Three fresh matched pairs pass both runtimes; single samples do not establish general reliability or superiority',stopReason=usage['stopReason'],matchedCompleteFairComparison=True,matchedComparisonLimitations='Same scenes/targets/goals/provider/model/13 WRITE subset/output cap; runtime prompts/READ differ; one sample each',historicalRound2=historical,finalRepeat=fixed)
summary['freshAcceptedTasks'] += [{'case':x['id'],'request':next(c['index']for c in r if c['turnId']==x['id']and c['status']==200),'roundId':auth['roundId']}for x in records if x['pass']]
assert len({x['request']for x in summary['freshAcceptedTasks']})==len(summary['freshAcceptedTasks'])
write(out/'LIVE_VALIDATION_SUMMARY.json',summary)
frozen=read(final/'frozen-source.json');diff=[f['path']for f in frozen['files']if hashlib.sha256(Path(f['path']).read_bytes()).hexdigest()!=f['sha256']];assert not diff
write(final/'source-integrity.json',{'pass':True,'frozenProductFiles':len(frozen['files']),'changedProductFiles':diff,'frozenHead':frozen['head'],'installersRebuilt':False,'reason':'Only QA/evidence/documentation changed; existing tested installers match frozen product source'})
print(json.dumps({'tasksPassed':8,'tasksFailed':2,'tasksNotRun':6,'requests':11,'inputTokens':88117,'outputTokens':4921,'historicalRequestsPreserved':28,'canary':'NOT READY'}))
