// tests/fake-dom.js — минимальная заглушка DOM для дымовых тестов в Node (без jsdom).
class Node_ {
  constructor(type) { this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  _adopt(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; return n; }
  appendChild(n) { this.childNodes.push(this._adopt(n)); return n; }
  append(...items) { for (const i of items) this.appendChild(typeof i === "object" && i && i.nodeType ? i : new Text_(String(i))); }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get isConnected() { let t = this; while (t.parentNode) t = t.parentNode; return t === global.document.body || !!t.__attached; }
  closest(sel) { const cls = sel.split(",").map((s) => s.trim().replace(/^\./, "")); for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (cls.some((c) => n.classList.contains(c))) return n; return null; }
  contains(n) { for (let c = n; c; c = c.parentNode) if (c === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes = []; if (v) this.appendChild(new Text_(String(v))); }
}
class Text_ extends Node_ { constructor(t) { super(3); this.data = t; } get textContent() { return this.data; } set textContent(v) { this.data = v; } }
class El extends Node_ {
  constructor(tag) {
    super(1); this.tagName = tag.toUpperCase(); this.attrs = {}; this.style = {}; this.dataset = {}; this.listeners = {}; this._cls = "";
    const self = this;
    this.classList = {
      add: (...c) => { const s = new Set(self._cls.split(/\s+/).filter(Boolean)); c.forEach((x) => s.add(x)); self._cls = [...s].join(" "); },
      remove: (...c) => { self._cls = self._cls.split(/\s+/).filter((x) => x && !c.includes(x)).join(" "); },
      toggle: (c, f) => { const has = self._cls.split(/\s+/).includes(c); const want = f === undefined ? !has : f; want ? self.classList.add(c) : self.classList.remove(c); },
      contains: (c) => self._cls.split(/\s+/).includes(c),
    };
  }
  get className() { return this._cls; } set className(v) { this._cls = v; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "value") this.value = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  click() { this.dispatch("click"); }
  dispatch(t, ev = {}) { for (const f of this.listeners[t] || []) f({ preventDefault() {}, stopPropagation() {}, target: this, ...ev }); }
  set innerHTML(v) { this._html = v; this.childNodes = []; }
  get innerHTML() { return this._html || ""; }
  getBoundingClientRect() { return { left: 0, width: 100 }; }
  empty() { this.childNodes = []; }
  setText(t) { this.textContent = t; }
  createEl(tag, o = {}) { const e = new El(tag); if (o.cls) e.className = o.cls; if (o.text) e.textContent = o.text; this.appendChild(e); return e; }
  find(pred, out = []) { for (const c of this.children) { if (pred(c)) out.push(c); c.find(pred, out); } return out; }
  byClass(cls) { return this.find((n) => n.classList.contains(cls)); }
}
function install() {
  const head = new El("head"), body = new El("body");
  const L = {};
  global.document = { addEventListener: (t, f) => (L[t] = L[t] || []).push(f), removeEventListener: (t, f) => { L[t] = (L[t] || []).filter((x) => x !== f); }, dispatch: (t, ev = {}) => (L[t] || []).slice().forEach((f) => f({ target: null, ...ev })), createElement: (t) => new El(t), createTextNode: (t) => new Text_(String(t)), head, body, activeElement: null, getElementById: (id) => head.find((n) => (n.id || n.attrs.id) === id)[0] || null, execCommand: () => true };
  global.window = global.window || {};
  try { global.navigator = global.navigator || { clipboard: { writeText: async () => {} } }; } catch (e) {}
  return { El, Text_ };
}
module.exports = { install, El };
