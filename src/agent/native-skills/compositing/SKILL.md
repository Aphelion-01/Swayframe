# Compositing Graph V1

Inspect real graph and typed ports. Generators stay detached until connected to Output; image processors insert into current Output edge. Inputs accept one connection. Preserve Source/Output invariants, reject cycles, compile and verify actual output. Never invent a Glow node name: query exact available capability.
