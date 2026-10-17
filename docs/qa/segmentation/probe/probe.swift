import Foundation
import Vision
import AppKit
import CoreImage
let input=URL(fileURLWithPath:CommandLine.arguments[1]),output=URL(fileURLWithPath:CommandLine.arguments[2])
let handler=VNImageRequestHandler(url:input,options:[:]);let request=VNGenerateForegroundInstanceMaskRequest()
let start=Date()
do {
 try handler.perform([request]);guard let result=request.results?.first else {throw NSError(domain:"NoMask",code:1)}
 let mask=try result.generateScaledMaskForImage(forInstances:result.allInstances,from:handler)
 let ci=CIImage(cvPixelBuffer:mask);let context=CIContext(options:[.workingColorSpace:CGColorSpace(name:CGColorSpace.sRGB)!])
 try context.writePNGRepresentation(of:ci,to:output,format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!)
 print("instances=\(result.allInstances.count) seconds=\(Date().timeIntervalSince(start)) size=\(CVPixelBufferGetWidth(mask))x\(CVPixelBufferGetHeight(mask))")
} catch {fputs("\(error)\n",stderr);exit(1)}
