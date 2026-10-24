// Finding what the user is reading: opened emails in Gmail, and the main body
// of news articles and blog posts. Navigation, share bars, captions, related
// links and the like are left out.

const NOT_CONTENT =
  "nav, aside, footer, form, button, select, figure, figcaption, [role=navigation], [role=complementary], [role=banner], [aria-hidden=true], [hidden], [contenteditable=true], textarea, input";
const JUNK_RE = /(^|[\s_-])(share|social|related|newsletter|promo|advert|ads?|sponsor|comments?|subscribe|byline|caption|breadcrumbs?|recommend(ed|ations)?|footer|sidebar|signup|paywall)([\s_-]|$)/i;
const MIN_ARTICLE_CHARS = 600;

export function isGmail() {
  return location.hostname === "mail.google.com";
}

// Opened message bodies in Gmail; never the compose box. Gmail's body
// container has long been div.a3s inside div.ii.gt; the latter is the
// fallback in case the inner class changes.
export function gmailMessages() {
  const bodies = [...document.querySelectorAll("div.ii.gt")].map((gt) => gt.querySelector("div.a3s") ?? gt);
  for (const el of document.querySelectorAll("div.a3s")) if (!bodies.includes(el)) bodies.push(el);
  return bodies.filter((el) => !el.isContentEditable && !el.closest("[contenteditable=true]") && el.getClientRects().length > 0);
}

// Elements to leave out when reading an article.
export function isArticleJunk(el) {
  return el.matches(NOT_CONTENT) || JUNK_RE.test(`${el.className?.baseVal ?? el.className ?? ""} ${el.id ?? ""}`);
}

function paragraphText(el) {
  let total = 0;
  for (const p of el.querySelectorAll("p")) {
    if (p.closest(NOT_CONTENT)) continue;
    const len = p.textContent.trim().length;
    if (len >= 40) total += len;
  }
  return total;
}

// The element holding the page's main article text, or null on pages that
// aren't long-form reading (home pages, apps, search results…).
export function findArticle({ minChars = MIN_ARTICLE_CHARS } = {}) {
  let best = null;
  let bestScore = 0;
  for (const el of document.querySelectorAll('[itemprop="articleBody"], article, [role="article"], main')) {
    const score = paragraphText(el);
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  if (bestScore < minChars) {
    // No usable markup: take the element that directly holds the most prose.
    const parents = new Map();
    for (const p of document.querySelectorAll("p")) {
      if (p.closest(NOT_CONTENT)) continue;
      const len = p.textContent.trim().length;
      if (len < 40 || !p.parentElement) continue;
      parents.set(p.parentElement, (parents.get(p.parentElement) ?? 0) + len);
    }
    for (const [el, score] of parents) {
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
  }
  return bestScore >= minChars ? best : null;
}

const BLOCK_SELECTOR = "p, li, blockquote, h1, h2, h3, h4, h5, h6, td, dd, pre, div";

// The nearest block-level ancestor of a node, used to anchor a selection.
export function blockAncestor(node) {
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return el?.closest(BLOCK_SELECTOR) ?? el ?? document.body;
}
