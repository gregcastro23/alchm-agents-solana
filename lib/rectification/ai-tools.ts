import { tool } from 'ai'
import {
  executeGeocodeLocationTool,
  executeRectifyApplyTool,
  executeRectifyScoreTool,
  executeRectifyWindowsTool,
  geocodeLocationInputSchema,
  rectifyApplyInputSchema,
  rectifyScoreInputSchema,
  rectifyWindowsInputSchema,
} from '@/lib/rectification/tool-handlers'

/**
 * Vercel AI SDK v5 tool wrappers for Monica chat routes so general/astrology
 * chat users can resolve cities, run Swiss Ephemeris EIG rectification, and save
 * their rectified Ascendant without leaving chat.
 */
export function getRectificationAiTools() {
  return {
    geocode_location: tool({
      description:
        'Convert a city/place name (e.g. "Chicago, IL", "Bangkok, Thailand") into latitude, longitude, IANA timezone, and clock-to-LMT offset minutes.',
      inputSchema: geocodeLocationInputSchema,
      execute: executeGeocodeLocationTool,
    }),
    rectify_windows: tool({
      description:
        'Scan 24-hour candidate rising sign windows for a birth date and birthplace (city string or lat/lon), returning sunrise/sunset LMT, Moon sign ingress minutes, entropy_bits, and EIG next_best_questions.',
      inputSchema: rectifyWindowsInputSchema,
      execute: executeRectifyWindowsTool,
    }),
    rectify_score: tool({
      description:
        'Run Bayesian Ascendant rectification across candidate birth minutes using diurnal clues, recorded times, and dated life events. Accepts either a city location or explicit lat/lon.',
      inputSchema: rectifyScoreInputSchema,
      execute: executeRectifyScoreTool,
    }),
    rectify_apply: tool({
      description:
        'Persist the authenticated user’s rectified Ascendant and working birth time to their profile and/or primary natal chart once eligible (>=70% top sign & <=180m window, or explicitly confirmed with allowUnconfirmed=true).',
      inputSchema: rectifyApplyInputSchema,
      execute: executeRectifyApplyTool,
    }),
  }
}
