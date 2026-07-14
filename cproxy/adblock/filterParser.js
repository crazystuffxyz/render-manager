'use strict';

import axios from 'axios';

const UBLOCK_FILES = [
  'annoyances-cookies.txt', 'annoyances-others.txt', 'annoyances.txt',
  'badlists.txt', 'badware.txt', 'experimental.txt',
  'filters-2020.txt', 'filters-2021.txt', 'filters-2023.txt',
  'filters-2024.txt', 'filters-2025.txt', 'filters-2026.txt',
  'filters-general.txt', 'filters-mobile.txt', 'filters.txt',
  'lan-block.txt', 'legacy.txt', 'privacy-removeparam.txt',
  'privacy.txt', 'quick-fixes.txt', 'resource-abuse.txt',
  'ubo-link-shorteners.txt', 'ubol-filters.txt', 'unbreak.txt',
];

const BASE_URL =
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/refs/heads/master/filters/';

// Essential domains that should never be blocked entirely at the domain/subdomain level
const PROTECTED_DOMAINS = new Set([
  'google.com',
  'google.co.uk',
  'google.ca',
  'google.de',
  'tailwindcss.com',
  'github.com',
  'cloudflare.com',
  'unpkg.com',
  'jsdelivr.net',
  'cdnjs.cloudflare.com',
]);

/**
 * Checks if a parsed domain or its parent domain is part of the protected list.
 */
function isProtectedDomain(domain) {
  let parts = domain.split('.');
  while (parts.length >= 2) {
    const candidate = parts.join('.');
    if (PROTECTED_DOMAINS.has(candidate)) return true;
    parts.shift();
  }
  return false;
}

const UBO_EXTENDED_SYNTAX = /:has\(|:has-text\(|:xpath\(|:matches-css|:upward\(|:min-text-length\(|:others\(|:if\(|:if-not\(|:remove\(|:style\(|:watch-attr\(|:matches-attr\(|:matches-prop\(/i;

function isPlainCssSelector(selector) {
  if (!selector) return false;
  if (UBO_EXTENDED_SYNTAX.test(selector)) return false;
  if (selector.includes('+js(')) return false;
  return true;
}

function parseLine(rawLine) {
  const line = rawLine.trim();

  if (!line || line.startsWith('!') || line.startsWith('[')) return null;
  if (line.includes('+js(') || UBO_EXTENDED_SYNTAX.test(line)) return null;

  const cosmeticIdx = line.indexOf('#@#');
  const isCosmeticException = cosmeticIdx !== -1;
  const plainCosmeticIdx = isCosmeticException ? -1 : line.indexOf('##');

  if (isCosmeticException || plainCosmeticIdx !== -1) {
    const splitAt = isCosmeticException ? cosmeticIdx : plainCosmeticIdx;
    const sep = isCosmeticException ? '#@#' : '##';
    const domainsPart = line.slice(0, splitAt);
    const selector = line.slice(splitAt + sep.length);

    if (!selector || !isPlainCssSelector(selector)) return null;

    const domains = domainsPart
      ? domainsPart.split(',').map((d) => d.trim()).filter(Boolean)
      : [];

    return {
      type: isCosmeticException ? 'cosmetic-exception' : 'cosmetic',
      domains,
      selector,
    };
  }

  const isException = line.startsWith('@@');
  const body = isException ? line.slice(2) : line;

  // FIX: Removed '/' from the character boundary class ([\^?$] instead of [\^/?$])
  // This ensures that rules containing paths (like ||google.com/pagead) are ignored
  const domainMatch = body.match(/^\|\|([a-zA-Z0-9.-]+)(?:[\^?$]|$)/);
  if (domainMatch) {
    return {
      type: isException ? 'network-exception' : 'network',
      domain: domainMatch[1].toLowerCase(),
    };
  }

  return null;
}

async function fetchAndParseFilters(options = {}) {
  const files = options.files || UBLOCK_FILES;
  const baseUrl = options.baseUrl || BASE_URL;

  const blockedDomains = new Set();
  const exceptionDomains = new Set();
  const globalCssSelectors = new Set();
  const domainSpecificCss = {};
  const domainCssExceptions = {};

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      const response = await axios.get(baseUrl + file, { timeout: 30000 });
      const lines = String(response.data).split('\n');

      for (const rawLine of lines) {
        const parsed = parseLine(rawLine);
        if (!parsed) continue;

        switch (parsed.type) {
          case 'network':
            // Check domain protection to prevent critical false positives
            if (!isProtectedDomain(parsed.domain)) {
              blockedDomains.add(parsed.domain);
            }
            break;
          case 'network-exception':
            exceptionDomains.add(parsed.domain);
            break;
          case 'cosmetic':
            if (parsed.domains.length === 0) {
              globalCssSelectors.add(parsed.selector);
            } else {
              for (const dom of parsed.domains) {
                if (dom.startsWith('~')) continue;
                if (!domainSpecificCss[dom]) domainSpecificCss[dom] = new Set();
                domainSpecificCss[dom].add(parsed.selector);
              }
            }
            break;
          case 'cosmetic-exception':
            for (const dom of parsed.domains) {
              const clean = dom.startsWith('~') ? dom.slice(1) : dom;
              if (!domainCssExceptions[clean]) domainCssExceptions[clean] = new Set();
              domainCssExceptions[clean].add(parsed.selector);
            }
            break;
          default:
            break;
        }
      }

      if (options.onProgress) options.onProgress(file, i + 1, files.length);
    } catch (error) {
      console.error(`[adblock] Failed to fetch ${file}: ${error.message}`);
    }
  }

  for (const exceptedDomain of exceptionDomains) {
    blockedDomains.delete(exceptedDomain);
  }

  const serializedDomainCss = {};
  for (const [dom, set] of Object.entries(domainSpecificCss)) {
    serializedDomainCss[dom] = Array.from(set);
  }
  const serializedDomainCssExceptions = {};
  for (const [dom, set] of Object.entries(domainCssExceptions)) {
    serializedDomainCssExceptions[dom] = Array.from(set);
  }

  return {
    blockedDomains: Array.from(blockedDomains).sort(),
    exceptionDomains: Array.from(exceptionDomains).sort(),
    globalCssSelectors: Array.from(globalCssSelectors).sort(),
    domainSpecificCss: serializedDomainCss,
    domainCssExceptions: serializedDomainCssExceptions,
    generatedAt: new Date().toISOString(),
    sourceFiles: files,
  };
}

export {
  UBLOCK_FILES,
  BASE_URL,
  parseLine,
  isPlainCssSelector,
  fetchAndParseFilters,
};