export interface SelectorElement {
  tagName: string;
  parentElement: SelectorElement | null;
  children: SelectorElement[];
  getAttribute(name: string): string | null;
}

function matchesSimpleSelector(el: SelectorElement, simple: string): boolean {
  let rest = simple.trim();
  if (rest.length === 0) {
    return false;
  }

  const nthOfTypeMatch = rest.match(/:nth-of-type\((\d+)\)$/);
  if (nthOfTypeMatch) {
    const expectedNth = Number(nthOfTypeMatch[1]);
    rest = rest.slice(0, nthOfTypeMatch.index);
    const parent = el.parentElement;
    if (!parent) {
      return false;
    }

    const sameTag = parent.children.filter((c) => c.tagName === el.tagName);
    if (sameTag.indexOf(el) + 1 !== expectedNth) {
      return false;
    }
  }

  const attrMatches = [...rest.matchAll(/\[([^=\]]+)=['"]([^'"]*)['"]\]/g)];
  for (const m of attrMatches) {
    const attrName = m[1];
    const attrVal = m[2];
    if (!attrName || el.getAttribute(attrName) !== attrVal) {
      return false;
    }
  }
  rest = rest.replace(/\[[^\]]+\]/g, "");

  const idMatch = rest.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    if (el.getAttribute("id") !== idMatch[1]) {
      return false;
    }
    rest = rest.replace(/#[a-zA-Z0-9_-]+/, "");
  }

  if (rest.length > 0 && rest !== "*") {
    return el.tagName === rest.toUpperCase();
  }

  return true;
}

function matchesComplex(
  el: SelectorElement,
  complex: string,
  rootLimit?: SelectorElement,
): boolean {
  const tokens = complex
    .replace(/\s*>\s*/g, " > ")
    .trim()
    .split(/\s+/);

  const last = tokens[tokens.length - 1];
  if (!last || !matchesSimpleSelector(el, last)) {
    return false;
  }

  let current: SelectorElement | null = el;
  let i = tokens.length - 2;

  while (i >= 0) {
    const token = tokens[i];
    if (token === ">") {
      const parentReq = tokens[i - 1];
      current = current?.parentElement ?? null;
      if (
        !current ||
        current === rootLimit ||
        !parentReq ||
        !matchesSimpleSelector(current, parentReq)
      ) {
        return false;
      }
      i -= 2;
      continue;
    }

    if (!token) {
      return false;
    }

    let ancestor: SelectorElement | null = current?.parentElement ?? null;
    let found = false;
    while (ancestor && ancestor !== rootLimit) {
      if (matchesSimpleSelector(ancestor, token)) {
        current = ancestor;
        found = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    if (!found) {
      return false;
    }
    i -= 1;
  }

  return true;
}

export function matchesSelector(
  el: SelectorElement,
  selector: string,
  rootLimit?: SelectorElement,
): boolean {
  const groups = selector.split(",").map((s) => s.trim());
  return groups.some((group) => matchesComplex(el, group, rootLimit));
}
