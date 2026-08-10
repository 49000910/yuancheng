

// ==UserScript==
// @name         SN缂栫爜鑷姩鏍￠獙锛堟棤闈㈡澘鐗堬紝榧犳爣鎮诞鐧藉簳淇℃伅鍗★級
// @namespace    tm.sn.code.check.no.panel.hover.white
// @version      2.7.1
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


  const BASE = 'https://w3.huawei.com/mespmm/gateway/com.huawei.supply.mes.mesplus.pspw:mespmmpreallservice/mespmmpreallone/services/emsComponentDataInfo/find/page';
  const selector = 'input[id^="sn-input"]';

  // 鐢卞埆鐨勮剼鏈潰鏉挎帶鍒?  const LOCK_SWITCH_KEY = 'sn_code_check_lock_on';
  const AUTO_ROUTE_KEY = 'sn_code_auto_route_on';
// 宸︿晶鏉＄爜娓呮礂瑙勫垯锛岀敱鍏滃簳鑴氭湰璁剧疆
const LEFT_CLEAN_KEY = 'sn_code_left_clean_rules_v1';
// ===== 鐖堕」鏉＄爜-BOM-SN閲囬泦璁板綍 =====
const BOM_COLLECT_STORE_KEY = 'sn_bom_collect_store_v1';
const BOM_COLLECT_MAX_PARENT = 500;
const bomCollectUnlockMap = new WeakMap();

  let lockOn = localStorage.getItem(LOCK_SWITCH_KEY) === '1';
  let autoRouteOn = localStorage.getItem(AUTO_ROUTE_KEY) !== '0';

  let __checkTimer = null;
  const __reqSeq = new WeakMap();
  const rowBubbleMap = new WeakMap();
  const rowBubbleKeys = new Set();
  const lastScanByInput = new WeakMap();
  const lastNonEmptyScanByInput = new WeakMap();
  // ===== SN閲嶅閿佸畾锛氱粺涓€鏀惧湪鑴氭湰1锛岄伩鍏嶅拰鑷姩杞～鍐茬獊 =====
  let dupLockedEl = null;
  let dupSuppressUntil = 0;

  // 宸︿晶绾㈣壊鎷彿DOM
  const dupBracketEls = [];

  // 琚贰绾㈡爣璁拌繃鐨勯噸澶嶆
  const dupPaintEls = new Set();

  function suppressDuplicateLockForRoute(ms) {
    dupSuppressUntil = Date.now() + (ms || 1200);
  }

  function isDuplicateLockSuppressed() {
    return Date.now() < dupSuppressUntil;
  }

  function isVisibleSnInputForDup(el) {
    if (!el || !document.body.contains(el)) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

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

  function clearDupBrackets() {
    while (dupBracketEls.length) {
      var el = dupBracketEls.pop();
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }

  function clearDupPaint(el) {
    if (!el || !el.dataset || el.dataset.snDupPaint !== '1') return;

    el.style.outline = '';
    el.style.backgroundColor = '';
    el.style.boxShadow = '';
    el.style.color = '';

    if (el.title && el.title.indexOf('閲嶅鏉＄爜') >= 0) {
      el.title = '';
    }

    delete el.dataset.snDupPaint;
  }

  function clearAllDupPaint() {
    dupPaintEls.forEach(function (el) {
      clearDupPaint(el);
    });
    dupPaintEls.clear();
  }

  function paintDup(el, key) {
    if (!el) return;

    el.dataset.snDupPaint = '1';

    // 缁熶竴娣＄孩鑹诧紝涓嶅啀鏈夊崟涓娣辩孩
    el.style.outline = '1px solid #d4380d';
    el.style.backgroundColor = '#fff1f0';
    el.style.boxShadow = '0 0 0 1px rgba(212,56,13,.12)';
    el.style.color = '#000';
    el.title = '閲嶅鏉＄爜锛? + key;

    dupPaintEls.add(el);
  }

  function addDupLine(left, top, width, height) {
    var div = document.createElement('div');

    div.style.position = 'fixed';
    div.style.zIndex = '2147483647';
    div.style.left = left + 'px';
    div.style.top = top + 'px';
    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.background = '#d4380d';
    div.style.borderRadius = '1px';
    div.style.pointerEvents = 'none';

    document.body.appendChild(div);
    dupBracketEls.push(div);

    return div;
  }

  function drawDupBracketForGroup(els) {
    if (!els || els.length < 2) return;

    var items = [];

    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();

      items.push({
        el: els[i],
        rect: r,
        centerY: r.top + r.height / 2
      });
    }

    items.sort(function (a, b) {
      return a.centerY - b.centerY;
    });

    var first = items[0];
    var last = items[items.length - 1];

    var minLeft = Infinity;

    for (var j = 0; j < items.length; j++) {
      minLeft = Math.min(minLeft, items[j].rect.left);
    }

    // 绾㈣壊鎷彿鍙傛暟
    // 绾跨矖 3锛屾í绾跨煭锛屾棤宸︿晶鏍囩
    var lineWidth = 3;
    var armLen = 11;
    var bracketLeft = Math.max(4, minLeft - 22);

    // 涓婄煭妯榻愭渶涓婇噸澶嶆涓績
    var topCenter = first.centerY;

    // 涓嬬煭妯榻愭渶涓嬮噸澶嶆涓績
    var bottomCenter = last.centerY;

    if (bottomCenter - topCenter < 18) {
      var mid = (topCenter + bottomCenter) / 2;
      topCenter = mid - 9;
      bottomCenter = mid + 9;
    }

    // 绔栫嚎
    addDupLine(
      bracketLeft,
      topCenter,
      lineWidth,
      bottomCenter - topCenter
    );

    // 涓婄煭妯?    addDupLine(
      bracketLeft,
      topCenter - lineWidth / 2,
      armLen,
      lineWidth
    );

    // 涓嬬煭妯?    addDupLine(
      bracketLeft,
      bottomCenter - lineWidth / 2,
      armLen,
      lineWidth
    );
  }

  function buildDuplicateMap() {
    var els = allSnInputs().filter(function (el) {
      return isVisibleSnInputForDup(el) && !isSnRouteMoving(el);
    });

    var map = new Map();

    for (var i = 0; i < els.length; i++) {
      var key = normalizeSnForDup(els[i].value);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(els[i]);
    }

    return map;
  }

  function removeDuplicateBubblesIfNeeded() {
    var els = allSnInputs();

    for (var i = 0; i < els.length; i++) {
      var st = rowBubbleMap.get(els[i]);
     if (st && st.text && st.text.indexOf('閲嶅鏉＄爜') >= 0) {
  removeRowBubble(els[i]);
}

    }
  }

  function refreshDuplicateLock(preferEl) {
    if (isDuplicateLockSuppressed()) return false;

    // 姣忔鍏堟竻鎺夋棫鎷彿鍜屾棫娣＄孩
    clearDupBrackets();
    clearAllDupPaint();

    var map = buildDuplicateMap();

    var hasDup = false;
    var targetEl = null;
    var targetKey = '';

    map.forEach(function (arr, key) {
      if (arr.length <= 1) return;

      hasDup = true;

      for (var i = 0; i < arr.length; i++) {
        paintDup(arr[i], key);

        // 褰撳墠杈撳叆妗嗗湪閲嶅缁勯噷锛屼紭鍏堟妸鍙充晶姘旀场鎸傚綋鍓嶆
        if (preferEl && arr[i] === preferEl) {
          targetEl = preferEl;
          targetKey = key;
        }

        // 娌℃湁浼樺厛鐩爣鏃讹紝閿佺涓€涓噸澶嶆
        if (!targetEl) {
          targetEl = arr[i];
          targetKey = key;
        }

               // 涓嶈鍦ㄨ繖閲屽啓 fail锛岄伩鍏嶄复鏃堕噸澶嶈В闄ゅ悗鐘舵€佹畫鐣?        // 閲嶅鍒ゆ柇浜ょ粰 publishSnCheckGate() 鍔ㄦ€佺粺璁?
      }

      // 宸︿晶绾㈣壊鎷彿锛屾棤鏂囧瓧
      drawDupBracketForGroup(arr);
    });

       if (!hasDup) {
      dupLockedEl = null;
      clearDupBrackets();
      clearAllDupPaint();
      removeDuplicateBubblesIfNeeded();

      // 淇锛氬鏋滀箣鍓嶅洜涓轰复鏃堕噸澶嶅啓鍏ヨ繃 fail/閲嶅鏉＄爜锛?      // 浣嗗綋鍓嶅疄闄呭凡缁忔病鏈夐噸澶嶏紝鍒欓噸鏂拌Е鍙戣繖浜涙鐨勭紪鐮佹牎楠岋紝娓呮帀鏃ail鐘舵€併€?      try {
        var gate = JSON.parse(localStorage.getItem('sn_code_check_gate_status') || 'null');

        if (gate && Array.isArray(gate.details)) {
          gate.details.forEach(function (d) {
            if (!d) return;

            var isOldDupFail =
              d.status === 'duplicate' ||
              d.msg === '閲嶅鏉＄爜' ||
              (d.status === 'fail' && d.msg === '閲嶅鏉＄爜');

            if (!isOldDupFail) return;

            var el = document.getElementById(d.id);
            if (!el || !document.body.contains(el)) return;

            var val = toStr(el.value);
            if (!val) return;

            // 鍏堟敼鎴?pending锛岄伩鍏?gate 涓€鐩?bad
            if (typeof setSnCheckState === 'function') {
              setSnCheckState(el, 'pending', '閲嶅瑙ｉ櫎寰呭鏍?, val);
            }

            // 閲嶆柊璺戠紪鐮佹牎楠岋紝鏍￠獙閫氳繃鍚庝細鍙樺洖 ok
            if (typeof enqueueCheck === 'function') {
              enqueueCheck(el, val);
            } else {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }
      } catch (e) {}

      return false;
    }


    dupLockedEl = targetEl;

    // 鍙充晶姘旀场淇濈暀
    if (targetEl) {
      showRowBubble(targetEl, '閲嶅鏉＄爜锛? + targetKey, 'err');

      try {
        if (document.activeElement === targetEl) {
          targetEl.select();
        }
      } catch (e) {}
    }

    return true;
  }

  // 杈撳叆鏃跺埛鏂伴噸澶嶇姸鎬?  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(selector)) return;

    // 鑴氭湰1鑷姩杞～鏈熼棿涓嶅仛閲嶅閿佸畾
    if (isDuplicateLockSuppressed() || isSnRouteMoving(t)) return;

    setTimeout(function () {
      try {
        refreshDuplicateLock(t);
      } catch (err) {}
    }, 0);
  }, true);

  // 鎸?Enter 鏃讹紝濡傛湁閲嶅鍒欓樆姝㈢户缁彁浜?  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(selector)) return;
    if (e.key !== 'Enter') return;

    // 鑷姩杞～鎻愪氦 Enter 鏃舵斁琛?    if (isDuplicateLockSuppressed() || isSnRouteMoving(t)) return;

    if (refreshDuplicateLock(t)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      var focusEl = dupLockedEl || t;

      setTimeout(function () {
        try {
          focusEl.focus();
          focusEl.select();
        } catch (err) {}
      }, 0);
    }
  }, true);

    // 鎸?Enter 鏃讹紝濡係N宸茶鍏朵粬鐖堕」閲囬泦锛屼篃闃绘缁х画鎻愪氦
document.addEventListener('keydown', function (e) {
  var t = e.target;

  if (!t || !t.matches || !t.matches(selector)) return;
  if (e.key !== 'Enter') return;

  if (isDuplicateLockSuppressed() || isSnRouteMoving(t)) return;

  if (bomCollectCheckConflictAndLock(t, t.value)) {
    e.preventDefault();
    e.stopPropagation();

    if (e.stopImmediatePropagation) {
      e.stopImmediatePropagation();
    }

    setTimeout(function () {
      try {
        t.focus();
        t.select();
      } catch (err) {}
    }, 0);
  }
}, true);

  // 婊氬姩鏃堕噸鏂板畾浣嶅乏渚ф嫭鍙?  window.addEventListener('scroll', function () {
    try {
      if (dupLockedEl) refreshDuplicateLock(dupLockedEl);
    } catch (e) {}
  }, true);

  // 绐楀彛鍙樺寲鏃堕噸鏂板畾浣嶅乏渚ф嫭鍙?  window.addEventListener('resize', function () {
    try {
      if (dupLockedEl) refreshDuplicateLock(dupLockedEl);
    } catch (e) {}
  }, true);

  // 椤甸潰鍔ㄦ€佸埛鏂版椂閲嶆柊鍒ゆ柇
  setInterval(function () {
    try {
      if (!document.querySelector(selector)) return;
      refreshDuplicateLock(document.activeElement);
    } catch (e) {}
  }, 800);



  // ===== 鏃犲搴旂紪鐮佹椂鑷姩閲嶈瘯锛岄槻姝㈡壂澶揩鎺ュ彛鏁版嵁杩樻病鍑烘潵 =====
  const NO_CODE_RETRY_MAX = 6;
  const NO_CODE_RETRY_DELAYS = [300, 600, 1000, 1500, 2200, 3000];
  const noCodeRetryMap = new WeakMap();

  function retrySnKey(snRaw) {
    return normalizeSnForDup(snRaw || '');
  }

  function resetNoCodeRetry(el) {
    noCodeRetryMap.delete(el);
  }

  function scheduleNoCodeRetry(el, snRaw) {
    if (!el || !document.body.contains(el)) return false;

    var key = retrySnKey(snRaw);
    if (!key) return false;

    var st = noCodeRetryMap.get(el);
    if (!st || st.key !== key) {
      st = {
        key: key,
        count: 0,
        token: 0
      };
      noCodeRetryMap.set(el, st);
    }

    if (st.count >= NO_CODE_RETRY_MAX) {
      return false;
    }

    st.count++;
    st.token++;

    var token = st.token;
    var delay = NO_CODE_RETRY_DELAYS[Math.min(st.count - 1, NO_CODE_RETRY_DELAYS.length - 1)];

    showRowBubble(el, '鏈煡鍒扮紪鐮侊紝閲嶈瘯 ' + st.count + '/' + NO_CODE_RETRY_MAX, 'warn');

    setTimeout(function () {
      if (!el || !document.body.contains(el)) return;

      var latest = noCodeRetryMap.get(el);
      if (!latest || latest.key !== key || latest.token !== token) return;

      var curr = toStr(el.value);
      if (!curr || retrySnKey(curr) !== key) return;

      enqueueCheck(el, snRaw);
    }, delay);

    return true;
  }


  // ===== 缁欒嚜鍔ㄨ繃绔欒剼鏈鍙栵細BOM瀛愰」SN鏍￠獙鐘舵€?=====
  const SN_CODE_CHECK_GATE_KEY = 'sn_code_check_gate_status';
  const snCheckStateMap = new WeakMap();
  // gate鍙戠幇鏈夊€间絾娌℃牎楠岀姸鎬佹椂锛岃嚜鍔ㄨˉ鏍￠獙锛岄伩鍏嶆案涔卲ending
  const gatePendingKickMap = new WeakMap();

  function kickPendingGateCheck(el, val, reason) {
    if (!el || !document.body.contains(el)) return;
    val = toStr(val);
    if (!val) return;

    var key = normalizeSnForDup(val);
    var now = Date.now();
    var old = gatePendingKickMap.get(el);

    // 鍚屼竴涓€?绉掑唴鍙ˉ瑙﹀彂涓€娆★紝閬垮厤姝诲惊鐜埛鎺ュ彛
    if (old && old.key === key && now - old.ts < 3000) return;

    gatePendingKickMap.set(el, {
      key: key,
      ts: now,
      reason: reason || ''
    });

    setTimeout(function () {
      try {
        if (!el || !document.body.contains(el)) return;
        if (normalizeSnForDup(el.value) !== key) return;

        enqueueCheck(el, val);
      } catch (e) {}
    }, 0);
  }

  function getParentBarcodeValueForGate() {
    var all = [].slice.call(document.querySelectorAll(
      'div[id^="Input_"] > input.hae-ui-input[type="text"], div[id^="Input_"] > input'
    ));

    for (var i = 0; i < all.length; i++) {
      var box = all[i].closest('div[id^="Input_"]');
      var ctx = ((box && box.parentElement ? box.parentElement.innerText : '') || '').replace(/\s+/g, '');
      if (ctx.indexOf('鏉＄爜閲囬泦') >= 0) {
        return toStr(all[i].value);
      }
    }

    return '';
  }

  function publishSnCheckGate() {
    var els = [].slice.call(document.querySelectorAll(selector));

    // 鍙粺璁″綋鍓嶉〉闈㈠彲瑙佺殑BOM瀛愰」SN妗?    els = els.filter(function (el) {
      var r = el.getBoundingClientRect();
      return document.body.contains(el) && r.width > 0 && r.height > 0;
    });

    var parentSn = getParentBarcodeValueForGate();

    var total = els.length;
    var filled = 0;
    var ok = 0;
    var bad = 0;
    var pending = 0;
    var duplicate = 0;
    var duplicateGroups = 0;
    var details = [];

    // 鍏堢粺璁℃竻娲楀悗鐨凷N锛岀敤浜庡垽鏂噸澶?    // 渚嬪 U1:21340902 鍜?21340902 娓呮礂鍚庨兘绛変簬 21340902
    var dupCount = {};

    for (var d = 0; d < els.length; d++) {
      var dv = toStr(els[d].value);
      if (!dv) continue;

      var dk = normalizeSnForDup(dv);
      if (!dk) continue;

      dupCount[dk] = (dupCount[dk] || 0) + 1;
    }

    Object.keys(dupCount).forEach(function (k) {
      if (dupCount[k] > 1) {
        duplicateGroups++;
        duplicate += dupCount[k];
      }
    });

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var val = toStr(el.value);
      var cleanVal = normalizeSnForDup(val);

      if (!val) {
        pending++;
        details.push({
          id: el.id || '',
          sn: '',
          cleanSn: '',
          status: 'empty',
          msg: '鏈壂鎻?
        });
        continue;
      }

      filled++;

      // 閲嶅鏉＄爜浼樺厛鍒ゅけ璐?      if (cleanVal && dupCount[cleanVal] > 1) {
        bad++;
        details.push({
          id: el.id || '',
          sn: val,
          cleanSn: cleanVal,
          status: 'duplicate',
          msg: '閲嶅鏉＄爜'
        });
        continue;
      }

      var st = snCheckStateMap.get(el);
      var currKey = normalizeSnForDup(val);
      var stKey = st ? normalizeSnForDup(st.sn) : '';

           if (!st || stKey !== currKey) {
        pending++;

        // 鏈夊€间絾娌℃湁瀵瑰簲鏍￠獙鐘舵€侊紝鑷姩琛ヤ竴娆℃牎楠?        kickPendingGateCheck(el, val, !st ? '鏃犳牎楠岀姸鎬? : '鏍￠獙鍊间笉涓€鑷?);

        details.push({
          id: el.id || '',
          sn: val,
          cleanSn: cleanVal,
          status: 'pending',
          msg: !st ? '绛夊緟鏍￠獙-宸茶ˉ瑙﹀彂' : '绛夊緟鏍￠獙-鍊煎彉鏇?
        });
        continue;
      }


      if (st.status === 'ok') {
        ok++;
      } else if (st.status === 'pending' || st.status === 'retry') {
        pending++;
      } else {
        bad++;
      }

      details.push({
        id: el.id || '',
        sn: val,
        cleanSn: cleanVal,
        status: st.status,
        msg: st.msg || ''
      });
    }

    var data = {
      ts: Date.now(),
      parentSn: parentSn,
      total: total,
      filled: filled,
      ok: ok,
      bad: bad,
      pending: pending,
     duplicate: duplicate,
     duplicateGroups: duplicateGroups,


      // 蹇呴』锛氭湁瀛愰」妗嗐€佸叏閮ㄥ～鍐欍€佸叏閮ㄦ牎楠孫K銆佹棤閲嶅
      allOk: total > 0 &&
             filled === total &&
             ok === total &&
             bad === 0 &&
             pending === 0 &&
             duplicate === 0,

      details: details
    };

  try {
  window.__SN_CODE_CHECK_GATE = data;
  localStorage.setItem(SN_CODE_CHECK_GATE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('sn-code-check-gate', { detail: data }));
} catch (e) {}

try {
  bomCollectSaveWhenGateAllOk(data);
} catch (e) {
  console.warn('[BOM閲囬泦璁板綍] 淇濆瓨澶辫触锛?, e);
}



  }

  function setSnCheckState(el, status, msg, sn) {
    if (!el) return;

    if (status === 'empty') {
      snCheckStateMap.delete(el);
    } else {
      snCheckStateMap.set(el, {
        status: status,
        msg: msg || '',
        sn: sn || toStr(el.value),
        ts: Date.now()
      });
    }

    publishSnCheckGate();
  }

  // 瀹氭椂鍒锋柊鐘舵€侊紝闃叉绯荤粺甯﹀嚭/鍒犻櫎SN妗嗗悗鐘舵€佷笉鍚屾
  setInterval(function () {
    try { publishSnCheckGate(); } catch (e) {}
  }, 1000);


    // 淇1锛氳剼鏈富鍔ㄦ竻绌烘椂锛岀姝㈢┖鍊煎洖鏀?  const suppressEmptyReplay = new WeakSet();

  // 淇2锛氫覆琛岄槦鍒楋紝闃插苟鍙戝綊浣嶆墦鏋?  let __scanChain = Promise.resolve();
  function enqueueCheck(el, sn){
    __scanChain = __scanChain
      .then(async function () {
        if (!el || !document.body.contains(el)) return;
        await runCheckOne(el, sn);
      })
      .catch(function(){});
  }

  let lockedInput = null;
  let lockedValue = '';

 const hoverCardMap = new WeakMap();
const hoverCache = new Map();
let hoverCurrentEl = null;

function syncSwitchFromStorage() {
  lockOn = localStorage.getItem(LOCK_SWITCH_KEY) === '1';
  autoRouteOn = localStorage.getItem(AUTO_ROUTE_KEY) !== '0';
}

  window.addEventListener('storage', function (e) {
    if (e.key === LOCK_SWITCH_KEY || e.key === AUTO_ROUTE_KEY) syncSwitchFromStorage();
  });

  function toStr(v){ return v == null ? '' : String(v).trim(); }
 function normSn(v){
  v = toStr(v).replace(/\s+/g, '');
  if (v.indexOf(':') >= 0) v = v.split(':').pop();
  return v;
}


  function normalizeForCompare(v){
    return toStr(v).replace(/\u00A0/g, ' ').replace(/\s+/g, '').replace(/锛?g, ':').toUpperCase();
  }

  function normalizeSnForDup(v){
    v = toStr(v).replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();
    if (v.indexOf('锛?) >= 0) v = v.split('锛?).pop();
    if (v.indexOf(':') >= 0) v = v.split(':').pop();
    return v.toUpperCase();
  }
// ===== 宸︿晶鏉＄爜鑷畾涔夋竻娲楄鍒?=====
function loadLeftCleanRules() {
  try {
    var arr = JSON.parse(localStorage.getItem(LEFT_CLEAN_KEY) || '[]');

    if (Array.isArray(arr)) {
      var out = [];

      arr.forEach(function (x) {
        x = toStr(x)
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, '')
          .replace(/锛?g, ':')
          .replace(/锛?g, '-');

        if (x && out.indexOf(x) < 0) {
          out.push(x);
        }
      });

      return out;
    }
  } catch (e) {}

  return [];
}

function cleanLeftByRules(seg) {
  var s = toStr(seg)
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/锛?g, ':')
    .replace(/锛?g, '-');

  if (!s) return '';

  var rules = loadLeftCleanRules();

  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r) continue;

    // 閰嶇疆 ":"锛氭竻娲楀啋鍙峰墠闈㈢殑浠绘剰瀛楃
    // U1:213409015510S4104636 => 213409015510S4104636
    if (r === ':') {
      var p = s.indexOf(':');
      if (p >= 0) {
        s = s.slice(p + 1);
      }
      continue;
    }

    // 閰嶇疆 "-"锛氭竻娲楁í鏉犲墠闈㈢殑浠绘剰瀛楃
    // ABC-34090213 => 34090213
    if (r === '-') {
      var p2 = s.indexOf('-');
      if (p2 >= 0) {
        s = s.slice(p2 + 1);
      }
      continue;
    }

    // 鏅€氬浐瀹氬墠缂€锛?    // 閰嶇疆 SN锛歋N03035FDT => 03035FDT
    if (s.toUpperCase().indexOf(r.toUpperCase()) === 0) {
      s = s.slice(r.length);
    }
  }

  return s;
}

// 鍙敤浜庡乏渚ф潯鐮佺殑娓呮礂锛屼笉褰卞搷鎺ュ彛鏌ュ嚭鏉ョ殑缂栫爜
function extractLeftCodeSmart(text) {
  text = toStr(text).replace(/\u00A0/g, ' ').replace(/锛?g, ':');

  var parts = text.split(/\s+/).filter(Boolean);
  var last = '';

  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i];

    // 鍏堟墽琛岃嚜瀹氫箟宸︿晶娓呮礂
    seg = cleanLeftByRules(seg);

    // 淇濈暀鍘熸潵閫昏緫锛氬啋鍙峰悗鍐呭浼樺厛
    if (seg.indexOf(':') >= 0) {
      seg = seg.split(':').pop();
    }

    // 淇濈暀鍘熸潵閫昏緫锛氬甫瀛楁瘝鍓嶇紑鐨?xxx- / xxx_ 鍘绘帀
    seg = seg.replace(/^(?=[A-Z0-9]*[A-Z])[A-Z0-9]+[-_]/i, '');

    seg = normalizeForCompare(seg);

    if (seg) last = seg;
  }

  return last || normalizeForCompare(cleanLeftByRules(text));
}
// ===== 鐖堕」鏉＄爜-BOM-SN閲囬泦璁板綍 START =====
function bomCollectParentKey(v) {
  return normalizeSnForDup(v);
}

function bomCollectSnKey(v) {
  return normalizeSnForDup(v);
}

function bomCollectLoadStore() {
  var store = null;

  try {
    store = JSON.parse(localStorage.getItem(BOM_COLLECT_STORE_KEY) || 'null');
  } catch (e) {}

  if (!store || typeof store !== 'object') {
    store = {
      parents: {},
      snIndex: {}
    };
  }

  if (!store.parents || typeof store.parents !== 'object') {
    store.parents = {};
  }

  if (!store.snIndex || typeof store.snIndex !== 'object') {
    store.snIndex = {};
  }

  return store;
}

function bomCollectRebuildIndex(store) {
  store.snIndex = {};

  Object.keys(store.parents || {}).forEach(function (parentKey) {
    var p = store.parents[parentKey];
    if (!p || !Array.isArray(p.items)) return;

    p.items.forEach(function (item) {
      if (!item || !item.cleanSn) return;

      if (!store.snIndex[item.cleanSn]) {
        store.snIndex[item.cleanSn] = [];
      }

      store.snIndex[item.cleanSn].push({
        parentKey: parentKey,
        parentSn: p.parentSn || parentKey,
        bomCode: item.bomCode || '',
        sn: item.sn || '',
        cleanSn: item.cleanSn || '',
        ts: p.ts || item.ts || 0
      });
    });
  });

  return store;
}

function bomCollectPrune(store) {
  var keys = Object.keys(store.parents || {});

  if (keys.length <= BOM_COLLECT_MAX_PARENT) {
    return store;
  }

  keys.sort(function (a, b) {
    var pa = store.parents[a] || {};
    var pb = store.parents[b] || {};
    return Number(pb.ts || 0) - Number(pa.ts || 0);
  });

  var keep = {};
  keys.slice(0, BOM_COLLECT_MAX_PARENT).forEach(function (k) {
    keep[k] = store.parents[k];
  });

  store.parents = keep;

  return store;
}

function bomCollectSaveStore(store) {
  store = bomCollectPrune(store);
  store = bomCollectRebuildIndex(store);

  try {
    localStorage.setItem(BOM_COLLECT_STORE_KEY, JSON.stringify(store));
  } catch (e) {}

  return store;
}

function bomCollectSaveWhenGateAllOk(gateData) {
  if (!gateData || !gateData.allOk) return false;

  var parentRaw = toStr(gateData.parentSn);
  var parentKey = bomCollectParentKey(parentRaw);

  if (!parentKey) return false;

  if (!Array.isArray(gateData.details) || !gateData.details.length) {
    return false;
  }

  var now = Date.now();
  var items = [];

  gateData.details.forEach(function (d) {
    if (!d) return;
    if (d.status !== 'ok') return;

    var sn = toStr(d.sn);
    var cleanSn = bomCollectSnKey(d.cleanSn || d.sn);

    if (!sn || !cleanSn) return;

    var el = d.id ? document.getElementById(d.id) : null;
    var leftText = el ? getNearCode(el) : '';
    var bomCode = extractLeftCodeSmart(leftText);

    items.push({
      id: d.id || '',
      sn: sn,
      cleanSn: cleanSn,
      bomCode: bomCode || '',
      leftText: leftText || '',
      ts: now
    });
  });

  if (!items.length) return false;

  var store = bomCollectLoadStore();

  store.parents[parentKey] = {
    parentKey: parentKey,
    parentSn: parentRaw || parentKey,
    ts: now,
    count: items.length,
    items: items
  };

  bomCollectSaveStore(store);

  console.log('[BOM閲囬泦璁板綍] 宸蹭繚瀛樼埗椤笲OM-SN鍏崇郴锛?, {
    parentSn: parentRaw || parentKey,
    count: items.length,
    items: items
  });

  return true;
}

function bomCollectFindConflict(snRaw, currentParentRaw) {
  var cleanSn = bomCollectSnKey(snRaw);
  if (!cleanSn) return null;

  var currentParentKey = bomCollectParentKey(currentParentRaw || getParentBarcodeValueForGate());
  if (!currentParentKey) return null;

  var store = bomCollectLoadStore();
  var arr = store.snIndex && store.snIndex[cleanSn];

  if (!Array.isArray(arr) || !arr.length) {
    store = bomCollectRebuildIndex(store);
    arr = store.snIndex && store.snIndex[cleanSn];
  }

  if (!Array.isArray(arr) || !arr.length) return null;

  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    if (!item) continue;

    if (item.parentKey && item.parentKey !== currentParentKey) {
      return item;
    }
  }

  return null;
}

function bomCollectUnlockKey(el, snRaw) {
  var parentKey = bomCollectParentKey(getParentBarcodeValueForGate());
  var snKey = bomCollectSnKey(snRaw || (el ? el.value : ''));

  if (!parentKey || !snKey) return '';

  return parentKey + '|' + snKey;
}

function bomCollectIsUnlocked(el, snRaw) {
  var key = bomCollectUnlockKey(el, snRaw);
  if (!key) return false;

  var st = bomCollectUnlockMap.get(el);

  return !!(st && st.key === key);
}

function bomCollectUnlockInput(el) {
  if (!el) return;

  var key = bomCollectUnlockKey(el, el.value);

  if (!key) return;

  bomCollectUnlockMap.set(el, {
    key: key,
    ts: Date.now()
  });

  console.log('[BOM閲囬泦璁板綍] 宸叉墜鍔ㄨВ閿侊細', key);
}

function bomCollectCheckConflictAndLock(el, snRaw) {
  if (!el || !document.body.contains(el)) return false;

  snRaw = toStr(snRaw || el.value);

  if (!snRaw) return false;

  if (bomCollectIsUnlocked(el, snRaw)) {
    return false;
  }

  var hit = bomCollectFindConflict(snRaw, getParentBarcodeValueForGate());

  if (!hit) return false;

  var cleanSn = bomCollectSnKey(snRaw);

  var msg =
    'SN銆? + cleanSn + '銆戝凡琚埗椤广€? + (hit.parentSn || hit.parentKey || '') + '銆戦噰闆? +
    (hit.bomCode ? '锛孊OM銆? + hit.bomCode + '銆? : '');

  try {
    setSnCheckState(el, 'fail', msg, snRaw);
  } catch (e) {}

  try {
    showRowBubble(el, msg, 'err');
  } catch (e2) {}

  try {
    lockedInput = el;
    lockedValue = toStr(el.value);
  } catch (e3) {}

  setTimeout(function () {
    try {
      el.focus();
      el.select();
    } catch (e4) {}
  }, 0);

  console.warn('[BOM閲囬泦璁板綍] 鍙戠幇璺ㄧ埗椤归噸澶嶉噰闆嗭細', {
    sn: cleanSn,
    currentParent: getParentBarcodeValueForGate(),
    oldParent: hit.parentSn || hit.parentKey,
    bomCode: hit.bomCode || ''
  });

  return true;
}
// ===== 鐖堕」鏉＄爜-BOM-SN閲囬泦璁板綍 END =====

  // 浠呭垹鍚瓧姣嶅墠缂€
  function extractCodeSmart(text){
    text = toStr(text).replace(/\u00A0/g, ' ').replace(/锛?g, ':');
    var parts = text.split(/\s+/).filter(Boolean);
    var last = '';

    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (seg.indexOf(':') >= 0) seg = seg.split(':').pop();
      seg = seg.replace(/^(?=[A-Z0-9]*[A-Z])[A-Z0-9]+[-_]/i, '');
      seg = normalizeForCompare(seg);
      if (seg) last = seg;
    }
    return last || normalizeForCompare(text);
  }

  function isCodeEqual(leftText, actualCode){
  var L = extractLeftCodeSmart(leftText);
  var A = extractCodeSmart(actualCode);
  return !!L && !!A && L === A;
}


  // ===== 宸︿晶瀹氫綅 =====
  function nearestLeftCodeCell(inputEl){
    var ir = inputEl.getBoundingClientRect();
    var cands = [].slice.call(document.querySelectorAll('td.grid-cell'));
    var best = null, bestScore = Infinity;

    for (var i = 0; i < cands.length; i++) {
      var td = cands[i];
      var r = td.getBoundingClientRect();
      if (r.right > ir.left) continue;

      var dy = Math.abs((r.top + r.height / 2) - (ir.top + ir.height / 2));
      var dx = ir.left - r.right;
      if (dy > 80 || dx > 700) continue;

      var bonus = (td.className || '').indexOf('col0') >= 0 ? -20 : 0;
      var score = dy * 3 + dx + bonus;
      if (score < bestScore) { bestScore = score; best = td; }
    }
    return best;
  }

  function findCodeNodeByInput(el){ return nearestLeftCodeCell(el); }
  function findCodeByInput(el){ return findCodeNodeByInput(el); } // 鍏滃簳鍒悕
  function getNearCode(el){
    var td = findCodeNodeByInput(el);
    return td ? toStr(td.innerText) : '';
  }

 // ===== 鏌ヨ =====
function isStrongCode(v){ return /^(34|45)\d{6}(-\d{3})?$/.test(toStr(v)); }
function isWeakCode(v){ return /^\d{8}(-\d{3})?$/.test(toStr(v)); }
function looksLikeDate8(v){ return /^20\d{6}$/.test(toStr(v)); }

// 鏂板锛?寮€澶达紝8浣嶏紝鎴栧甫-3浣嶅亸鐮?function isNineCode(v){
  v = toStr(v).toUpperCase();
  return /^9[A-Z0-9]{7}(?:-\d{3})?$/.test(v);
}

function pickFirstMatchedCode(obj){
  var strong = '';
  var weak = '';
  var nine = '';

  (function walk(x){
    if (x == null) return;

    if (typeof x !== 'object') {
      var s = toStr(x).toUpperCase();
      if (!s) return;

      if (!strong && isStrongCode(s)) { strong = s; return; }
      if (!weak && isWeakCode(s) && !looksLikeDate8(s)) weak = s;
      if (!nine && isNineCode(s)) nine = s;
      return;
    }

    if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) walk(x[i]); return; }

    var keys = Object.keys(x);
    for (var k = 0; k < keys.length; k++) walk(x[keys[k]]);
  })(obj);

  return strong || weak || nine || '';
}

  async function fetchPage(sn, pageSize, pageNo, a, b){
    var url = BASE + '/' + pageSize + '/' + pageNo + '/' + a + '/' + b;
    var body = { barCode:'', snStr:sn, itemName:'', componentType:'', createdFrom:'', createdTo:'' };

    var r = await fetch(url, {
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });

    return JSON.parse(await r.text());
  }

  async function queryAllRows(snRaw, pageSize){
    pageSize = pageSize || 100;
    var sn = normSn(snRaw);
    var modes = [[0,0],[7,0]];
    var best = { sn: sn, rows: [], mode: '-' };

    for (var i = 0; i < modes.length; i++) {
      var a = modes[i][0], b = modes[i][1];
      var page = 1, totalPages = 1, rows = [];

      do {
        var j = await fetchPage(sn, pageSize, page, a, b);
        var vo = (j && j.resultObjVO) || {};
        var pageVO = vo.pageVO || {};
        rows = rows.concat(vo.result || []);
        totalPages = Number(pageVO.totalPages || 1);
        page++;
      } while (page <= totalPages);

      if (rows.length) return { sn: sn, rows: rows, mode: a + '/' + b };
      best = { sn: sn, rows: rows, mode: a + '/' + b };
    }
    return best;
  }

  async function queryCodeBySn_OpenApi(snRaw){
    var sn = normSn(snRaw);
    var url = 'https://w3.huawei.com/mes/qmgateway/com.huawei.supply.mes.mesplus.qm:mesqmmitrservice/mes/mitrservice/services/openapi/getSnAttr';

    var r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sn: sn })
    });

    var j = await r.json();
    var vo = (j && j.resultObjVO) || {};
    return { sn: sn, code: toStr(vo.partNo), source: 'openapi', mode: '-', rows: 0 };
  }

  async function queryCodeHybrid(snRaw){
    var q1 = await queryAllRows(snRaw, 100);
    var code1 = pickFirstMatchedCode(q1.rows);
    if (code1) return { sn: q1.sn, code: code1, source: 'ems-find', mode: q1.mode, rows: q1.rows.length };
    return queryCodeBySn_OpenApi(snRaw);
  }

  // ===== 鑷姩褰掍綅 =====
  function allSnInputs(){
    var arr = [].slice.call(document.querySelectorAll(selector));
    arr.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var dy = ra.top - rb.top;
      if (Math.abs(dy) > 4) return dy;
      return ra.left - rb.left;
    });
    return arr;
  }

  function hasDuplicateSn(snRaw, ignoreEl){
    var sn = normalizeSnForDup(snRaw);
    if (!sn) return false;

    var els = allSnInputs();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (ignoreEl && el === ignoreEl) continue;
      var v = normalizeSnForDup(el.value);
      if (v && v === sn) return true;
    }
    return false;
  }

  function findTargetInputByActualCode(actualCode, excludeEl){
    var A = extractCodeSmart(actualCode);
    if (!A) return null;

    var els = allSnInputs();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === excludeEl) continue;
      var left = extractLeftCodeSmart(getNearCode(el));
      if (left && left === A && !toStr(el.value)) return el;
    }
    return null;
  }

  function commitInputByEnter(el){
    if (!el) return;
    try { el.focus(); } catch(e){}

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  function tryAutoRouteWrongScan(currEl, snRaw, actualCode){
    if (!toStr(snRaw) || !toStr(actualCode)) return null;
    if (hasDuplicateSn(snRaw, currEl)) return null;

    var target = findTargetInputByActualCode(actualCode, currEl);
    if (!target) return null;

    if (hasDuplicateSn(snRaw, currEl)) return null;

        // 鑷姩杞～鏈熼棿锛屾殏鍋滈噸澶嶉攣瀹氾紝閬垮厤涓存椂閲嶅璇攣
    suppressDuplicateLockForRoute(1200);

    target.dataset.snAutoFill = '1';
    target.dataset.snRouteMoving = '1';
    target.dataset.autoFilled = '1';

    currEl.dataset.snRouteMoving = '1';

    target.value = snRaw;

    setSnCheckState(target, 'pending', '鑷姩杞～寰呮牎楠?, snRaw);


    setTimeout(function () {
      try { commitInputByEnter(target); } catch(e){}
           setTimeout(function () {
        try { enqueueCheck(target, toStr(target.value) || snRaw); } catch(e2){}
      }, 60);

    }, 0);

    // 淇1锛氭竻绌哄師妗嗘椂鍚屾妯″瀷 + 娓呯紦瀛?+ 绂佹绌哄€煎洖鏀?    currEl.value = '';
    lastScanByInput.delete(currEl);
    setSnCheckState(currEl, 'empty', '宸茶浆濉?, '');
    suppressEmptyReplay.add(currEl);


    currEl.dispatchEvent(new Event('input', { bubbles: true }));
    currEl.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(function () { suppressEmptyReplay.delete(currEl); }, 300);
    // 鑷姩杞～缁撴潫鍚庯紝娓呴櫎鏍囪锛屽苟閲嶆柊妫€鏌ョ湡瀹為噸澶?    setTimeout(function () {
      try { delete target.dataset.snAutoFill; } catch(e){}
      try { delete target.dataset.snRouteMoving; } catch(e){}
      try { delete currEl.dataset.snRouteMoving; } catch(e){}

      try { refreshDuplicateLock(target); } catch(e2){}
    }, 1200);

    // 淇濇寔浣犲師琛屼负锛氬洖褰撳墠妗嗗苟鍏ㄩ€?    setTimeout(function () { try { currEl.focus(); currEl.select(); } catch(e){} }, 80);

    return target;
  }

  function focusNextEmptyFrom(el){
    var els = allSnInputs();
    var idx = els.indexOf(el);
    if (idx < 0) return null;
    for (var i = idx + 1; i < els.length; i++) {
      if (!toStr(els[i].value)) return els[i];
    }
    return null;
  }

  // ===== 姘旀场 =====
  function ensureRowBubble(inputEl){
    var st = rowBubbleMap.get(inputEl);

    if (!st) {
      var box = document.createElement('div');
      var arrow = document.createElement('div');

      document.body.appendChild(box);
      document.body.appendChild(arrow);

      st = { box: box, arrow: arrow, type: 'warn', text: '' };
      rowBubbleMap.set(inputEl, st);
      rowBubbleKeys.add(inputEl);
    }

    // 姣忔閮藉己鍒跺埛鏂版牱寮忥紝閬垮厤鏃ф牱寮忔畫鐣欏鑷村彧鏈変竴涓皬璞嗚眴
    st.box.style.position = 'fixed';
    st.box.style.zIndex = '2147483647';
    st.box.style.display = 'block';
    st.box.style.visibility = 'visible';
    st.box.style.boxSizing = 'border-box';
    st.box.style.width = 'auto';
    st.box.style.minWidth = '80px';
   st.box.style.maxWidth = '520px';
      st.box.style.minHeight = '24px';
      st.box.style.padding = '6px 10px';
      st.box.style.borderRadius = '6px';
      st.box.style.color = '#fff';
      st.box.style.fontSize = '12px';
      st.box.style.fontWeight = '400';
      st.box.style.lineHeight = '18px';
      st.box.style.textAlign = 'left';
      st.box.style.boxShadow = '0 4px 12px rgba(0,0,0,.2)';
      st.box.style.whiteSpace = 'normal';
      st.box.style.wordBreak = 'break-all';
      st.box.style.overflowWrap = 'anywhere';
      st.box.style.overflow = 'visible';
      st.box.style.pointerEvents = 'none';


    st.arrow.style.position = 'fixed';
    st.arrow.style.zIndex = '2147483647';
    st.arrow.style.width = '0';
    st.arrow.style.height = '0';
    st.arrow.style.pointerEvents = 'none';
    st.arrow.style.display = 'block';

    return st;
  }


  function positionRowBubble(inputEl){
    var st = rowBubbleMap.get(inputEl);
    if (!st) return;
    if (!document.body.contains(inputEl)) return removeRowBubble(inputEl);

    var r = inputEl.getBoundingClientRect();

    // 纭繚鏂囧瓧宸茬粡鎾戝紑鍚庡啀鍙栧楂?    var bw = st.box.getBoundingClientRect().width || st.box.offsetWidth || 120;
    var bh = st.box.getBoundingClientRect().height || st.box.offsetHeight || 28;
    st.box.style.maxWidth = Math.min(520, window.innerWidth - 40) + 'px';
    st.box.style.width = 'auto';

    var arrow = 6;
    var gap = 8;

    // 榛樿鏀惧彸杈?    var left = r.right + gap + arrow;

    // 濡傛灉鍙宠竟绌洪棿涓嶅锛岃创鍒拌绐楀彸杈癸紝浣嗕粛鐒朵繚鎸佸湪鍙充晶鍖哄煙
    if (left + bw > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - bw - 8);
    }

    var top = r.top + (r.height - bh) / 2;

    if (top < 8) top = 8;
    if (top + bh > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - bh - 8);
    }

    st.box.style.left = left + 'px';
    st.box.style.top = top + 'px';

    // 绠ご鍦ㄦ皵娉″乏渚э紝鎸囧悜SN妗?    st.arrow.style.left = (left - arrow * 2 + 1) + 'px';
    st.arrow.style.top = (top + bh / 2 - arrow) + 'px';
  }




  function showRowBubble(inputEl, text, type){
    var st = ensureRowBubble(inputEl);

    st.type = type || 'warn';
    st.text = text || '';

    var bg = '#d48806';
    if (st.type === 'err') bg = '#d4380d';
    if (st.type === 'warn') bg = '#d48806';
    if (st.type === 'ok') bg = '#389e0d';

    st.box.style.background = bg;
    st.box.style.color = '#fff';
    st.box.textContent = st.text || '鎻愮ず';

    // 鍏堟竻绌虹澶存棫鏍峰紡锛岄槻姝㈠乏绠ご/鍙崇澶存牱寮忓彔鍔犳垚灏忚眴璞?    st.arrow.style.borderTop = '0';
    st.arrow.style.borderBottom = '0';
    st.arrow.style.borderLeft = '0';
    st.arrow.style.borderRight = '0';

    // 姘旀场鍦ㄥ彸杈癸紝鎵€浠ョ澶村湪姘旀场宸︿晶锛屽皷澶存湞宸︼紝鎸囧悜SN妗?    st.arrow.style.borderTop = '6px solid transparent';
    st.arrow.style.borderBottom = '6px solid transparent';
    st.arrow.style.borderRight = '6px solid ' + bg;
    st.arrow.style.borderLeft = '0';

    positionRowBubble(inputEl);

    // 鍐嶅欢杩熶竴甯ч噸鏂板畾浣嶏紝纭繚鏂囧瓧瀹藉害鐢熸晥
    requestAnimationFrame(function () {
      positionRowBubble(inputEl);
    });
  }



  function removeRowBubble(inputEl){
    var st = rowBubbleMap.get(inputEl);
    if (!st) return;
    if (st.box && st.box.parentNode) st.box.parentNode.removeChild(st.box);
    if (st.arrow && st.arrow.parentNode) st.arrow.parentNode.removeChild(st.arrow);
    rowBubbleMap.delete(inputEl);
    rowBubbleKeys.delete(inputEl);
  }

  function removeAllRowBubbles(){ rowBubbleKeys.forEach(function(el){ removeRowBubble(el); }); }
  function refreshAllBubblePos(){ rowBubbleKeys.forEach(function(el){ positionRowBubble(el); }); }

  window.addEventListener('scroll', refreshAllBubblePos, true);
  window.addEventListener('resize', refreshAllBubblePos, true);

  // ===== 鐧藉簳鎮诞淇℃伅鍗★紙鏀惧湪SN妗嗕笅鏂癸級=====
  function ensureHoverCard(inputEl){
    var card = hoverCardMap.get(inputEl);
    if (card) return card;

    card = document.createElement('div');
    card.style.position = 'fixed';
    card.style.zIndex = '2147483646';
    card.style.maxWidth = '380px';
    card.style.padding = '8px 10px';
    card.style.borderRadius = '8px';
    card.style.background = '#fff';
    card.style.color = '#333';
    card.style.border = '1px solid #d9d9d9';
    card.style.fontSize = '12px';
    card.style.lineHeight = '1.5';
    card.style.whiteSpace = 'pre-line';
    card.style.pointerEvents = 'none';
    card.style.boxShadow = '0 6px 20px rgba(0,0,0,.15)';
    card.style.display = 'none';

    document.body.appendChild(card);
    hoverCardMap.set(inputEl, card);
    return card;
  }

  function positionHoverCard(inputEl){
    var card = hoverCardMap.get(inputEl);
    if (!card) return;

    var r = inputEl.getBoundingClientRect();
    var left = r.left;
    var top = r.bottom + 6; // 鏀惧湪涓嬫柟

    var maxW = 380;
    if (left + maxW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - maxW - 8);
    }

    var cardH = card.offsetHeight || 120;
    if (top + cardH > window.innerHeight - 8) {
      top = Math.max(8, r.top - cardH - 6); // 鏀句笉涓嬪氨涓婃柟
    }

    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function hideHoverCard(inputEl){
    var card = hoverCardMap.get(inputEl);
    if (card) card.style.display = 'none';
    if (hoverCurrentEl === inputEl) hoverCurrentEl = null;
  }

  async function queryHoverInfo(snRaw){
    var sn = normSn(snRaw);
    if (!sn) return null;

    var hit = hoverCache.get(sn);
    var now = Date.now();
    if (hit && (now - hit.ts < 15000)) return hit.data;

    var q = await queryCodeHybrid(sn);
    var data = {
      sn: q.sn || sn,
      code: toStr(q.code),
      source: q.source || '-',
      mode: q.mode || '-',
      rows: q.rows || 0
    };
    hoverCache.set(sn, { ts: now, data: data });
    return data;
  }

  async function showHoverInfo(inputEl){
    var snRaw = toStr(inputEl.value);
    if (!snRaw) return hideHoverCard(inputEl);

    hoverCurrentEl = inputEl;

    var leftRaw = getNearCode(inputEl) || '';
    var leftFiltered = extractLeftCodeSmart(leftRaw) || '(鏃?';
    var card = ensureHoverCard(inputEl);

    card.textContent = '宸︿晶(杩囨护鍚?: ' + leftFiltered + '\n鏌ヨ涓?..';
    card.style.display = 'block';
    positionHoverCard(inputEl);

    try {
      var info = await queryHoverInfo(snRaw);
      if (hoverCurrentEl !== inputEl) return;

      var queryFiltered = info && info.code ? (extractCodeSmart(info.code) || info.code) : '(鏃?';
      card.textContent =
        '宸︿晶(杩囨护鍚?: ' + leftFiltered + '\n' +
        '鏌ヨ: ' + queryFiltered + '\n' +
        '鏉ユ簮: ' + (info ? info.source : '-') + '\n' +
        '妯″紡: ' + (info ? info.mode : '-') + '\n' +
        'rows: ' + (info ? info.rows : 0);

      card.style.display = 'block';
      positionHoverCard(inputEl);
    } catch (e) {
      if (hoverCurrentEl !== inputEl) return;
      card.textContent = '宸︿晶(杩囨护鍚?: ' + leftFiltered + '\n鏌ヨ寮傚父: ' + String(e);
      card.style.display = 'block';
      positionHoverCard(inputEl);
    }
  }

  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) showHoverInfo(t);
  }, true);
  document.addEventListener('mouseout', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) hideHoverCard(t);
  }, true);

  // ===== 涓绘牎楠?=====
  function paintCodeNode(node, status){
    if (!node) return;
    node.style.backgroundColor = '';
    if (status === 'fail') { node.style.color = '#d4380d'; node.style.fontWeight = '700'; }
    else if (status === 'none') { node.style.color = '#d48806'; node.style.fontWeight = '700'; }
    else if (status === 'ok') { node.style.color = '#389e0d'; node.style.fontWeight = '700'; }
    else { node.style.color = ''; node.style.fontWeight = ''; }
  }

    async function runCheckOne(el, snOverride){
    syncSwitchFromStorage();

    var seq = (__reqSeq.get(el) || 0) + 1;
    __reqSeq.set(el, seq);
    function isStale(){ return __reqSeq.get(el) !== seq; }

    var snRaw = toStr(snOverride || el.value);
      if (!snRaw) {
      resetNoCodeRetry(el);
      setSnCheckState(el, 'empty', '绌?, '');
      if (isStale()) return;
      removeRowBubble(el);
      paintCodeNode(findCodeNodeByInput(el), '');
      return;
    }

    if (bomCollectCheckConflictAndLock(el, snRaw)) {
      return;
    }

    setSnCheckState(el, 'pending', '鏌ヨ涓?, snRaw);


    var expected = getNearCode(el);
    var codeNode = findCodeNodeByInput(el);

    try {
      var q = await queryCodeHybrid(snRaw);
      if (isStale()) return;

      var actual = q.code;

      if (!expected) {
        resetNoCodeRetry(el);
        setSnCheckState(el, 'fail', '鏃犲乏渚х紪鐮?, snRaw);
        paintCodeNode(codeNode, 'none');
        showRowBubble(el, '鏃犲乏渚х紪鐮?, 'warn');

      } else if (!actual) {
        paintCodeNode(codeNode, 'none');

        // 鏌ヤ笉鍒扮紪鐮佹椂鍏堣嚜鍔ㄩ噸璇曪紝闃叉鎵お蹇帴鍙ｈ繕娌¤繑鍥炴暟鎹?        if (scheduleNoCodeRetry(el, snRaw)) {
          setSnCheckState(el, 'retry', '鏈煡鍒扮紪鐮侊紝閲嶈瘯涓?, snRaw);
          return;
        }

        setSnCheckState(el, 'fail', '鏃犲搴旂紪鐮侊紝宸查噸璇? + NO_CODE_RETRY_MAX + '娆?, snRaw);
        showRowBubble(el, '鏃犲搴旂紪鐮侊紝宸查噸璇? + NO_CODE_RETRY_MAX + '娆?, 'warn');

      } else if (isCodeEqual(expected, actual)) {
        resetNoCodeRetry(el);
        setSnCheckState(el, 'ok', '缂栫爜涓€鑷?, snRaw);
        paintCodeNode(codeNode, 'ok');
        removeRowBubble(el);

      } else {
        resetNoCodeRetry(el);

        var targetEl = autoRouteOn ? tryAutoRouteWrongScan(el, snRaw, actual) : null;
        if (isStale()) return;

        if (targetEl) {
          setSnCheckState(el, 'empty', '宸茶浆濉?, '');
          paintCodeNode(codeNode, 'none');
          showRowBubble(el, '宸茶浆濉?, 'warn');
          showRowBubble(targetEl, '宸茶嚜鍔ㄥ～鍏ュ搴旂紪鐮佽', 'warn');
        } else {
          setSnCheckState(el, 'fail', '缂栫爜涓嶄竴鑷?, snRaw);
          paintCodeNode(codeNode, 'fail');
          showRowBubble(el, '缂栫爜涓嶄竴鑷?, 'err');

          if (lockOn) {
            lockedInput = el;
            lockedValue = toStr(el.value);
            setTimeout(function(){ try { el.focus(); el.select(); } catch (e) {} }, 0);
          }
        }
      }
    } catch (e) {
      if (isStale()) return;
      resetNoCodeRetry(el);
      setSnCheckState(el, 'fail', '鏌ヨ澶辫触', snRaw);
      paintCodeNode(codeNode, 'fail');
      showRowBubble(el, '鏌ヨ澶辫触', 'err');
    }

    if (isStale()) return;
    refreshAllBubblePos();
  }


  // ===== 鐩戝惉 =====
  // 鍙紶鏍囨偓鍋滄樉绀鸿鎯咃紝涓嶅湪 focus 鏃舵樉绀?  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) showHoverInfo(t);
  }, true);


 // focusin 浠呬繚鐣欓攣閫昏緫锛堝幓鎺?autoFilled 鑷姩璺充笅涓€涓級
document.addEventListener('focusin', function (e) {
  var t = e.target;
  if (!t || !t.matches || !t.matches(selector)) return;

  __lastSnInput = t;

  // 閿佸畾浼樺厛
  if (lockOn && lockedInput && t !== lockedInput) {
    setTimeout(function () {
      try { lockedInput.focus(); lockedInput.select(); } catch (err) {}
    }, 0);
    return;
  }

  // 宸茶嚜鍔ㄨ浆濉笖鏈夊€硷細鑷姩璺宠繃鍒颁笅涓€涓┖妗?  if (t.dataset && t.dataset.autoFilled === '1' && toStr(t.value)) {
    var nxt = focusNextEmptyFrom(t);
    if (nxt) {
      setTimeout(function () {
        try { nxt.focus(); } catch (e2) {}
      }, 0);
    }
  }
}, true);



  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) {
      __preJumpSnInput = t; // 璁板綍璺宠蛋鍓峉N妗?    }
  }, true);

  // 淇2锛歩nput 鏀逛负涓茶鍏ラ槦
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(selector)) return;
    if (t.dataset && t.dataset.snAutoFill === '1') return;

    syncSwitchFromStorage();

       if (toStr(t.value)) {
      lastScanByInput.set(t, toStr(t.value));
      lastNonEmptyScanByInput.set(t, toStr(t.value));
      setSnCheckState(t, 'pending', '绛夊緟鏍￠獙', toStr(t.value));
    } else {
      setSnCheckState(t, 'empty', '绌?, '');
    }



    if (lockOn && lockedInput === t && toStr(t.value) !== lockedValue) {
      lockedInput = null;
      lockedValue = '';
    }

    clearTimeout(__checkTimer);
    __checkTimer = setTimeout(function () {
      enqueueCheck(t, toStr(t.value));
    }, 220);
  }, true);

  // 淇1+2锛氬睆钄借剼鏈竻绌哄洖鏀?+ 涓茶鍏ラ槦
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(selector)) return;

    syncSwitchFromStorage();

    if (!toStr(t.value)) {
      if (suppressEmptyReplay.has(t)) return;

      var last = toStr(lastScanByInput.get(t));
      if (last) {
        setTimeout(function () {
          enqueueCheck(t, last);
        }, 0);
      }
    }
  }, true);

  // 鍙屽嚮瑙ｉ攣
  document.addEventListener('dblclick', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches(selector)) return;

    if (t.dataset && t.dataset.autoFilled) delete t.dataset.autoFilled;

    try {
      bomCollectUnlockInput(t);
    } catch (err) {}

    lockedInput = null;
    lockedValue = '';

    showRowBubble(t, '宸茶В閿侊紝鍙墜鍔ㄤ慨鏀?, 'warn');
    setTimeout(function(){ removeRowBubble(t); }, 1200);
  }, true);


  // Esc 瑙ｉ攣
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      lockedInput = null;
      lockedValue = '';
    }
  }, true);

  // ===== 瑕嗙洊杩欐暣娈碉細寮圭獥鑷姩鍏抽棴 + 鍗曟鍥炴媺 + 涓嶅洖濉絾鍙浆濉?=====
  var __lastSnInput = null;
  var __preJumpSnInput = null;
  var __snErrBubbleUntil = 0;
  var __snErrBubbleText = '';

  // 璁板綍褰撳墠SN鐒︾偣
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) {
      __lastSnInput = t;
    }
  }, true);

  // 璁板綍璺宠蛋鍓峉N妗?  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches(selector)) {
      __preJumpSnInput = t;
    }
  }, true);

  var __snDialogMo = new MutationObserver(function (list) {
    list.forEach(function (m) {
      [].forEach.call(m.addedNodes || [], function (n) {
        if (!n || n.nodeType !== 1) return;

        var dialog = null;
        if (n.matches && n.matches('.hae-dialog.popup-dialog, .dialog-tips.hae-dialog')) {
          dialog = n;
        } else if (n.querySelector) {
          dialog = n.querySelector('.hae-dialog.popup-dialog, .dialog-tips.hae-dialog');
        }
        if (!dialog) return;

        var txt = (dialog.innerText || '');
                var isErr1 = txt.indexOf('鏈厤缃柊缂栫爜') >= 0 && txt.indexOf('鐗╂枡SN[') >= 0;
        var isErr2 = txt.indexOf('鏂扮紪鐮佷笌褰撳墠鐗╂枡缂栫爜涓嶄竴鑷?) >= 0;
        if (!isErr1 && !isErr2) return;

        // 鑷姩鐐光€滅‘瀹氣€?        var okBtn = dialog.querySelector('button.hae-btn.btn-primary, .btn-primary');
        if (okBtn) {
          try { okBtn.click(); } catch (e) {}
        }

        // 鍗曟鍥炴媺锛堜笉鍥炲～锛夛紝浣嗙敤缂撳瓨鍊艰Е鍙戣浆濉?        setTimeout(function () {
          var recoverEl = __preJumpSnInput || __lastSnInput;
          if (!recoverEl || !document.body.contains(recoverEl)) return;
          if (!(recoverEl.matches && recoverEl.matches(selector))) return;

         // 涓嶅洖濉緭鍏ユ锛屼絾鐢ㄦ渶杩戠紦瀛樺€艰窇鏍￠獙/鑷姩杞～锛堝惈鍏滃簳缂撳瓨锛?var last = toStr(
  lastScanByInput.get(recoverEl) ||
  lastNonEmptyScanByInput.get(recoverEl)
);
if (last) {
  enqueueCheck(recoverEl, last);
}


          var msg = isErr2 ? '绯荤粺鏍￠獙鏈€氳繃锛氭柊缂栫爜涓庡綋鍓嶇墿鏂欑紪鐮佷笉涓€鑷达紝璇烽噸鏂版壂鎻? : '绯荤粺鏍￠獙鏈€氳繃锛氭湭閰嶇疆鏂扮紪鐮侊紝璇烽噸鏂版壂鎻?;

          __snErrBubbleText = msg;
          __snErrBubbleUntil = Date.now() + 5000;

          try { showRowBubble(recoverEl, msg, 'err'); } catch (e) {}
          try { recoverEl.focus(); recoverEl.select(); } catch (e) {}

          setTimeout(function () {
            if (Date.now() >= __snErrBubbleUntil && __snErrBubbleText === msg) {
              try { removeRowBubble(recoverEl); } catch (e) {}
            }
          }, 5000);
        }, 80);
      });
    });
  });

  __snDialogMo.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  // ===== 鎮诞鍗″厹搴曢殣钘忥紙闃插崱浣忥級=====
  setInterval(function () {
    if (!hoverCurrentEl) return;

    if (!document.body.contains(hoverCurrentEl)) {
      hideHoverCard(hoverCurrentEl);
      hoverCurrentEl = null;
      return;
    }

    var over = document.querySelector(selector + ':hover');
    if (over !== hoverCurrentEl) {
      hideHoverCard(hoverCurrentEl);
      hoverCurrentEl = null;
    }
  }, 180);

  document.addEventListener('scroll', function () {
    if (hoverCurrentEl) {
      hideHoverCard(hoverCurrentEl);
      hoverCurrentEl = null;
    }
  }, true);

  document.addEventListener('mousedown', function () {
    if (hoverCurrentEl) {
      hideHoverCard(hoverCurrentEl);
      hoverCurrentEl = null;
    }
  }, true);

 // ===== 娓呯悊 =====
function hasGridRows(){ return document.querySelectorAll('tr.grid-row').length > 0; }
function allSnEmpty(){
  var els = document.querySelectorAll(selector);
  for (var i = 0; i < els.length; i++) {
    if ((els[i].value || '').trim()) return false;
  }
  return true;
}

setInterval(function () {
  if (Date.now() < __snErrBubbleUntil) return;

  if (!hasGridRows() || allSnEmpty()) {
    removeAllRowBubbles();
    hoverCurrentEl = null;
  }
}, 300);

// ===== SN鎵归噺杞～鎵弿妗嗭紙鍙傝€冪簿绠€鍏滃簳鐗堬級=====

var __bomListActive = false;        // BOM鍒楄〃鏄惁娲昏穬
var __snProcessed = new Set();      // 宸插鐞嗙殑SN锛堝幓閲嶏級
var __snQueue = [];                 // 澶勭悊闃熷垪
var __snLogs = [];                  // 鏃ュ織璁板綍
var __panelPosKey = '__sn_panel_pos_v3';

// ===== 宸ュ叿鍑芥暟 =====
function __getBarcodeInput() {
  var all = document.querySelectorAll('div[id^="Input_"] > input.hae-ui-input[type="text"], div[id^="Input_"] > input');
  for (var i = 0; i < all.length; i++) {
    var box = all[i].closest('div[id^="Input_"]');
    var ctx = ((box && box.parentElement ? box.parentElement.innerText : '') || '').replace(/\s+/g, '');
    if (ctx.indexOf('鏉＄爜閲囬泦') >= 0) return all[i];
  }
  return all[3] || null;
}

function __findInputByCode(code) {
  if (!code) return null;
  var inputs = document.querySelectorAll('input[id^="sn-input"]');
  for (var i = 0; i < inputs.length; i++) {
    if (toStr(inputs[i].value)) continue;
    var td = findCodeNodeByInput(inputs[i]);
    if (!td) continue;
    if (extractLeftCodeSmart(toStr(td.innerText)) === code) return inputs[i];
  }
  return null;
}

// ===== 澶勭悊鍗曟潯SN =====
async function __processSn(sn) {
  if (!sn || __snProcessed.has(sn)) {
    if (__snProcessed.has(sn)) __addLog(sn, '', 'duplicate');
    return;
  }

  __snProcessed.add(sn);
  var item = { sn: sn, code: '', status: 'querying' };
  __snQueue.push(item);
  __addLog(sn, '鏌ヨ涓?..', '');

  try {
    var q = await queryCodeHybrid(sn);
    var code = q ? toStr(q.code) : '';

    if (code) {
      item.code = code;
      var target = __findInputByCode(code);
      if (target) {
        item.status = 'success';

        // 璋冪敤鍘熻剼鏈嚱鏁板～鍏?鈫?瑙﹀彂绯荤粺鏍￠獙
        target.value = sn;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        target.dispatchEvent(new KeyboardEvent('keydown', o));
        target.dispatchEvent(new KeyboardEvent('keypress', o));
        target.dispatchEvent(new KeyboardEvent('keyup', o));

        setSnCheckState(target, 'ok', 'ok', sn);
        paintCodeNode(findCodeNodeByInput(target), 'ok');

        __addLog(sn, code, 'success');
      } else {
        item.status = 'skipped';
        __addLog(sn, code, 'skip');
      }
    } else {
      item.status = 'failed';
      __addLog(sn, '', 'error');
    }
  } catch (e) {
    item.status = 'failed';
    __addLog(sn, '', 'error');
  }

  var countEl = document.getElementById('__sn_count');
  if (countEl) countEl.textContent = __snQueue.length + '鏉?;
}

function __addLog(sn, code, status) {
  __snLogs.unshift({ sn: sn, code: code, status: status, ts: Date.now() });
  if (__snLogs.length > 50) __snLogs.pop();
  var el = document.getElementById('__sn_logs');
  if (!el) return;
  el.innerHTML = __snLogs.map(function(l) {
    var c = '#888', p = '路';
    if (l.status === 'success') { c = '#389e0d'; p = '鉁?; }
    else if (l.status === 'duplicate') { c = '#d4380d'; p = '鈯?; }
    else if (l.status === 'error') { c = '#d4380d'; p = '鉁?; }
    else if (l.status === 'skip') { c = '#999'; p = '鈫?; }
    var t = l.sn;
    if (l.code) t += ' 鈫?' + l.code;
    return '<div style="padding:2px 8px;font-size:11px;color:' + c + ';border-bottom:1px solid #f5f5f5;">' + p + ' ' + t + '</div>';
  }).join('');
  el.scrollTop = 0;
}

// ===== 闈㈡澘绠＄悊 =====
function __savePos(left, top) {
  try { localStorage.setItem(__panelPosKey, JSON.stringify({ left: left, top: top })); } catch (e) {}
}
function __loadPos() {
  try { var p = JSON.parse(localStorage.getItem(__panelPosKey)); if (p && typeof p.left === 'number') return p; } catch (e) {}
  return null;
}

function __createPanel() {
  var old = document.getElementById('__sn_panel');
  if (old) return;

  var pos = __loadPos();

  var panel = document.createElement('div');
  panel.id = '__sn_panel';
  panel.style.cssText = 'position:fixed;z-index:2147483646;width:300px;' + (pos ? 'left:' + pos.left + 'px;top:' + pos.top + 'px;right:auto;' : 'right:16px;top:100px;') + 'background:#fafafa;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.08);font-size:12px;font-family:Arial,sans-serif;color:#333;display:flex;flex-direction:column;overflow:hidden;';

  panel.innerHTML =
    '<div id="__sn_head" style="padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;background:#fff;cursor:move;user-select:none;">' +
      '<span style="font-weight:600;">SN杞～</span>' +
      '<span id="__sn_count" style="color:#888;font-size:11px;">0鏉?/span>' +
    '</div>' +
    '<div style="padding:8px 12px;">' +
      '<input id="__sn_input" placeholder="鎵玈N鏉＄爜" style="width:100%;box-sizing:border-box;height:32px;border:1px solid #d9d9d9;border-radius:4px;padding:0 8px;font-size:13px;outline:none;" onfocus="this.style.borderColor=\'#69b1ff\'" onblur="this.style.borderColor=\'#d9d9d9\'">' +
    '</div>' +
    '<div style="padding:4px 12px;border-top:1px solid #f5f5f5;display:flex;justify-content:space-between;align-items:center;background:#fff;">' +
      '<span id="__sn_hint" style="color:#888;font-size:11px;"></span>' +
      '<button id="__sn_clear" style="border:none;background:none;color:#999;font-size:10px;cursor:pointer;">娓呯┖</button>' +
    '</div>' +
    '<div id="__sn_logs" style="max-height:200px;overflow:auto;min-height:20px;background:#fafafa;"></div>';

  document.body.appendChild(panel);

  var input = panel.querySelector('#__sn_input');
  input.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.keyCode !== 13) return;
    e.preventDefault(); e.stopPropagation();
    var v = toStr(input.value);
    input.value = '';
    if (v) __processSn(v);
  });

  panel.querySelector('#__sn_clear').onclick = function() {
    __snProcessed.clear(); __snQueue = []; __snLogs = [];
    var el = document.getElementById('__sn_logs'); if (el) el.innerHTML = '';
    var ce = document.getElementById('__sn_count'); if (ce) ce.textContent = '0鏉?;
  };

  // 鎷栨嫿
  (function(h) {
    var dn = false, sx, sy, ox, oy;
    h.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'INPUT') return;
      dn = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.left = ox + 'px'; panel.style.top = oy + 'px'; panel.style.right = 'auto';
    });
    document.addEventListener('mousemove', function(e) {
      if (!dn) return; panel.style.left = Math.max(0, ox + e.clientX - sx) + 'px'; panel.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', function() {
      if (!dn) return; dn = false;
      var r = panel.getBoundingClientRect(); __savePos(r.left, r.top);
    });
  })(panel.querySelector('#__sn_head'));

  setTimeout(function() { try { input.focus(); } catch(e) {} }, 200);
}

function __removePanel() {
  var p = document.getElementById('__sn_panel');
  if (p) { p.remove(); }
}

function __showHint(text) {
  var el = document.getElementById('__sn_hint');
  if (el) el.textContent = text || '';
}

// ===== BOM妫€娴嬶細鍑虹幇鈫掑脊妗嗭紝娑堝け鈫掑垹妗?鐒︾偣鍥炴潯鐮佹 =====
setInterval(function() {
  if (!location.href || location.href.indexOf('#/ProductTrackInOut') < 0) return;

  var count = document.querySelectorAll('input[id^="sn-input"]').length + document.querySelectorAll('tr.grid-row').length;
  var now = count > 0;

  if (now && !__bomListActive) {
    __bomListActive = true;
    __createPanel();
    __showHint('BOM ' + count + '椤?);
  }

  if (!now && __bomListActive) {
    __bomListActive = false;
    __removePanel();
    __snProcessed.clear(); __snQueue = []; __snLogs = [];

    setTimeout(function() {
      var bi = __getBarcodeInput();
      if (bi) { try { bi.focus(); if (bi.select) bi.select(); } catch(e) {} }
    }, 400);
  }
}, 600);

// Ctrl+Q
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) { e.preventDefault(); __createPanel(); }
}, true);

// 鎺у埗鍙?window.SnFill = {
  scan: function(s) { __processSn(s); },
  open: function() { __createPanel(); var i = document.getElementById('__sn_input'); if (i) i.focus(); },
  state: function() { return { processed: __snProcessed.size, queue: __snQueue.length, logs: __snLogs.length, bomActive: __bomListActive }; }
};

console.log('[SnFill] 宸插姞杞? Ctrl+Q 鎵撳紑');

})();