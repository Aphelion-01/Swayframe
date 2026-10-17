from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,os
root=Path('docs/qa/external-ai');out=Path(os.environ.get('SF_EXTERNAL_OUT',str(root/'run')));pkg=root/'composition';m=json.loads((pkg/'manifest.json').read_text());W,H=m['canvas']['width'],m['canvas']['height'];results=[]
def compose(dx,dy):
 c=Image.new('RGBA',(W,H))
 for l in m['layers']:
  b=l['bounds'];x,y=b['x'],b['y']
  if l['id']=='subject':x+=dx;y+=dy
  c.alpha_composite(Image.open(pkg/l['asset']).convert('RGBA'),(x,y))
 return c
expected=[('imported',Image.open(root/'reference.png').convert('RGBA')),('animation-0',compose(-30,8)),('animation-1',compose(24,-4)),('reopened-animation-1',compose(24,-4))]
for name,im in expected:
 a=np.array(im).astype(np.int16);actual=Image.open(out/(name+'.png')).convert('RGBA');b=np.array(actual).astype(np.int16);delta=np.abs(a-b);p={'case':name,'size':list(actual.size),'maxChannelDelta':int(delta.max()),'meanChannelDelta':float(delta.mean()),'channelsOverTolerance':int((delta>2).sum()),'tolerance':2,'pass':bool(delta.max()<=2)};results.append(p);im.save(out/(name+'-expected.png'))
 (Image.fromarray(np.uint8(np.clip(delta[:,:,:3]*32,0,255)))).save(out/(name+'-difference-x32.png'))
a=np.array(Image.open(out/'animation-0.png'));b=np.array(Image.open(out/'animation-1.png'));diff=np.any(a!=b,axis=2);ys,xs=np.where(diff);bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
# All changed pixels must be in union of the two explicitly positioned subject rectangles.
allowed=np.zeros((H,W),dtype=bool);allowed[108:478,525:895]=True;allowed[96:466,579:949]=True
stableOutside=int(np.count_nonzero(diff&~allowed));results.append({'case':'animation-locality','changedPixels':int(diff.sum()),'changeBounds':bounds,'changesOutsideSubjectUnion':stableOutside,'pass':int(diff.sum())>10000 and stableOutside==0})
contact=Image.new('RGB',(1440,310),(25,27,30));d=ImageDraw.Draw(contact)
for i,(name,label) in enumerate([('reference','EXTERNAL REFERENCE'),('imported','SF IMPORT / FRAME 0'),('animation-1','SF ANIMATION / 1 SECOND')]):
 im=Image.open(root/'reference.png' if name=='reference' else out/(name+'.png')).convert('RGB');im=im.resize((480,270),Image.Resampling.LANCZOS);contact.paste(im,(i*480,30));d.text((i*480+12,10),label,fill='white')
contact.save(out/'visual-comparison.png');report={'pass':all(r['pass'] for r in results),'colorSpace':'sRGB encoded-byte source-over, RGBA8; not linear-light/HDR','toleranceReason':'same P3/P6 per-channel 2 for Canvas/PIL 8-bit alpha rounding; unchanged after actual results','results':results};(out/'visual-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert report['pass']
