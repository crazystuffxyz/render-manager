'use strict';

/**
 * Escapes a selector for safe embedding inside a CSS rule. Real escaping
 * of arbitrary selectors is not meaningful (selectors aren't string
 * literals), but we do need to guard against control characters / stray
 * braces that could break out of the rule body.
 */
function sanitizeSelector(selector) {
  return String(selector).replace(/[{}]/g, '');
}

/**
 * Given the parsed filter data and a hostname, builds the full CSS text
 * that should be injected into the page to hide ad/annoyance elements.
 *
 * Each selector becomes its own rule so that one invalid/unsupported
 * selector can't break the rest of the stylesheet (browsers drop an
 * entire rule on a parse error, but only that one rule, when each
 * selector gets its own `{ }` block).
 */
function buildCss({ globalCssSelectors = [], domainSpecificCss = {}, domainCssExceptions = {} }, hostname) {
  const exceptedForHost = new Set();
  if (hostname) {
    const parts = hostname.split('.');
    let cursor = parts;
    while (cursor.length > 0) {
      const candidate = cursor.join('.');
      const excepted = domainCssExceptions[candidate];
      if (excepted) excepted.forEach((sel) => exceptedForHost.add(sel));
      cursor = cursor.slice(1);
    }
  }

  const rules = [];
  const seen = new Set();

  const addSelector = (selector) => {
    const clean = sanitizeSelector(selector);
    if (!clean || seen.has(clean) || exceptedForHost.has(selector)) return;
    seen.add(clean);
    rules.push(`${clean} { display: none !important; }`);
  };

  globalCssSelectors.forEach(addSelector);

  if (hostname) {
    const parts = hostname.split('.');
    let cursor = parts;
    while (cursor.length > 0) {
      const candidate = cursor.join('.');
      const domainRules = domainSpecificCss[candidate];
      if (domainRules) domainRules.forEach(addSelector);
      cursor = cursor.slice(1);
    }
  } else {
    // No hostname given: include every domain-specific rule too, so a
    // generic "cleanCSS" export is still maximally useful standalone.
    Object.values(domainSpecificCss).forEach((selectors) => selectors.forEach(addSelector));
  }

  return rules.join('\n');
}

/**
 * Returns the array of raw (un-prefixed) selectors that apply to a given
 * hostname — used by cleanHTML so it can hide/remove matching elements
 * via Cheerio without needing a CSS parser.
 */
function selectorsForHostname({ globalCssSelectors = [], domainSpecificCss = {}, domainCssExceptions = {} }, hostname) {
  const exceptedForHost = new Set();
  if (hostname) {
    let cursor = hostname.split('.');
    while (cursor.length > 0) {
      const candidate = cursor.join('.');
      const excepted = domainCssExceptions[candidate];
      if (excepted) excepted.forEach((sel) => exceptedForHost.add(sel));
      cursor = cursor.slice(1);
    }
  }

  const result = new Set();
  globalCssSelectors.forEach((sel) => {
    if (!exceptedForHost.has(sel)) result.add(sel);
  });

  if (hostname) {
    let cursor = hostname.split('.');
    while (cursor.length > 0) {
      const candidate = cursor.join('.');
      const domainRules = domainSpecificCss[candidate];
      if (domainRules) {
        domainRules.forEach((sel) => {
          if (!exceptedForHost.has(sel)) result.add(sel);
        });
      }
      cursor = cursor.slice(1);
    }
  }

  return Array.from(result);
}

export { buildCss, selectorsForHostname, sanitizeSelector };