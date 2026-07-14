'use strict';

import { selectorsForHostname } from './cssBuilder.js';

// Attributes across common elements that can carry a URL we should check
// against the blocklist.
const URL_BEARING_ATTRS = [
  ['script', 'src'],
  ['iframe', 'src'],
  ['img', 'src'],
  ['img', 'data-src'],
  ['link[rel="stylesheet"]', 'href'],
  ['source', 'src'],
  ['embed', 'src'],
  ['object', 'data'],
];

/**
 * Removes elements matching a cosmetic selector. uBO ships some selectors
 * that aren't valid CSS-select syntax (or that Cheerio's css-select can't
 * parse), so each selector is applied in isolation inside a try/catch —
 * exactly mirroring the "one bad rule shouldn't break everything else"
 * approach used for the injected <style> tag.
 */
function applyCosmeticSelectors($, selectors) {
  let removed = 0;
  for (const selector of selectors) {
    try {
      const matches = $(selector);
      if (matches.length) {
        removed += matches.length;
        matches.remove();
      }
    } catch (_) {
      // Selector unsupported by css-select — skip silently, same
      // tolerance policy as the browser-side CSSOM injection.
    }
  }
  return removed;
}

/**
 * Removes elements whose src/href/data points at a blocked domain.
 */
function applyNetworkRules($, isAllowedFn) {
  let removed = 0;
  for (const [selector, attr] of URL_BEARING_ATTRS) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const value = $el.attr(attr);
      if (value && !isAllowedFn(value)) {
        $el.remove();
        removed += 1;
      }
    });
  }
  return removed;
}

/**
 * Strips inline <script> tags that reference well-known ad/analytics
 * loader patterns the network list wouldn't catch (since inline scripts
 * have no `src` to test against the domain blocklist). This is a small,
 * conservative, high-precision list — intentionally not "boil the
 * ocean" here, because false positives on inline scripts can break a
 * page's own functionality.
 */
const INLINE_SCRIPT_PATTERNS = [
  /googletagmanager\.com\/gtag\/js/i,
  /googlesyndication\.com/i,
  /doubleclick\.net/i,
  /google-analytics\.com\/analytics\.js/i,
  /connect\.facebook\.net\/.*\/fbevents\.js/i,
];

function applyInlineScriptHeuristics($) {
  let removed = 0;
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    if (INLINE_SCRIPT_PATTERNS.some((re) => re.test(content))) {
      $(el).remove();
      removed += 1;
    }
  });
  return removed;
}

/**
 * Removes now-empty cosmetic shells commonly used as ad wrapper divs
 * (e.g. <div class="ad-slot"></div> left behind after its contents were
 * stripped). Conservative: only removes elements that are completely
 * empty (no text, no element children) AND carry a strong ad-related
 * class/id signal, so we don't eat legitimate empty layout elements.
 */
const AD_CONTAINER_HINT = /\b(ad|ads|advert|advertisement|sponsor|banner)\b/i;

function pruneEmptyAdShells($) {
  let removed = 0;
  // Run a couple of passes since removing a child can make its parent
  // newly-empty.
  for (let pass = 0; pass < 3; pass += 1) {
    let changedThisPass = false;
    $('div,section,aside,ins').each((_, el) => {
      const $el = $(el);
      const isEmpty = $el.children().length === 0 && $el.text().trim() === '';
      if (!isEmpty) return;
      const idAndClass = `${$el.attr('id') || ''} ${$el.attr('class') || ''}`;
      if (AD_CONTAINER_HINT.test(idAndClass)) {
        $el.remove();
        removed += 1;
        changedThisPass = true;
      }
    });
    if (!changedThisPass) break;
  }
  return removed;
}

/**
 * Builds the cleanHTML(cheerio$) function bound to a live filter store
 * and isAllowed predicate. Returns a SYNCHRONOUS function, as requested:
 * it mutates the given Cheerio instance in place and also returns it for
 * convenient chaining.
 *
 * @param {object} deps
 * @param {() => object} deps.getFilterData - returns current parsed filter data
 * @param {(url: string) => boolean} deps.isAllowed
 * @param {(hostname?: string|null) => void} [deps.hostnameHint] - unused, reserved
 */
function createCleanHTML({ getFilterData, isAllowed }) {
  /**
   * @param {import('cheerio').CheerioAPI} $ a Cheerio instance, e.g.
   *   const cheerio = require('cheerio');
   *   const $ = cheerio.load(html);
   * @param {object} [options]
   * @param {string} [options.hostname] hostname the HTML was served from,
   *   used to additionally apply domain-specific cosmetic rules. If
   *   omitted, only global cosmetic rules + network rules are applied.
   * @returns {import('cheerio').CheerioAPI} the same $ instance, mutated
   */
  return function cleanHTML($, options = {}) {
    if (!$ || typeof $ !== 'function') {
      throw new TypeError('cleanHTML expects a Cheerio instance (the $ returned by cheerio.load())');
    }

    const filterData = getFilterData();
    const hostname = options.hostname || null;
    const selectors = selectorsForHostname(filterData, hostname);

    const stats = {
      cosmeticRemoved: applyCosmeticSelectors($, selectors),
      networkRemoved: applyNetworkRules($, isAllowed),
      inlineScriptRemoved: applyInlineScriptHeuristics($),
      emptyShellsRemoved: 0,
    };
    stats.emptyShellsRemoved = pruneEmptyAdShells($);

    // Expose stats for callers who want telemetry, without changing the
    // documented return type ($ itself remains the primary return value).
    $.__adblockStats = stats;

    return $;
  };
}

export { createCleanHTML, applyCosmeticSelectors, applyNetworkRules, applyInlineScriptHeuristics, pruneEmptyAdShells };