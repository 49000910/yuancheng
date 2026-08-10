// ==UserScript==
// @name         SN缂栫爜瑙勫垯鍏滃簳鍓嶅彴鐗?// @namespace    mes.sn.rule.fallback.ui
// @version      1.6
// @description  SN鎺ュ彛鏌ヤ笉鍒扮紪鐮佹椂鎸夊墠鍙拌鍒欏厹搴曪紱鏀寔鎺ュ彛涓€寮哄瓧娈靛拰鎺ュ彛涓€鎺掗櫎缂栫爜
// @match        https://w3.huawei.com/mespmm/wipweb*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__SN_RULE_FALLBACK_UI__) return;
  window.__SN_RULE_FALLBACK_UI__ = true;

  const RULE_KEY = 'sn_code_rule_fallback_rules_v2';
  const ENABLE_KEY = 'sn_code_rule_fallback_enabled_v2';

  // 鎺ュ彛涓€寮哄瓧娈佃鍒?  const STRONG_FIELD_KEY = 'sn_code_rule_fallback_strong_fields_v1';

  // 鎺ュ彛涓€鎺掗櫎缂栫爜
  const EXCLUDE_CODE_KEY = 'sn_code_rule_fallback_exclude_codes_v1';
// 宸︿晶鏉＄爜娓呮礂瑙勫垯锛屼緵鏍￠獙鑴氭湰璇诲彇
const LEFT_CLEAN_KEY = 'sn_code_left_clean_rules_v1';

  // 鎺ュ彛涓€ EMS锛岀敤浜庡己瀛楁娴嬭瘯
  const EMS_BASE = 'https://w3.huawei.com/mespmm/gateway/com.huawei.supply.mes.mesplus.pspw:mespmmpreallservice/mespmmpreallone/services/emsComponentDataInfo/find/page';
  const EMS_PAGE_SIZE = 100;
  const EMS_MODES = [[0, 0], [7, 0]];

  let enabled = localStorage.getItem(ENABLE_KEY) !== '0';

  function toStr(v) {
    return v == null ? '' : String(v).trim();
  }

  function normSn(v) {
    v = toStr(v).replace(/\u00A0/g, ' ').replace(/\s+/g, '');

    if (v.indexOf('锛?) >= 0) {
      v = v.split('锛?).pop();
    }

    if (v.indexOf(':') >= 0) {
      v = v.split(':').pop();
    }

    return v.toUpperCase();
  }

  function normCode(v) {
    return toStr(v).replace(/\u00A0/g, ' ').replace(/\s+/g, '').toUpperCase();
  }

  // 涓撻棬鐢ㄤ簬鎺ュ彛杩斿洖鍏ㄦ枃/寮哄瓧娈靛尮閰?  // 涓嶈兘鍍?normSn 閭ｆ牱閬囧埌鍐掑彿灏辨埅鏂?  function normSearchText(v) {
    return toStr(v)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/锛?g, ':')
      .toUpperCase();
  }

  function codeExact(v) {
    return normCode(v);
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function escReg(s) {
    const specials = '\\^$.*+?()[]{}|';

    return String(s).split('').map(function (ch) {
      return specials.indexOf(ch) >= 0 ? '\\' + ch : ch;
    }).join('');
  }

  /*
    閫氶厤瑙勫垯锛?    ? = 浠绘剰 1 浣?    * = 浠绘剰闀垮害锛屽父鐢ㄤ簬鏈熬
    澶氫釜 * 杩炲湪涓€璧凤紝渚嬪 *******锛屾寜鍥哄畾 7 浣嶅鐞?  */
  function wildcardToRegExp(pattern) {
    pattern = normSn(pattern).replace(/锛?g, '*').replace(/锛?g, '?');

    let out = '^';

    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];

      if (ch === '?') {
        out += '[A-Z0-9]';
        continue;
      }

      if (ch === '*') {
        let j = i;

        while (j < pattern.length && pattern[j] === '*') {
          j++;
        }

        const count = j - i;
        const isAtEnd = j === pattern.length;

        if (count === 1 && isAtEnd) {
          out += '[A-Z0-9]*';
        } else {
          out += '[A-Z0-9]{' + count + '}';
        }

        i = j - 1;
        continue;
      }

      out += escReg(ch);
    }

    out += '$';

    return new RegExp(out, 'i');
  }

  function normalizeRuleType(type) {
    type = toStr(type);

    if (type === '寮€澶? || type === '鍓嶇紑') return '寮€澶存槸';
    if (type === '鍖呮嫭' || type === '鍚湁') return '鍖呭惈';
    if (type === '绮剧‘' || type === '鐩哥瓑') return '绛変簬';
    if (type === '閫氶厤绗?) return '閫氶厤';

    if (['鍖呭惈', '寮€澶存槸', '绛変簬', '閫氶厤'].indexOf(type) >= 0) {
      return type;
    }

    return '鍖呭惈';
  }

  function getEffectiveType(type, pattern) {
    type = normalizeRuleType(type);
    pattern = normSn(pattern);

    if (pattern.indexOf('*') >= 0 || pattern.indexOf('?') >= 0) {
      return '閫氶厤';
    }

    return type;
  }

  function loadRules() {
    try {
      const arr = JSON.parse(localStorage.getItem(RULE_KEY) || '[]');

      if (Array.isArray(arr)) {
        return arr.filter(function (r) {
          return r && r.code && r.pattern;
        }).map(function (r) {
          return {
            code: normCode(r.code),
            type: normalizeRuleType(r.type || '鍖呭惈'),
            pattern: normSn(r.pattern),
            note: toStr(r.note || '')
          };
        });
      }
    } catch (e) {}

    return [];
  }

  function saveRules(rules) {
    rules = rules || [];

    const clean = rules.filter(function (r) {
      return r && r.code && r.pattern;
    }).map(function (r) {
      return {
        code: normCode(r.code),
        type: normalizeRuleType(r.type),
        pattern: normSn(r.pattern),
        note: toStr(r.note || '')
      };
    });

    localStorage.setItem(RULE_KEY, JSON.stringify(clean));
    updateMiniButton();
  }

  // ===== 鎺ュ彛涓€寮哄瓧娈佃鍒?=====

  function loadStrongFields() {
    try {
      const arr = JSON.parse(localStorage.getItem(STRONG_FIELD_KEY) || '[]');

      if (Array.isArray(arr)) {
        return arr.filter(function (r) {
          return r && r.field && r.code;
        }).map(function (r) {
          return {
            field: normSearchText(r.field),
            code: normCode(r.code),
            note: toStr(r.note || '')
          };
        });
      }
    } catch (e) {}

    return [];
  }

  function saveStrongFields(rules) {
    rules = rules || [];

    const clean = rules.filter(function (r) {
      return r && r.field && r.code;
    }).map(function (r) {
      return {
        field: normSearchText(r.field),
        code: normCode(r.code),
        note: toStr(r.note || '')
      };
    });

    localStorage.setItem(STRONG_FIELD_KEY, JSON.stringify(clean));
    updateMiniButton();
  }

  function matchStrongFieldInText(text, rulesOverride) {
    text = normSearchText(text);

    if (!text) return null;

    const rules = rulesOverride || loadStrongFields();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];

      const field = normSearchText(r.field);
      const code = normCode(r.code);

      if (!field || !code) continue;

      // 寮哄瓧娈靛睘浜庢帴鍙ｄ竴锛屾墍浠ュ彈鎺ュ彛涓€鎺掗櫎缂栫爜闄愬埗
      if (isExcludedCodeForEms(code)) continue;

      if (text.indexOf(field) >= 0) {
        return {
          index: i + 1,
          field: field,
          code: code,
          note: r.note || ''
        };
      }
    }

    return null;
  }

  async function fetchEmsPageForStrongTest(sn, pageSize, pageNo, a, b) {
    const url = EMS_BASE + '/' + pageSize + '/' + pageNo + '/' + a + '/' + b;

    const body = {
      barCode: '',
      snStr: sn,
      itemName: '',
      componentType: '',
      createdFrom: '',
      createdTo: ''
    };

    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    return JSON.parse(await r.text());
  }

  async function queryEmsStrongFieldBySn(snRaw) {
    const sn = normSn(snRaw);

    if (!sn) {
      return {
        sn: '',
        hit: null,
        rows: 0,
        pages: 0,
        mode: '-'
      };
    }

    let rules = [];

    try {
      rules = readStrongFieldsFromTable().filter(function (r) {
        return r.field && r.code;
      });
    } catch (e) {
      rules = loadStrongFields();
    }

    let totalRows = 0;
    let totalPagesChecked = 0;

    for (let m = 0; m < EMS_MODES.length; m++) {
      const a = EMS_MODES[m][0];
      const b = EMS_MODES[m][1];

      let page = 1;
      let totalPages = 1;

      do {
        const j = await fetchEmsPageForStrongTest(sn, EMS_PAGE_SIZE, page, a, b);

        totalPagesChecked++;

        const vo = j && j.resultObjVO || {};
        const pageVO = vo.pageVO || {};
        const rows = vo.result || [];

        if (Array.isArray(rows)) {
          totalRows += rows.length;
        }

        const text = JSON.stringify(j);
        const hit = matchStrongFieldInText(text, rules);

        if (hit) {
          return {
            sn: sn,
            hit: hit,
            rows: totalRows,
            pages: totalPagesChecked,
            mode: a + '/' + b
          };
        }

        totalPages = Number(pageVO.totalPages || 1);
        page++;
      } while (page <= totalPages);
    }

    return {
      sn: sn,
      hit: null,
      rows: totalRows,
      pages: totalPagesChecked,
      mode: '-'
    };
  }

  // ===== 鎺ュ彛涓€鎺掗櫎缂栫爜 =====

  function loadExcludeCodes() {
    try {
      const arr = JSON.parse(localStorage.getItem(EXCLUDE_CODE_KEY) || '[]');

      if (Array.isArray(arr)) {
        return arr.map(function (x) {
          return codeExact(x);
        }).filter(Boolean);
      }
    } catch (e) {}

    return [];
  }

    function loadLeftCleanRules() {
  try {
    const arr = JSON.parse(localStorage.getItem(LEFT_CLEAN_KEY) || '[]');

    if (Array.isArray(arr)) {
      const out = [];

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

function saveLeftCleanRules(rules) {
  rules = rules || [];

  const clean = [];

  rules.forEach(function (x) {
    x = toStr(x)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/锛?g, ':')
      .replace(/锛?g, '-');

    if (x && clean.indexOf(x) < 0) {
      clean.push(x);
    }
  });

  localStorage.setItem(LEFT_CLEAN_KEY, JSON.stringify(clean));
  updateMiniButton();
}

function readLeftCleanRulesFromBox() {
  const el = document.getElementById('sn-left-clean-text');
  const text = el ? el.value : '';

  return text
    .split(/[\n\r]+/)
    .map(function (x) {
      return toStr(x);
    })
    .filter(Boolean);
}

  function saveExcludeCodes(codes) {
    codes = codes || [];

    const clean = codes.map(function (x) {
      return codeExact(x);
    }).filter(Boolean);

    const unique = [];

    clean.forEach(function (x) {
      if (unique.indexOf(x) < 0) unique.push(x);
    });

    localStorage.setItem(EXCLUDE_CODE_KEY, JSON.stringify(unique));
    updateMiniButton();
  }

  function isExcludedCodeForEms(code) {
    code = codeExact(code);

    if (!code) return false;

    const excludes = loadExcludeCodes();

    // 鍥哄畾瀹屽叏鍖归厤
    return excludes.indexOf(code) >= 0;
  }

  function shouldRemoveCodeValueFromEms(v) {
    const s = normCode(v);
    if (!s) return false;

    return isExcludedCodeForEms(s);
  }

  function sanitizeExcludedCodesDeepForEms(obj) {
    if (obj == null) return obj;

    if (typeof obj === 'string' || typeof obj === 'number') {
      const s = String(obj);

      if (shouldRemoveCodeValueFromEms(s)) {
        return '';
      }

      return obj;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = sanitizeExcludedCodesDeepForEms(obj[i]);
      }
      return obj;
    }

    if (typeof obj === 'object') {
      Object.keys(obj).forEach(function (k) {
        obj[k] = sanitizeExcludedCodesDeepForEms(obj[k]);
      });
      return obj;
    }

    return obj;
  }

  function injectStrongCodeToEmsResult(j, hit) {
    if (!j || !hit || !hit.code) return j;

    // 寮哄瓧娈靛睘浜庢帴鍙ｄ竴锛屾墍浠ュ彈鎺ュ彛涓€鎺掗櫎缂栫爜闄愬埗
    if (isExcludedCodeForEms(hit.code)) return j;

    if (!j.resultObjVO || typeof j.resultObjVO !== 'object') {
      j.resultObjVO = {};
    }

    if (!Array.isArray(j.resultObjVO.result)) {
      j.resultObjVO.result = [];
    }

    // 鎻掑叆鏈€鍓嶉潰锛屼繚璇佸師鏍￠獙鑴氭湰 pickFirstMatchedCode 浼樺厛鎹″埌瀹?    j.resultObjVO.result.unshift({
      __snRuleStrongField: true,
      __snRuleField: hit.field,
      __snRuleNote: hit.note || '',
      partNo: hit.code,
      itemCode: hit.code,
      materialCode: hit.code,
      code: hit.code
    });

    return j;
  }

  // ===== SN瑙勫垯鍏滃簳 =====

  function matchRule(snRaw) {
    const sn = normSn(snRaw);

    if (!sn) return null;

    const rules = loadRules();

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];

      const value = normSn(r.pattern);
      const type = getEffectiveType(r.type, value);

      if (!r.code || !value) continue;

      let ok = false;

      if (type === '寮€澶存槸') {
        ok = sn.startsWith(value);
      } else if (type === '鍖呭惈') {
        ok = sn.indexOf(value) >= 0;
      } else if (type === '绛変簬') {
        ok = sn === value;
      } else if (type === '閫氶厤') {
        ok = wildcardToRegExp(value).test(sn);
      } else {
        ok = sn.indexOf(value) >= 0;
      }

      if (ok) {
        return {
          sn: sn,
          code: r.code,
          type: type,
          pattern: r.pattern,
          note: r.note || '',
          index: i + 1
        };
      }
    }

    return null;
  }

  function getFetchUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    return '';
  }

  function getFetchBody(input, init) {
    if (init && init.body) return init.body;
    return '';
  }

  function isEmsFindUrl(url) {
    return /emsComponentDataInfo\/find\/page/i.test(String(url || ''));
  }

  function isOpenApiUrl(url) {
    return /openapi\/getSnAttr/i.test(String(url || ''));
  }

  function jsonResponseLike(res, j) {
    const headers = new Headers(res.headers);
    headers.set('content-type', 'application/json;charset=utf-8');

    return new Response(JSON.stringify(j), {
      status: res.status,
      statusText: res.statusText,
      headers: headers
    });
  }

  const rawFetch = window.fetch;

  window.fetch = async function (input, init) {
    const res = await rawFetch.apply(this, arguments);

    try {
      enabled = localStorage.getItem(ENABLE_KEY) !== '0';

      if (!enabled) return res;

      const url = getFetchUrl(input);

      // ===== 鎺ュ彛涓€ EMS find/page锛氬己瀛楁 + 鎺ュ彛涓€鎺掗櫎缂栫爜 =====
      if (isEmsFindUrl(url)) {
        const clone = res.clone();

        let text = '';

        try {
          text = await clone.text();
        } catch (e) {
          return res;
        }

        let j = null;

        try {
          j = JSON.parse(text);
        } catch (e2) {
          return res;
        }

        let changed = false;

        const hit = matchStrongFieldInText(text);

        // 鍏堟竻闄ゆ帴鍙ｄ竴鎺掗櫎缂栫爜锛岄伩鍏嶅師寮虹紪鐮佽鍛戒腑
        const before = JSON.stringify(j);
        j = sanitizeExcludedCodesDeepForEms(j);
        const after = JSON.stringify(j);

        if (before !== after) {
          changed = true;
          console.log('[SN瑙勫垯鍏滃簳] 鎺ュ彛涓€宸叉竻闄ゆ帓闄ょ紪鐮?);
        }

        // 鍐嶆彃鍏ュ己瀛楁缂栫爜
        if (hit && hit.code && !isExcludedCodeForEms(hit.code)) {
          injectStrongCodeToEmsResult(j, hit);
          changed = true;
          console.log(
            '[SN瑙勫垯鍏滃簳] 鎺ュ彛涓€寮哄瓧娈靛懡涓?',
            hit.field,
            '=>',
            hit.code
          );
        }

        if (changed) {
          return jsonResponseLike(res, j);
        }

        return res;
      }

      // ===== 鎺ュ彛浜?OpenAPI锛氫笉浣跨敤鎺掗櫎缂栫爜锛屽彧鍋歋N瑙勫垯鍏滃簳 =====
      if (isOpenApiUrl(url)) {
        const reqBody = getFetchBody(input, init);
        let sn = '';

        if (typeof reqBody === 'string') {
          try {
            const bodyJson = JSON.parse(reqBody);
            sn = bodyJson && bodyJson.sn || '';
          } catch (e) {}
        }

        if (!sn) {
          console.log('[SN瑙勫垯鍏滃簳] openapi 鏈彇鍒癝N锛岃烦杩?);
          return res;
        }

        const clone = res.clone();
        let j = null;

        try {
          j = await clone.json();
        } catch (e) {
          return res;
        }

        if (!j || typeof j !== 'object') {
          return res;
        }

        if (!j.resultObjVO || typeof j.resultObjVO !== 'object') {
          j.resultObjVO = {};
        }

        const vo = j.resultObjVO;
        const nowCode = normCode(vo.partNo || '');

        // 鎺ュ彛浜?OpenAPI 涓嶄娇鐢ㄦ帓闄ょ紪鐮?        // 鎺ュ彛鏈潵鏈夌紪鐮侊紝涓嶅厹搴?        if (nowCode) {
          console.log('[SN瑙勫垯鍏滃簳] 鎺ュ彛浜屽凡鏈夌紪鐮侊紝涓嶅厹搴?', sn, nowCode);
          return jsonResponseLike(res, j);
        }

        const hit = matchRule(sn);

        if (!hit || !hit.code) {
          console.log('[SN瑙勫垯鍏滃簳] SN瑙勫垯鏈懡涓?', sn);
          return jsonResponseLike(res, j);
        }

        j.resultObjVO = Object.assign({}, vo, {
          partNo: hit.code,
          __ruleFallback: true,
          __ruleType: hit.type,
          __rulePattern: hit.pattern
        });

        console.log(
          '[SN瑙勫垯鍏滃簳] SN瑙勫垯鍛戒腑:',
          sn,
          '=>',
          hit.code,
          '鏂瑰紡:',
          hit.type,
          '瑙勫垯:',
          hit.pattern
        );

        return jsonResponseLike(res, j);
      }

      return res;

    } catch (e) {
      console.warn('[SN瑙勫垯鍏滃簳] 寮傚父:', e);
      return res;
    }
  };

  // ===== 鍓嶅彴UI =====

  function updateMiniButton() {
    const count = document.getElementById('sn-rule-count');

    if (count) {
      count.textContent = String(loadRules().length);
    }

    const strongCount = document.getElementById('sn-strong-count');

    if (strongCount) {
      strongCount.textContent = String(loadStrongFields().length);
    }

    const excludeCount = document.getElementById('sn-exclude-count');

    if (excludeCount) {
      excludeCount.textContent = String(loadExcludeCodes().length);
    }
      const leftCleanCount = document.getElementById('sn-left-clean-count');

      if (leftCleanCount) {
          leftCleanCount.textContent = String(loadLeftCleanRules().length);
      }

    const state = document.getElementById('sn-rule-state');

    if (state) {
      enabled = localStorage.getItem(ENABLE_KEY) !== '0';
      state.textContent = enabled ? '寮€' : '鍏?;
      state.style.color = enabled ? '#389e0d' : '#d4380d';
    }
  }

  function createMiniButton() {
    if (document.getElementById('sn-rule-mini')) return;

    const btn = document.createElement('div');
    btn.id = 'sn-rule-mini';

    btn.style.cssText = `
      position: fixed;
      right: 12px;
      bottom: 58px;
      z-index: 2147483646;
      background: #fff;
      color: #222;
      border: 1px solid #bbb;
      border-radius: 6px;
      padding: 6px 9px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,.18);
      font-family: Arial, "Microsoft YaHei", sans-serif;
      user-select: none;
    `;

      btn.innerHTML = `
  SN瑙勫垯:<b id="sn-rule-count">${loadRules().length}</b>
  寮哄瓧娈?<b id="sn-strong-count">${loadStrongFields().length}</b>
  鎺ュ彛涓€鎺掗櫎:<b id="sn-exclude-count">${loadExcludeCodes().length}</b>
  宸︽竻娲?<b id="sn-left-clean-count">${loadLeftCleanRules().length}</b>
      <span style="margin-left:4px;">鐘舵€?</span>
      <b id="sn-rule-state" style="color:${enabled ? '#389e0d' : '#d4380d'};">
        ${enabled ? '寮€' : '鍏?}
      </b>
    `;

    btn.addEventListener('click', showRuleModal);

    document.body.appendChild(btn);
  }

  function createEmptyRule() {
    return {
      code: '',
      type: '鍖呭惈',
      pattern: '',
      note: ''
    };
  }

  function createEmptyStrongField() {
    return {
      field: '',
      code: '',
      note: ''
    };
  }

  function readRulesFromTable() {
    const rows = Array.from(document.querySelectorAll('#sn-rule-tbody tr'));
    const rules = [];

    rows.forEach(function (tr) {
      const codeEl = tr.querySelector('.sn-rule-code');
      const typeEl = tr.querySelector('.sn-rule-type');
      const patternEl = tr.querySelector('.sn-rule-pattern');
      const noteEl = tr.querySelector('.sn-rule-note');

      const code = normCode(codeEl ? codeEl.value : '');

      let type = '鍖呭惈';

      if (typeEl) {
        if (typeEl.selectedIndex >= 0 && typeEl.options[typeEl.selectedIndex]) {
          type = toStr(typeEl.options[typeEl.selectedIndex].value);
        } else {
          type = toStr(typeEl.value || '鍖呭惈');
        }
      }

      type = normalizeRuleType(type);

      const pattern = normSn(patternEl ? patternEl.value : '');
      const note = toStr(noteEl ? noteEl.value : '');

      if (!code && !pattern) return;

      rules.push({
        code: code,
        type: type,
        pattern: pattern,
        note: note
      });
    });

    return rules;
  }

  function readStrongFieldsFromTable() {
    const rows = Array.from(document.querySelectorAll('#sn-strong-tbody tr'));
    const rules = [];

    rows.forEach(function (tr) {
      const fieldEl = tr.querySelector('.sn-strong-field');
      const codeEl = tr.querySelector('.sn-strong-code');
      const noteEl = tr.querySelector('.sn-strong-note');

      const field = normSearchText(fieldEl ? fieldEl.value : '');
      const code = normCode(codeEl ? codeEl.value : '');
      const note = toStr(noteEl ? noteEl.value : '');

      if (!field && !code) return;

      rules.push({
        field: field,
        code: code,
        note: note
      });
    });

    return rules;
  }

  function readExcludeCodesFromBox() {
    const el = document.getElementById('sn-exclude-text');
    const text = el ? el.value : '';

    return text
      .split(/[\s,锛?锛沑n\r]+/)
      .map(function (x) {
        return codeExact(x);
      })
      .filter(Boolean);
  }

  function saveFromTable() {
    const rules = readRulesFromTable().filter(function (r) {
      return r.code && r.pattern;
    });

    const strongRules = readStrongFieldsFromTable().filter(function (r) {
      return r.field && r.code;
    });

    const excludeCodes = readExcludeCodesFromBox();
    const leftCleanRules = readLeftCleanRulesFromBox();

    saveRules(rules);
    saveStrongFields(strongRules);
    saveExcludeCodes(excludeCodes);
    saveLeftCleanRules(leftCleanRules);

    updateMiniButton();

    setRuleMsg(
  '宸蹭繚瀛橈細SN瑙勫垯 ' + rules.length +
  ' 鏉★紝寮哄瓧娈?' + strongRules.length +
  ' 鏉★紝鎺ュ彛涓€鎺掗櫎缂栫爜 ' + excludeCodes.length +
  ' 涓紝宸︿晶娓呮礂瑙勫垯 ' + leftCleanRules.length + ' 鏉?
);


    console.log('[SN瑙勫垯鍏滃簳] 宸蹭繚瀛楽N瑙勫垯锛?, rules);
    console.log('[SN瑙勫垯鍏滃簳] 宸蹭繚瀛樺己瀛楁锛?, strongRules);
    console.log('[SN瑙勫垯鍏滃簳] 宸蹭繚瀛樻帴鍙ｄ竴鎺掗櫎缂栫爜锛?, excludeCodes);
  }

  function setRuleMsg(msg, color) {
    const el = document.getElementById('sn-rule-msg');
    if (!el) return;

    el.textContent = msg || '';
    el.style.color = color || '#389e0d';
  }

  function ruleRowHtml(r, i) {
    r = r || createEmptyRule();

    const currType = normalizeRuleType(r.type || '鍖呭惈');

    const types = ['鍖呭惈', '寮€澶存槸', '绛変簬', '閫氶厤'];

    return `
      <tr>
        <td style="border:1px solid #eee;padding:4px;text-align:center;width:40px;">${i + 1}</td>

        <td style="border:1px solid #eee;padding:4px;width:120px;">
          <input class="sn-rule-code" value="${escHtml(r.code || '')}" placeholder="濡?34100239" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;width:90px;">
          <select class="sn-rule-type" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
            ${types.map(function (t) {
              return `<option value="@@@MATH_INLINE_0_END@@@{currType === t ? 'selected="selected"' : ''}>${t}</option>`;
            }).join('')}
          </select>
        </td>

        <td style="border:1px solid #eee;padding:4px;width:150px;">
          <input class="sn-rule-pattern" value="${escHtml(r.pattern || '')}" placeholder="濡?K179 / K???????" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;">
          <input class="sn-rule-note" value="${escHtml(r.note || '')}" placeholder="澶囨敞锛屽彲涓嶅～" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;text-align:center;width:60px;">
          <button class="sn-rule-del" style="font-size:12px;height:24px;color:#d4380d;">鍒犻櫎</button>
        </td>
      </tr>
    `;
  }

  function strongRowHtml(r, i) {
    r = r || createEmptyStrongField();

    return `
      <tr>
        <td style="border:1px solid #eee;padding:4px;text-align:center;width:40px;">${i + 1}</td>

        <td style="border:1px solid #eee;padding:4px;width:210px;">
          <input class="sn-strong-field" value="${escHtml(r.field || '')}" placeholder="濡?OC8072V1H74S" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;width:120px;">
          <input class="sn-strong-code" value="${escHtml(r.code || '')}" placeholder="濡?34090213" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;">
          <input class="sn-strong-note" value="${escHtml(r.note || '')}" placeholder="澶囨敞锛屽彲涓嶅～" style="width:100%;height:24px;box-sizing:border-box;font-size:12px;">
        </td>

        <td style="border:1px solid #eee;padding:4px;text-align:center;width:60px;">
          <button class="sn-strong-del" style="font-size:12px;height:24px;color:#d4380d;">鍒犻櫎</button>
        </td>
      </tr>
    `;
  }

  function bindDeleteButtons() {
    const ruleBody = document.getElementById('sn-rule-tbody');
    if (ruleBody) {
      ruleBody.querySelectorAll('.sn-rule-del').forEach(function (btn) {
        btn.onclick = function () {
          const tr = btn.closest('tr');
          if (tr) tr.remove();
        };
      });
    }

    const strongBody = document.getElementById('sn-strong-tbody');
    if (strongBody) {
      strongBody.querySelectorAll('.sn-strong-del').forEach(function (btn) {
        btn.onclick = function () {
          const tr = btn.closest('tr');
          if (tr) tr.remove();
        };
      });
    }
  }

  function renderRuleTable() {
    const leftCleanBox = document.getElementById('sn-left-clean-text');

if (leftCleanBox) {
  leftCleanBox.value = loadLeftCleanRules().join('\n');
}

    const tbody = document.getElementById('sn-rule-tbody');
    if (tbody) {
      const rules = loadRules();

      if (rules.length) {
        tbody.innerHTML = rules.map(function (r, i) {
          return ruleRowHtml(r, i);
        }).join('');
      } else {
        tbody.innerHTML = ruleRowHtml(createEmptyRule(), 0);
      }
    }

    const strongTbody = document.getElementById('sn-strong-tbody');
    if (strongTbody) {
      const strongRules = loadStrongFields();

      if (strongRules.length) {
        strongTbody.innerHTML = strongRules.map(function (r, i) {
          return strongRowHtml(r, i);
        }).join('');
      } else {
        strongTbody.innerHTML = strongRowHtml(createEmptyStrongField(), 0);
      }
    }

    const excludeBox = document.getElementById('sn-exclude-text');
    if (excludeBox) {
      excludeBox.value = loadExcludeCodes().join('\n');
    }

    bindDeleteButtons();
    updateMiniButton();
  }

  function addRuleRow(rule) {
    const tbody = document.getElementById('sn-rule-tbody');
    if (!tbody) return;

    const idx = tbody.querySelectorAll('tr').length;
    const temp = document.createElement('tbody');

    temp.innerHTML = ruleRowHtml(rule || createEmptyRule(), idx);

    const tr = temp.querySelector('tr');
    tbody.appendChild(tr);

    bindDeleteButtons();
  }

  function addStrongRow(rule) {
    const tbody = document.getElementById('sn-strong-tbody');
    if (!tbody) return;

    const idx = tbody.querySelectorAll('tr').length;
    const temp = document.createElement('tbody');

    temp.innerHTML = strongRowHtml(rule || createEmptyStrongField(), idx);

    const tr = temp.querySelector('tr');
    tbody.appendChild(tr);

    bindDeleteButtons();
  }

  function testRuleInModal() {
    const input = document.getElementById('sn-rule-test-sn');
    const sn = normSn(input ? input.value : '');

    if (!sn) {
      setRuleMsg('璇疯緭鍏ユ祴璇昐N', '#d4380d');
      return;
    }

    const tempRules = readRulesFromTable().filter(function (r) {
      return r.code && r.pattern;
    });

    let hit = null;

    for (let i = 0; i < tempRules.length; i++) {
      const r = tempRules[i];
      const value = normSn(r.pattern);
      const type = getEffectiveType(r.type, value);

      let ok = false;

      if (type === '鍖呭惈') {
        ok = sn.indexOf(value) >= 0;
      } else if (type === '寮€澶存槸') {
        ok = sn.startsWith(value);
      } else if (type === '绛変簬') {
        ok = sn === value;
      } else if (type === '閫氶厤') {
        ok = wildcardToRegExp(value).test(sn);
      }

      if (ok) {
        hit = {
          code: r.code,
          type: type,
          pattern: r.pattern,
          index: i + 1
        };
        break;
      }
    }

    if (hit) {
      setRuleMsg(
        'SN瑙勫垯娴嬭瘯鍛戒腑锛? + sn + ' => ' + hit.code + '锛岀 ' + hit.index + ' 琛岋紝' + hit.type + ' ' + hit.pattern,
        '#389e0d'
      );
    } else {
      setRuleMsg('SN瑙勫垯娴嬭瘯鏈懡涓細' + sn, '#d4380d');
    }
  }

  async function testStrongFieldInModal() {
    const input = document.getElementById('sn-strong-test-text');
    const sn = normSn(input ? input.value : '');

    if (!sn) {
      setRuleMsg('璇疯緭鍏ヨ鏌ヨ鐨勫簭鍒楀彿SN', '#d4380d');
      return;
    }

    setRuleMsg('鎺ュ彛涓€鏌ヨ涓細' + sn + ' ...', '#d48806');

    try {
      const ret = await queryEmsStrongFieldBySn(sn);

      if (ret.hit) {
        setRuleMsg(
          '寮哄瓧娈靛懡涓細SN ' + sn +
          '锛屽瓧娈?' + ret.hit.field +
          ' => 缂栫爜 ' + ret.hit.code +
          '锛屾ā寮?' + ret.mode +
          '锛宺ows ' + ret.rows,
          '#389e0d'
        );
      } else {
        setRuleMsg(
          '寮哄瓧娈垫湭鍛戒腑锛歋N ' + sn +
          '锛屽凡鏌ユ帴鍙ｄ竴 pages ' + ret.pages +
          '锛宺ows ' + ret.rows,
          '#d4380d'
        );
      }
    } catch (e) {
      setRuleMsg('鎺ュ彛涓€鏌ヨ寮傚父锛? + e, '#d4380d');
      console.warn('[SN瑙勫垯鍏滃簳] 寮哄瓧娈垫祴璇曞紓甯?, e);
    }
  }

function showRuleModal() {
  let modal = document.getElementById('sn-rule-modal');

  if (modal) {
    modal.style.display = 'block';
    renderRuleTable();
    return;
  }

  modal = document.createElement('div');
  modal.id = 'sn-rule-modal';

  modal.style.cssText = `
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 920px;
    max-width: calc(100vw - 40px);
    height: 720px;
    max-height: calc(100vh - 40px);
    background: #fff;
    color: #222;
    border: 1px solid #bbb;
    border-radius: 8px;
    z-index: 2147483647;
    box-shadow: 0 8px 30px rgba(0,0,0,.28);
    font-size: 12px;
    font-family: Arial, "Microsoft YaHei", sans-serif;
    overflow: hidden;
  `;

  modal.innerHTML = `
    <div style="
      height:38px;
      line-height:38px;
      padding:0 12px;
      background:#f5f5f5;
      border-bottom:1px solid #ddd;
      display:flex;
      align-items:center;
      justify-content:space-between;
    ">
      <b>SN缂栫爜瑙勫垯鍏滃簳璁剧疆</b>
      <button id="sn-rule-close" style="font-size:12px;">鍏抽棴</button>
    </div>

    <div style="
      padding:8px 12px;
      border-bottom:1px solid #eee;
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    ">
      <label>
        <input id="sn-rule-enabled" type="checkbox" ${enabled ? 'checked' : ''}>
        鍚敤瑙勫垯鍏滃簳
      </label>

      <button id="sn-rule-save" style="font-size:12px;height:24px;color:#389e0d;">淇濆瓨鍏ㄩ儴</button>
      <button id="sn-rule-clear" style="font-size:12px;height:24px;color:#d4380d;">娓呯┖鍏ㄩ儴</button>

      <span id="sn-rule-msg" style="margin-left:6px;color:#389e0d;"></span>
    </div>

    <div style="
      height: calc(100% - 94px);
      overflow:auto;
      padding:10px 12px;
      box-sizing:border-box;
    ">

      <div style="margin-bottom:14px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <div style="background:#fafafa;padding:7px 10px;font-weight:bold;">
          涓€銆丼N瑙勫垯鍏滃簳锛氭帴鍙ｄ竴/鎺ュ彛浜岄兘鏌ヤ笉鍒版椂锛岀敤SN瑙勫垯鍒ゆ柇缂栫爜
          <button id="sn-rule-add" style="float:right;font-size:12px;height:22px;">鏂板涓€琛?/button>
        </div>

        <div style="padding:8px;">
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>娴嬭瘯SN锛?/span>
            <input id="sn-rule-test-sn" placeholder="濡?K0154738" style="width:180px;height:24px;box-sizing:border-box;font-size:12px;">
            <button id="sn-rule-test-btn" style="font-size:12px;height:24px;">娴嬭瘯SN瑙勫垯</button>
            <span style="color:#666;">渚嬶細K??????? 琛ㄧずK寮€澶存€诲叡8浣嶏紱K179* 琛ㄧずK179寮€澶村悗闈换鎰忛暱搴?/span>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#fafafa;">
                <th style="border:1px solid #eee;padding:5px;width:40px;">搴忓彿</th>
                <th style="border:1px solid #eee;padding:5px;width:120px;">缂栫爜</th>
                <th style="border:1px solid #eee;padding:5px;width:90px;">鍖归厤鏂瑰紡</th>
                <th style="border:1px solid #eee;padding:5px;width:150px;">SN瑙勫垯</th>
                <th style="border:1px solid #eee;padding:5px;">澶囨敞</th>
                <th style="border:1px solid #eee;padding:5px;width:60px;">鎿嶄綔</th>
              </tr>
            </thead>
            <tbody id="sn-rule-tbody"></tbody>
          </table>

          <div style="margin-top:6px;color:#777;line-height:18px;">
            鍖呭惈锛歋N閲屽寘鍚鍒欏唴瀹癸紱寮€澶存槸锛歋N浠ュ墠缂€寮€澶达紱绛変簬锛歋N瀹屽叏涓€鏍凤紱
            閫氶厤锛? 琛ㄧず浠绘剰1浣嶏紝鏈熬鍗曚釜 * 琛ㄧず鍚庨潰浠绘剰闀垮害銆係N瑙勫垯閲屾湁 * 鎴?? 鏃讹紝浼氳嚜鍔ㄦ寜閫氶厤澶勭悊銆?            <br>娉ㄦ剰锛歋N瑙勫垯鍏滃簳涓嶅彈鎺ュ彛涓€鎺掗櫎缂栫爜褰卞搷銆?          </div>
        </div>
      </div>

      <div style="margin-bottom:14px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <div style="background:#fafafa;padding:7px 10px;font-weight:bold;">
          浜屻€佹帴鍙ｄ竴寮哄瓧娈碉細杈撳叆SN鏌ヨ鎺ュ彛涓€锛岃繑鍥炲唴瀹归噷鍖呭惈鍥哄畾瀛楃锛屽氨寮哄埗绛変簬鎸囧畾缂栫爜
          <button id="sn-strong-add" style="float:right;font-size:12px;height:22px;">鏂板涓€琛?/button>
        </div>

        <div style="padding:8px;">
          <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>娴嬭瘯搴忓垪鍙稴N锛?/span>
            <input id="sn-strong-test-text" placeholder="杈撳叆SN鍚庢煡璇㈡帴鍙ｄ竴" style="width:220px;height:24px;box-sizing:border-box;font-size:12px;">
            <button id="sn-strong-test-btn" style="font-size:12px;height:24px;">鏌ヨ鎺ュ彛涓€骞舵祴璇?/button>
            <span style="color:#666;">渚嬶細鎺ュ彛涓€杩斿洖鍐呭鍚?OC8072V1H74S锛屽垯缂栫爜 34090213</span>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#fafafa;">
                <th style="border:1px solid #eee;padding:5px;width:40px;">搴忓彿</th>
                <th style="border:1px solid #eee;padding:5px;width:210px;">鍥哄畾瀛楃</th>
                <th style="border:1px solid #eee;padding:5px;width:120px;">绛変簬缂栫爜</th>
                <th style="border:1px solid #eee;padding:5px;">澶囨敞</th>
                <th style="border:1px solid #eee;padding:5px;width:60px;">鎿嶄綔</th>
              </tr>
            </thead>
            <tbody id="sn-strong-tbody"></tbody>
          </table>

          <div style="margin-top:6px;color:#777;line-height:18px;">
            璇存槑锛氭帴鍙ｄ竴杩斿洖鏁版嵁閲屽彧瑕佸嚭鐜扳€滃浐瀹氬瓧绗︹€濓紝灏辨妸鈥滅瓑浜庣紪鐮佲€濇彃鍏ユ帴鍙ｄ竴缁撴灉鏈€鍓嶉潰锛屼紭鍏堢粰鏍￠獙鑴氭湰鍛戒腑銆?            <br>娉ㄦ剰锛氬己瀛楁灞炰簬鎺ュ彛涓€锛屾墍浠ュ彈鎺ュ彛涓€鎺掗櫎缂栫爜褰卞搷銆?          </div>
        </div>
      </div>

      <div style="margin-bottom:14px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <div style="background:#fafafa;padding:7px 10px;font-weight:bold;">
          涓夈€佹帴鍙ｄ竴鎺掗櫎缂栫爜锛氳繖浜涚紪鐮佸湪鎺ュ彛涓€閲屼笉瑕佸懡涓?        </div>

        <div style="padding:8px;">
          <textarea id="sn-exclude-text" placeholder="涓€琛屼竴涓紪鐮侊紝渚嬪锛?34090456
34090000" style="
            width:100%;
            height:80px;
            box-sizing:border-box;
            font-size:12px;
            line-height:18px;
            resize:vertical;
          "></textarea>

          <div style="margin-top:6px;color:#777;line-height:18px;">
            璇存槑锛氭帓闄ょ紪鐮佸彧浣滅敤浜庢帴鍙ｄ竴锛屼笖蹇呴』瀹屽叏鐩哥瓑銆?            渚嬪濉啓 34090456锛屽彧鎺掗櫎鎺ュ彛涓€閲岀殑 34090456锛屼笉鎺掗櫎 34090456-001銆?            鎺ュ彛浜屽拰SN瑙勫垯鍏滃簳涓嶅彈杩欓噷褰卞搷銆?          </div>
        </div>
      </div>

      <div style="margin-bottom:14px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">
        <div style="background:#fafafa;padding:7px 10px;font-weight:bold;">
          鍥涖€佸乏渚ф潯鐮佹竻娲楋細鍙竻娲楅〉闈㈠乏渚ф潯鐮侊紝涓嶅奖鍝嶆帴鍙ｆ煡璇㈢紪鐮?        </div>

        <div style="padding:8px;">
          <textarea id="sn-left-clean-text" placeholder="涓€琛屼竴涓竻娲楄鍒欙紝渚嬪锛?SN
:
-" style="
            width:100%;
            height:90px;
            box-sizing:border-box;
            font-size:12px;
            line-height:18px;
            resize:vertical;
          "></textarea>

          <div style="margin-top:6px;color:#777;line-height:18px;">
            璇存槑锛?            <br>1銆佸～鍐?SN锛氬乏渚?SN03035FDT 浼氭竻娲楁垚 03035FDT銆?            <br>2銆佸～鍐?: 锛氬乏渚?U1:213409015510S4104636 浼氭竻娲楁垚 213409015510S4104636銆?            <br>3銆佸～鍐?- 锛氬乏渚?ABC-34090213 浼氭竻娲楁垚 34090213銆?            <br>4銆佽繖浜涜鍒欏彧浣滅敤浜庡乏渚ф潯鐮侊紝涓嶄細娓呮礂鎺ュ彛杩斿洖鐨勭紪鐮併€?          </div>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('sn-rule-close').onclick = function () {
    modal.style.display = 'none';
  };

  document.getElementById('sn-rule-enabled').onchange = function () {
    enabled = this.checked;
    localStorage.setItem(ENABLE_KEY, enabled ? '1' : '0');
    updateMiniButton();
    setRuleMsg(enabled ? '瑙勫垯鍏滃簳宸插惎鐢? : '瑙勫垯鍏滃簳宸插叧闂?, enabled ? '#389e0d' : '#d4380d');
  };

  document.getElementById('sn-rule-save').onclick = function () {
    saveFromTable();
  };

  document.getElementById('sn-rule-clear').onclick = function () {
    if (!confirm('纭畾娓呯┖鎵€鏈塖N瑙勫垯銆佸己瀛楁銆佹帴鍙ｄ竴鎺掗櫎缂栫爜鍜屽乏渚ф竻娲楄鍒欙紵')) return;

    saveRules([]);
    saveStrongFields([]);
    saveExcludeCodes([]);
    saveLeftCleanRules([]);

    renderRuleTable();
    setRuleMsg('宸叉竻绌哄叏閮ㄨ鍒?, '#d4380d');
  };

  document.getElementById('sn-rule-add').onclick = function () {
    addRuleRow();
  };

  document.getElementById('sn-strong-add').onclick = function () {
    addStrongRow();
  };

  document.getElementById('sn-rule-test-btn').onclick = function () {
    testRuleInModal();
  };

  document.getElementById('sn-strong-test-btn').onclick = function () {
    testStrongFieldInModal();
  };

  renderRuleTable();
}


  function bootUI() {
    if (!document.body) {
      setTimeout(bootUI, 300);
      return;
    }

    createMiniButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUI);
  } else {
    bootUI();
  }

  window.SN_RULE_UI = {
    show: showRuleModal,
    rules: loadRules,
    strongFields: loadStrongFields,
    excludes: loadExcludeCodes,
    test: matchRule,
    testStrong: matchStrongFieldInText,
    queryStrongBySn: queryEmsStrongFieldBySn,
    enable: function () {
      enabled = true;
      localStorage.setItem(ENABLE_KEY, '1');
      updateMiniButton();
    },
    disable: function () {
      enabled = false;
      localStorage.setItem(ENABLE_KEY, '0');
      updateMiniButton();
    },
    clear: function () {
      saveRules([]);
      saveStrongFields([]);
      saveExcludeCodes([]);
      saveLeftCleanRules([]);
      updateMiniButton();
    }
  };

  console.log('[SN瑙勫垯鍏滃簳鍓嶅彴鐗圿 宸插畨瑁?v1.6');

})();
