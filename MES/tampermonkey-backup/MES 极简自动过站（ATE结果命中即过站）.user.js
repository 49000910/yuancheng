// ==UserScript==
// @name         MES 鏋佺畝鑷姩杩囩珯锛圓TE缁撴灉鍛戒腑鍗宠繃绔欙級
// @namespace    tm.mes.autopass.ate.result
// @version      0.2
// @match        https://w3.huawei.com/mespmm/wipweb*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // ===== MES鎺堟潈闂ㄧ START =====
  async function __MES_AUTH_GATE__() {
    if (
      location.hostname === 'mes.huawei.com' &&
      location.href.indexOf('/mespmm/rptwebnew') >= 0 &&
      location.hash.indexOf('autoExtract=1') >= 0
    ) {
      return true;
    }

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
  // ===== MES鎺堟潈闂ㄧ END =====

  if (!location.href.includes('#/ProductTrackInOut')) return;

  // 鍚庨潰鏄綘鐨勪唬鐮?

  // 杩欓噷鎹㈡垚浣犳姄鍒扮殑瀹屾暣URL
  var ATE_URL = 'https://w3.huawei.com/mespmm/gateway/S007307:mespmmrptservice/mespmm/rpt/services/wipAteFacade/selectPrintAteTestResultList/page/10/1/1/0';

var INTERVAL_MS = 1200;

var SN_CODE_CHECK_GATE_KEY = 'sn_code_check_gate_status';
var SN_CODE_GATE_STALE_MS = 120000;

// ===== 鑷姩杩囩珯妯″紡 =====
// bom_ate  = BOM瀛愰」鏍￠獙閫氳繃 + ATE閫氳繃 鍚庤繃绔?// bom_only = 鍙BOM瀛愰」鏍￠獙閫氳繃灏辫繃绔欙紝涓嶆煡ATE
var AUTO_PASS_MODE_KEY = 'auto_pass_mode';
var AUTO_PASS_MODE_BOM_ATE = 'bom_ate';
var AUTO_PASS_MODE_BOM_ONLY = 'bom_only';

var autoPassMode = localStorage.getItem(AUTO_PASS_MODE_KEY) || AUTO_PASS_MODE_BOM_ATE;


  var timer = null;
  var busy = false;

  // 宸茬粡鑷姩鐐硅繃杩囩珯鐨凷N锛岄槻姝㈤噸澶嶇偣
  var passedSet = new Set();

  // 杩炵画鏈懡涓鏁帮紝浠呯敤浜庤鏍囨樉绀?  var missCountMap = new Map();

  // ===== 鐘舵€佽鏍?=====
 var badge = document.createElement('div');
    badge.style.position = 'fixed';
    badge.style.left = '12px';
    badge.style.bottom = '12px';
    badge.style.zIndex = '2147483647';

    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '8px';
    badge.style.background = '#1677ff';
    badge.style.color = '#fff';
    badge.style.fontSize = '12px';
    badge.style.boxShadow = '0 4px 12px rgba(0,0,0,.2)';
    badge.textContent = '鑷姩杩囩珯锛氬垵濮嬪寲';

  function appendBadge() {
    if (!document.body.contains(badge)) {
      document.body.appendChild(badge);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appendBadge);
  } else {
    appendBadge();
  }

  function setBadge(text, color) {
    badge.textContent = '鑷姩杩囩珯锛? + text;
    badge.style.background = color || '#1677ff';
    console.log('[AUTO-PASS]', text);
  }
function syncAutoPassMode() {
  autoPassMode = localStorage.getItem(AUTO_PASS_MODE_KEY) || AUTO_PASS_MODE_BOM_ATE;
}

function createAutoPassModePanel() {
  var panel = document.createElement('div');
  panel.id = '__auto_pass_mode_panel';
  panel.style.position = 'fixed';
  panel.style.right = '12px';
  panel.style.bottom = '52px';
  panel.style.zIndex = '2147483647';
  panel.style.padding = '8px 10px';
  panel.style.borderRadius = '8px';
  panel.style.background = '#fff';
  panel.style.color = '#333';
  panel.style.fontSize = '12px';
  panel.style.boxShadow = '0 4px 12px rgba(0,0,0,.2)';
  panel.style.border = '1px solid #d9d9d9';
  panel.style.lineHeight = '1.8';

  var title = document.createElement('div');
  title.textContent = '鑷姩杩囩珯妯″紡';
  title.style.fontWeight = '700';
  title.style.marginBottom = '4px';
  panel.appendChild(title);

  function makeRadio(text, value) {
    var label = document.createElement('label');
    label.style.display = 'block';
    label.style.cursor = 'pointer';
    label.style.whiteSpace = 'nowrap';

    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = '__auto_pass_mode_radio';
    radio.value = value;
    radio.checked = autoPassMode === value;
    radio.style.marginRight = '6px';

    radio.addEventListener('change', function () {
      if (!radio.checked) return;

      localStorage.setItem(AUTO_PASS_MODE_KEY, value);
      syncAutoPassMode();

      if (autoPassMode === AUTO_PASS_MODE_BOM_ATE) {
        setBadge('妯″紡锛氭牎楠?ATE杩囩珯', '#1677ff');
      } else {
        setBadge('妯″紡锛氬彧鏍￠獙杩囩珯', '#fa8c16');
      }
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(text));
    return label;
  }

  panel.appendChild(makeRadio('鏍￠獙 + ATE杩囩珯', AUTO_PASS_MODE_BOM_ATE));
  panel.appendChild(makeRadio('鍙牎楠岃繃绔?, AUTO_PASS_MODE_BOM_ONLY));

  function append() {
    if (!document.getElementById('__auto_pass_mode_panel')) {
      document.body.appendChild(panel);
    }
  }

  if (document.body) {
    append();
  } else {
    document.addEventListener('DOMContentLoaded', append);
  }
}

// createAutoPassModePanel(); // 妯″紡寮€鍏冲凡绉诲埌涓€浣撳寲闈㈡澘鑴氭湰


window.addEventListener('storage', function (e) {
  if (e.key === AUTO_PASS_MODE_KEY) {
    syncAutoPassMode();
  }
});

  function toStr(v) {
    return v == null ? '' : String(v).trim();
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function fmtDateTime(d, endOfDay) {
    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate())
    ].join('-') + (endOfDay ? ' 23:59:59' : ' 00:00:00');
  }

  function getParentInput() {
    var all = [].slice.call(document.querySelectorAll(
      'div[id^="Input_"] > input.hae-ui-input[type="text"], div[id^="Input_"] > input'
    ));

    for (var i = 0; i < all.length; i++) {
      var box = all[i].closest('div[id^="Input_"]');
      var ctx = ((box && box.parentElement ? box.parentElement.innerText : '') || '').replace(/\s+/g, '');
      if (ctx.indexOf('鏉＄爜閲囬泦') >= 0) return all[i];
    }

    return all[3] || null;
  }
function normGateParent(v) {
  return v == null ? '' : String(v).replace(/\s+/g, '').toUpperCase();
}

function readSnCodeGate(currentParentSn) {
  var raw = localStorage.getItem(SN_CODE_CHECK_GATE_KEY);


  if (!raw) {
    return {
      ok: false,
      msg: '鏈敹鍒癇OM瀛愰」SN鏍￠獙鐘舵€?
    };
  }

  var data = null;

  try {
    data = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      msg: 'BOM瀛愰」SN鐘舵€佽В鏋愬け璐?
    };
  }

  if (!data || !data.ts) {
    return {
      ok: false,
      msg: 'BOM瀛愰」SN鐘舵€佹棤鏁?
    };
  }

  if (Date.now() - data.ts > SN_CODE_GATE_STALE_MS) {
    return {
      ok: false,
      msg: 'BOM瀛愰」SN鐘舵€佽繃鏈?
    };
  }

  if (!data.parentSn) {
    return {
      ok: false,
      msg: '鏈瘑鍒埗椤规潯鐮?
    };
  }

  if (normGateParent(data.parentSn) !== normGateParent(currentParentSn)) {
    return {
      ok: false,
      msg: '鐖堕」鏉＄爜涓嶄竴鑷达紝绛夊緟BOM鐘舵€佸埛鏂?
    };
  }

  if (!data.total) {
    return {
      ok: false,
      msg: '鏈娴嬪埌BOM瀛愰」SN妗?
    };
  }

  if (data.filled < data.total) {
    return {
      ok: false,
      msg: 'BOM瀛愰」鏈壂瀹?' + data.filled + '/' + data.total
    };
  }

  if (data.duplicate > 0) {
    return {
      ok: false,
      msg: 'BOM瀛愰」閲嶅鏉＄爜 ' + data.duplicate + ' 涓?
    };
  }

  if (data.pending > 0) {
    return {
      ok: false,
      msg: 'BOM瀛愰」鏍￠獙涓?' + data.pending + ' 涓?
    };
  }

  if (data.bad > 0) {
    return {
      ok: false,
      msg: 'BOM瀛愰」缂栫爜寮傚父 ' + data.bad + ' 涓?
    };
  }

  if (!data.allOk) {
    return {
      ok: false,
      msg: 'BOM瀛愰」鏈叏閮ㄩ€氳繃'
    };
  }

  return {
    ok: true,
    msg: 'BOM瀛愰」鏍￠獙閫氳繃 ' + data.ok + '/' + data.total,
    data: data
  };
}

  function getPassBtn() {
    var list = document.querySelectorAll('button.hae-btn');

    for (var i = 0; i < list.length; i++) {
      var txt = (list[i].innerText || '').replace(/\s+/g, '');
      var hasSaveIcon = !!list[i].querySelector('.hae-icon.icon-save');

      if (txt === '杩囩珯' && hasSaveIcon) return list[i];
    }

    return null;
  }

  function buildBody(sn) {
  var end = new Date();


    // 浣犳姄鍒扮殑鏄ぇ绾﹀線鍓嶅崐骞达紝杩欓噷鐢?80澶╋紝澶熸煡鏈€杩慉TE缁撴灉
    var start = new Date(end.getTime() - 180 * 24 * 3600 * 1000);

    return {
      siteId: '50',
      workProcess: null,
      workSite: null,
      barCode: sn,
      testResult: null,
      tpsName: null,
      equipmentSn: null,
      createdFrom: fmtDateTime(start, false),
      createdTo: fmtDateTime(end, true)
    };
  }

  async function postJson(url, body) {
    console.groupCollapsed('[AUTO-PASS] 鏌ヨATE');
    console.log('URL:', url);
    console.log('Body:', body);
    console.groupEnd();

    var r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    var text = await r.text();

    console.groupCollapsed('[AUTO-PASS] ATE杩斿洖 ' + r.status);
    console.log('responseText:', text.slice(0, 1500));
    console.groupEnd();

    if (!r.ok) {
      throw new Error('HTTP ' + r.status + '锛? + text.slice(0, 200));
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('JSON瑙ｆ瀽澶辫触锛? + text.slice(0, 200));
    }
  }

  function getRows(j) {
    if (
      j &&
      j.resultObjVO &&
      Array.isArray(j.resultObjVO.result)
    ) {
      return j.resultObjVO.result;
    }

    return [];
  }

  // 鏂版帴鍙ｅ懡涓鍒欙細
  // testResult === "0" 鎴?orgTestResult === "0" 鎴?mesTestResult === "Y"
  function hitRule(row, sn) {
    if (!row) return false;

    var barCode = toStr(row.barCode);
    if (barCode && barCode !== sn) return false;

    var testResult = toStr(row.testResult);
    var orgTestResult = toStr(row.orgTestResult);
    var mesTestResult = toStr(row.mesTestResult).toUpperCase();
    var failDesc = toStr(row.failDesc);

    return testResult === '0' ||
           orgTestResult === '0' ||
           mesTestResult === 'Y' ||
           failDesc.indexOf('鎴愬姛') >= 0;
  }

  async function queryAtePass(sn) {
    var j = await postJson(ATE_URL, buildBody(sn));
    var rows = getRows(j);

    console.log('[AUTO-PASS] ATE rows:', rows.length);
    if (rows.length) console.table(rows.slice(0, 5));

    var hit = rows.some(function (row) {
      return hitRule(row, sn);
    });

    return {
      hit: hit,
      rows: rows,
      raw: j
    };
  }

  async function checkLoop() {
    if (busy) return;
    busy = true;

    try {
      var input = getParentInput();

      if (!input) {
        setBadge('鏈壘鍒版潯鐮侀噰闆嗘', '#cf1322');
        return;
      }

      var sn = toStr(input.value);

      if (!sn) {
        setBadge('绛夊緟鎵爜', '#1677ff');
        return;
      }

    if (passedSet.has(sn)) {
  setBadge('宸插鐞嗭細' + sn, '#389e0d');
  return;
}

syncAutoPassMode();

// 绗竴姝ワ細鏃犺鍝釜妯″紡锛岄兘蹇呴』鍏堟牎楠孊OM瀛愰」SN
var gate = readSnCodeGate(sn);
if (!gate.ok) {
  setBadge('绛夊緟BOM鏍￠獙锛? + gate.msg, '#fa8c16');
  return;
}

// 绗簩姝ワ細鏍规嵁妯″紡鍐冲畾鏄惁鏌ヨATE
if (autoPassMode === AUTO_PASS_MODE_BOM_ATE) {
  setBadge(gate.msg + '锛屾煡璇TE锛? + sn, '#1677ff');

  var ret = await queryAtePass(sn);

  if (!ret.hit) {
    var n = (missCountMap.get(sn) || 0) + 1;
    missCountMap.set(sn, n);

    setBadge('ATE鏈€氳繃/鏈嚭缁撴灉锛岀户缁瓑 ' + n + '锛? + sn, '#fa8c16');
    return;
  }

  setBadge('BOM鏍￠獙閫氳繃锛孉TE閫氳繃锛屽噯澶囪繃绔欙細' + sn, '#389e0d');

} else if (autoPassMode === AUTO_PASS_MODE_BOM_ONLY) {
  setBadge('BOM鏍￠獙閫氳繃锛屽彧鏍￠獙妯″紡锛屽噯澶囪繃绔欙細' + sn, '#fa8c16');

} else {
  setBadge('鏈煡杩囩珯妯″紡锛岀姝㈣繃绔?, '#cf1322');
  return;
}


      var btn = getPassBtn();

      if (!btn) {
        setBadge('鏍￠獙閫氳繃锛屼絾鏈壘鍒拌繃绔欐寜閽?, '#cf1322');
        return;
      }

      btn.click();

      passedSet.add(sn);
      missCountMap.delete(sn);

      setBadge('宸茶嚜鍔ㄨ繃绔欙細' + sn, '#389e0d');
    } catch (e) {
      console.error('[AUTO-PASS] 寮傚父璇︽儏:', e);
      setBadge('寮傚父锛? + (e && e.message ? e.message : String(e)), '#cf1322');
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;

    timer = setInterval(checkLoop, INTERVAL_MS);
    setBadge('杩愯涓?, '#1677ff');

    // 鍚姩鍚庣珛鍗虫煡涓€娆?    setTimeout(checkLoop, 300);
  }

  window.autoPassAteTest = async function (sn) {
    sn = toStr(sn);
    if (!sn) {
      console.warn('鐢ㄦ硶锛歛utoPassAteTest("SN")');
      return;
    }

    var ret = await queryAtePass(sn);
    console.log('[AUTO-PASS TEST] hit:', ret.hit);
    console.log('[AUTO-PASS TEST] rows:', ret.rows);
    return ret;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
