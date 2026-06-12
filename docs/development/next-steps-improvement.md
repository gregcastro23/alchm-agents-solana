# 🌌 Planetary Agents: Next Steps & Project Improvement

This document outlines the comprehensive next steps for the Planetary Agents platform based on the latest codebase audit. Following the resolution of the critical bugs (Council Crash, CORS issues, Dashboard loading), the focus now shifts to completing the migration to the Railway backend, restoring missing features, and deepening the personalized temporal features.

---

## 🚨 Backend Feature Restoration (WTEN/Railway)

The migration to the unified FastAPI backend (`whattoeatnext-production`) is mostly stable, but several data points are currently being "mocked" or defaulting to neutral values on the frontend due to missing backend endpoints.

### 1. Elemental & Modality Decomposition

**Issue**: Components like `/me/page.tsx` and `temporal-client.tsx` currently inject neutral fallback data (e.g., all 1s or random weights) for Fire, Water, Air, and Earth elements.
**Findings**:

- The backend does not currently return `Total Effect Value` or `Dominant Element/Modality`.
- **Action**: Update the WTEN backend to expose the full elemental decomposition in its alchemical calculations. Once exposed, remove the `TODO` placeholders in the Next.js `alchemize` endpoints and `MeClient`.

### 2. SVG Natal Wheel Rendering

**Issue**: The Temporal Client and `HistoricalCouncilChat` are missing visual natal charts.
**Findings**:

- `fetchWheelForBirth` in `temporal-client.tsx` currently returns an empty object because the Railway backend no longer renders SVG natal wheels.
- **Action**: Develop or restore a `chart-image` endpoint on the backend and wire it back up to the Next.js UI to gracefully render SVGs or image URLs.

### 3. Batch API Enhancements

**Issue**: The Alchemical Trainer (`lib/monica/alchemical-trainer.ts`) uses a batch API that is missing planetary hour data.
**Action**: Add planetary hour and daytime boolean calculations to the batch `/api/tokens/calculate` or `kinetics-client.ts` endpoints.

---

## 🎨 UI/UX & Temporal Enhancements

### 1. Philosopher's Stone Integration

**Issue**: The Temporal Delta tracking system is initialized but largely relies on simplified approximations for synastry.
**Enhancement**:

- The `SynastryAnalysisEngine` calculates elemental/modal profiles based purely on the Sun sign instead of the full chart geometry.
- Upgrade the `createSynastryChartSkeleton` in `temporal-client.tsx` to utilize exact planetary geometries when the backend exposes full aspect data.

### 2. Live Consciousness Visualization (Monica Constant)

**Issue**: The `Monica Constant (A-Number)` is foundational but lacks historical plotting.
**Enhancement**:

- Implement trend line visualization in the `/dashboard` to show how a user's Monica Constant fluctuates over time alongside planetary transits.

---

## 🛠️ Technical Debt & Infrastructure

### 1. TypeScript & Build Cache Cleanliness

**Issue**: `yarn typecheck` occasionally fails due to ghost files in the `.next/types` directory (e.g., referencing a deleted `app/api/alchmize` route instead of the renamed `alchemize`).
**Action**:

- Run a deep clean of the Next.js build cache (`rm -rf .next`).
- Perform a thorough sweep of any residual imports pointing to deprecated `alchmize` spellings.

### 2. Test Coverage & Deprecation Cleanup

**Issue**: The unit tests for the Chat System are passing flawlessly, but `localStorage` mock warnings persist in the console.
**Action**:

- Add a proper `localStorage` mock to `vitest.unit.config.ts`.
- Remove legacy fallback code blocks (e.g., `useLegacyFallback: true`) in `alchemical-trainer.ts` once the synchronized `VSOP87` engine in WTEN is proven 100% reliable across all timezones.

---

## 📈 Roadmap for Next Sprint

1. **Backend Upgrade**: Expose Elemental/Modality data and SVG wheels on the WTEN Python backend.
2. **Frontend Wiring**: Remove mock fallbacks in `/me` and `temporal-client.tsx` to consume the new live data.
3. **Build Hardening**: Clear the `.next` cache and fix all lingering TypeScript/import anomalies.
4. **Synastry Deepening**: Enhance the Philosopher's Stone integration to use true planetary aspects rather than Sun-sign approximations.

---

_Documented on May 16, 2026_
