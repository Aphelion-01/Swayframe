from pathlib import Path
import os, json, subprocess, time
out=Path('outputs/agent-v2-7').resolve()
env=os.environ.copy();env['SWAYFRAME_USER_DATA']=str(out/'native-startup-userdata')
exe=Path('release/mac-arm64/Swayframe.app/Contents/MacOS/Swayframe').resolve()
with (out/'native-mac-startup.log').open('w') as log:
 p=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=log)
 time.sleep(8);alive=p.poll() is None
 if alive:
  p.terminate()
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=5)
text=(out/'native-mac-startup.log').read_text()
fatal=any(x in text for x in ['Uncaught Exception','Cannot find module','ERR_FILE_NOT_FOUND','SyntaxError:'])
report={'version':'1.0.3','nativeExecutableStarted':alive,'observedSeconds':8,'fatalSignatureFound':fatal,'pass':alive and not fatal,'scope':'Actual packaged Mac executable; isolated profile; only owned subprocess terminated; no paid Provider request'}
(out/'native-mac-startup.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report));assert report['pass']
