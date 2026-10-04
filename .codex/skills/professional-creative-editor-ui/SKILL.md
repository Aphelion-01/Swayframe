---
name: professional-creative-editor-ui
description: Redesign and audit Swayframe's professional desktop creative editor, including its shell, canvas, timeline, graph, properties, assets and contextual AI. Use for editor UI work, not landing pages or general dashboards.
---

# Professional Creative Editor UI

Use this skill when adjusting this repository's editor. Apply it to working code and inspect the running result. Learn workspace organization and precise editing from AE, Figma, Blender, Resolve, Nuke, Cinema 4D and VS Code without copying their branding.

## Product and architecture

- Keep a stable global toolbar / left project-tools area / center composition / right properties / bottom timeline-curve-node dock. Canvas is the visual center; no floating core modules.
- Reuse `Workspace`, `Tabs`, `Section`, `IconButton`, `NumberField`, `TextField`, palette and menu primitives. Improve existing resizing, collapse, persistence and keyboard workflow rather than replacing state architecture.
- Scene mutations remain Command/Transaction operations. GUI and Agent share them; Intelligence emits Proposal. Preserve project format, media loading, IPC, save/load, undo/redo, shortcuts and render behavior.
- UI-only layout and tab preferences never enter Scene. Avoid broad subscriptions in static chrome.
- Audit the actual existing screens; do not invent a home, settings or AI chat screen that does not exist. Desktop startup, recovery, about, export and composition dialogs are part of the product.

## Visual system

- Professional tool first: medium-high density, quiet neutral dark surfaces, compact rows and controls. No dashboard cards, hero typography, giant buttons, excessive whitespace, gradients or glass effects.
- Hierarchy: application shell → workspace regions → panels → sections → controls → metadata. Make active workspace, selected object, canvas, properties, assets, time and AI entry recognizable.
- Use shared semantic tokens for primary/secondary/tertiary backgrounds, hover/active/selected, subtle/strong borders, primary/secondary/muted text, accent/hover, danger/warning/success. Named data colors can distinguish axes and node port types.
- Spacing scale: 2/4/6/8/12/16/24/32. Controls 24–28px; compact panel headers 28–32px; rows 26–30px. Prefer alignment and spacing over nested borders.
- Radius: controls 2–4px, panels 0, popovers 4–8px. Shadows only on floating surfaces. Avoid pills and decorative badges.
- Typography: 12px controls, 12px panel title with medium weight, 11px metadata, modest application title. Numeric values use tabular figures. Keep muted text readable and do not dim enabled controls as if disabled.
- Shared vector icons: 16px viewBox, consistent 1.5px stroke and alignment. No emoji tools, mixed glyph styles or extra icon dependency.
- Buttons distinguish primary, secondary, ghost, icon, toolbar, danger, toggle and segmented states. Accent is reserved for selection, active tools and primary action.
- Unify selected layer/node/asset/tool/tab language; inspect default, hover, pressed, selected, focus, disabled, loading and error.
- Motion is restrained 100–220ms for hover/menu feedback. Do not animate direct manipulation or playback; honor reduced motion.

## Region-specific checks

- Inspector: collapsible Transform, Appearance, Motion/Effects, Structure and Advanced sections as existing capabilities require. Align labels and values; vector axes retain link control, scalar values never acquire it. Preserve realtime preview and vertical value scrubbing.
- Canvas: composition boundary, zoom/pan/selection/snap/handles remain legible. Group viewport controls; metadata and side panels do not compete with artwork.
- Timeline: compact rows, layer hierarchy, precise ruler/playhead, classic diamond keyframes, selected/hover tracks, duration bars, scrolling and zoom. Do not change time math while styling.
- Nodes: compact header/ports, wires, readable categories and parameters, coherent selection, connection compatibility, dot grid, pan/zoom/search/alignment. Keep node geometry and hit targets synchronized. Only expose minimap/groups if implemented; do not invent decorative controls.
- Assets: reuse list rows and thumbnails, import/drop/relink states, truncation with full-name tooltip, selected feedback.
- AI: contextual assistant/command and Proposal execution preview, not a dominant chat window. Label simulation honestly; candidate applies only through existing Transaction validation.
- Menus/popovers/dialogs: keyboard navigation, Escape/outside dismissal, focus ownership/return, compact actions, no clipping. Loading/error/empty feedback must describe the next available action.

## Execution and validation

1. Map UI entrypoints, CSS, tokens and primitives. Read necessary source and run the actual app.
2. Record a P0/P1/P2/P3 audit with evidence: structural breakage / inconsistent hierarchy / interaction details / final polish.
3. Fix shell first, then shared primitives and every existing region. Keep changes incremental and reviewable.
4. Inspect 1280×720, 1440×900, 1920×1080 and 2560×1440. Handle narrow windows with resize/collapse/scroll and sensible minimums, not whole-interface scaling.
5. Run a second visual audit for alignment, spacing, proportions, typography, icons, hover and divider contrast. Fix found defects.
6. Run a third professional-tool audit: inspect density, canvas dominance, restrained surfaces and workflow with branding ignored. Remove remaining generic website styling.
7. Verify build/typecheck/lint/tests and real creation/select/transform/keyframe/curve/node/asset/save-load/undo workflows. Report measured outcomes and limits; screenshots do not prove untested desktop behavior.

## Repo pointers

`src/ui/App.tsx`, `src/ui/workspace/`, `src/ui/Toolbar.tsx`, `src/ui/Canvas.tsx`, `src/ui/Inspector.tsx`, `src/ui/Timeline.tsx`, `src/ui/CompositingGraph.tsx`, `src/ui/base.css`, `src/ui/compositing-graph.css`, `src/desktop/DesktopApp.tsx`.
