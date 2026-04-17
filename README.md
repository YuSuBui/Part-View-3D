# PartView3D

Production-style 3D viewer built with Babylon.js + React + TypeScript.

## Live demo

**Production:** [https://part-view-3d.vercel.app/](https://part-view-3d.vercel.app/) (Vercel).

To deploy your own fork, see [Deployment notes](#deployment-notes) below.

## Local setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run lint
npm run build
npm run preview
```

## What is implemented

- Default model loads from `/models/car.glb`.
- 3D model loading with explicit loading and error states.
- Auto center and dynamic camera fit using model bounds.
- Smooth orbit + zoom controls with desktop and touch support.
- Reset view button and keyboard shortcut (`R`).
- Mesh picking selection with highlight layer.
- Click empty space (or `Esc`) clears the active selection.
- Info panel showing mesh name and additional attributes:
  - mapped metadata (`category`, `finish`, `notes`)
  - derived model values (`materialName`, `vertexCount`)
- Basic cleanup on unmount (event listeners, scene, engine, highlight layer).

## Approach and decisions

- `src/viewer/Viewer.ts` encapsulates Babylon engine/scene logic so UI stays clean.
- `HighlightLayer` is used for selection feedback to avoid destructive material swaps.
- Camera framing is derived from model bounds:
  - center from `boundingSphere.centerWorld`
  - fit radius from `boundingSphere.radiusWorld`, camera FOV, and dynamic padding
  - alpha/beta derived from model proportions (`x/y/z` spans)
  - zoom limits derived from fitted radius
- Camera snapshot is captured after fit so `Reset view` always returns to a valid framing.
- Metadata is resolved from part names using keyword mapping in `src/data/MetaData.ts`.

## Assumptions

- Main default model path is `/models/car.glb`.
- If part metadata is missing, viewer shows fallback labels rather than failing.

## Known limitations

- Metadata mapping is keyword-based and intentionally simple for this practical scope.
- Current UI focuses on a single default model flow (no model-switch dropdown).
- No debounced search/filter UI yet.
- No automated integration tests for mesh picking flow.

## What I would improve with more time

- Hover highlight + tooltip with throttled pointer picking.
- Search/filter by part name and focus camera on matched part.
- Performance stats toggle and optional lazy-loading compression pipeline.
- Add Playwright smoke tests for load/select/clear/reset interactions.

## Deployment notes

### Vercel

This project is deployed on [Vercel](https://vercel.com/). The live app is at [https://part-view-3d.vercel.app/](https://part-view-3d.vercel.app/).

To deploy from this repository:

1. Import the project into Vercel.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
