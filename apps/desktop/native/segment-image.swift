import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

func fail(_ message:String) throws -> Never { throw NSError(domain:"SFLocalSegmentation",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
func run() throws {
 guard CommandLine.arguments.count==2 else {try fail("Expected one local image file")}
 let url=URL(fileURLWithPath:CommandLine.arguments[1])
 guard let source=CGImageSourceCreateWithURL(url as CFURL,nil),CGImageSourceGetCount(source)==1 else {try fail("请选择完整的单帧 PNG / JPEG 照片")}
 guard let type=CGImageSourceGetType(source),[UTType.png.identifier,UTType.jpeg.identifier].contains(type as String) else {try fail("仅支持 PNG / JPEG 照片")}
 guard let props=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],let width=props[kCGImagePropertyPixelWidth] as? Int,let height=props[kCGImagePropertyPixelHeight] as? Int else {try fail("图片信息无法读取，文件可能已损坏")}
 guard width>0,height>0,width<=8192,height<=8192,width*height<=16_777_216 else {try fail("原图尺寸超限：单边最多8192，总像素最多16777216")}
 let options:[CFString:Any]=[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:1024,kCGImageSourceShouldCacheImmediately:true]
 guard let image=CGImageSourceCreateThumbnailAtIndex(source,0,options as CFDictionary) else {try fail("图片解码失败，请重新导出照片")}
 let w=image.width,h=image.height,color=CGColorSpace(name:CGColorSpace.sRGB)!
 var rgba=[UInt8](repeating:0,count:w*h*4)
 let rendered=rgba.withUnsafeMutableBytes { bytes -> Bool in
  guard let context=CGContext(data:bytes.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:color,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else {return false}
  context.draw(image,in:CGRect(x:0,y:0,width:w,height:h));return true
 }
 guard rendered else {try fail("sRGB conversion failed")}
 for i in stride(from:3,to:rgba.count,by:4) {if rgba[i] != 255 {try fail("请选择不透明的真实照片，不支持预先抠好的透明素材")}}
 let handler=VNImageRequestHandler(cgImage:image,options:[:]),request=VNGenerateForegroundInstanceMaskRequest()
 request.revision=VNGenerateForegroundInstanceMaskRequestRevision1
 let start=Date();try handler.perform([request])
 guard let result=request.results?.first,!result.allInstances.isEmpty else {try fail("未找到可分离的前景主体，请换一张主体更清晰的照片")}
 let buffer=try result.generateScaledMaskForImage(forInstances:result.allInstances,from:handler)
 guard CVPixelBufferGetWidth(buffer)==w,CVPixelBufferGetHeight(buffer)==h else {try fail("Mask size mismatch")}
 CVPixelBufferLockBaseAddress(buffer,.readOnly);defer{CVPixelBufferUnlockBaseAddress(buffer,.readOnly)}
 guard let base=CVPixelBufferGetBaseAddress(buffer) else {try fail("Mask unavailable")}
 let format=CVPixelBufferGetPixelFormatType(buffer),strideBytes=CVPixelBufferGetBytesPerRow(buffer)
 var alpha=[UInt8](repeating:0,count:w*h)
 for y in 0..<h {for x in 0..<w {
  if format==kCVPixelFormatType_OneComponent32Float {
   let value=base.advanced(by:y*strideBytes).assumingMemoryBound(to:Float.self)[x]
   guard value.isFinite else {try fail("Non-finite model alpha")}
   alpha[y*w+x]=UInt8((max(0,min(1,value))*255).rounded())
  } else if format==kCVPixelFormatType_OneComponent8 {alpha[y*w+x]=base.advanced(by:y*strideBytes).assumingMemoryBound(to:UInt8.self)[x]}
  else {try fail("Unsupported mask pixel format")}
 }}
 let data:[String:Any]=["width":w,"height":h,"originalWidth":width,"originalHeight":height,"rgba":Data(rgba).base64EncodedString(),"alpha":Data(alpha).base64EncodedString(),"instances":result.allInstances.count,"revision":request.revision,"seconds":Date().timeIntervalSince(start)]
 FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:data,options:[.sortedKeys]))
}
do {try run()} catch {fputs("本机分割失败： \(error.localizedDescription)\n",stderr);exit(1)}
