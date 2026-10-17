# Keyframe Animation V1

Use actual layer Property paths or inspected property IDs. Times in seconds within duration. Validate keyframe values and shared interpolation/motion-curve format. Verify endpoints and evaluation. Local changes preserve unrelated text and animation.

For standard timing use animateLayerProperty easing=linear/easeIn/easeOut/easeInOut (host native presets). An explicit bezier interpolation stores BOTH control points of the outgoing normalized segment. Never assign incoming y=0 to the first key and outgoing y=1 to the second: that does not produce ease-in-out. Verify midpoint as well as endpoints.
