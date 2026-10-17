# 0.9.30 recovery evidence runner

Normal offline checks are npm run lint, npm run typecheck, npm test, npm run desktop:build. Recovery regression tests use actual registry / CommandSystem / AgentTransaction; scripted model outputs and injected failures are explicitly fixtures.

Paid runners require an explicitly authorized budget. main.ts / renderer.ts seed three controlled failures; main-free.ts / renderer-free.ts continue the same ledger with one freely planned task. Never delete/overwrite live-calls.json to restart a paid batch. main.ts refuses existing ledger; main-free.ts requires exactly three retained calls and three retained tasks. Hard maximum six attempts, prospective UTF-8 input-byte upper bound plus per-request framing reserve <=300000, max_tokens=2000 injected into each actual native wire request, so total output ceiling <=12000. ProviderManager failover is disabled in the runner; no images leave the machine. NativeAIService reads secure credentials; no raw keys enter source or output files.

Build main*.ts with local esbuild --bundle --platform=node --format=cjs --external:electron; renderer*.ts --bundle --platform=browser --format=iife. The two HTML files refer to the respective renderer bundles. Run local Electron on the compiled main. Generated bundles/profiles/caches remain excluded from Git. Calls, Sessions, saved Scenes and actual rendered PNGs are recorded under outputs/autonomous-recovery-030. First adapter-only failures are retained separately and never described as remote provider requests.

packaged-smoke.cjs loads real Mac app.asar with isolated userData and creates a blank project; no API call or user-project mutation. It does not claim Windows runtime verification.
