from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib
root=Path('docs/qa/external-ai'); result=json.loads((root/'p7-result.json').read_text()); subject=Image.open(Path(result['directory'])/'layers/main-subject.png').convert('RGBA')
pkg=root/'composition';(pkg/'layers').mkdir(parents=True,exist_ok=True);w,h=960,540
p=np.zeros((h,w,4),dtype=np.uint8);yy,xx=np.mgrid[0:h,0:w];glow=np.exp(-((xx-740)**2/(310**2)+(yy-270)**2/(260**2)))
for i,(base,rise) in enumerate([(7,4),(14,18),(26,27)]):p[:,:,i]=(base+rise*glow).astype(np.uint8)
p[:,:,3]=255;bg=Image.fromarray(p);d=ImageDraw.Draw(bg)
for x in range(0,w,40):d.line((x,0,x,h),fill=(13,27,42,255))
for y in range(0,h,40):d.line((0,y,w,y),fill=(13,27,42,255))
D=Image.new('RGBA',(w,h));d=ImageDraw.Draw(D);cyan=(78,219,239,255);muted=(48,112,143,150)
d.ellipse((568,83,928,443),outline=muted,width=2);d.arc((551,66,945,460),205,285,fill=cyan,width=3);d.arc((551,66,945,460),-10,65,fill=cyan,width=3)
for x,y,sx,sy in [(40,40,1,1),(920,40,-1,1),(40,500,1,-1),(920,500,-1,-1)]:
 d.line((x,y,x+22*sx,y),fill=cyan,width=2);d.line((x,y,x,y+22*sy),fill=cyan,width=2)
d.line((76,119,176,119),fill=cyan,width=3);d.line((76,397,400,397),fill=muted,width=1)
for x in range(76,230,12):d.line((x,425,x,431),fill=cyan,width=1)
fontpath='/System/Library/Fonts/Supplemental/Arial Bold.ttf';regular='/System/Library/Fonts/Supplemental/Arial.ttf';title=Image.new('RGBA',(495,274));d=ImageDraw.Draw(title)
d.text((0,0),'[ 01 ]   /   FLIGHT SYSTEMS',font=ImageFont.truetype(regular,14),fill=(78,219,239,255))
d.text((0,45),'ORBIT',font=ImageFont.truetype(fontpath,76),fill=(231,243,250,255));d.text((0,123),'SYSTEMS',font=ImageFont.truetype(fontpath,67),fill=(78,219,239,255))
d.text((2,224),'ENGINEERING THE NEXT HORIZON',font=ImageFont.truetype(regular,14),fill=(158,184,203,255))
subject=subject.convert('RGBa').resize((370,370),Image.Resampling.LANCZOS).convert('RGBA')
records=[('background','Background',bg,0,0),('decoration','Circuit accents',D,0,0),('subject','Main Subject',subject,555,100),('title','Title — ORBIT SYSTEMS (Raster)',title,76,137)]
manifest={'format':'swayframe.layerpack','version':1,'canvas':{'width':w,'height':h},'colorSpace':'srgb','alphaMode':'straight','order':'bottom-to-top','layers':[]};ref=Image.new('RGBA',(w,h))
for ident,name,im,x,y in records:
 im.save(pkg/'layers'/f'{ident}.png');manifest['layers'].append({'id':ident,'name':name,'type':'raster','asset':f'layers/{ident}.png','bounds':{'x':x,'y':y,'width':im.width,'height':im.height},'opacity':1});ref.alpha_composite(im,(x,y))
(pkg/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');ref.save(pkg/'reference.png');ref.save(root/'reference.png')
(root/'design-provenance.json').write_text(json.dumps({'creator':'Codex file-capable external AI tool; deterministic local artwork, no paid model','subject':'Fresh P7 Apple Vision from NASA astronaut photograph; grouped instance; no inpainting','sourceSha256':hashlib.sha256((root/'source.png').read_bytes()).hexdigest(),'title':'Explicit authored ORBIT SYSTEMS, rasterized Arial Bold; no OCR or native-text reconstruction','font':fontpath,'canvas':[w,h],'subjectResize':'370x370 premultiplied filtering, PNG stored straight-alpha','hiddenBackgroundRestoration':False,'layers':[r[:2] for r in records],'license':'NASA input as documented in P7; Apple output restrictions retained; no model training'},indent=2)+'\n')
print('External artwork: 4 real RGBA PNG layers, 960x540 reference, standard P3 manifest')
