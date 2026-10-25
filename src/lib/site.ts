// Site-wide switches.

/**
 * Keep every page out of search engines until the owner decides to launch (SPEC section 9).
 * Set to false at launch; check-leaks fails while it is true and any page lacks the tag.
 */
export const NOINDEX = true;
