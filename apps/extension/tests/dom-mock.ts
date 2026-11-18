import { matchesSelector } from "./dom-selector";

type ListenerEntry = {
  type: string;
  listener: (event: Event) => void;
  capture: boolean;
};

export class MockTextNode {
  textContent: string;
  parentElement: MockElement | null = null;
  nextSibling: MockNode | null = null;

  constructor(text: string) {
    this.textContent = text;
  }
}

export type MockNode = MockElement | MockTextNode;

export class MockElement {
  tagName: string;
  attributes: Record<string, string> = {};
  childNodes: MockNode[] = [];
  parentElement: MockElement | null = null;
  style: Record<string, string> = {};
  checked = false;
  value = "";
  cellIndex = -1;
  clickCount = 0;
  private listeners: ListenerEntry[] = [];

  constructor(tagName: string, attrs: Record<string, string> = {}) {
    this.tagName = tagName.toUpperCase();
    for (const [key, val] of Object.entries(attrs)) {
      this.setAttribute(key, val);
    }
  }

  get children(): MockElement[] {
    return this.childNodes.filter(
      (node): node is MockElement => node instanceof MockElement,
    );
  }

  get nextSibling(): MockNode | null {
    if (!this.parentElement) {
      return null;
    }

    const siblings = this.parentElement.childNodes;
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx + 1 < siblings.length
      ? (siblings[idx + 1] ?? null)
      : null;
  }

  get textContent(): string {
    return this.childNodes.map((n) => n.textContent).join("");
  }

  set textContent(val: string) {
    this.childNodes = val.length > 0 ? [new MockTextNode(val)] : [];
    for (const node of this.childNodes) {
      node.parentElement = this;
    }
  }

  appendChild(node: MockNode): void {
    node.parentElement = this;
    this.childNodes.push(node);

    if (
      this.tagName === "TR" &&
      node instanceof MockElement &&
      (node.tagName === "TD" || node.tagName === "TH")
    ) {
      const cells = this.children.filter(
        (c) => c.tagName === "TD" || c.tagName === "TH",
      );
      cells.forEach((c, idx) => {
        c.cellIndex = idx;
      });
    }
  }

  getAttribute(name: string): string | null {
    const key = name.toLowerCase();
    return key in this.attributes ? (this.attributes[key] ?? null) : null;
  }

  setAttribute(name: string, value: string): void {
    const key = name.toLowerCase();
    this.attributes[key] = value;

    if (key === "value") {
      this.value = value;
    }
    if (key === "checked") {
      this.checked = value !== "false";
    }
  }

  click(): void {
    this.clickCount += 1;
    this.dispatchEvent(new Event("click", { bubbles: true }));
  }

  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners.push({ type, listener, capture });
  }

  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners = this.listeners.filter(
      (entry) =>
        !(
          entry.type === type &&
          entry.listener === listener &&
          entry.capture === capture
        ),
    );
  }

  dispatchEvent(event: Event): boolean {
    const ev = event as Event & { target?: unknown };
    if (!ev.target) {
      Object.defineProperty(ev, "target", {
        value: this,
        configurable: true,
      });
    }

    for (const entry of [...this.listeners]) {
      if (entry.type === event.type) {
        entry.listener(event);
      }
    }

    if (event.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }

    return !event.defaultPrevented;
  }

  closest(selector: string): Element | null {
    if (matchesSelector(this, selector)) {
      return this as unknown as Element;
    }

    let current: MockElement | null = this.parentElement;
    while (current) {
      if (matchesSelector(current, selector)) {
        return current as unknown as Element;
      }
      current = current.parentElement;
    }

    return null;
  }

  querySelector(selector: string): Element | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): Element[] {
    const results: Element[] = [];
    const visit = (node: MockElement): void => {
      for (const child of node.children) {
        if (matchesSelector(child, selector, this)) {
          results.push(child as unknown as Element);
        }
        visit(child);
      }
    };
    visit(this);
    return results;
  }
}

export class MockDocument {
  body: MockElement;
  location = { origin: "https://siakad.example.ac.id" };
  private listeners: ListenerEntry[] = [];

  constructor(children: MockNode[] = []) {
    this.body = new MockElement("body");
    for (const child of children) {
      this.body.appendChild(child);
    }
  }

  querySelector(selector: string): Element | null {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector: string): Element[] {
    return this.body.querySelectorAll(selector);
  }

  getElementById(id: string): Element | null {
    return this.body.querySelector(`[id="${id}"]`);
  }

  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners.push({ type, listener, capture });
  }

  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    this.listeners = this.listeners.filter(
      (entry) =>
        !(
          entry.type === type &&
          entry.listener === listener &&
          entry.capture === capture
        ),
    );
  }

  dispatchEvent(event: Event): boolean {
    for (const entry of [...this.listeners]) {
      if (entry.type === event.type) {
        entry.listener(event);
      }
    }
    return !event.defaultPrevented;
  }

  simulateClick(target: MockElement): Event {
    const ev = new Event("click", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: target, configurable: true });
    for (const entry of [...this.listeners]) {
      if (entry.type === "click" && entry.capture) {
        entry.listener(ev);
      }
    }
    if (!ev.defaultPrevented) {
      target.dispatchEvent(ev);
    }
    return ev;
  }

  simulateKeyDown(key: string): Event {
    const ev = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "key", { value: key, configurable: true });
    this.dispatchEvent(ev);
    return ev;
  }
}

export function h(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: Array<MockNode | string>
): MockElement {
  const el = new MockElement(tag, attrs);
  for (const child of children) {
    if (typeof child === "string") {
      el.appendChild(new MockTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}
