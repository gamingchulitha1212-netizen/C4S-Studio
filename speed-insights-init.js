/**
 * C4S STUDIO — Vercel Speed Insights Integration
 * Tracks web performance and vitals for optimization
 */

import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights with optimal configuration
injectSpeedInsights({
  debug: false, // Set to true for development debugging
  sampleRate: 1, // Track 100% of page loads (adjust as needed)
  beforeSend: (event) => {
    // Optional: Modify or filter events before sending
    // Return null to cancel the event
    return event;
  }
});

console.log('✅ Vercel Speed Insights initialized');
