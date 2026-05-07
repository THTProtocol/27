
/**
 * htp-api-config.js — API origin + helper (merges with htp-config.js)
 */
window.HTP_CONFIG = window.HTP_CONFIG || {};
window.HTP_CONFIG.API_ORIGIN = window.HTP_CONFIG.API_ORIGIN || "https://hightable.duckdns.org";

window.htpApiUrl = function(path) {
  var origin = window.HTP_CONFIG.API_ORIGIN.replace(/\/+$/, '');
  if (path.charAt(0) !== '/') path = '/' + path;
  return origin + path;
};
