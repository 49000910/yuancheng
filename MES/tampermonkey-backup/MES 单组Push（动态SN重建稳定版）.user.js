// ==UserScript==
// @name         MES 鍗曠粍Push锛堝姩鎬丼N閲嶅缓绋冲畾鐗堬級
// @namespace    mes.plugin.push.dynamic
// @version      3.0
// @match        https://w3.huawei.com/mespmm/wipweb*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(async function () {
  'use strict';

  // ===== MES鎺堟潈闂ㄧ START =====
  async function __MES_AUTH_GATE__() {
    var KEY = 'MES_AUTH_CENTER_STATE_V1';
    var start = Date.now();

    while (Date.now() - start < 10000) {
      try {
        var st = JSON.parse(localStorage.getItem(KEY) || 'null');

        if (st && st.ok && Date.now() - Number(st.ts || 0) < 10000) {
          console.log('[MES鎺堟潈闂ㄧ] 宸叉巿鏉冿紝鑴氭湰缁х画杩愯锛?, st.jobNumber);
          return true;
        }
      } catch (e) {}

      await new Promise(function (r) {
        setTimeout(r, 300);
      });
    }

    console.warn('[MES鎺堟潈闂ㄧ] 鏈巿鏉冿紝鑴氭湰宸插仠姝㈣繍琛?);
    return false;
  }

  if (!(await __MES_AUTH_GATE__())) return;

  if (!location.href.includes('#/ProductTrackInOut')) return;

  const KEY_CFG = 'mes_plugin_push_cfg_dynamic_v30';
  const KEY_SAVED = 'mes_plugin_push_saved_configs';
  const BARCODE_SELECTOR = 'div[id^="Input_"] > input.hae-ui-input[type="text"], div[id^="Input_"] > input';
  const PUSH_URL = 'http://127.0.0.1:8765/push';
  const PING_URL = 'http://127.0.0.1:8765/ping';

  const defaultCfg = {
    snListText: '1 8 9',
    debug: true,
    autoPush: false,
    waitAllSn: false
  };

  // 鍔犺浇淇濆瓨鐨勯厤缃?  let cfg = { ...defaultCfg };
  try {
    const saved = GM_getValue(KEY_CFG, null);
    if (saved) {
      cfg = { ...defaultCfg, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.log('[PUSH] 鍔犺浇閰嶇疆澶辫触锛屼娇鐢ㄩ粯璁ら厤缃?);
  }

  // 鍔犺浇淇濆瓨鐨凷N閰嶇疆鍒楄〃
  let savedConfigs = [];
  try {
    const saved = GM_getValue(KEY_SAVED, null);
    if (saved) {
      savedConfigs = JSON.parse(saved);
    }
  } catch (e) {
    console.log('[PUSH] 鍔犺浇淇濆瓨閰嶇疆鍒楄〃澶辫触');
  }

  let lastSig = '';
  let lastBarcode = '';

  // 鐖堕」鍙樺寲鏃堕棿锛岀敤浜庨槻姝㈡柊鐖堕」閰嶆棫SN
  let parentChangeAt = 0;

  // 褰撳墠宸茶瘑鍒埗椤?  let lastParentSeen = '';

  // 璁板綍姣忎釜SN妗嗘渶鍚庝竴娆″彉鍖栨椂闂?  const snTouchedAtById = new Map();

  // 鏃ュ織闃插埛灞?  const logThrottleMap = new Map();
  const LOG_THROTTLE_MS = 3000;

  function dlog(...args) {
    if (cfg.debug) console.log('[PUSH-DYNAMIC]', ...args);
  }

  function saveConfig() {
    try {
      GM_setValue(KEY_CFG, JSON.stringify(cfg));
      dlog('閰嶇疆宸蹭繚瀛?', cfg);
    } catch (e) {
      console.log('[PUSH] 淇濆瓨閰嶇疆澶辫触:', e);
    }
  }

  function saveSavedConfigs() {
    try {
      GM_setValue(KEY_SAVED, JSON.stringify(savedConfigs));
    } catch (e) {
      console.log('[PUSH] 淇濆瓨閰嶇疆鍒楄〃澶辫触:', e);
    }
  }

  function appendDataLog(msg, force = false) {
    const box = document.getElementById('og-log');
    if (!box) return;

    const text = String(msg);
    const now = Date.now();

    if (!force) {
      const last = logThrottleMap.get(text) || 0;
      if (now - last < LOG_THROTTLE_MS) return;
      logThrottleMap.set(text, now);
    }

    box.value = text + '\n' + box.value;

    // 鎺у埗鏃ュ織闀垮害锛岄伩鍏嶅お闀?    if (box.value.length > 8000) {
      box.value = box.value.slice(0, 8000);
    }
  }

  function setMsg(text) {
    const msg = document.getElementById('og-msg');
    if (msg && msg.textContent !== text) {
      msg.textContent = text;
    }
  }

  function normalize(v) {
    v = (v || '').trim().replace(/\u00A0/g, ' ').replace(/\s+/g, '');
    if (v.indexOf('锛?) >= 0) v = v.split('锛?).pop();
    if (v.indexOf(':') >= 0) v = v.split(':').pop();
    return v.toUpperCase();
  }

  function readBomGate() {
    const KEY = 'sn_code_check_gate_status';
    const candidates = [];

    function addGate(src, raw) {
      if (!raw) return;

      try {
        const data = JSON.parse(raw);
        if (!data || !data.ts || !Array.isArray(data.details)) return;

        candidates.push({
          src,
          data
        });
      } catch (e) {}
    }

    try {
      addGate('localStorage', localStorage.getItem(KEY));
    } catch (e) {}

    try {
      addGate('sessionStorage', sessionStorage.getItem(KEY));
    } catch (e) {}

    if (!candidates.length) return null;

    let currentParent = '';

    try {
      currentParent = normalize(getBarcode());
    } catch (e) {
      currentParent = '';
    }

    if (currentParent) {
      const matched = candidates.filter(function (x) {
        return normalize(x.data.parentSn || '') === currentParent;
      });

      if (!matched.length) {
        return null;
      }

      matched.sort(function (a, b) {
        return (b.data.ts || 0) - (a.data.ts || 0);
      });

      return matched[0].data;
    }

    candidates.sort(function (a, b) {
      return (b.data.ts || 0) - (a.data.ts || 0);
    });

    return candidates[0].data;
  }

  function parseSnNums(txt) {
    return (txt || '')
      .split(/\s+/)
      .map(x => parseInt(x, 10))
      .filter(n => !isNaN(n) && n >= 1);
  }

  function getBarcodeInput() {
    const all = [...document.querySelectorAll(BARCODE_SELECTOR)].filter(el => !el.closest('#og-panel'));

    for (const el of all) {
      const box = el.closest('div[id^="Input_"]');
      const ctx = ((box?.parentElement?.innerText || box?.innerText || '')).replace(/\s+/g, '');
      if (ctx.includes('鏉＄爜閲囬泦')) return el;
    }

    return all[0] || null;
  }

  function getBarcode() {
    return normalize(getBarcodeInput()?.value || '');
  }

  function getAllSnFilled() {
    const els = [...document.querySelectorAll('input[id^="sn-input"]')];
    for (const el of els) {
      if (!normalize(el.value || '')) return false;
    }
    return true;
  }

  function buildLines() {
    const barcode = getBarcode();
    const nums = parseSnNums(cfg.snListText);

    if (!barcode || !nums.length) return null;

    // 濡傛灉寮€鍚簡绛夊緟鍏ㄩ儴SN锛屾鏌ユ墍鏈塖N妗嗘槸鍚﹂兘鏈夋暟鎹?    if (cfg.waitAllSn) {
      if (!getAllSnFilled()) {
        return null;
      }
    }

    const out = [barcode];

    for (const n of nums) {
      const idx = n - 1;
      const v = normalize(document.querySelector('#sn-input' + idx)?.value || '');
      if (!v) return null;
      out.push(v);
    }

    return out;
  }

  function allSnNoDuplicate() {
    const els = [...document.querySelectorAll('input[id^="sn-input"]')];
    const vals = els.map(el => normalize(el.value || '')).filter(Boolean);
    return new Set(vals).size === vals.length;
  }

  async function pushToLocal(lines) {
    const r = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines })
    });

    return r.json();
  }

  async function healthCheck() {
    const r = await fetch(PING_URL);
    return r.json();
  }

  async function doPush(force = false) {
    const lines = buildLines();

    if (!lines) {
      if (cfg.waitAllSn) {
        setMsg('绛夊緟鍏ㄩ儴SN濉啓瀹屾垚');
      } else {
        setMsg('鏉＄爜/SN涓嶅畬鏁?);
      }
      return;
    }

    const currentBarcode = getBarcode();

    if (!currentBarcode || currentBarcode !== lastParentSeen) {
      setMsg('鐖堕」鏈壂鐮佺‘璁?);
      return;
    }

    if (!allSnNoDuplicate()) {
      appendDataLog('SN閲嶅锛屾湭鎻愪氦');
      setMsg('SN閲嶅锛屾湭鎻愪氦');
      return;
    }

    try {
      const gate = readBomGate();

      if (!gate || !gate.ts || Date.now() - gate.ts > 120000) {
        setMsg('绛夊緟鏍￠獙');
        return;
      }

      if (parentChangeAt && gate.ts < parentChangeAt) {
        setMsg('绛夊緟鏍￠獙');
        return;
      }

      if (!Array.isArray(gate.details)) {
        setMsg('绛夊緟鏍￠獙');
        return;
      }

      const nums = parseSnNums(cfg.snListText);

      if (!nums.length) {
        appendDataLog('鏈厤缃甋N搴忓彿');
        setMsg('鏈厤缃甋N搴忓彿');
        return;
      }

      for (const n of nums) {
        const id = 'sn-input' + (n - 1);
        const el = document.getElementById(id);
        const val = normalize(el && el.value || '');

        if (!el) {
          appendDataLog('鏈壘鍒伴厤缃甋N妗?' + id);
          setMsg('鏈壘鍒伴厤缃甋N妗?' + id);
          return;
        }

        if (!val) {
          setMsg('閰嶇疆SN鏈～鍐?' + id);
          return;
        }

        const touchedAt = snTouchedAtById.get(id) || 0;

        if (parentChangeAt && touchedAt < parentChangeAt) {
          setMsg('閰嶇疆SN鏈埛鏂?' + id);
          return;
        }

        const d = gate.details.find(x => x && x.id === id);

        if (!d) {
          setMsg('绛夊緟鏍￠獙');
          return;
        }

        if (normalize(d.sn || '') !== val) {
          setMsg('绛夊緟鏍￠獙');
          return;
        }

        if (d.status !== 'ok') {
          setMsg('绛夊緟鏍￠獙');
          return;
        }
      }

    } catch (e) {
      setMsg('绛夊緟鏍￠獙');
      return;
    }

    const sig = lines.join('|');

    // 鎵嬪姩Push涓嶅彈lastSig鍘婚噸闄愬埗
    if (!force && sig === lastSig) return;

    if (!force) {
      lastSig = sig;
    }

    appendDataLog('鎶撳彇瀹屾垚: ' + lines.join(' | '), true);

    try {
      const ret = await pushToLocal(lines);

      appendDataLog('Push瀹屾垚: ' + (ret.count || lines.length) + ' 鏉?, true);
      setMsg('宸睵ush ' + (ret.count || lines.length));

      dlog('push ok', lines);
    } catch (e) {
      appendDataLog('Push澶辫触: ' + e, true);
      setMsg('Push澶辫触');

      dlog('push fail', e);
    }
  }

  function bindEvents() {
    let pushTimer = null;

    function isSnRouteMoving(el) {
      return !!(
        el &&
        el.dataset &&
        (
          el.dataset.snAutoFill === '1' ||
          el.dataset.snRouteMoving === '1'
        )
      );
    }

    function anySnRouteMoving() {
      const els = [...document.querySelectorAll('input[id^="sn-input"]')];
      return els.some(isSnRouteMoving);
    }

    function markSnTouched(el) {
      if (!el || !el.id || !/^sn-input\d+$/i.test(el.id)) return;
      snTouchedAtById.set(el.id, Date.now());
    }

    function isBarcodeTarget(t) {
      return !!(t && t === getBarcodeInput());
    }

    function commitParentChangedByEnter() {
      const b = getBarcode();
      if (!b) return false;

      if (b === lastParentSeen) {
        return false;
      }

      lastParentSeen = b;
      lastBarcode = b;
      lastSig = '';

      parentChangeAt = Date.now();
      snTouchedAtById.clear();

      clearTimeout(pushTimer);

      setMsg('鐖堕」宸叉壂鐮侊紝绛夊緟閰嶇疆SN鏍￠獙');
      appendDataLog('鐖堕」鍙樺寲: ' + b + '锛岀瓑寰呴厤缃甋N鏍￠獙');

      dlog('parent changed by scanner enter:', b);

      return true;
    }

    function markConfiguredOkFromGate(gate) {
      if (!gate || !Array.isArray(gate.details)) return;

      const nums = parseSnNums(cfg.snListText);
      if (!nums.length) return;

      for (const n of nums) {
        const id = 'sn-input' + (n - 1);
        const el = document.getElementById(id);
        if (!el) continue;

        const val = normalize(el.value || '');
        if (!val) continue;

        const d = gate.details.find(x => x && x.id === id);
        if (!d) continue;

        if (d.status === 'ok' && normalize(d.sn || '') === val) {
          snTouchedAtById.set(id, Date.now());
        }
      }
    }

    function configuredSnReadyAndOk() {
      const barcode = getBarcode();

      if (!barcode) {
        return { ok: false, msg: '鐖堕」鏉＄爜涓虹┖' };
      }

      if (barcode !== lastParentSeen) {
        return { ok: false, msg: '鐖堕」鏈壂鐮佺‘璁わ紝璇烽噸鏂版壂鐮? };
      }

      const nums = parseSnNums(cfg.snListText);

      if (!nums.length) {
        return { ok: false, msg: '鏈厤缃甋N搴忓彿' };
      }

      if (!allSnNoDuplicate()) {
        return { ok: false, msg: 'SN閲嶅锛屾湭Push' };
      }

      // 濡傛灉寮€鍚簡绛夊緟鍏ㄩ儴SN锛屾鏌ユ墍鏈塖N妗?      if (cfg.waitAllSn) {
        if (!getAllSnFilled()) {
          return { ok: false, msg: '绛夊緟鍏ㄩ儴SN濉啓' };
        }
      }

      const gate = readBomGate();

      if (!gate || !gate.ts || Date.now() - gate.ts > 120000) {
        return { ok: false, msg: '绛夊緟鏍￠獙' };
      }

      if (parentChangeAt && gate.ts < parentChangeAt) {
        return { ok: false, msg: '绛夊緟鏍￠獙' };
      }

      if (!Array.isArray(gate.details)) {
        return { ok: false, msg: '绛夊緟鏍￠獙' };
      }

      markConfiguredOkFromGate(gate);

      for (const n of nums) {
        const id = 'sn-input' + (n - 1);
        const el = document.getElementById(id);

        if (!el) {
          return { ok: false, msg: '鏈壘鍒伴厤缃甋N妗?' + id };
        }

        const val = normalize(el.value || '');

        if (!val) {
          return { ok: false, msg: '閰嶇疆SN鏈～鍐?' + id };
        }

        const touchedAt = snTouchedAtById.get(id) || 0;

        if (parentChangeAt && touchedAt < parentChangeAt) {
          return { ok: false, msg: '閰嶇疆SN鏈埛鏂?' + id };
        }

        const d = gate.details.find(x => x && x.id === id);

        if (!d) {
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}

          return { ok: false, msg: '绛夊緟鏍￠獙' };
        }

        if (normalize(d.sn || '') !== val) {
          return { ok: false, msg: '绛夊緟鏍￠獙' };
        }

        if (d.status !== 'ok') {
          return { ok: false, msg: '绛夊緟鏍￠獙' };
        }
      }

      return { ok: true, msg: '閰嶇疆SN宸叉牎楠岄€氳繃' };
    }

    function tryAutoPushByConfiguredSn() {
      if (!cfg.autoPush) return;

      if (anySnRouteMoving()) {
        setMsg('SN褰掍綅涓紝绛夊緟Push');
        return;
      }

      if (!allSnNoDuplicate()) {
        setMsg('SN閲嶅锛屾湭Push');
        return;
      }

      const ready = configuredSnReadyAndOk();

      if (!ready.ok) {
        setMsg(ready.msg);
        return;
      }

      clearTimeout(pushTimer);

      pushTimer = setTimeout(function () {
        doPush(false);  // 鑷姩Push鍙條astSig鍘婚噸闄愬埗
      }, 300);
    }

    lastParentSeen = getBarcode();
    lastBarcode = lastParentSeen;
    parentChangeAt = 0;
    snTouchedAtById.clear();

    window.addEventListener('sn-code-check-gate', function (e) {
      markConfiguredOkFromGate(e.detail);

      setTimeout(function () {
        markConfiguredOkFromGate(readBomGate());
        tryAutoPushByConfiguredSn();
      }, 120);
    }, true);

    document.addEventListener('input', function (e) {
      const t = e.target;

      if (t && t.matches && t.matches('input[id^="sn-input"]')) {
        markSnTouched(t);

        setTimeout(function () {
          markConfiguredOkFromGate(readBomGate());
          tryAutoPushByConfiguredSn();
        }, 200);

        return;
      }

      if (isBarcodeTarget(t)) {
        setMsg('鐖堕」杈撳叆涓紝绛夊緟鎵爜鏋狤nter');
      }
    }, true);

    document.addEventListener('change', function (e) {
      const t = e.target;

      if (t && t.matches && t.matches('input[id^="sn-input"]')) {
        markSnTouched(t);

        setTimeout(function () {
          markConfiguredOkFromGate(readBomGate());
          tryAutoPushByConfiguredSn();
        }, 200);

        return;
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      const t = e.target;

      if (!isBarcodeTarget(t)) return;

      if (e.key === 'Enter') {
        setTimeout(function () {
          const changed = commitParentChangedByEnter();

          if (changed) {
            tryAutoPushByConfiguredSn();
          }
        }, 30);
      }
    }, true);

    document.addEventListener('blur', function (e) {
      const t = e.target;

      if (t && t.matches && t.matches('input[id^="sn-input"]')) {
        markSnTouched(t);
        tryAutoPushByConfiguredSn();
      }
    }, true);

    setInterval(function () {
      markConfiguredOkFromGate(readBomGate());
      tryAutoPushByConfiguredSn();
    }, 800);
  }

  function createPanel() {
    if (document.getElementById('og-panel')) return;

    const POS_KEY = 'mes_push_panel_pos_v1';

    function loadPanelState() {
      try {
        return GM_getValue(POS_KEY, null) || {};
      } catch (e) {
        try {
          return JSON.parse(localStorage.getItem(POS_KEY) || '{}');
        } catch (e2) {
          return {};
        }
      }
    }

    function savePanelState(state) {
      try {
        GM_setValue(POS_KEY, state);
      } catch (e) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(state));
        } catch (e2) {}
      }
    }

    const state = loadPanelState();

    const panel = document.createElement('div');
    panel.id = 'og-panel';

    const left = typeof state.left === 'number' ? state.left : null;
    const top = typeof state.top === 'number' ? state.top : 90;
    const collapsed = !!state.collapsed;

    panel.style.cssText = `
      position: fixed;
      ${left === null ? 'right: 12px;' : 'left: ' + left + 'px;'}
      top: ${top}px;
      width: ${collapsed ? 90 : 280}px;
      z-index: 999999;
      background: #fff;
      color: #222;
      border: 1px solid #bbb;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,.18);
      font-family: Arial, "Microsoft YaHei", sans-serif;
      user-select: none;
    `;

    // 鐢熸垚涓嬫媺閫夐」HTML
    let optionsHtml = '<option value="">鎵嬪姩杈撳叆</option>';
    for (const saved of savedConfigs) {
      const selected = saved === cfg.snListText ? 'selected' : '';
      optionsHtml += `<option value="${saved}" ${selected}>${saved}</option>`;
    }

    panel.innerHTML = `
      <div id="og-title" style="
        font-weight:bold;
        margin-bottom:6px;
        color:#111;
        display:flex;
        justify-content:space-between;
        align-items:center;
        cursor:move;
      ">
        <span>MES Push</span>
        <span id="og-mini" style="cursor:pointer;color:#666;font-weight:normal;">
          ${collapsed ? '灞曞紑' : '鏀惰捣'}
        </span>
      </div>

      <div id="og-body" style="${collapsed ? 'display:none;' : ''}">
        <div id="og-msg" style="
          color:#007a3d;
          margin-bottom:6px;
          font-size:12px;
          line-height:16px;
          min-height:16px;
          user-select:text;
        ">鎻掍欢宸插姞杞?/div>

        <div style="margin-bottom:6px;">
          <div style="margin-bottom:3px;">
            SN閰嶇疆:
            <select id="og-sn-select" style="
              width:130px;
              height:22px;
              font-size:12px;
            ">
              ${optionsHtml}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <input id="og-sn-list" value="${cfg.snListText}" style="
              width:100px;
              height:20px;
              font-size:12px;
              box-sizing:border-box;
              flex:1;
            ">
            <button id="og-save-btn" style="font-size:11px;height:22px;padding:0 6px;">淇濆瓨</button>
            <button id="og-del-btn" style="font-size:11px;height:22px;padding:0 6px;">鍒犻櫎</button>
          </div>
        </div>

        <div style="margin-bottom:6px;display:flex;align-items:center;gap:8px;">
          <label>
            <input id="og-auto" type="checkbox" ${cfg.autoPush ? 'checked' : ''}>
            鑷姩
          </label>
          <label>
            <input id="og-wait-all" type="checkbox" ${cfg.waitAllSn ? 'checked' : ''}>
            绛夊緟鍏ㄩ儴SN
          </label>
        </div>

        <div style="margin-bottom:6px;">
          <button id="og-push-btn" style="font-size:12px;height:23px;">Push</button>
          <button id="og-health-btn" style="font-size:12px;height:23px;">妫€娴?/button>
        </div>

        <textarea id="og-log" readonly style="
          width:100%;
          height:70px;
          box-sizing:border-box;
          background:#fafafa;
          color:#333;
          border:1px solid #ccc;
          font-size:11px;
          line-height:14px;
          resize:none;
          user-select:text;
        "></textarea>
      </div>
    `;

    document.body.appendChild(panel);

    function clampPanel() {
      const rect = panel.getBoundingClientRect();

      let newLeft = rect.left;
      let newTop = rect.top;

      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;

      if (newLeft + rect.width > window.innerWidth) {
        newLeft = Math.max(0, window.innerWidth - rect.width);
      }

      if (newTop + rect.height > window.innerHeight) {
        newTop = Math.max(0, window.innerHeight - rect.height);
      }

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';

      return {
        left: newLeft,
        top: newTop
      };
    }

    function saveCurrentPanelState() {
      const pos = clampPanel();
      const body = document.getElementById('og-body');

      savePanelState({
        left: pos.left,
        top: pos.top,
        collapsed: body ? body.style.display === 'none' : false
      });
    }

    // 鍒锋柊涓嬫媺鍒楄〃
    function refreshSelect() {
      const select = document.getElementById('og-sn-select');
      if (!select) return;

      let html = '<option value="">鎵嬪姩杈撳叆</option>';
      for (const saved of savedConfigs) {
        const selected = saved === cfg.snListText ? 'selected' : '';
        html += `<option value="${saved}" ${selected}>${saved}</option>`;
      }
      select.innerHTML = html;
    }

    // 鎷栧姩
    (function bindDrag() {
      const title = document.getElementById('og-title');

      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;

      title.addEventListener('mousedown', function (e) {
        if (e.target && e.target.id === 'og-mini') return;

        dragging = true;

        const rect = panel.getBoundingClientRect();

        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';

        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        if (!dragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        panel.style.left = startLeft + dx + 'px';
        panel.style.top = startTop + dy + 'px';
        panel.style.right = 'auto';
      });

      document.addEventListener('mouseup', function () {
        if (!dragging) return;

        dragging = false;
        saveCurrentPanelState();
      });
    })();

    // SN杈撳叆妗嗗彉鏇?- 绔嬪嵆淇濆瓨
    document.getElementById('og-sn-list').addEventListener('change', function () {
      cfg.snListText = this.value || '';
      saveConfig();
      setMsg('SN搴忓彿宸叉洿鏂?);
    });

    // 涓嬫媺閫夋嫨鍙樻洿 - 绔嬪嵆鐢熸晥骞朵繚瀛?    document.getElementById('og-sn-select').addEventListener('change', function () {
      const val = this.value;
      if (val) {
        cfg.snListText = val;
        document.getElementById('og-sn-list').value = val;
        saveConfig();
        setMsg('宸查€夋嫨: ' + val);
      }
    });

    // 淇濆瓨褰撳墠閰嶇疆鍒颁笅鎷夊垪琛?    document.getElementById('og-save-btn').addEventListener('click', function () {
      const val = cfg.snListText.trim();
      if (!val) {
        setMsg('璇疯緭鍏N搴忓彿');
        return;
      }

      if (!savedConfigs.includes(val)) {
        savedConfigs.push(val);
        savedConfigs.sort();
        saveSavedConfigs();
        refreshSelect();
        document.getElementById('og-sn-select').value = val;
        setMsg('宸蹭繚瀛? ' + val);
      } else {
        setMsg('宸插瓨鍦? ' + val);
      }
    });

    // 鍒犻櫎褰撳墠閰嶇疆
    document.getElementById('og-del-btn').addEventListener('click', function () {
      const val = cfg.snListText.trim();
      if (!val) {
        setMsg('璇疯緭鍏ヨ鍒犻櫎鐨凷N搴忓彿');
        return;
      }

      const idx = savedConfigs.indexOf(val);
      if (idx >= 0) {
        savedConfigs.splice(idx, 1);
        saveSavedConfigs();
        refreshSelect();
        document.getElementById('og-sn-select').value = '';
        setMsg('宸插垹闄? ' + val);
      } else {
        setMsg('鏈壘鍒? ' + val);
      }
    });

    // 鑷姩寮€鍏?- 绔嬪嵆鐢熸晥骞朵繚瀛?    document.getElementById('og-auto').addEventListener('change', function () {
      cfg.autoPush = this.checked;
      saveConfig();
      setMsg(cfg.autoPush ? '鑷姩Push宸插紑鍚? : '鑷姩Push宸插叧闂?);
      dlog('鑷姩Push:', cfg.autoPush);
    });

    // 绛夊緟鍏ㄩ儴SN寮€鍏?- 绔嬪嵆鐢熸晥骞朵繚瀛?    document.getElementById('og-wait-all').addEventListener('change', function () {
      cfg.waitAllSn = this.checked;
      saveConfig();
      setMsg(cfg.waitAllSn ? '绛夊緟鍏ㄩ儴SN宸插紑鍚? : '绛夊緟鍏ㄩ儴SN宸插叧闂?);
      dlog('绛夊緟鍏ㄩ儴SN:', cfg.waitAllSn);
    });

    // Push鎸夐挳 - 鍙互閲嶅鎻愪氦
    document.getElementById('og-push-btn').addEventListener('click', function () {
      doPush(true);  // force=true锛屽彲浠ラ噸澶嶆彁浜?    });

    document.getElementById('og-health-btn').addEventListener('click', async function () {
      try {
        const ret = await healthCheck();
        appendDataLog('鏈嶅姟姝ｅ父: ' + JSON.stringify(ret), true);
        setMsg('鏈嶅姟姝ｅ父');
      } catch (e) {
        appendDataLog('鏈嶅姟寮傚父: ' + e, true);
        setMsg('鏈嶅姟寮傚父');
      }
    });

    document.getElementById('og-mini').addEventListener('click', function () {
      const body = document.getElementById('og-body');
      if (!body) return;

      if (body.style.display === 'none') {
        body.style.display = '';
        this.textContent = '鏀惰捣';
        panel.style.width = '280px';
      } else {
        body.style.display = 'none';
        this.textContent = '灞曞紑';
        panel.style.width = '90px';
      }

      saveCurrentPanelState();
    });

    window.addEventListener('resize', function () {
      saveCurrentPanelState();
    });

    setTimeout(saveCurrentPanelState, 100);
  }


  createPanel();
  bindEvents();
})();
