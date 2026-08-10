// ==UserScript==
// @name        MES 涓€浣撳寲锛堝浐瀹氶摼鎺?鎵归噺杩囩珯锛?// @namespace    tampermonkey.mes.allinone.final
// @version      3.0
// @description  鍥哄畾UI鎻愬彇鏉＄爜骞跺洖濉紱鎵嬪姩杞藉叆寮€濮嬶紱SN閲嶅閿佸畾+甯搁┗姘旀场
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect      w3.huawei.com



// @grant        GM_addValueChangeListener
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


  // 鍥哄畾鎻愬彇閾炬帴锛堟寜浣犺姹傦級


  // 鍥哄畾鎻愬彇閾炬帴锛堟寜浣犺姹傦級
  var FIXED_UI_URL = 'https://mes.huawei.com/mespmm/rptwebnew#/ProductList#autoExtract=1';

    // ===== 淇濇寔鐧诲叆 =====
var KEEPALIVE_URL = 'https://w3.huawei.com/mespmm/gateway/com.huawei.supply.mes.mesplus.pspw:mespmmsystemservice/mespmm/sys/only4ssoTimeUpdate.do';
var KEEPALIVE_CFG_KEY = 'tm_keepalive_cfg';
var keepAliveTimer = null;

// 浠诲姟浠ゆ潯鐮佹帴鍙ｆ彁鍙栵紝涓€椤垫渶澶?00鏉★紝瓒呰繃鑷姩缈婚〉
var TASK_SN_API_BASE = 'https://w3.huawei.com/mespmm/gateway/S007307:mespmmrptservice/mespmm/rpt/services/wipTaskSn/findlist/page';

  var fallbackIndex = 3;
  var loadingSelector = '#global_toploading_flag';

  // 蹇參鑷€傚簲
  var tickMs = 50;
  var maxWaitMs = 60000;
  var fastPassMs = 1200;

  var KEY_JOB = 'mes_extract_job';
  var KEY_RESULT = 'mes_extract_result';

  var queue = [];
  var idx = 0;
  var running = false;
  var waiting = false;
  var waitStart = 0;
  var submitAt = 0;
  var currentCode = '';
  var ticking = false;
  var sawLoading = false;
  var loadingGoneCount = 0;

  var extractRunning = false;
  var lastJobId = '';
// ===== 鏉＄爜鍥炶溅锛氭壂鐮佹灙鐪熷疄Enter鍚庯紝绛夊緟鈥滀骇鍝佽繘绔欐垚鍔熲€濓紝鍐嶈ˉ涓€涓狤nter =====
var BARCODE_ENTER_KEY = 'tm_barcode_enter_on';

var barcodeEnterPending = false;
var barcodeEnterTriggerAt = 0;
var barcodeEnterValue = '';
var barcodeEnterLastAutoAt = 0;
var barcodeEnterSending = false;
var barcodeEnterBoundInput = null;
var barcodeEnterDocBound = false;
var barcodeEnterBgStarted = false;


// 璁板綍鎵爜鍓嶉〉闈笂宸叉湁澶氬皯鏉♀€滃綋鍓嶆潯鐮佽繘绔欐垚鍔熲€濇彁绀猴紝闃叉鏃ф彁绀鸿瑙﹀彂
var barcodeEnterSuccessCountBefore = 0;



  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function isVisible(el) {
    if (!el) return false;
    var st = getComputedStyle(el);
    return el.offsetParent !== null && st.display !== 'none' && st.visibility !== 'hidden';
  }

  function setStatus(msg, color) {
    color = color || '#333';
    var el = document.getElementById('tm-batch-status');
    if (el) {
      el.textContent = msg;
      el.style.color = color;
    }
    console.log('[MES] ' + msg);
  }

  function setProgress() {
    var el = document.getElementById('tm-batch-progress');
    if (el) el.textContent = idx + '/' + queue.length;
  }
    function loadKeepAliveCfg() {
  try {
    var c = JSON.parse(localStorage.getItem(KEEPALIVE_CFG_KEY) || '{}');
    return {
      enabled: !!c.enabled,
      sec: Number(c.sec || 600)
    };
  } catch (e) {
    return {
      enabled: false,
      sec: 600
    };
  }
}

function saveKeepAliveCfg(c) {
  localStorage.setItem(KEEPALIVE_CFG_KEY, JSON.stringify(c));
}

async function keepAliveOnce() {
  try {
    // 鍙湪 w3 鍩熷悕鎵ц锛岄伩鍏嶅叾瀹冮〉闈㈣法鍩熷紓甯?    if (location.hostname !== 'w3.huawei.com') return;

    var r = await fetch(KEEPALIVE_URL, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });

    var el = document.getElementById('tm-keepalive-status');

    if (r.status === 401) {
      if (el) {
        el.textContent = '鎺夌嚎';
        el.style.color = '#cf1322';
      }
      console.warn('[MES] 淇濇寔鐧诲叆澶辫触锛?01');
      return;
    }

    if (el) {
      el.textContent = '鍦ㄧ嚎';
      el.style.color = '#389e0d';
    }

    console.log('[MES] keepAlive ok:', r.status);
  } catch (e) {
    var el2 = document.getElementById('tm-keepalive-status');
    if (el2) {
      el2.textContent = '寮傚父';
      el2.style.color = '#fa8c16';
    }
    console.warn('[MES] keepAlive error:', e);
  }
}

function restartKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  var cfg = loadKeepAliveCfg();

  if (!cfg.enabled) {
    var el = document.getElementById('tm-keepalive-status');
    if (el) {
      el.textContent = '鍏?;
      el.style.color = '#666';
    }
    return;
  }

 var ms = Math.max(30, Number(cfg.sec) || 600) * 1000;

  keepAliveTimer = setInterval(function () {
    keepAliveOnce();
  }, ms);

  keepAliveOnce();
}


  function parseCodes(txt) {
    return (txt || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
// ===== 鏉＄爜鍥炶溅鍔熻兘 =====
function isBarcodeEnterEnabled() {
  return localStorage.getItem(BARCODE_ENTER_KEY) === '1';
}

function isBarcodeInput(el) {
  if (!el) return false;

  var target = getParentInput();

  if (target && el === target) return true;

  var box = el.closest && el.closest('div[id^="Input_"]');
  var ctx = ((box && box.parentElement ? box.parentElement.innerText : '') || '').replace(/\s+/g, '');

  return ctx.indexOf('鏉＄爜閲囬泦') >= 0;
}

// 缁熻椤甸潰涓娾€滃綋鍓嶆潯鐮?+ 浜у搧杩涚珯鎴愬姛鈥濈殑娆℃暟
function countBarcodeTrackInSuccess(code) {
  if (!code) return 0;

  var text = document.body && document.body.innerText ? document.body.innerText : '';

  if (!text) return 0;

  code = String(code).trim();

  if (!code) return 0;

  var count = 0;
  var pos = 0;

  while (true) {
    var idx = text.indexOf(code, pos);

    if (idx < 0) break;

    // 鍙栧綋鍓嶆潯鐮侀檮杩戠殑鏂囧瓧
    // 绀轰緥锛?    // 銆?32VBY10S6001881銆戣繃绔欎俊鎭細
    // 浜у搧杩涚珯鎴愬姛!
    var near = text.slice(Math.max(0, idx - 80), idx + 500);

    var hasSuccess =
      near.indexOf('浜у搧杩涚珯鎴愬姛') >= 0 ||
      near.indexOf('杩涚珯鎴愬姛') >= 0;

    var hasInfo =
      near.indexOf('杩囩珯淇℃伅') >= 0 ||
      near.indexOf('杩涚珯淇℃伅') >= 0 ||
      near.indexOf('杩囩珯') >= 0;

    if (hasSuccess && hasInfo) {
      count++;
    }

    pos = idx + code.length;

    if (count > 20) break;
  }

  return count;
}

function hasNewBarcodeTrackInSuccess(code) {
  var nowCount = countBarcodeTrackInSuccess(code);
  return nowCount > barcodeEnterSuccessCountBefore;
}

function prepareBarcodeEnter(input, reason) {
  if (!isBarcodeEnterEnabled()) return;

  // 鎵归噺杩囩珯杩愯鏃朵笉瑙﹀彂锛岄伩鍏嶅啿绐?  if (running || waiting) return;

  // 鑷繁琛?Enter 鏃朵笉瑙﹀彂
  if (barcodeEnterSending) return;

  var v = input && input.value ? String(input.value).trim() : '';

  if (!v) return;

  // 璁板綍鎵爜鍓嶉〉闈笂宸叉湁澶氬皯鏉″綋鍓嶆潯鐮佹垚鍔熸彁绀猴紝闃叉鏃ф彁绀鸿瑙﹀彂
  barcodeEnterSuccessCountBefore = countBarcodeTrackInSuccess(v);

  barcodeEnterPending = true;
  barcodeEnterTriggerAt = Date.now();
  barcodeEnterValue = v;

  console.log('[MES] 鏉＄爜鍥炶溅锛氬凡鎹曡幏鎵爜 Enter锛岀瓑寰呰繘绔欐垚鍔熸彁绀?, {
    value: v,
    reason: reason,
    successCountBefore: barcodeEnterSuccessCountBefore
  });

  setStatus('鏉＄爜鍥炶溅锛氱瓑寰呰繘绔欐垚鍔熸彁绀?, '#1677ff');
}

function pressEnterForBarcodeEnter() {
  var input = getParentInput();

  if (!input) {
    setStatus('鏉＄爜鍥炶溅锛氭湭鎵惧埌鏉＄爜閲囬泦妗?, '#cf1322');
    return false;
  }

  var currentValue = String(input.value || '').trim();

  // 濡傛灉杈撳叆妗嗗唴瀹瑰凡缁忓彉浜嗭紝璇存槑鐢ㄦ埛鍙堟壂浜嗗埆鐨勶紝閬垮厤璇ˉ
  if (barcodeEnterValue && currentValue && currentValue !== barcodeEnterValue) {
    console.warn('[MES] 鏉＄爜鍥炶溅锛氳緭鍏ユ鍐呭宸插彉鍖栵紝鍙栨秷琛?Enter', {
      oldValue: barcodeEnterValue,
      currentValue: currentValue
    });

    setStatus('鏉＄爜鍥炶溅锛氭潯鐮佸凡鍙樺寲锛屽彇娑堣ˉ Enter', '#fa8c16');
    return false;
  }

  barcodeEnterSending = true;

  try {
    input.focus();

    var opts = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    };

    input.dispatchEvent(new KeyboardEvent('keydown', opts));
    input.dispatchEvent(new KeyboardEvent('keypress', opts));
    input.dispatchEvent(new KeyboardEvent('keyup', opts));

    barcodeEnterLastAutoAt = Date.now();

    console.log('[MES] 鏉＄爜鍥炶溅锛氬凡鑷姩琛?Enter', barcodeEnterValue);

    setStatus('鏉＄爜鍥炶溅锛氬凡鑷姩琛?Enter', '#389e0d');

    return true;
  } finally {
    setTimeout(function () {
      barcodeEnterSending = false;
    }, 500);
  }
}

function bindBarcodeEnterInput() {
  var input = getParentInput();

  if (input) {
    barcodeEnterBoundInput = input;
  }

  // document 绾х洃鍚彧缁戝畾涓€娆?  // 涓嶄緷璧栭潰鏉挎槸鍚︽樉绀猴紝涔熶笉鎬?MES 閲嶆覆鏌撹緭鍏ユ
  if (barcodeEnterDocBound) return;

  barcodeEnterDocBound = true;

  document.addEventListener('', function (e) {
    try {
      if (!isBarcodeEnterEnabled()) return;

      if (e.key !== 'Enter' && e.keyCode !== 13) return;

      // 鍙帴鍙楃湡瀹炴壂鐮佹灙/閿洏 Enter锛屼笉鎺ュ彈鑴氭湰鑷繁娲惧彂鐨?Enter
      if (!e.isTrusted) return;

      var target = e.target;

      if (!target) return;

      if (!isBarcodeInput(target)) return;

      barcodeEnterBoundInput = target;

      // 寤惰繜涓€鎷嶏紝纭繚鎵爜鏋緭鍏ュ€煎凡缁忓啓鍏?input.value
      setTimeout(function () {
        prepareBarcodeEnter(target, 'background document trusted enter');
      }, 0);

    } catch (err) {
      console.warn('[MES] 鏉＄爜鍥炶溅锛歞ocument鐩戝惉寮傚父', err);
    }
  }, true);

  console.log('[MES] 鏉＄爜鍥炶溅锛歞ocument绾х洃鍚凡鍚姩锛岄潰鏉挎渶灏忓寲涓嶅奖鍝?);
}


async function barcodeEnterTick() {
  if (!isBarcodeEnterEnabled()) {
    barcodeEnterPending = false;
    return;
  }

  // 瀹氭湡缁戝畾锛屽洜涓洪〉闈㈠彲鑳介噸娓叉煋杈撳叆妗?  bindBarcodeEnterInput();

  if (!barcodeEnterPending) return;

  // 鎵归噺杩囩珯涓笉澶勭悊
  if (running || waiting) return;

  var now = Date.now();

  // 瓒呰繃 15 绉掓病妫€娴嬪埌鎴愬姛鎻愮ず锛屽彇娑堟湰娆?  if (now - barcodeEnterTriggerAt > 15000) {
    barcodeEnterPending = false;

    console.warn('[MES] 鏉＄爜鍥炶溅锛氱瓑寰呰繘绔欐垚鍔熸彁绀鸿秴鏃讹紝鍙栨秷鏈', barcodeEnterValue);

    setStatus('鏉＄爜鍥炶溅锛氱瓑寰呰繘绔欐垚鍔熻秴鏃讹紝宸插彇娑?, '#fa8c16');

    return;
  }

  // 鍙垽鏂綋鍓嶆潯鐮佹槸鍚﹀嚭鐜版柊鐨勨€滀骇鍝佽繘绔欐垚鍔熲€濇彁绀?  if (!hasNewBarcodeTrackInSuccess(barcodeEnterValue)) {
    return;
  }

  // 闃叉鐭椂闂撮噸澶嶈ˉ Enter
  if (now - barcodeEnterLastAutoAt < 2500) {
    barcodeEnterPending = false;
    return;
  }

  barcodeEnterPending = false;

  console.log('[MES] 鏉＄爜鍥炶溅锛氭娴嬪埌褰撳墠鏉＄爜杩涚珯鎴愬姛锛屽噯澶囪ˉ Enter', {
    barcode: barcodeEnterValue,
    before: barcodeEnterSuccessCountBefore,
    now: countBarcodeTrackInSuccess(barcodeEnterValue)
  });

  setStatus('鏉＄爜鍥炶溅锛氭娴嬪埌杩涚珯鎴愬姛锛屽噯澶囪ˉ Enter', '#389e0d');

  // 绋嶇瓑椤甸潰绋冲畾
  await sleep(300);

  pressEnterForBarcodeEnter();
}

    function parseTaskNos(txt) {
  var tokens = String(txt || '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || [];

  var out = [];
  var seen = {};

  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];

    // 浠诲姟浠や竴鑸槸 10~12 浣嶏紝鍓嶉潰鑷冲皯4浣嶅瓧姣嶏紝涓斿寘鍚暟瀛?    // 绀轰緥锛欵PZE145150D銆丒PZEL452606銆丏DEDZN051406
    if (t.length < 10 || t.length > 12) continue;
    if (!/^[A-Z]{4,8}[A-Z0-9]*$/.test(t)) continue;
    if (!/[0-9]/.test(t)) continue;

    // 鎺掗櫎鏄庢樉涓嶆槸浠诲姟浠ょ殑鍐呭
    if (t.indexOf('ROHS') >= 0) continue;
    if (t.indexOf('LINE') === 0) continue;
    if (t.indexOf('SUB') === 0) continue;

    if (!seen[t]) {
      seen[t] = 1;
      out.push(t);
    }
  }

  return out;
}

      // ===== 浠诲姟浠ゆ潯鐮佹帴鍙ｆ彁鍙?=====
  function taskApiPad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function taskApiFmtDateTime(d, endOfDay) {
    return [
      d.getFullYear(),
      taskApiPad2(d.getMonth() + 1),
      taskApiPad2(d.getDate())
    ].join('-') + (endOfDay ? ' 23:59:59' : ' 00:00:00');
  }

  function gmPostJson(url, data) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'POST',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: JSON.stringify(data),
        timeout: 30000,
        onload: function (res) {
          var text = String(res.responseText || '');

          console.groupCollapsed('[TASK-SN-API] 杩斿洖 ' + res.status);
          console.log('URL:', url);
          console.log('Body:', data);
          console.log('Response鍓?500瀛楃:', text.slice(0, 1500));
          console.groupEnd();

          if (res.status < 200 || res.status >= 300) {
            reject(new Error('HTTP ' + res.status + '锛? + text.slice(0, 200)));
            return;
          }

          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error('JSON瑙ｆ瀽澶辫触锛? + text.slice(0, 200)));
          }
        },
        onerror: function (e) {
          try {
            reject(new Error('璇锋眰澶辫触锛? + JSON.stringify(e).slice(0, 200)));
          } catch (err) {
            reject(new Error('璇锋眰澶辫触'));
          }
        },
        ontimeout: function () {
          reject(new Error('璇锋眰瓒呮椂'));
        }
      });
    });
  }

  function buildTaskSnBody(taskNo, siteId) {
    var end = new Date();

    // 鏌ユ渶杩?80澶╋紝浠诲姟浠ゆ瘮杈冭€佷篃鑳借鐩?    var start = new Date(end.getTime() - 180 * 24 * 3600 * 1000);

    return {
      siteId: String(siteId),
      snType: 10,
      partNo: null,
      sn: null,
      traySn: null,
      taskNo: taskNo,
      workstepName: null,
      snStatus: null,
      productSnCategory: '10',
      createdFrom: taskApiFmtDateTime(start, false),
      createdTo: taskApiFmtDateTime(end, true)
    };
  }

async function queryTaskSnOneMode(taskNo, siteId, modeA, modeB) {
  var pageSize = 100;
  var pageNo = 1;
  var allRows = [];
  var maxPages = 300;

  while (pageNo <= maxPages) {
    var url = TASK_SN_API_BASE + '/' + pageSize + '/' + pageNo + '/' + modeA + '/' + modeB;
    var body = buildTaskSnBody(taskNo, siteId);

    console.log(
      '[TASK-SN-API] 鏌ヨ taskNo=' + String(taskNo).slice(0, 80) +
      ' siteId=' + siteId +
      ' mode=' + modeA + '/' + modeB +
      ' page=' + pageNo
    );

    var j = await gmPostJson(url, body);

    var vo = j && j.resultObjVO ? j.resultObjVO : {};
    var pageVO = vo.pageVO || {};
    var rows = Array.isArray(vo.result) ? vo.result : [];

    console.log(
      '[TASK-SN-API] page=' + pageNo +
      ' rows=' + rows.length +
      ' totalRows=' + (pageVO.totalRows || '') +
      ' totalPages=' + (pageVO.totalPages || '')
    );

    allRows = allRows.concat(rows);



setStatus(
  '鎺ュ彛缈婚〉锛歴iteId=' + siteId +
  ' mode=' + modeA + '/' + modeB +
  ' 绗? + pageNo +
  '椤碉紝绱' + allRows.length + '鏉?,
  '#1677ff'
);

    // 鏍稿績锛氫笉瑕佸彧淇?totalPages
    // 涓€椤垫渶澶?00鏉★紝濡傛灉鏈〉灏戜簬100锛岃鏄庡埌鏈€鍚庝竴椤?    if (rows.length < pageSize) {
      break;
    }

    pageNo++;
  }

  console.log(
    '[TASK-SN-API] 瀹屾垚 siteId=' + siteId +
    ' mode=' + modeA + '/' + modeB +
    ' 鎬籸ows=' + allRows.length +
    ' 鏌ヨ椤垫暟=' + pageNo
  );

  return allRows;
}


async function extractTaskCodesByApi(taskNos) {
  if (!Array.isArray(taskNos)) {
    taskNos = parseTaskNos(taskNos);
  }

  taskNos = taskNos.map(function (x) {
    return String(x || '').trim().toUpperCase();
  }).filter(Boolean);

  if (!taskNos.length) {
    throw new Error('鏈瘑鍒埌浠诲姟浠?);
  }

   // 鎺ュ彛鏀寔澶氫换鍔′护锛氶€楀彿鍒嗛殧
  var taskNoText = taskNos.join(',');


  // 涓や釜缁勭粐閮藉皾璇曪紝閬垮厤涓嶅悓浠诲姟浠ゅ睘浜庝笉鍚岀粍缁?  var siteIds = ['50', '66'];

  // 浣犳姄鍒拌繃 /10/0 鍜?/0/0锛屼袱绉嶉兘灏濊瘯
  var modes = [
    [10, 0],
    [0, 0]
  ];

  var codeMap = {};
  var allCodes = [];
  var hitInfo = [];

  for (var s = 0; s < siteIds.length; s++) {
    for (var m = 0; m < modes.length; m++) {
      var siteId = siteIds[s];
      var modeA = modes[m][0];
      var modeB = modes[m][1];

      var rows = await queryTaskSnOneMode(taskNoText, siteId, modeA, modeB);

      hitInfo.push({
        siteId: siteId,
        mode: modeA + '/' + modeB,
        rows: rows.length
      });

      for (var i = 0; i < rows.length; i++) {
        var sn = rows[i] && rows[i].sn;
        sn = sn == null ? '' : String(sn).trim();

        if (!sn) continue;

        if (!codeMap[sn]) {
          codeMap[sn] = 1;
          allCodes.push(sn);
        }
      }

      console.log(
        '[TASK-SN-API] 缁勫悎瀹屾垚 siteId=' + siteId +
        ' mode=' + modeA + '/' + modeB +
        ' rows=' + rows.length +
        ' 褰撳墠绱SN=' + allCodes.length
      );
    }
  }

  return {
    codes: allCodes,
    taskNos: taskNos,
    taskCount: taskNos.length,
    hitInfo: hitInfo
  };
}


  function isLoadingVisible() {
    var el = document.querySelector(loadingSelector);
    if (!el) return false;
    var st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
  }

  // ===== 鐖堕」杩囩珯杈撳叆妗?=====
  function getParentInput() {
    var all = [].slice.call(document.querySelectorAll('div[id^="Input_"] > input.hae-ui-input[type="text"],div[id^="Input_"] > input'));
    for (var i = 0; i < all.length; i++) {
      var box = all[i].closest('div[id^="Input_"]');
      var ctx = ((box && box.parentElement ? box.parentElement.innerText : '') || '').replace(/\s+/g, '');
      if (ctx.indexOf('鏉＄爜閲囬泦') >= 0) return all[i];
    }
    return all[fallbackIndex] || null;
  }

  async function submitOne(code) {
    var input = getParentInput();
    if (!input) {
      setStatus('鏈壘鍒扳€滄潯鐮侀噰闆嗏€濊緭鍏ユ', '#cf1322');
      running = false;
      return false;
    }

    input.focus();
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(input, code);
    else input.value = code;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(40);

    var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', opts));
    input.dispatchEvent(new KeyboardEvent('keypress', opts));
    input.dispatchEvent(new KeyboardEvent('keyup', opts));
    return true;
  }

  async function tick() {
    if (!running || ticking) return;
    ticking = true;
    try {
      if (waiting) {
        var on = isLoadingVisible();

        if (on) {
          sawLoading = true;
          loadingGoneCount = 0;
        } else if (sawLoading) {
          loadingGoneCount++;
        }

        if (sawLoading && loadingGoneCount >= 2) {
          waiting = false;
          idx++;
          setProgress();
          await sleep(40);
          return;
        }

        if (!sawLoading && (Date.now() - submitAt) >= fastPassMs) {
          waiting = false;
          idx++;
          setProgress();
          await sleep(40);
          return;
        }

        if (Date.now() - waitStart > maxWaitMs) {
          running = false;
          waiting = false;
          setStatus('绗?' + (idx + 1) + ' 鏉¤秴鏃讹細' + currentCode + '锛屽凡鏆傚仠', '#cf1322');
        }
        return;
      }

      if (idx >= queue.length) {
        running = false;
        localStorage.setItem('MES_BATCH_RUNNING_FLAG', '0'); // 銆愬姞杩欒锛氬彇娑堟殫鍙枫€?        setStatus('瀹屾垚锛氬叡 ' + queue.length + ' 鏉?, '#389e0d');
        return;
      }

currentCode = queue[idx];

      sawLoading = false;
      loadingGoneCount = 0;

      var ok = await submitOne(currentCode);
      if (!ok) return;

      submitAt = Date.now();
      waiting = true;
      waitStart = Date.now();
      setStatus('鎻愪氦涓?(' + (idx + 1) + '/' + queue.length + ')锛? + currentCode, '#1677ff');
    } finally {
      ticking = false;
    }
  }

  // ===== 鎻愬彇閫昏緫 =====
  function getTaskMagnifier() {
    var list = [].slice.call(document.querySelectorAll('a.hae-icon.icon-search')).filter(isVisible);
    return list[1] || null;
  }

  function getTaskDialog() {
    var titles = document.querySelectorAll('.hae-dialog__title');
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      if ((t.innerText || '').indexOf('浠诲姟浠ゅ杈撳叆妗?) >= 0 && isVisible(t)) {
        return t.closest('.hae-dialog__wrapper') || t.closest('.hae-dialog-box');
      }
    }
    var form = document.querySelector('#addForm');
    if (form) return form.closest('.hae-dialog__wrapper') || form.closest('.hae-dialog-box');
    return null;
  }

  function getTaskTextarea(dialog) {
    if (!dialog) return null;
    return dialog.querySelector('#addForm div[id^="Textarea_"] > textarea.textarea')
      || dialog.querySelector('#addForm textarea.textarea')
      || dialog.querySelector('textarea.textarea')
      || dialog.querySelector('textarea');
  }

  function setTextareaValue(el, value) {
    var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findBtnByText(txt, root) {
    root = root || document;
    var list = root.querySelectorAll('button');
    for (var i = 0; i < list.length; i++) {
      if (isVisible(list[i]) && (list[i].innerText || '').trim() === txt) return list[i];
    }
    return null;
  }

  async function waitLoadingDone(max) {
    max = max || 18000;
    var start = Date.now();
    var seen = false;
    while (Date.now() - start < max) {
      var on = isLoadingVisible();
      if (on) seen = true;
      if (seen && !on) return true;
      await sleep(120);
    }
    return false;
  }

  async function waitRowsReady(max) {
    max = max || 12000;
    var start = Date.now();
    while (Date.now() - start < max) {
      if (document.querySelectorAll('tr.grid-row').length > 0) return true;
      await sleep(150);
    }
    return false;
  }

  function extractCodes() {
    var list = [].slice.call(document.querySelectorAll('tr.grid-row td:nth-of-type(3) span.grid-input'))
      .map(function (el) { return (el.innerText || '').trim(); })
      .filter(Boolean);

    if (!list.length) {
      list = [].slice.call(document.querySelectorAll('tr.grid-row span.grid-input'))
        .map(function (el) { return (el.innerText || '').trim(); })
        .filter(function (v) { return /^[0-9A-Za-z]{8,}$/.test(v); });
    }

    var map = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (!map[list[i]]) { map[list[i]] = 1; out.push(list[i]); }
    }
    return out;
  }

  async function waitUntil(cond, timeout, step) {
    timeout = timeout || 45000;
    step = step || 250;
    var start = Date.now();
    while (Date.now() - start < timeout) {
      if (cond()) return true;
      await sleep(step);
    }
    return false;
  }

  async function waitExtractReady() {
    var ok = await waitUntil(function () {
      var mags = [].slice.call(document.querySelectorAll('a.hae-icon.icon-search')).filter(isVisible);
      return mags.length >= 2;
    }, 45000, 300);
    if (!ok) throw new Error('鎻愬彇椤垫湭灏辩华');
  }

  async function runExtract(taskNo) {
    var mag = getTaskMagnifier();
    if (!mag) throw new Error('鏈壘鍒颁换鍔′护鏀惧ぇ闀?);
    mag.click();
    await sleep(250);

    var dialog = null, ta = null;
    for (var i = 0; i < 100; i++) {
      dialog = getTaskDialog();
      ta = getTaskTextarea(dialog);
      if (dialog && ta && isVisible(ta)) break;
      await sleep(140);
    }
    if (!ta) throw new Error('鏈壘鍒颁换鍔′护杈撳叆妗?);

    ta.focus();
    ta.click();
    setTextareaValue(ta, taskNo);
    await sleep(140);

    var saveBtn = findBtnByText('淇濆瓨', dialog) || findBtnByText('淇濆瓨', document);
    if (!saveBtn) throw new Error('鏈壘鍒颁繚瀛樻寜閽?);
    saveBtn.click();

    await sleep(260);

    var queryBtn = findBtnByText('鏌ヨ', document);
    if (!queryBtn) throw new Error('鏈壘鍒版煡璇㈡寜閽?);
    queryBtn.click();

    var ok = await waitLoadingDone(18000);
    if (!ok) throw new Error('鏌ヨ瓒呮椂');

    var rowsOk = await waitRowsReady(12000);
    if (!rowsOk) throw new Error('琛ㄦ牸鏈覆鏌?);

    return extractCodes();
  }

  async function runExtractWithRetry(taskNo, maxTry) {
    maxTry = maxTry || 3;
    for (var i = 0; i < maxTry; i++) {
      try {
        var codes = await runExtract(taskNo);
        if (codes.length) return codes;
      } catch (e) {}
      await sleep(400);
    }
    return [];
  }

  async function handleJob(job) {
    if (!job || !job.taskNo) return;
    if (extractRunning) return;
    if (job.jobId === lastJobId) return;

    extractRunning = true;
    lastJobId = job.jobId;

    try {
      await waitExtractReady();
      var codes = await runExtractWithRetry(job.taskNo, 3);
      if (!codes.length) throw new Error('閲嶈瘯鍚庝粛鏈彁鍙栧埌鏉＄爜');

      await GM_setValue(KEY_RESULT, {
        ok: true,
        jobId: job.jobId,
        taskNo: job.taskNo,
        codes: codes,
        ts: Date.now()
      });
    } catch (e) {
      await GM_setValue(KEY_RESULT, {
        ok: false,
        jobId: job.jobId,
        taskNo: job.taskNo,
        codes: [],
        err: String(e),
        ts: Date.now()
      });
    } finally {
      setTimeout(function () { try { window.close(); } catch (e) {} }, 500);
      extractRunning = false;
    }
  }

  async function bgWorker() {
    if (location.hash.indexOf('autoExtract=1') === -1) return;

    var first = await GM_getValue(KEY_JOB, null);
    handleJob(first);

    if (typeof GM_addValueChangeListener === 'function') {
      GM_addValueChangeListener(KEY_JOB, function (_k, _o, n) { handleJob(n); });
    }
  }

function startBarcodeEnterBackgroundService() {
  if (barcodeEnterBgStarted) return;

  barcodeEnterBgStarted = true;

  var bgPending = false;
  var bgInput = null;
  var bgCode = '';
  var bgTriggerAt = 0;
  var bgSawLoading = false;
  var bgLoadingGoneCount = 0;
  var bgLastAutoAt = 0;

  // 鏈€闀跨瓑寰?loading 鍑虹幇鏃堕棿
  // 瓒呰繃杩欎釜鏃堕棿娌＄湅鍒?loading锛屽氨鍙栨秷锛屼笉琛?Enter
  var BG_WAIT_LOADING_MS = 8000;

  // 鏈€闀挎€荤瓑寰呮椂闂?  var BG_MAX_WAIT_MS = 30000;

  function bgMakeEnterEvent(type) {
    var e = new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true
    });

    try {
      Object.defineProperty(e, 'keyCode', {
        get: function () {
          return 13;
        }
      });
    } catch (err) {}

    try {
      Object.defineProperty(e, 'which', {
        get: function () {
          return 13;
        }
      });
    } catch (err2) {}

    return e;
  }

  function bgPressEnter(reason) {
    var input = bgInput;

    if (!input || !document.contains(input)) {
      input = getParentInput();
    }

    if (!input) {
      console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氭湭鎵惧埌鏉＄爜閲囬泦妗嗭紝鏃犳硶琛nter');
      setStatus('鏉＄爜鍥炶溅锛氭湭鎵惧埌鏉＄爜閲囬泦妗?, '#cf1322');
      return false;
    }

    if (Date.now() - bgLastAutoAt < 1200) {
      console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氳窛绂讳笂娆¤ˉEnter澶繎锛岃烦杩?);
      return false;
    }

    barcodeEnterSending = true;

    try {
      input.focus();

      input.dispatchEvent(bgMakeEnterEvent('keydown'));
      input.dispatchEvent(bgMakeEnterEvent('keypress'));
      input.dispatchEvent(bgMakeEnterEvent('keyup'));

      bgLastAutoAt = Date.now();
      barcodeEnterLastAutoAt = Date.now();

      console.log('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氭娴嬪埌loading缁撴潫锛屽凡琛nter', {
        reason: reason,
        barcode: bgCode,
        inputValue: String(input.value || '')
      });

      setStatus('鏉＄爜鍥炶溅锛歭oading缁撴潫锛屽凡琛?Enter', '#389e0d');

      return true;
    } finally {
      setTimeout(function () {
        barcodeEnterSending = false;
      }, 500);
    }
  }

  function bgIsBarcodeTarget(target) {
    if (!target) return false;

    var p = getParentInput();

    if (p && target === p) return true;

    try {
      if (isBarcodeInput(target)) return true;
    } catch (e) {}

    return false;
  }

  document.addEventListener('keydown', function (e) {
    try {
      if (!isBarcodeEnterEnabled()) return;

      if (barcodeEnterSending) return;

      if (e.key !== 'Enter' && e.keyCode !== 13) return;

      // 鍙鐞嗘壂鐮佹灙/閿洏鐪熷疄 Enter
      if (!e.isTrusted) return;

      var target = e.target;

      // 鍙鐞嗘潯鐮侀噰闆嗘
      if (!bgIsBarcodeTarget(target)) return;

      var v = String(target.value || '').trim();

      if (!v) return;

        bgPending = true;
        bgInput = target;
        bgCode = v;
        bgTriggerAt = Date.now();
        bgSawLoading = false;
        bgLoadingGoneCount = 0;
        barcodeEnterBoundInput = target;


      console.log('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氭崟鑾锋潯鐮佺湡瀹濫nter锛岀瓑寰卨oading鍑虹幇', {
        barcode: bgCode,
        panelHidden: !!document.getElementById('tm-fab') &&
          getComputedStyle(document.getElementById('tm-fab')).display !== 'none'
      });

      setStatus('鏉＄爜鍥炶溅锛氱瓑寰卨oading', '#1677ff');

    } catch (err) {
      console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氱湡瀹濫nter鐩戝惉寮傚父', err);
    }
  }, true);

  setInterval(function () {
    try {
      if (!isBarcodeEnterEnabled()) {
        bgPending = false;
        return;
      }

      if (!bgPending) return;

      var now = Date.now();
      var loading = false;

      try {
        loading = isLoadingVisible();
      } catch (e) {
        loading = false;
      }

      // 鐪嬪埌 loading
      if (loading) {
        bgSawLoading = true;
        bgLoadingGoneCount = 0;

        setStatus('鏉＄爜鍥炶溅锛氭娴嬪埌loading锛岀瓑寰呯粨鏉?, '#1677ff');
        return;
      }

      // 宸茬粡鐪嬪埌杩?loading锛岀幇鍦?loading 娑堝け
      if (bgSawLoading && !loading) {
        bgLoadingGoneCount++;

        // 杩炵画妫€娴嬩袱娆℃秷澶憋紝璁や负椤甸潰缂撳啿缁撴潫
        if (bgLoadingGoneCount >= 2) {
          bgPending = false;

          setTimeout(function () {
            bgPressEnter('loading finished');
          }, 200);

          return;
        }
      }

      // 娌＄湅鍒?loading锛岃秴杩囩瓑寰呮椂闂达細鍙栨秷锛屼笉琛?Enter
      if (!bgSawLoading && now - bgTriggerAt >= BG_WAIT_LOADING_MS) {
        bgPending = false;

        console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氭湭妫€娴嬪埌loading锛屽彇娑堟湰娆★紝涓嶈ˉEnter', {
          barcode: bgCode,
          waitMs: BG_WAIT_LOADING_MS
        });

        setStatus('鏉＄爜鍥炶溅锛氭湭妫€娴嬪埌loading锛屽凡鍙栨秷', '#fa8c16');
        return;
      }

      // 鎬昏秴鏃朵繚鎶わ細鍙栨秷锛屼笉琛?Enter
      if (now - bgTriggerAt >= BG_MAX_WAIT_MS) {
        bgPending = false;

        console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氱瓑寰卨oading缁撴潫瓒呮椂锛屽彇娑堟湰娆★紝涓嶈ˉEnter', {
          barcode: bgCode,
          waitMs: BG_MAX_WAIT_MS
        });

        setStatus('鏉＄爜鍥炶溅锛氱瓑寰卨oading瓒呮椂锛屽凡鍙栨秷', '#fa8c16');
        return;
      }

    } catch (err) {
      console.warn('[MES] 鏉＄爜鍥炶溅鍚庡彴锛氭娴嬪紓甯?, err);
    }
  }, 100);

  console.log('[MES] 鏉＄爜鍥炶溅鐙珛鍚庡彴鏈嶅姟宸插惎鍔細鍙娴媗oading锛屾湭妫€娴嬪埌涓嶈ˉEnter');
}







// ===== UI =====
function buildPanel() {
  if (document.getElementById('tm-main-panel')) return;

  var CFG_KEY = 'tm_auto_pass_cfg';
  var PANEL_STATE_KEY = 'tm_panel_state';
  var SN_LOCK_KEY = 'sn_code_check_lock_on';
  var SN_ROUTE_KEY = 'sn_code_auto_route_on';
  var AUTO_PASS_MODE_KEY = 'auto_pass_mode';
  var AUTO_PASS_MODE_BOM_ATE = 'bom_ate';
  var AUTO_PASS_MODE_BOM_ONLY = 'bom_only';

  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
      return { enabled: !!c.enabled };
    } catch (e) {
      return { enabled: false };
    }
  }

  function loadPanelState() {
    try {
      return JSON.parse(localStorage.getItem(PANEL_STATE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function savePanelState(state) {
    var old = loadPanelState();
    var next = Object.assign({}, old, state);
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(next));
  }

  var box = document.createElement('div');
  box.id = 'tm-main-panel';
  box.style.position = 'fixed';
  box.style.right = '16px';
  box.style.bottom = '16px';
  box.style.zIndex = '999999';
  box.style.width = '360px';
  box.style.background = '#fff';
  box.style.border = '1px solid #d9d9d9';
  box.style.borderRadius = '8px';
  box.style.boxShadow = '0 4px 14px rgba(0,0,0,.15)';
  box.style.fontSize = '12px';
  box.style.padding = '10px';

  box.innerHTML =
   '<div id="tm-head" style="font-weight:600;margin-bottom:8px;cursor:move;display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
  '<span>82023703MES涓撶敤</span>' +
  '<div style="display:flex;align-items:center;gap:6px;cursor:default;font-weight:400;">' +
    '<label title="淇濇寔w3鐧诲綍鎬? style="white-space:nowrap;"><input id="tm-keepalive-on" type="checkbox"> 淇濇寔W3鐧诲叆</label>' +
    '<span id="tm-keepalive-status" style="color:#666;">鍏?/span>' +
    '<button id="tm-toggle" style="border:0;background:#f0f0f0;border-radius:6px;padding:2px 8px;cursor:pointer;">鏈€灏忓寲</button>' +
  '</div>' +
'</div>' +

    '<div id="tm-body">' +
    '<div>浠诲姟浠わ紝鍙矘璐存帓浜ф枃鏈紝鑷姩杩囨护浠诲姟浠?/div>' +
'<textarea id="tm-taskno" style="width:100%;height:38px;min-height:32px;max-height:90px;resize:vertical;box-sizing:border-box;margin:4px 0 8px;" placeholder="鍙緭鍏ュ涓换鍔′护锛屾垨绮樿创鎺掍骇鏂囨湰"></textarea>' +

'<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
'<button id="tm-paste-task">绮樿创鍓创鏉?/button>' +
 '<button id="tm-extract-api">鎺ュ彛鎻愬彇</button>' +
'<button id="tm-extract-run">鎻愬彇鏉＄爜</button>' +

'</div>' +


      '<hr style="margin:10px 0;">' +
      '<div>鎵归噺鏉＄爜鍒楄〃锛堟瘡琛屼竴涓級</div>' +
      '<textarea id="tm-batch-input" style="width:100%;height:110px;box-sizing:border-box;"></textarea>' +
    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
'<button id="tm-load">杞藉叆</button>' +
'<button id="tm-start">寮€濮?/button>' +
'<button id="tm-pause">鏆傚仠</button>' +
'<button id="tm-reset">閲嶇疆</button>' +
'<label title="鎵爜鏋緭鍏ユ潯鐮佸苟瑙﹀彂鐪熷疄Enter鍚庯紝绛夊緟浜у搧杩涚珯鎴愬姛锛屽啀鑷姩琛ヤ竴涓狤nter" style="white-space:nowrap;">' +
'<input id="tm-barcode-enter-on" type="checkbox"> 鏉＄爜鍥炶溅' +
'</label>' +
'</div>' +

          '<hr style="margin:10px 0;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<label title="缂栫爜涓嶄竴鑷存椂閿佸畾褰撳墠SN妗?><input id="tm-sn-lock-on" type="checkbox"> SN鎷︽埅</label>' +
      '<label title="SN鎵敊浣嶇疆鏃惰嚜鍔ㄨ浆濉埌瀵瑰簲缂栫爜琛?><input id="tm-sn-route-on" type="checkbox"> SN褰掍綅</label>' +
      '<label title="BOM瀛愰」鏍￠獙閫氳繃鍚庯紝杩樿ATE娴嬭瘯閫氳繃鎵嶈繃绔?><input id="tm-pass-mode-bom-ate" name="tm-pass-mode" type="radio" value="bom_ate"> 鏍￠獙+ATE</label>' +
      '<label title="鍙BOM瀛愰」鏍￠獙閫氳繃灏辫繃绔欙紝涓嶆煡ATE"><input id="tm-pass-mode-bom-only" name="tm-pass-mode" type="radio" value="bom_only"> 鍙牎楠?/label>' +
      '</div>' +
      '<div id="tm-sn-status" style="margin-top:4px;color:#666;">SN鏍￠獙锛氬緟鍛?/div>' +
      '<div id="tm-pass-mode-status" style="margin-top:2px;color:#666;">杩囩珯妯″紡锛氬緟鍛?/div>' +


      '<div style="margin-top:8px;">杩涘害锛?span id="tm-batch-progress">0/0</span></div>' +
      '<div id="tm-batch-status" style="margin-top:4px;color:#333;">寰呭懡</div>' +
    '</div>';

  document.body.appendChild(box);

  // 鎶樺彔/灞曞紑 + 鐘舵€佽蹇?  var bodyWrap = box.querySelector('#tm-body');
  var toggleBtn = box.querySelector('#tm-toggle');
  var keepAliveOn = box.querySelector('#tm-keepalive-on');

  var st = loadPanelState();
  var collapsed = !!st.collapsed;

  // 鎮诞鐞冿紙绠€鐗堬級
  var fab = document.createElement('div');
  fab.id = 'tm-fab';
  fab.textContent = 'qiu';
  fab.style.position = 'fixed';
  fab.style.right = '18px';
  fab.style.bottom = '18px';
  fab.style.width = '46px';
  fab.style.height = '46px';
  fab.style.borderRadius = '50%';
  fab.style.background = '#1677ff';
  fab.style.color = '#fff';
  fab.style.display = 'none';
  fab.style.alignItems = 'center';
  fab.style.justifyContent = 'center';
  fab.style.fontSize = '12px';
  fab.style.cursor = 'pointer';
  fab.style.zIndex = '1000001';
  fab.style.boxShadow = '0 6px 18px rgba(0,0,0,.25)';
  fab.title = '鐐瑰嚮灞曞紑闈㈡澘';
  document.body.appendChild(fab);

  function applyCollapsed() {
    bodyWrap.style.display = collapsed ? 'none' : '';
    toggleBtn.textContent = collapsed ? '灞曞紑' : '鏈€灏忓寲';
    box.style.width = collapsed ? '220px' : '360px';
  }
  applyCollapsed();
// 淇濇寔鐧诲叆鍒濆鍖?(function initKeepAliveSwitch() {
  var kc = loadKeepAliveCfg();

  keepAliveOn.checked = !!kc.enabled;

  var stEl = box.querySelector('#tm-keepalive-status');
  if (stEl) {
    stEl.textContent = keepAliveOn.checked ? '鍚姩涓? : '鍏?;
    stEl.style.color = keepAliveOn.checked ? '#1677ff' : '#666';
  }

  keepAliveOn.addEventListener('change', function (e) {
    e.stopPropagation();

    var next = loadKeepAliveCfg();
    next.enabled = !!keepAliveOn.checked;
    if (!next.sec) next.sec = 90;

    saveKeepAliveCfg(next);
    restartKeepAlive();

    var el = box.querySelector('#tm-keepalive-status');
    if (el) {
      el.textContent = keepAliveOn.checked ? '鍚姩涓? : '鍏?;
      el.style.color = keepAliveOn.checked ? '#1677ff' : '#666';
    }
  });

  restartKeepAlive();
})();
var keepAliveLabel = box.querySelector('label[title="淇濇寔w3鐧诲綍鎬?]');
if (keepAliveLabel) {
  keepAliveLabel.addEventListener('mousedown', function (e) {
    e.stopPropagation();
  }, true);
}
if (keepAliveOn) {
  keepAliveOn.addEventListener('mousedown', function (e) {
    e.stopPropagation();
  }, true);
}


  toggleBtn.onclick = function (e) {
    e.stopPropagation();
    collapsed = !collapsed;
    applyCollapsed();
    savePanelState({ collapsed: collapsed });

    if (collapsed) {
      box.style.display = 'none';
      fab.style.display = 'flex';
    } else {
      box.style.display = '';
      fab.style.display = 'none';
    }
  };

  fab.onclick = function () {
    box.style.display = '';
    fab.style.display = 'none';
    collapsed = false;
    applyCollapsed();
    savePanelState({ collapsed: false });
  };

  // 鎷栨嫿
  (function makeDrag(panel, head) {
    var down = false, sx = 0, sy = 0, ox = 0, oy = 0;
    head.addEventListener('mousedown', function (e) {
      down = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top;
      panel.style.left = ox + 'px';
      panel.style.top = oy + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!down) return;
      panel.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
      panel.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (!down) return;
      down = false;
      document.body.style.userSelect = '';
      var r = panel.getBoundingClientRect();
      savePanelState({ left: r.left, top: r.top });
    });
  })(box, box.querySelector('#tm-head'));

  // 鎭㈠涓婃浣嶇疆
  if (typeof st.left === 'number' && typeof st.top === 'number') {
    box.style.left = Math.max(0, st.left) + 'px';
    box.style.top = Math.max(0, st.top) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  // 棣栨鍔犺浇濡傛灉涓婃鏄姌鍙狅紝鐩存帴鏄剧ず鎮诞鐞?  if (collapsed) {
    box.style.display = 'none';
    fab.style.display = 'flex';
  }

    var taskInput = box.querySelector('#tm-taskno');
    var ta = box.querySelector('#tm-batch-input');
    var barcodeEnterOn = box.querySelector('#tm-barcode-enter-on');
    var snLockOn = box.querySelector('#tm-sn-lock-on');
    var snRouteOn = box.querySelector('#tm-sn-route-on');
    var passModeBomAte = box.querySelector('#tm-pass-mode-bom-ate');
    var passModeBomOnly = box.querySelector('#tm-pass-mode-bom-only');



  function applySnCfgNow() {
    localStorage.setItem(SN_LOCK_KEY, snLockOn.checked ? '1' : '0');
    localStorage.setItem(SN_ROUTE_KEY, snRouteOn.checked ? '1' : '0');

    var s = box.querySelector('#tm-sn-status');
    if (s) {
      s.textContent = 'SN鏍￠獙锛氭嫤鎴? + (snLockOn.checked ? '寮€' : '鍏?) + ' / 褰掍綅' + (snRouteOn.checked ? '寮€' : '鍏?);
      s.style.color = (snLockOn.checked || snRouteOn.checked) ? '#389e0d' : '#666';
    }
  }
      function applyAutoPassModeNow() {
    var mode = passModeBomOnly.checked ? AUTO_PASS_MODE_BOM_ONLY : AUTO_PASS_MODE_BOM_ATE;

    localStorage.setItem(AUTO_PASS_MODE_KEY, mode);

    var s = box.querySelector('#tm-pass-mode-status');
    if (s) {
      if (mode === AUTO_PASS_MODE_BOM_ONLY) {
        s.textContent = '杩囩珯锛氬彧鏍￠獙';
        s.style.color = '#fa8c16';
      } else {
        s.textContent = '杩囩珯锛氭牎楠?ATE';
        s.style.color = '#389e0d';
      }
    }

    console.log('[MES] 鑷姩杩囩珯妯″紡:', mode);
  }

  function initAutoPassModeUi() {
    var mode = localStorage.getItem(AUTO_PASS_MODE_KEY) || AUTO_PASS_MODE_BOM_ATE;

    if (mode === AUTO_PASS_MODE_BOM_ONLY) {
      passModeBomOnly.checked = true;
      passModeBomAte.checked = false;
    } else {
      passModeBomAte.checked = true;
      passModeBomOnly.checked = false;
    }

    applyAutoPassModeNow();
  }



  snLockOn.addEventListener('change', applySnCfgNow);
  snRouteOn.addEventListener('change', applySnCfgNow);
  passModeBomAte.addEventListener('change', applyAutoPassModeNow);
  passModeBomOnly.addEventListener('change', applyAutoPassModeNow);
// 鏉＄爜鍥炶溅寮€鍏冲垵濮嬪寲
if (barcodeEnterOn) {
  barcodeEnterOn.checked = localStorage.getItem(BARCODE_ENTER_KEY) === '1';

  barcodeEnterOn.addEventListener('change', function () {
    localStorage.setItem(BARCODE_ENTER_KEY, barcodeEnterOn.checked ? '1' : '0');

    barcodeEnterPending = false;
    barcodeEnterSuccessCountBefore = 0;

    setStatus(
      '鏉＄爜鍥炶溅锛? + (barcodeEnterOn.checked ? '寮€' : '鍏?),
      barcodeEnterOn.checked ? '#389e0d' : '#666'
    );

    if (barcodeEnterOn.checked) {
      bindBarcodeEnterInput();
    }
  });

  if (barcodeEnterOn.checked) {
    bindBarcodeEnterInput();
  }
}


  box.querySelector('#tm-paste-task').onclick = async function () {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setStatus('娴忚鍣ㄤ笉鏀寔鐩存帴璇诲彇鍓创鏉匡紝璇锋墜鍔?Ctrl+V', '#fa8c16');
        try {
          taskInput.focus();
          taskInput.select();
        } catch (e) {}
        return;
      }

      var text = await navigator.clipboard.readText();

      if (!text) {
        setStatus('鍓创鏉夸负绌?, '#fa8c16');
        return;
      }

      taskInput.value = text;
      taskInput.dispatchEvent(new Event('input', { bubbles: true }));
      taskInput.dispatchEvent(new Event('change', { bubbles: true }));

      var taskNos = parseTaskNos(text);

      if (taskNos.length) {
        setStatus('宸茬矘璐达紝璇嗗埆鍒颁换鍔′护 ' + taskNos.length + ' 涓?, '#389e0d');
        console.log('[TASK-NO] 璇嗗埆鍒颁换鍔′护:', taskNos);
      } else {
        setStatus('宸茬矘璐达紝浣嗘湭璇嗗埆鍒颁换鍔′护', '#fa8c16');
      }
    } catch (e) {
      console.error('[TASK-NO] 璇诲彇鍓创鏉垮け璐?', e);
      setStatus('璇诲彇鍓创鏉垮け璐ワ紝璇锋墜鍔?Ctrl+V', '#cf1322');

      try {
        taskInput.focus();
        taskInput.select();
      } catch (err) {}
    }
  };

  box.querySelector('#tm-extract-run').onclick = async function () {
    var taskNos = parseTaskNos(taskInput.value);
    if (!taskNos.length) return setStatus('鏈瘑鍒埌浠诲姟浠?, '#cf1322');

    // 鍥哄畾閾炬帴鎻愬彇淇濇寔鍘熼€昏緫锛屽彧鍙栫涓€涓换鍔′护
    var taskNo = taskNos[0];

    if (taskNos.length > 1) {
      setStatus('鍥哄畾鎻愬彇鍙娇鐢ㄧ涓€涓换鍔′护锛? + taskNo + '锛屽涓鐢ㄦ帴鍙ｆ彁鍙?, '#fa8c16');
    }

    var jobId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await GM_setValue(KEY_JOB, { jobId: jobId, taskNo: taskNo, ts: Date.now() });

    GM_openInTab(FIXED_UI_URL, { active: true, insert: true, setParent: true });
    setStatus('宸叉墦寮€鍥哄畾鎻愬彇椤靛苟鍙戦€佷换鍔★細' + taskNo);
  };

      box.querySelector('#tm-extract-api').onclick = async function () {
    var taskNos = parseTaskNos(taskInput.value);

    if (!taskNos.length) {
      return setStatus('鏈瘑鍒埌浠诲姟浠?, '#cf1322');
    }

    try {
      setStatus('璇嗗埆鍒颁换鍔′护 ' + taskNos.length + ' 涓紝鎺ュ彛鎵归噺鎻愬彇涓?..', '#1677ff');

      var ret = await extractTaskCodesByApi(taskNos);
      var codes = ret.codes || [];

      if (!codes.length) {
        setStatus('鎺ュ彛鏈彁鍙栧埌鏉＄爜锛氫换鍔′护' + taskNos.length + '涓?, '#fa8c16');
        console.log('[TASK-SN-API] 鏈彁鍙栧埌锛屼换鍔′护:', taskNos);
        console.log('[TASK-SN-API] 鏌ヨ缁勫悎:', ret.hitInfo);
        return;
      }

      ta.value = codes.join('\n');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      // 鑷姩杞藉叆鍒版壒閲忛槦鍒?      queue = parseCodes(ta.value);
      idx = 0;
      running = false;
      waiting = false;
      currentCode = '';

      setProgress();

      setStatus(
        '鎺ュ彛鎻愬彇鎴愬姛锛氫换鍔′护' + ret.taskCount +
        '涓紝鏉＄爜' + queue.length +
        '鏉★紝宸茶嚜鍔ㄨ浇鍏?,
        '#389e0d'
      );

      console.log('[TASK-SN-API] 浠诲姟浠?', ret.taskNos);
      console.log('[TASK-SN-API] 鏌ヨ缁勫悎:', ret.hitInfo);
      console.log('[TASK-SN-API] SN鏁伴噺:', queue.length);

    } catch (e) {
      console.error('[TASK-SN-API] 鎺ュ彛鎻愬彇澶辫触:', e);
      setStatus('鎺ュ彛鎻愬彇澶辫触锛? + (e && e.message ? e.message : String(e)), '#cf1322');
    }
  };




  box.querySelector('#tm-load').onclick = function () {
    queue = parseCodes(ta.value);
    idx = 0; running = false; waiting = false; currentCode = '';
    setProgress();
    setStatus('宸茶浇鍏?' + queue.length + ' 鏉?);
  };

  box.querySelector('#tm-start').onclick = function () {
    if (!queue.length) return setStatus('璇峰厛杞藉叆鏉＄爜', '#cf1322');
    running = true;
       localStorage.setItem('MES_BATCH_RUNNING_FLAG', '1'); // 銆愬姞杩欒锛氭墦涓婃壒閲忔殫鍙枫€?    setStatus('寮€濮嬫墽琛?..', '#1677ff');
  };

  box.querySelector('#tm-pause').onclick = function () {
    running = false; waiting = false;
    localStorage.setItem('MES_BATCH_RUNNING_FLAG', '0'); // 銆愬姞杩欒锛氬彇娑堟殫鍙枫€?    setStatus('宸叉殏鍋?, '#fa8c16');
  };

  box.querySelector('#tm-reset').onclick = function () {
    running = false; waiting = false; idx = 0; currentCode = '';
    localStorage.setItem('MES_BATCH_RUNNING_FLAG', '0'); // 銆愬姞杩欒锛氬彇娑堟殫鍙枫€?    setProgress();
    setStatus('宸查噸缃?);
  };
  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(KEY_RESULT, function (_k, _o, r) {
      if (!r) return;
      if (!r.ok) return setStatus('鎻愬彇澶辫触锛? + (r.err || '鏈煡閿欒'), '#cf1322');

      ta.value = (r.codes || []).join('\n');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));

      // 鑷姩杞藉叆
      queue = parseCodes(ta.value);
      idx = 0; running = false; waiting = false; currentCode = '';
      setProgress();

      setStatus('鎻愬彇鎴愬姛锛? + queue.length + ' 鏉★紝宸茶嚜鍔ㄨ浇鍏?, '#1677ff');
    });
  }

  // SN 寮€鍏冲垵濮嬪寲
  snLockOn.checked = localStorage.getItem(SN_LOCK_KEY) === '1';
  snRouteOn.checked = localStorage.getItem(SN_ROUTE_KEY) !== '0';
  applySnCfgNow();

  // 鑷姩杩囩珯妯″紡鍒濆鍖?  initAutoPassModeUi();

setInterval(function () { tick(); }, tickMs);

// 鏉＄爜鍥炶溅妫€娴嬪凡绉诲姩鍒扮嫭绔嬪悗鍙版湇鍔?startBarcodeEnterBackgroundService()
// 涓嶈鍦ㄨ繖閲岄噸澶嶅惎鍔紝閬垮厤閲嶅鎵ц


}



function boot() {
  buildPanel();

  startBarcodeEnterBackgroundService();

  bgWorker();
}




if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
})();
