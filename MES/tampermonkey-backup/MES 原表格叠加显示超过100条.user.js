// ==UserScript==
// @name         MES 鍘熻〃鏍煎彔鍔犳樉绀鸿秴杩?00鏉?// @namespace    mes.inline.stack.grid
// @version      2.0
// @description  MES鏉＄爜閲囬泦琛ㄦ牸鍙犲姞锛屾帓闄ゆ壒閲忚剼鏈骇鐢熺殑鏁版嵁锛岀簿鍑嗙粺璁′汉宸ユ晥鑳斤紝姘镐箙璁板繂璁剧疆
// @match        https://w3.huawei.com/mespmm/wipweb*
// @run-at       document-idle
// @grant        none
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
        if (st && st.ok && Date.now() - Number(st.ts || 0) < 10000) return true;
      } catch (e) {}

      await new Promise(function (r) { setTimeout(r, 300); });
    }
    return false;
  }

  if (!(await __MES_AUTH_GATE__())) return;
  // ===== MES鎺堟潈闂ㄧ END =====


  const ROUTE_KEY = '#/ProductTrackInOut';
  const GRID_SELECTOR = '#Grid_18799581';
  const MAX_KEEP = 1000;
  const RENUMBER_SEQ = true;
  const CHECK_INTERVAL = 800;

  // ===== 缁熶竴鐨勬湰鍦拌缃繚瀛樹笌璇诲彇 =====
  const SETTINGS_KEY = 'MES_INLINE_GRID_SETTINGS_V1';
  const defaultSettings = { heightOffset: 510, onlyUnique: false, groupSize: 0 };

  function loadSettings() {
    try {
      return Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY)));
    } catch (e) { return defaultSettings; }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      heightOffset: heightOffset, onlyUnique: onlyUnique, groupSize: groupSize
    }));
  }

  let settings = loadSettings();
  let heightOffset = settings.heightOffset;
  let onlyUnique = settings.onlyUnique;
  let groupSize = settings.groupSize;
  // ==================================

  let accRows = [];
  let rendering = false;
  let lastRenderedSig = '';
  let observer = null;
  let timer = null;
  let uphTimer = null;
  let currentTbody = null;
  let started = false;

  const softColors = ['#d4e6fc', '#fdf2cf', '#d8efd1'];

  // ========= UPH 鎸夊皬鏃剁粺璁?=========
  let currentHourKey = new Date().getHours();
  let hourSet = new Set();

  function log(...args) { console.log('[MES鍘熻〃鏍煎彔鍔燷', ...args); }
  function isTargetRoute() { return location.href.includes(ROUTE_KEY); }
  function getGrid() { return document.querySelector(GRID_SELECTOR) || document.querySelector('.hae-grid'); }
  function getTbody() { return getGrid() && getGrid().querySelector('.grid-body-content'); }
  function getBody() { return getGrid() && getGrid().querySelector('.grid-body'); }
  function txt(el) { return (el && el.textContent || '').trim().replace(/\s+/g, ' '); }

  function cell(row, field) {
    const el = row.querySelector('[field="' + field + '"] .grid-input, [field="' + field + '"]');
    return txt(el);
  }

  function readRowsFromDom() {
    const tbody = getTbody();
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr.grid-row')).map(function (tr) {
      return {
        html: tr.outerHTML,
        data: {
          seqNo: cell(tr, 'seqNo'), sn: cell(tr, 'sn'), rootSn: cell(tr, 'rootSn'),
          pId: cell(tr, 'pId'), taskNo: cell(tr, 'taskNo'), partNo: cell(tr, 'partNo'),
          workstepName: cell(tr, 'workstepName'), snGrade: cell(tr, 'snGrade'),
          snProcessStatus: cell(tr, 'snProcessStatus'), goodRateQty: cell(tr, 'goodRateQty'),
          scrappedQty: cell(tr, 'scrappedQty')
        }
      };
    }).filter(function (r) { return r.data.sn || r.data.taskNo || r.data.partNo; });
  }

  function rowKey(r) {
    const d = r.data || {};
    return [d.sn, d.rootSn, d.pId, d.taskNo, d.partNo, d.workstepName, d.snGrade, d.snProcessStatus, d.goodRateQty, d.scrappedQty].join('|');
  }

  function listSig(rows) { return rows.map(rowKey).join('\n'); }

  function fixRowHtml(item, index, total) {
    const tb = document.createElement('tbody');
    tb.innerHTML = item.html;
    const tr = tb.querySelector('tr');
    if (!tr) return item.html;

    tr.setAttribute('_row', String(index));
    if (index !== 0) tr.classList.remove('row-actived');

    if (RENUMBER_SEQ) {
      const seqCell = tr.querySelector('[field="seqNo"] .grid-input');
      if (seqCell) seqCell.textContent = String(total - index);
    }

    if (groupSize > 0) {
      const colorIndex = Math.floor(index / groupSize) % softColors.length;
      if (!tr.classList.contains('row-actived')) {
        tr.style.setProperty('background-color', softColors[colorIndex], 'important');
      }
    }
    return tr.outerHTML;
  }

  function adjustGridHeight(offset) {
    heightOffset = offset || heightOffset;
    const grid = getGrid();
    if (grid) {
      grid.style.setProperty('height', `calc(100vh - ${heightOffset}px)`, 'important');
      grid.style.setProperty('min-height', '200px', 'important');
      const body = getBody();
      if (body) {
        body.style.setProperty('height', 'calc(100% - 45px)', 'important');
        body.style.setProperty('overflow-y', 'auto', 'important');
      }
    }
  }

  function checkHourChange() {
    const h = new Date().getHours();
    if (h !== currentHourKey) {
      currentHourKey = h;
      hourSet.clear();
      const rangeEl = document.getElementById('mes-uph-range');
      if (rangeEl) {
        const hStr = String(h).padStart(2, '0');
        const nextHStr = String((h + 1) % 24).padStart(2, '0');
        rangeEl.textContent = `${hStr}:00-${nextHStr}:00`;
      }
    }
  }

  function trackUPH(newRows) {
    // 銆愭牳蹇冧慨鏀广€戯細璇诲彇銆婁竴浣撳寲鑴氭湰銆嬫湁娌℃湁鐣欎笅姝ｅ湪鎵硅窇鐨勬殫鍙?    const isBatchRunning = localStorage.getItem('MES_BATCH_RUNNING_FLAG') === '1';

    newRows.forEach(r => {
      if (r.data.sn) {
        // 鍙湁銆愪笉鏄€戞壒閲忚剼鏈窇鐨勬暟鎹紝鎵嶄細璁″叆浜哄伐鏁堣兘缁熻
        if (!isBatchRunning) {
          hourSet.add(r.data.sn);
        } else {
          log('妫€娴嬪埌鏉＄爜 [', r.data.sn, '] 鏉ヨ嚜鎵归噺鑴氭湰锛屼笉璁″叆鏁堣兘UPH');
        }
      }
    });
  }

  function mergeRows(currentRows, oldRows) {
    const result = currentRows.slice();
    const countMap = new Map();
    currentRows.forEach(r => countMap.set(rowKey(r), (countMap.get(rowKey(r)) || 0) + 1));

    const oldKeys = new Set(oldRows.map(rowKey));
    const newlyScanned = currentRows.filter(r => !oldKeys.has(rowKey(r)));
    if (newlyScanned.length > 0) trackUPH(newlyScanned);

    oldRows.forEach(function (r) {
      const k = rowKey(r);
      const n = countMap.get(k) || 0;
      if (n > 0) countMap.set(k, n - 1);
      else result.push(r);
    });
    return result.slice(0, MAX_KEEP);
  }

  function getDisplayRows() {
    if (!onlyUnique) return accRows;
    const display = [], seen = new Set();
    accRows.forEach(r => {
      const sn = r.data.sn;
      if (sn && !seen.has(sn)) { seen.add(sn); display.push(r); }
      else if (!sn) { display.push(r); }
    });
    return display;
  }

  function renderRows() {
    const tbody = getTbody();
    if (!tbody) return;
    rendering = true;
    const displayRows = getDisplayRows();
    const total = displayRows.length;

    const body = getBody();
    const oldScrollTop = body ? body.scrollTop : 0;
    const oldScrollHeight = body ? body.scrollHeight : 0;
    const isPinnedToBottom = body ? (oldScrollTop + body.clientHeight + 5 >= oldScrollHeight) : true;

    tbody.innerHTML = displayRows.map((r, i) => fixRowHtml(r, i, total)).join('');

    if (body) {
      body.style.overflowY = 'auto';
      if (isPinnedToBottom) body.scrollTop = body.scrollHeight;
      else body.scrollTop = oldScrollTop * (body.scrollHeight / (oldScrollHeight || 1));
    }

    lastRenderedSig = listSig(displayRows);
    updateBadge(total);
    setTimeout(() => { rendering = false; }, 80);
  }

  function checkAndStack() {
    if (!isTargetRoute() || rendering) return;
    const tbody = getTbody();
    if (!tbody) return;
    if (tbody !== currentTbody) bindObserver();

    const domRows = readRowsFromDom();
    if (!domRows.length) return;
    if (listSig(domRows) === lastRenderedSig) return;

    accRows = mergeRows(domRows.slice(0, 100), accRows);
    renderRows();
  }

  function createBadge() {
    const grid = getGrid();
    if (!grid || document.getElementById('mes-inline-stack-badge')) return;
    const head = grid.querySelector('.hae-grid-head') || grid;

    const badge = document.createElement('div');
    badge.id = 'mes-inline-stack-badge';
    badge.style.cssText = `padding: 3px 8px; background: #fffbe6; border: 1px solid #ffe58f; color: #333; font-size: 12px; line-height: 20px; display: inline-flex; align-items: center; gap: 6px; vertical-align: middle; margin-right: 10px; white-space: nowrap;`;

    const h = new Date().getHours();
    const timeRange = `${String(h).padStart(2, '0')}:00-${String((h + 1) % 24).padStart(2, '0')}:00`;

    badge.innerHTML = `
      <span>鍙犲姞:<b id="mes-inline-stack-count" style="color:#1890ff;">0</b></span><span style="color:#d9d9d9;">|</span>
      <span>鏁堣兘(<span id="mes-uph-range">${timeRange}</span>):<b id="mes-inline-stack-uph" style="color:#d4380d;">0</b></span><span style="color:#d9d9d9;">|</span>
      <label style="display:inline-flex; align-items:center;">缁?<input type="number" id="mes-inline-stack-group" value="${groupSize}" min="0" max="100" style="width:32px; text-align:center; margin:0 2px; border:1px solid #ccc;"></label><span style="color:#d9d9d9;">|</span>
      <label><input type="checkbox" id="mes-inline-stack-unique" style="vertical-align:middle;">鍘婚噸</label><span style="color:#d9d9d9;">|</span>
      <label style="display:inline-flex; align-items:center;">楂?<input type="range" id="mes-height-slider" min="50" max="800" value="${heightOffset}" style="width:60px; margin:0 4px; cursor:pointer;"></label><span style="color:#d9d9d9;">|</span>
      <button id="mes-inline-stack-reset" style="font-size:12px; height:20px; padding:0 4px; cursor:pointer; border:1px solid #ccc; background:#fff; border-radius:3px;">閲嶇疆</button>
      <button id="mes-inline-stack-stop" style="font-size:12px; height:20px; padding:0 4px; cursor:pointer; border:1px solid #ccc; background:#fff; border-radius:3px;">鍋滄</button>
      <button id="mes-inline-stack-hide" style="font-size:12px; height:20px; padding:0 4px; cursor:pointer; border:1px solid #ccc; background:#fff; border-radius:3px;">闅愯棌</button>
    `;
    head.insertBefore(badge, head.firstChild);

    document.getElementById('mes-inline-stack-reset').onclick = () => { accRows = readRowsFromDom().slice(0, 100); hourSet.clear(); renderRows(); };
    document.getElementById('mes-inline-stack-stop').onclick = () => stop();
    document.getElementById('mes-inline-stack-hide').onclick = () => badge.style.display = 'none';

    const uniqueCb = document.getElementById('mes-inline-stack-unique');
    uniqueCb.checked = onlyUnique;
    uniqueCb.onchange = function() { onlyUnique = this.checked; saveSettings(); renderRows(); };

    const groupInput = document.getElementById('mes-inline-stack-group');
    groupInput.oninput = function() { groupSize = parseInt(this.value) || 0; saveSettings(); renderRows(); };

    const heightSlider = document.getElementById('mes-height-slider');
    heightSlider.onchange = () => saveSettings();
    heightSlider.oninput = function() { adjustGridHeight(parseInt(this.value)); };
  }

  function updateBadge(count) {
    const el = document.getElementById('mes-inline-stack-count');
    if (el) el.textContent = String(count);
  }

  function bindObserver() {
    const tbody = getTbody();
    if (!tbody) return;
    if (observer) observer.disconnect();
    currentTbody = tbody;
    observer = new MutationObserver(() => {
      if (rendering) return;
      clearTimeout(window.__mesInlineStackTimer);
      window.__mesInlineStackTimer = setTimeout(checkAndStack, 120);
    });
    observer.observe(tbody, { childList: true, subtree: true, characterData: true });
  }

  function start() {
    if (started || !isTargetRoute()) return;
    const tbody = getTbody();
    if (!getGrid() || !tbody) return;
    started = true;

    adjustGridHeight(heightOffset);
    createBadge();
    accRows = readRowsFromDom();
    trackUPH(accRows);

    if (accRows.length) renderRows();
    bindObserver();
    timer = setInterval(checkAndStack, CHECK_INTERVAL);
    uphTimer = setInterval(() => {
      checkHourChange();
      const uphEl = document.getElementById('mes-inline-stack-uph');
      if (uphEl) uphEl.textContent = String(hourSet.size);
    }, 1000);
  }

  function stop() {
    if (timer) clearInterval(timer);
    if (uphTimer) clearInterval(uphTimer);
    if (observer) observer.disconnect();
    const badge = document.getElementById('mes-inline-stack-badge');
    if (badge) badge.remove();
    started = false;
  }

  function bootWait() {
    if (!isTargetRoute()) return;
    if (getGrid() && getTbody()) { start(); return; }
    setTimeout(bootWait, 800);
  }

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (isTargetRoute()) setTimeout(bootWait, 1000);
      else stop();
    }
    if (isTargetRoute() && !started) bootWait();
  }, 1000);

  bootWait();
})();