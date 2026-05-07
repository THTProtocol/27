/**
 * htp-api-config.js — SINGLE SOURCE OF TRUTH for API origin
 *
 * Every fetch() in the HTP frontend MUST go through window.htpApiUrl().
 * This file defines the ONE origin and ONE helper function.
 *
 * Loading order: load this BEFORE any HTP module that makes API calls.
 */

window.HTP_CONFIG = window.HTP_CONFIG || {};
window.HTP_CONFIG.API_ORIGIN = "https://hightable.duckdns.org";

/**
 * Build a full absolute URL for an HTP API endpoint.
 * Strips any trailing slash from the origin, ensures path starts with "/".
 *
 * Usage:
 *   fetch(window.htpApiUrl("/api/stats"))
 *   fetch(window.htpApiUrl("/api/games"), { method: "POST", body: ... })
 */
window.htpApiUrl = function(path) {
  var origin = window.HTP_CONFIG.API_ORIGIN.replace(/\/+$/, '');
  if (path.charAt(0) !== '/') path = '/' + path;
  return origin + path;
};
