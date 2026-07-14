// cproxy/adblock.js
'use strict';

import { FilterStore } from './adblock/filterStore.js';
import { createIsAllowed } from './adblock/urlMatcher.js';
import { buildCss } from './adblock/cssBuilder.js';
import { createCleanHTML } from './adblock/cleanHtml.js';

const store = new FilterStore();

function isEnabled() {
  return process.env.ADBLOCK !== 'false' && process.env.ADBLOCK !== '0';
}

const _isAllowed = createIsAllowed(() => store.blockedDomainSet);

/**
 * isAllowed(url): boolean
 *
 * Accepts either a full URL ("https://ads.example.com/x") or a bare
 * hostname ("ads.example.com"). Returns:
 *   true  -> the url/hostname is allowed (not on the blocklist)
 *   false -> the url/hostname is blocked
 *
 * Synchronous — reads from the in-memory cache populated by refresh().
 */
const isAllowed = (url) => isEnabled() ? _isAllowed(url) : true;

const _cleanHTML = createCleanHTML({
  getFilterData: () => store.data,
  isAllowed: _isAllowed,
});

/**
 * cleanHTML($): mutates and returns the given Cheerio instance, removing
 * elements matched by cosmetic filter rules and elements that reference
 * blocked-domain resources.
 *
 * Usage:
 *   const cheerio = require('cheerio');
 *   const { cleanHTML } = require('adblock-module');
 *   const $ = cheerio.load(html);
 *   cleanHTML($, { hostname: 'www.example.com' }); // hostname optional
 *
 * Synchronous — reads from the in-memory cache populated by refresh().
 */
const cleanHTML = ($, options) => isEnabled() ? _cleanHTML($, options) : $;

/**
 * getCleanCSS([hostname]): string
 *
 * Returns a fresh CSS string built from the *current* in-memory filter
 * data. Use this if you want domain-specific selectors mixed in (pass
 * the requesting page's hostname), or if you want a guarantee you're
 * always reading live data rather than a possibly-stale snapshot.
 */
function getCleanCSS(hostname) {
  return isEnabled() ? buildCss(store.data, hostname || null) : "";
}

/**
 * cleanCSS: string
 *
 * A plain string containing the global (non-domain-specific) cosmetic
 * CSS rules, ready to drop into a <style> tag or serve as a stylesheet
 * response. Exported as `module.exports.cleanCSS`.
 *
 * IMPORTANT CAVEAT: like any plain exported string, this is a snapshot.
 * It is set once at require-time and reassigned every time `refresh()`
 * resolves (via `module.exports.cleanCSS = ...`). If your code does:
 *
 *     const { cleanCSS } = require('adblock-module');
 *
 * ...at the top of a long-lived file, that local binding will be the
 * value at the moment of that `require()` call and will NOT update
 * after a later `refresh()`. For a reverse proxy that calls `refresh()`
 * periodically, prefer reading `require('adblock-module').cleanCSS` (or
 * call `getCleanCSS()`) at request time instead of destructuring it once
 * at startup.
 */
function updateCleanCSSExport() {
  cleanCSS = isEnabled() ? buildCss(store.data, null) : "";
}

/**
 * Triggers a network fetch + parse of all uBO filter lists and updates
 * the live cache used by isAllowed/cleanHTML/cleanCSS. Call this once at
 * startup and `await` it before serving traffic, then optionally call
 * `startAutoRefresh()` to keep it warm.
 */
/**
 * Triggers a network fetch + parse of all uBO filter lists and updates
 * the live cache used by isAllowed/cleanHTML/cleanCSS.
 */
/**
 * Triggers a network fetch + parse of all uBO filter lists and updates
 * the live cache used by isAllowed/cleanHTML/cleanCSS.
 */
async function refresh(options) {
  if (!isEnabled()) return store.data;

  const result = await store.refresh(options);
  updateCleanCSSExport();
  
  // FIX: Read the merged total from store.data instead of result
  console.log(
    `[adblock] Filters updated successfully. ` +
    `Total blocked domains: ${store.data.blockedDomains.length}, ` +
    `Global CSS rules: ${store.data.globalCssSelectors.length}`
  );
  
  return result;
}

/**
 * Starts a periodic background refresh (default every 12h). Returns a
 * function you can call to stop it (e.g. on graceful shutdown).
 */
function startAutoRefresh(intervalMs, options) {
  if (!isEnabled()) return () => {};

  store.stopAutoRefresh();
  store.refreshTimer = setInterval(() => {
    store.refresh(options)
      .then(() => {
        updateCleanCSSExport();
        // FIX: Read the merged total from store.data
        console.log(
          `[adblock] Background filters updated successfully. ` +
          `Total blocked domains: ${store.data.blockedDomains.length}`
        );
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`[adblock] Background refresh failed: ${error.message}`);
      });
  }, intervalMs || 12 * 60 * 60 * 1000);
  return () => store.stopAutoRefresh();
}

function stopAutoRefresh() {
  store.stopAutoRefresh();
}

/** Whether filter data has been loaded at least once (from disk or network). */
function isReady() {
  return isEnabled() ? store.isReady() : true;
}

/** Returns a snapshot of internal stats — useful for a /status endpoint. */
function getStats() {
  if (!isEnabled()) {
    return {
      blockedDomainCount: 0,
      exceptionDomainCount: 0,
      globalCssSelectorCount: 0,
      domainsWithSpecificCssCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }
  const { blockedDomains, exceptionDomains, globalCssSelectors, domainSpecificCss, generatedAt } = store.data;
  return {
    blockedDomainCount: blockedDomains.length,
    exceptionDomainCount: exceptionDomains.length,
    globalCssSelectorCount: globalCssSelectors.length,
    domainsWithSpecificCssCount: Object.keys(domainSpecificCss).length,
    generatedAt,
  };
}

/**
 * Loads pre-fetched filter data directly into the store, bypassing the
 * network fetch. Primarily useful for tests, or for callers who want to
 * fetch+parse filters themselves (e.g. from a different source) and just
 * use this module's matching/cleaning logic.
 */
function loadData(data) {
  if (!isEnabled()) return;
  store.loadData(data);
  updateCleanCSSExport();
}
export let cleanCSS = isEnabled() ? buildCss(store.data, null) : "";
export default {
  isAllowed,
  cleanHTML,
  cleanCSS,
  getCleanCSS,
  refresh,
  startAutoRefresh,
  stopAutoRefresh,
  isReady,
  getStats,
  loadData,
  // internal — exposed for advanced use / testing
  _store: store,
};