// キャンバスのボード（*.dc.html）を、キャンバスの外のブラウザで表示するための最小の実行系。
// ボードが使う構文だけを扱う: {{a.b}} の差し込み、<sc-for list as>、<sc-if value>、onClick="{{fn}}"、
// <script data-dc-script> の Component（DCLogic を継承し renderVals() を返す）、<helmet> の中身を <head> へ移すこと。
// 状態は URL の #state={"mode":"wheelchair"} で上書きできる（書き出し用）。
(function () {
  const WHOLE = /^\{\{\s*([\w.$]+)\s*\}\}$/;
  const PART = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const HTML_NS = 'http://www.w3.org/1999/xhtml';

  let root = null;
  let template = null;
  let logic = null;

  class DCLogic {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
    setState(patch) {
      Object.assign(this.state, patch);
      render();
    }
    renderVals() {
      return {};
    }
  }

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  }

  function interpolate(text, scope) {
    return text.replace(PART, (_, path) => {
      const v = lookup(scope, path);
      return v == null ? '' : String(v);
    });
  }

  function wholeValue(node, name, scope) {
    const m = (node.getAttribute(name) || '').match(WHOLE);
    return m ? lookup(scope, m[1]) : undefined;
  }

  function build(node, scope, out) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.localName === 'sc-for') {
      const as = node.getAttribute('as');
      for (const item of wholeValue(node, 'list', scope) || []) {
        const child = Object.create(scope);
        child[as] = item;
        node.childNodes.forEach((c) => build(c, child, out));
      }
      return;
    }
    if (node.localName === 'sc-if') {
      if (wholeValue(node, 'value', scope)) node.childNodes.forEach((c) => build(c, scope, out));
      return;
    }

    const el = node.namespaceURI === HTML_NS
      ? document.createElement(node.localName)
      : document.createElementNS(node.namespaceURI, node.localName);
    for (const attr of node.attributes) {
      const m = attr.value.match(WHOLE);
      const value = m ? lookup(scope, m[1]) : undefined;
      if (/^on/.test(attr.name) && typeof value === 'function') {
        el.addEventListener(attr.name.slice(2), value);
      } else if (attr.namespaceURI) {
        el.setAttributeNS(attr.namespaceURI, attr.name, interpolate(attr.value, scope));
      } else {
        el.setAttribute(attr.name, interpolate(attr.value, scope));
      }
    }
    node.childNodes.forEach((c) => build(c, scope, el));
    out.appendChild(el);
  }

  function render() {
    const vals = logic ? logic.renderVals() : {};
    const frag = document.createDocumentFragment();
    template.childNodes.forEach((c) => build(c, vals, frag));
    root.replaceChildren(frag);
  }

  function defaultProps(script) {
    const props = {};
    const raw = script ? JSON.parse(script.dataset.props || '{}') : {};
    for (const [key, spec] of Object.entries(raw)) {
      if (key.startsWith('$')) continue;
      props[key] = spec && typeof spec === 'object' && 'default' in spec ? spec.default : spec;
    }
    return props;
  }

  function stateFromHash() {
    const m = location.hash.match(/state=(.+)$/);
    return m ? JSON.parse(decodeURIComponent(m[1])) : null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    root = document.querySelector('x-dc');
    if (!root) return;
    for (const helmet of root.querySelectorAll('helmet')) {
      document.head.append(...helmet.childNodes);
      helmet.remove();
    }
    template = root.cloneNode(true);

    const script = document.querySelector('script[data-dc-script]');
    if (script) {
      const Component = new Function('DCLogic', `${script.textContent}\nreturn Component;`)(DCLogic);
      logic = new Component(defaultProps(script));
      const override = stateFromHash();
      if (override) Object.assign(logic.state, override);
    }
    render();
  });
})();
