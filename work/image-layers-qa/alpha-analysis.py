from PIL import Image,ImageDraw,ImageOps
import numpy as np,json,hashlib
from pathlib import Path
root=Path('docs/qa/segmentation');records=json.loads((root/'generation.json').read_text());metrics=[];rows=[]
qc=root/'alpha';qc.mkdir(exist_ok=True)
for entry in records:
 name=entry['name'];pkg=Path(entry['directory']);analysis=Path(entry['analysisDirectory']);ref=Image.open(pkg/'reference.png').convert('RGBA');fg=Image.open(pkg/'layers/main-subject.png').convert('RGBA');bg=Image.open(pkg/'layers/background.png').convert('RGBA');mask=Image.open(analysis/'model-alpha.png').convert('L');r=np.array(ref);f=np.array(fg);b=np.array(bg);m=np.array(mask);h,w=m.shape;ys,xs=np.where(m>0)
 original=Image.open(root/'inputs'/f'{name}.png').convert('RGBA');src=np.array(original)
 preview=[]
 for mode,color in [('black',(0,0,0,255)),('white',(255,255,255,255)),('magenta',(255,0,255,255)),('checker',(160,160,160,255))]:
  canvas=Image.new('RGBA',(w,h),color)
  if mode=='checker':
   d=ImageDraw.Draw(canvas)
   for y in range(0,h,16):
    for x in range(0,w,16):
     if (x//16+y//16)%2:d.rectangle((x,y,x+15,y+15),fill=(230,230,230,255))
  merged=Image.alpha_composite(canvas,fg);merged.save(qc/f'{name}-subject-{mode}.png');preview.append(merged)
 Image.alpha_composite(Image.new('RGBA',(w,h),(180,180,180,255)),bg).save(qc/f'{name}-background-holes.png')
 recon=Image.alpha_composite(bg,fg);recon.save(qc/f'{name}-recombined.png')
 delta=np.abs(np.array(recon).astype(int)-r.astype(int));soft=(m>0)&(m<255);zero=f[:,:,3]==0
 result={'name':name,'width':w,'height':h,'foregroundBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'corePixels':int((m==255).sum()),'backgroundPixels':int((m==0).sum()),'uncertainEdgePixels':int(soft.sum()),'alphaLevels':int(np.unique(m).size),'nonzeroRGBUnderZeroAlpha':int(np.count_nonzero(f[zero,:3])),'rawAlphaPreserved':bool(np.array_equal(f[:,:,3],m)),'sourceOrientationAndRGBMaxDelta':int(np.abs(src.astype(int)-r.astype(int)).max()),'foregroundRGBMatchesSourceWhereAlphaNonzero':bool(np.array_equal(f[m>0,:3],r[m>0,:3])),'recombinedMaxChannelDelta':int(delta.max()),'halfTransparentPixels':int(((m>=64)&(m<=191)).sum()),'uncertainBackgroundPixelsRetained':int(np.count_nonzero(b[soft,3])),'inpainting':False,'hiddenPixelsGenerated':0,'groundTruthAvailable':False,'pixelAccuracyIsNotSegmentationAccuracy':True}
 metrics.append(result)
 thumbs=[]
 for im,label in [(ref,'INPUT'),(mask.convert('RGBA'),'RAW MODEL ALPHA'),(preview[0],'SUBJECT / BLACK'),(preview[1],'SUBJECT / WHITE'),(Image.open(qc/f'{name}-background-holes.png').convert('RGBA'),'BACKGROUND / HOLES')]:
  tile=Image.new('RGB',(240,270),(35,37,40));img=im.convert('RGB');img.thumbnail((240,240));tile.paste(img,((240-img.width)//2,25));ImageDraw.Draw(tile).text((5,5),label,fill='white');thumbs.append(tile)
 row=Image.new('RGB',(1200,270));
 for i,tile in enumerate(thumbs):row.paste(tile,(i*240,0))
 rows.append(row)
 # Preserve 4x nearest-neighbour crops for edge review, not a retouched output.
 box={'A-chelsea':(270,120,451,300),'B-astronaut':(100,0,350,200),'C-coffee':(330,10,500,180)}[name]
 crop=Image.new('RGB',(640,640),(50,50,50))
 for i,im in enumerate([ref,preview[0],preview[1],mask.convert('RGBA')]):
  part=im.crop(box).convert('RGB');part.thumbnail((160,160));part=part.resize((part.width*2,part.height*2),Image.Resampling.NEAREST);crop.paste(part,((i%2)*320,(i//2)*320))
 crop.save(qc/f'{name}-edge-inspection.png')
contact=Image.new('RGB',(1200,810));
for i,row in enumerate(rows):contact.paste(row,(0,i*270))
contact.save(qc/'real-image-contact.png');(root/'alpha-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics,indent=2))
