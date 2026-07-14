'use strict';

/**
 * Resolves an arbitrary input (full URL string, URL-like string without a
 * scheme, or a bare hostname) down to a lowercase hostname, or null if it
 * cannot be resolved.
 */
function resolveHostname(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  const value = input.trim();

  try {
    const url = new URL(value);
    if (url.hostname) return url.hostname.toLowerCase();
  } catch (_) {
    // not a valid absolute URL — fall through
  }

  try {
    const url = new URL(`https://${value.replace(/^\/\//, '')}`);
    if (url.hostname) return url.hostname.toLowerCase();
  } catch (_) {
    // still not parseable
  }

  const bareHostPattern = /^[a-zA-Z0-9.-]+$/;
  if (bareHostPattern.test(value)) return value.toLowerCase();

  return null;
}

/**
 * Checks whether a hostname matches a blocked domain.
 * Ensures TLDs (like 'com' or 'net') are never checked for multi-label domains.
 */
function hostnameMatches(hostname, blockedDomainSet) {
  const parts = hostname.split('.');
  
  // If the original hostname is single-label (no dots, e.g. "localhost" or "intranet")
  if (parts.length === 1) {
    return blockedDomainSet.has(parts[0]);
  }

  // For multi-label hostnames (e.g. "www.google.com"), check candidates
  // down to 2 labels (checks "www.google.com" and "google.com", but NEVER "com").
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join('.');
    if (blockedDomainSet.has(candidate)) return true;
  }

  return false;
}

/**
 * Builds a synchronous isAllowed(url) predicate bound to a given
 * blockedDomainSet (a Set<string> of lowercase domains).
 */
function createIsAllowed(getBlockedDomainSet) {
  return function isAllowed(url) {
    const hostname = resolveHostname(url);
    if (!hostname) return true;
    const blockedDomainSet = getBlockedDomainSet();
    return !hostnameMatches(hostname, blockedDomainSet);
  };
}

export { resolveHostname, hostnameMatches, createIsAllowed };