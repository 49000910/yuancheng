// ==UserScript==
// @name         鑷缓椤甸潰-閲囬泦瀵煎嚭-绛旀瀵煎叆-鎵归噺鐐归€?璺宠繃瀛樼枒鐗?// @namespace    http://tampermonkey.net/
// @version      1.1.9
// @description  閲囬泦瀵煎嚭锛屾敮鎸乀XT绛旀瀵煎叆銆侀珮浜綋鍓嶉绛旀銆佹壒閲忕偣閫夛紱瀛樼枒/鐣欑┖棰樺彧璺宠繃锛屼笉鐐瑰嚮瀛樼枒
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  console.log('[AE] userscript loaded:', location.href, document.readyState);

  // ===== 閫夋嫨鍣ㄩ厤缃?=====
  var CFG = {
    questionRoot: '.right-subjects-inner .right-main',
    questionNo: '.subtitle .subtitle_index',
    stem: '.subtitle .main-title .markdown-body p',

    // 鍏煎 subect-label 鍜?subject-label
    option: '.subect-label .option-list-item .option-content .markdown-body p, .subject-label .option-list-item .option-content .markdown-body p',

    // 閫夐」澶栧眰锛岀敤浜庨珮浜?鐐归€?    optionItem: '.subect-label .option-list-item, .subject-label .option-list-item',

    answer: '',

    // 涓嬩竴棰橈細鎺掗櫎涓婁竴棰?prv锛屾帓闄ゅ瓨鐤?quest
    nextBtn: '.subject-btns .subject-btn:not(.prv):not(.quest)',

    stepDelay: 900,
    maxSteps: 200
  };

  var state = {
    running: false,
    stopRequested: false,
    rows: [],
    seen: {},
    answerBank: {},
    skipBank: {}
  };

  var ANSWER_IMPORT = {
    autoSelect: false
  };

  function q(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  function qa(sel, root) {
    try {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  function txt(el) {
    return ((el && (el.innerText || el.textContent)) || '').trim();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function parseNo(noRaw) {
    var m = String(noRaw || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function normText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function stripTailNoise(s) {
    return String(s || '')
      .replace(/\s*(涓婁竴棰榺涓嬩竴棰榺瀛樼枒|鍙栨秷瀛樼枒|鏀惰棌|鏍囪|浜ゅ嵎|鎻愪氦|鏌ョ湅瑙ｆ瀽)\s*$/g, '')
      .trim();
  }

  function cleanOptionText(s) {
    return stripTailNoise(String(s || ''))
      .replace(/^([A-F])[\.銆乗s]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactText(s) {
    return cleanOptionText(s)
      .replace(/[銆傦紟.銆乗s]/g, '')
      .toLowerCase();
  }

  function toast(msg, err) {
    var el = document.getElementById('__ae_toast__');

    if (!el) {
      el = document.createElement('div');
      el.id = '__ae_toast__';
      el.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
        'background:#222;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.25);';
      document.body.appendChild(el);
    }

    el.style.background = err ? '#b00020' : '#222';
    el.textContent = msg;

    clearTimeout(el._t);
    el._t = setTimeout(function () {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 2200);
  }

  function setStatus(msg) {
    var el = q('#__ae_status__');
    if (el) {
      el.textContent = msg;
    }
  }

  function buildKey(no, stem) {
    if (no !== undefined && no !== null && no !== '') {
      return 'NO_' + String(no).trim();
    }

    return 'STEM_' + normText(stem).slice(0, 120);
  }

  // ===== 鏂囨湰鍏滃簳瑙ｆ瀽 =====
  function parseMergedBlockText(s) {
    s = normText(s);

    var stem = s;
    var m1 = s.match(/^(.*?)(A[\.銆乗s]|B[\.銆乗s]|姝ｇ‘|閿欒)/);

    if (m1) {
      stem = m1[1].trim();
    }

    stem = stem.replace(/^\d+[銆乗.\s]*/, '').trim();

    var options = [];
    var abcd = s.match(/([A-F][\.銆乗s].*)$/);

    if (abcd) {
      var parts = abcd[1].split(/(?=[A-F][\.銆乗s])/).filter(function (x) {
        return !!x;
      });

      options = parts.map(function (p, i) {
        var mm = p.match(/^([A-F])[\.銆乗s]*(.*)$/);

        return {
          key: mm ? mm[1] : String.fromCharCode(65 + i),
          text: cleanOptionText(mm ? mm[2] : p)
        };
      });
    } else {
      var ci = s.indexOf('姝ｇ‘');
      var wi = s.indexOf('閿欒');

      if (ci >= 0 && wi >= 0) {
        if (ci < wi) {
          options.push({ key: 'A', text: '姝ｇ‘' });
          options.push({ key: 'B', text: '閿欒' });
        } else {
          options.push({ key: 'A', text: '閿欒' });
          options.push({ key: 'B', text: '姝ｇ‘' });
        }
      }
    }

    return {
      stem: stem,
      options: options
    };
  }

  // ===== 閫夋嫨鍣ㄦ彁鍙?=====
  function getCurrentBySelector() {
    var root = q(CFG.questionRoot);

    if (!root) {
      return null;
    }

    var noRaw = CFG.questionNo ? txt(q(CFG.questionNo, root)) : '';
    var no = parseNo(noRaw);

    var stem = txt(q(CFG.stem, root));

    var opts = qa(CFG.option, root).map(function (el, i) {
      return {
        key: String.fromCharCode(65 + i),
        text: cleanOptionText(txt(el))
      };
    });

    var answer = CFG.answer ? txt(q(CFG.answer, root)) : '';

    if (!stem || !opts.length) {
      return null;
    }

    return {
      key: buildKey(no, stem),
      no: no,
      stem: stem,
      options: opts,
      answer: answer,
      source: 'selector'
    };
  }

  // ===== 鍏滃簳鏂囨湰鎻愬彇 =====
  function getCurrentByFallback() {
    var root = q(CFG.questionRoot);

    if (!root) {
      return null;
    }

    var noRaw = CFG.questionNo ? txt(q(CFG.questionNo, root)) : '';
    var no = parseNo(noRaw);

    var answer = CFG.answer ? txt(q(CFG.answer, root)) : '';

    var parsed = parseMergedBlockText(txt(root));

    if (!parsed.stem || !parsed.options.length) {
      return null;
    }

    return {
      key: buildKey(no, parsed.stem),
      no: no,
      stem: parsed.stem,
      options: parsed.options,
      answer: answer,
      source: 'fallback'
    };
  }

  function scoreCandidate(cur) {
    if (!cur) {
      return -9999;
    }

    var score = 0;
    var stem = normText(cur.stem);
    var opts = cur.options || [];

    if (stem) {
      score += 30;
    } else {
      score -= 100;
    }

    if (opts.length) {
      score += opts.length * 10;
    } else {
      score -= 100;
    }

    if (opts.length === 2) {
      score += 15;
    }

    if (opts.length === 4) {
      score += 18;
    }

    if (cur.source === 'selector') {
      score += 4;
    }

    return score;
  }

  function getCurrentQuestion() {
    var a = getCurrentBySelector();
    var b = getCurrentByFallback();

    if (a) {
      a._aeScore = scoreCandidate(a);
    }

    if (b) {
      b._aeScore = scoreCandidate(b);
    }

    if (a && b) {
      if (a._aeScore >= b._aeScore - 6) {
        return a;
      }

      return b;
    }

    return a || b || null;
  }

  function getOptionItems(root) {
    var items = [];

    if (CFG.optionItem) {
      items = qa(CFG.optionItem, root);
    }

    if (!items.length) {
      items = qa(CFG.option, root).map(function (el) {
        return el.closest('.option-list-item') || el;
      });
    }

    return items;
  }

  function isVisible(el) {
    if (!el) {
      return false;
    }

    var rects = el.getClientRects && el.getClientRects();
    return !!(rects && rects.length);
  }

  function getClickableOptionElement(el) {
    if (!el) {
      return null;
    }

    return el.closest(
      'label,' +
      '.option-list-item,' +
      '.option-item,' +
      '.answer-item,' +
      '.choice-item,' +
      '.van-radio,' +
      '.van-checkbox,' +
      '.el-radio,' +
      '.el-checkbox,' +
      '[role="radio"],' +
      '[role="checkbox"],' +
      'li,' +
      'button'
    ) || el;
  }

  // 鍙壂鎻忛€夐」鍖哄煙锛屼笉鎵弿棰樺共 p/span/div锛岄伩鍏嶉骞插惈鍏抽敭璇嶉€夐敊
  function findOptionElementByText(root, opt, idx, items, cur) {
    var target = compactText(opt && opt.text);
    var optionCount = ((cur && cur.options) || []).length;

    items = (items || []).filter(function (el) {
      return el && isVisible(el);
    });

    if (items[idx] && optionCount && items.length === optionCount) {
      return items[idx];
    }

    if (items[idx]) {
      var candidate = items[idx];
      var ct = compactText(txt(candidate));

      if (
        !target ||
        !ct ||
        ct === target ||
        ct.indexOf(target) >= 0 ||
        target.indexOf(ct) >= 0
      ) {
        return candidate;
      }
    }

    if (!target) {
      return null;
    }

    var candidates = [];

    if (items.length) {
      candidates = items.slice();
    }

    if (!candidates.length && CFG.optionItem) {
      candidates = qa(CFG.optionItem, root).filter(function (el) {
        return el && isVisible(el);
      });
    }

    if (!candidates.length && CFG.option) {
      qa(CFG.option, root).forEach(function (el) {
        if (!isVisible(el)) {
          return;
        }

        var item = el.closest(
          '.option-list-item,' +
          '.option-item,' +
          '.answer-item,' +
          '.choice-item,' +
          'label,' +
          'li,' +
          '[role="radio"],' +
          '[role="checkbox"],' +
          '.van-radio,' +
          '.van-checkbox,' +
          '.el-radio,' +
          '.el-checkbox'
        ) || el;

        if (item && candidates.indexOf(item) < 0 && isVisible(item)) {
          candidates.push(item);
        }
      });
    }

    if (!candidates.length) {
      return null;
    }

    var matches = [];

    candidates.forEach(function (item, pos) {
      var rawText = txt(item);
      var t = compactText(rawText);

      if (!t) {
        return;
      }

      if (
        t === target ||
        t.indexOf(target) >= 0 ||
        target.indexOf(t) >= 0
      ) {
        var score = 0;

        if (pos === idx) {
          score -= 1000;
        }

        score += Math.abs(normText(rawText).length - normText(opt.text || '').length);

        matches.push({
          el: item,
          score: score,
          len: normText(rawText).length
        });
      }
    });

    matches.sort(function (a, b) {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      return a.len - b.len;
    });

    return matches.length ? matches[0].el : null;
  }

  function clickOptionElement(item) {
    if (!item) {
      return false;
    }

    var input = q('input[type="radio"], input[type="checkbox"]', item);

    if (input) {
      if (!input.checked) {
        input.click();
      }

      return true;
    }

    var clickable = getClickableOptionElement(item) || item;

    if (clickable) {
      clickable.click();
      return true;
    }

    return false;
  }

  function makeAnswerKey(no, stem) {
    if (no) {
      return 'NO_' + Number(no);
    }

    return 'STEM_' + normText(stem).slice(0, 120);
  }

  function isSkipAnswer(ans) {
    ans = String(ans || '').trim();
    return !ans || /^(瀛樼枒|鐣欑┖|绌簗skip|璺宠繃|鏃爘鏃犵瓟妗坾娌℃湁绛旀|鏆傛棤绛旀)$/i.test(ans);
  }

  function addAnswerToBank(row) {
    if (!row) {
      return false;
    }

    var no = row.no || row.index || row.id || row.questionNo;
    var stem = row.stem || row.question || row.title || '';
    var ans = row.answer || row.answers || row.correctAnswer || row.correct || row.key || '';

    if (Array.isArray(ans)) {
      ans = ans.join('');
    }

    ans = String(ans || '').trim();

    if (isSkipAnswer(ans)) {
      if (no) {
        state.skipBank['NO_' + Number(no)] = true;
        delete state.answerBank['NO_' + Number(no)];
        return true;
      }

      return false;
    }

    if (no) {
      state.answerBank['NO_' + Number(no)] = ans;
      delete state.skipBank['NO_' + Number(no)];
    }

    if (stem) {
      state.answerBank[makeAnswerKey(null, stem)] = ans;
    }

    return true;
  }

  // ===== 瀵煎叆 TXT / JSON 绛旀 =====
  function parseAnswerImport(content) {
    var count = 0;

    content = String(content || '').replace(/^\uFEFF/, '');

    if (!content.trim()) {
      return 0;
    }

    // 姣忔瀵煎叆娓呯┖鏃х瓟妗堝拰鏃ц烦杩?    state.answerBank = {};
    state.skipBank = {};

    // JSON
    try {
      var data = JSON.parse(content);

      if (Array.isArray(data)) {
        data.forEach(function (r) {
          if (addAnswerToBank(r)) {
            count++;
          }
        });

        return count;
      }

      if (data && typeof data === 'object') {
        var arr = data.rows || data.data || data.questions || [];

        if (Array.isArray(arr) && arr.length) {
          arr.forEach(function (r) {
            if (addAnswerToBank(r)) {
              count++;
            }
          });

          return count;
        }

        Object.keys(data).forEach(function (k) {
          var m = String(k).match(/^(?:NO_)?(\d+)$/i);

          if (m) {
            var no = Number(m[1]);
            var v = String(data[k] || '').trim();

            if (isSkipAnswer(v)) {
              state.skipBank['NO_' + no] = true;
              delete state.answerBank['NO_' + no];
            } else {
              state.answerBank['NO_' + no] = v;
              delete state.skipBank['NO_' + no];
            }

            count++;
          }
        });

        return count;
      }
    } catch (e) {
      // 闈?JSON锛岀户缁寜 TXT 瑙ｆ瀽
    }

    // TXT / CSV
    content.split(/\r?\n/).forEach(function (line) {
      line = line.replace(/^\uFEFF/, '').trim();

      if (!line) {
        return;
      }

      // 鏀寔绛旀锛?      // 1 A / 1.A / 1锛欰 / 3B / 11 ABCD / 21 姝ｇ‘ / 22 閿欒
      var mAns = line.match(/^(\d+)\s*(?:[\.\銆乗:锛?锛宂)?\s*([A-F]+|姝ｇ‘|閿欒|瀵箌閿檤true|false|鏄瘄鍚?\s*$/i);

      if (mAns) {
        var noAns = Number(mAns[1]);

        state.answerBank['NO_' + noAns] = String(mAns[2]).trim();
        delete state.skipBank['NO_' + noAns];

        count++;
        return;
      }

      // 鏀寔璺宠繃锛?      // 2 / 2. / 2锛?/ 2 瀛樼枒 / 2 鐣欑┖ / 2 绌?/ 2 璺宠繃
      var mSkip = line.match(/^(\d+)\s*(?:[\.\銆乗:锛?锛宂)?\s*(?:瀛樼枒|鐣欑┖|绌簗skip|璺宠繃|鏃爘鏃犵瓟妗坾娌℃湁绛旀|鏆傛棤绛旀)?\s*$/i);

      if (mSkip) {
        var noSkip = Number(mSkip[1]);

        if (noSkip) {
          state.skipBank['NO_' + noSkip] = true;
          delete state.answerBank['NO_' + noSkip];
          count++;
        }
      }
    });

    return count;
  }

  function refillCollectedAnswers() {
    var n = 0;

    state.rows.forEach(function (r) {
      var ans = state.answerBank['NO_' + Number(r.no)];

      if (ans) {
        r.answer = ans;
        n++;
      }
    });

    return n;
  }

  function importAnswerFile() {
    var input = document.createElement('input');

    input.type = 'file';
    input.accept = '.txt,.json,.csv';

    input.onchange = function () {
      var file = input.files && input.files[0];

      if (!file) {
        return;
      }

      var reader = new FileReader();

      reader.onload = function () {
        var n = parseAnswerImport(reader.result);
        var filled = refillCollectedAnswers();

        toast('瀵煎叆绛旀/璺宠繃 ' + n + ' 鏉★紝鍥炲～ ' + filled + ' 鏉?);

        setStatus(
          '绛旀搴擄細' + Object.keys(state.answerBank).length +
          ' 鏉★紝璺宠繃锛? + Object.keys(state.skipBank).length + ' 棰?
        );

        console.log('[AE] answerBank:', state.answerBank);
        console.log('[AE] skipBank:', state.skipBank);
        console.log('[AE] rows:', state.rows);
      };

      reader.readAsText(file, 'utf-8');
    };

    input.click();
  }

  function getImportedAnswer(cur) {
    if (!cur) {
      return '';
    }

    if (cur.no !== undefined && cur.no !== null) {
      var byNo = state.answerBank['NO_' + Number(cur.no)];

      if (byNo) {
        return byNo;
      }
    }

    return state.answerBank[makeAnswerKey(null, cur.stem)] || '';
  }

  function isImportedSkip(cur) {
    if (!cur) {
      return false;
    }

    if (cur.no !== undefined && cur.no !== null) {
      return !!state.skipBank['NO_' + Number(cur.no)];
    }

    return false;
  }

  function answerToLetters(ans, cur) {
    var raw = String(ans || '').trim();

    if (!raw) {
      return [];
    }

    var compact = raw.replace(/[\s,锛屻€亅\/]+/g, '').toUpperCase();

    if (/^[A-F]+$/.test(compact)) {
      var out = [];

      compact.split('').forEach(function (x) {
        if (out.indexOf(x) < 0) {
          out.push(x);
        }
      });

      return out;
    }

    var clean = raw.replace(/[銆傦紟.銆乗s]/g, '').toLowerCase();
    var isTrue = /^(姝ｇ‘|瀵箌true|鏄?$/i.test(clean);
    var isFalse = /^(閿欒|閿檤false|鍚?$/i.test(clean);

    var letters = [];

    (cur.options || []).forEach(function (o) {
      var t = String(o.text || '');

      var optClean = t
        .replace(/^([A-F])[\.銆乗s]*/i, '')
        .replace(/[銆傦紟.銆乗s]/g, '')
        .toLowerCase();

      if (isTrue && /^(姝ｇ‘|瀵箌true|鏄?$/i.test(optClean)) {
        letters.push(o.key);
        return;
      }

      if (isFalse && /^(閿欒|閿檤false|鍚?$/i.test(optClean)) {
        letters.push(o.key);
        return;
      }

      if (!isTrue && !isFalse) {
        var nt = normText(t).toLowerCase();
        var nr = normText(raw).toLowerCase();

        if (nt === nr || nt.indexOf(nr) >= 0 || nr.indexOf(nt) >= 0) {
          letters.push(o.key);
        }
      }
    });

    return letters;
  }

  function clearAnswerMark(root) {
    qa('.__ae_answer_mark__', root).forEach(function (el) {
      el.classList.remove('__ae_answer_mark__');
      el.style.outline = '';
      el.style.background = '';
    });
  }

  function clearWrongCheckedOptions(items, answerIdxMap) {
    if (!items || !items.length) {
      return;
    }

    items.forEach(function (item, idx) {
      if (answerIdxMap[idx]) {
        return;
      }

      qa('input[type="checkbox"]', item).forEach(function (input) {
        if (input.checked) {
          input.click();
        }
      });
    });
  }

  function applyAnswerToPage(cur, letters, doClick) {
    var root = q(CFG.questionRoot);

    if (!root) {
      return {
        ok: false,
        reason: '鏈壘鍒伴鐩尯鍩?
      };
    }

    var items = getOptionItems(root);

    clearAnswerMark(root);

    var answerIdxMap = {};
    letters.forEach(function (k) {
      answerIdxMap[k.charCodeAt(0) - 65] = true;
    });

    if (doClick) {
      clearWrongCheckedOptions(items, answerIdxMap);
    }

    var clicked = 0;
    var missing = [];

    letters.forEach(function (k) {
      var idx = k.charCodeAt(0) - 65;
      var opt = (cur.options || [])[idx] || {
        key: k,
        text: ''
      };

      var item = findOptionElementByText(root, opt, idx, items, cur);

      if (!item) {
        missing.push(k);
        return;
      }

      item.classList.add('__ae_answer_mark__');
      item.style.outline = '2px solid #ff9800';
      item.style.background = 'rgba(255,152,0,.16)';

      if (doClick) {
        if (clickOptionElement(item)) {
          clicked++;
        }
      }
    });

    return {
      ok: missing.length === 0 && (!doClick || clicked > 0),
      clicked: clicked,
      missing: missing,
      letters: letters,
      itemsCount: items.length
    };
  }

  // ===== 鏍囪/鐐归€夊綋鍓嶉 =====
  function markOrSelectImportedAnswer() {
    var cur = getCurrentQuestion();

    if (!cur) {
      toast('鏈瘑鍒綋鍓嶉鐩?, true);
      return;
    }

    var ans = getImportedAnswer(cur);

    if (!ans) {
      if (isImportedSkip(cur)) {
        toast('褰撳墠棰樹负瀛樼枒/鐣欑┖锛屽凡璺宠繃锛屼笉鐐归€?);
        console.log('[AE] skip current:', cur);
        return;
      }

      toast('绛旀搴撴病鏈夊尮閰嶅埌褰撳墠棰?, true);
      console.log('[AE] no answer matched:', cur, state.answerBank, state.skipBank);
      return;
    }

    var letters = answerToLetters(ans, cur);

 if (!letters.length) {
  toast('鍖归厤鍒扮瓟妗堬紝浣嗘棤娉曡浆鎴愰€夐」锛? + ans, true);
  console.log('[AE] cannot convert answer:', ans, cur);
  return;
}


    var ret = applyAnswerToPage(cur, letters, ANSWER_IMPORT.autoSelect);

    if (!ret.ok) {
      toast('澶勭悊澶辫触锛岀己灏戦€夐」锛? + ret.missing.join(','), true);
      console.warn('[AE] apply failed:', ret, cur);
      return;
    }

    toast((ANSWER_IMPORT.autoSelect ? '宸茬偣閫夌瓟妗堬細' : '宸叉爣璁扮瓟妗堬細') + letters.join(''));

    console.log('[AE] current answer:', {
      current: cur,
      answer: ans,
      letters: letters,
      autoSelect: ANSWER_IMPORT.autoSelect,
      result: ret
    });
  }

  function canClickNext(btn) {
    if (!btn) {
      return false;
    }

    if (btn.disabled) {
      return false;
    }

    if (/disabled/i.test(btn.className || '')) {
      return false;
    }

    if (btn.getAttribute && btn.getAttribute('aria-disabled') === 'true') {
      return false;
    }

    return true;
  }

  // ===== 鎵归噺鐐归€夊綋鍓嶉鍒版渶鍚庝竴棰?=====
  async function batchSelectAllImportedAnswers() {
    if (state.running) {
      toast('姝ｅ湪鎵ц涓紝璇峰嬁閲嶅鐐瑰嚮', true);
      return;
    }

    state.running = true;
    state.stopRequested = false;

    var selected = 0;
    var skipped = 0;
    var failed = 0;
    var seen = {};

    setStatus('鎵归噺鐐归€変腑...');
    toast('寮€濮嬫壒閲忕偣閫夛紝璇峰嬁鎿嶄綔椤甸潰');

    try {
      for (var i = 0; i < CFG.maxSteps; i++) {
        if (state.stopRequested) {
          toast('宸叉墜鍔ㄥ仠姝?);
          break;
        }

        var cur = getCurrentQuestion();

        if (!cur) {
          failed++;
          toast('鏈瘑鍒綋鍓嶉锛屽仠姝?, true);
          break;
        }

        if (seen[cur.key]) {
          toast('妫€娴嬪埌閲嶅棰樼洰锛屽仠姝?);
          break;
        }

        seen[cur.key] = true;

        var ans = getImportedAnswer(cur);

        if (!ans) {
          if (isImportedSkip(cur)) {
            skipped++;
            console.log('[AE] 褰撳墠棰樹负瀛樼枒/鐣欑┖锛岃烦杩囦笉鐐?', {
              no: cur.no,
              cur: cur
            });
          } else {
            failed++;
            console.warn('[AE] 褰撳墠棰樻湭鍖归厤绛旀锛屼篃鏈爣璁拌烦杩?', cur);
          }
        } else {
          var letters = answerToLetters(ans, cur);

          if (!letters.length) {
            failed++;
            console.warn('[AE] 绛旀鏃犳硶杞€夐」:', ans, cur);
          } else {
            var ret = applyAnswerToPage(cur, letters, true);

            if (ret.ok) {
              selected++;
              console.log('[AE] 宸茬偣閫?', {
                no: cur.no,
                answer: ans,
                letters: letters,
                result: ret
              });
            } else {
              failed++;
              console.warn('[AE] 鐐归€夊け璐?', {
                no: cur.no,
                answer: ans,
                letters: letters,
                result: ret,
                cur: cur
              });
            }
          }
        }

        setStatus('鎵归噺鐐归€夛細鎴愬姛 ' + selected + '锛岃烦杩?' + skipped + '锛屽け璐?' + failed);

        var next = q(CFG.nextBtn);

        if (!canClickNext(next)) {
          toast('涓嬩竴棰樹笉鍙偣鍑伙紝鎵归噺鐐归€夌粨鏉?);
          break;
        }

        next.click();
        await sleep(CFG.stepDelay);
      }

      setStatus('鎵归噺鐐归€夊畬鎴愶細鎴愬姛 ' + selected + '锛岃烦杩?' + skipped + '锛屽け璐?' + failed);
      toast('鎵归噺鐐归€夊畬鎴愶細鎴愬姛 ' + selected + '锛岃烦杩?' + skipped + '锛屽け璐?' + failed);
    } catch (e) {
      console.error('[AE] 鎵归噺鐐归€夊け璐?', e);
      toast('鎵归噺鐐归€夊け璐ワ細' + e.message, true);
      setStatus('鎵归噺鐐归€夊け璐?);
    } finally {
      state.running = false;
      state.stopRequested = false;
    }
  }

  // ===== 鑷姩閲囬泦 =====
  async function collectAll() {
    if (state.running) {
      toast('姝ｅ湪閲囬泦涓紝璇峰嬁閲嶅鐐瑰嚮');
      return;
    }

    state.running = true;
    state.stopRequested = false;
    state.rows = [];
    state.seen = {};

    setStatus('閲囬泦涓?..');
    toast('寮€濮嬮噰闆?);

    try {
      for (var i = 0; i < CFG.maxSteps; i++) {
        if (state.stopRequested) {
          toast('宸插仠姝?);
          break;
        }

        var cur = getCurrentQuestion();

        if (!cur) {
          toast('鏈瘑鍒埌褰撳墠棰樼洰锛屽仠姝?, true);
          break;
        }

        if (state.seen[cur.key]) {
          toast('妫€娴嬪埌閲嶅棰樼洰锛屽仠姝?);
          break;
        }

        state.seen[cur.key] = true;

        var importedAns = getImportedAnswer(cur);

        state.rows.push({
          no: cur.no || state.rows.length + 1,
          stem: cur.stem,
          options: cur.options,
          answer: cur.answer || importedAns || '',
          source: cur.source
        });

        setStatus('宸查噰闆嗭細' + state.rows.length + ' 棰橈紝鏉ユ簮锛? + cur.source);
        toast('宸查噰闆?' + state.rows.length + ' 棰?);

        var next = q(CFG.nextBtn);

        if (!canClickNext(next)) {
          toast('涓嬩竴棰樹笉鍙偣鍑伙紝鍋滄');
          break;
        }

        next.click();
        await sleep(CFG.stepDelay);
      }

      setStatus('瀹屾垚锛屽叡 ' + state.rows.length + ' 棰?);
      toast('閲囬泦瀹屾垚锛屽叡 ' + state.rows.length + ' 棰?);

      console.log('[AE] rows:', state.rows);
    } catch (e) {
      console.error('[AE] collect error:', e);
      toast('閲囬泦澶辫触锛? + e.message, true);
      setStatus('閲囬泦澶辫触');
    } finally {
      state.running = false;
      state.stopRequested = false;
    }
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], {
      type: mime || 'text/plain;charset=utf-8'
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportJSON() {
    if (!state.rows.length) {
      toast('鏆傛棤鏁版嵁鍙鍑?, true);
      return;
    }

    download(
      'questions_' + Date.now() + '.json',
      JSON.stringify(state.rows, null, 2),
      'application/json;charset=utf-8'
    );
  }

  function exportCSV() {
    if (!state.rows.length) {
      toast('鏆傛棤鏁版嵁鍙鍑?, true);
      return;
    }

    function esc(v) {
      if (v === undefined || v === null) {
        v = '';
      }

      return '"' + String(v).replace(/"/g, '""') + '"';
    }

    var lines = ['no,stem,options,answer,source'];

    state.rows.forEach(function (r) {
      var opts = (r.options || []).map(function (o) {
        return o.key + '. ' + o.text;
      }).join(' | ');

      lines.push([
        esc(r.no),
        esc(r.stem),
        esc(opts),
        esc(r.answer),
        esc(r.source)
      ].join(','));
    });

    download(
      'questions_' + Date.now() + '.csv',
      '\uFEFF' + lines.join('\n'),
      'text/csv;charset=utf-8'
    );
  }

  async function copyText() {
    if (!state.rows.length) {
      toast('鏆傛棤鏁版嵁鍙鍒?, true);
      return;
    }

    refillCollectedAnswers();

    var s = state.rows.map(function (r) {
      var opts = (r.options || []).map(function (o) {
        return o.key + '. ' + o.text;
      }).join('\n');

      return String(r.no || '') + '. ' + String(r.stem || '') +
        '\n' + opts +
        '\n绛旀: ' + (r.answer || '(鏃?') +
        '\n鏉ユ簮: ' + (r.source || '');
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(s);
      toast('宸插鍒讹紝瀛楃鏁帮細' + s.length);
    } catch (e) {
      console.error('[AE] copy error:', e);
      toast('澶嶅埗澶辫触锛? + e.message, true);
    }
  }

  // ===== 闈㈡澘 =====
  function injectPanel() {
    var old = document.getElementById('__ae_panel__');

    if (old) {
      old.parentNode.removeChild(old);
    }

    var p = document.createElement('div');
    p.id = '__ae_panel__';

    p.style.cssText =
      'position:fixed;top:100px;right:16px;z-index:2147483647;' +
      'background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;width:250px;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.15);font-family:Arial,"Microsoft YaHei",sans-serif;' +
      'color:#222;font-size:12px;';

    p.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div style="font-weight:700;font-size:13px;">鏁村嵎閲囬泦瀵煎嚭</div>' +
        '<button id="__ae_close__" style="border:none;background:#eee;border-radius:4px;cursor:pointer;">脳</button>' +
      '</div>' +

      '<div id="__ae_status__" style="margin-bottom:8px;color:#666;">寰呭紑濮?/div>' +

      '<button id="__ae_start__" style="width:100%;margin:4px 0;cursor:pointer;">寮€濮嬭嚜鍔ㄩ噰闆?/button>' +
      '<button id="__ae_stop__" style="width:100%;margin:4px 0;cursor:pointer;">鍋滄閲囬泦/鎵归噺</button>' +

      '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">' +

      '<button id="__ae_json__" style="width:100%;margin:4px 0;cursor:pointer;">瀵煎嚭 JSON</button>' +
      '<button id="__ae_csv__" style="width:100%;margin:4px 0;cursor:pointer;">瀵煎嚭 CSV</button>' +
      '<button id="__ae_copy__" style="width:100%;margin:4px 0;cursor:pointer;">澶嶅埗鏂囨湰</button>' +
      '<button id="__ae_clear__" style="width:100%;margin:4px 0;cursor:pointer;">娓呯┖鏁版嵁</button>' +

      '<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">' +

      '<button id="__ae_import_answer__" style="width:100%;margin:4px 0;cursor:pointer;">瀵煎叆绛旀 TXT/JSON</button>' +
      '<button id="__ae_mark_answer__" style="width:100%;margin:4px 0;cursor:pointer;">鏍囪/鐐归€夊綋鍓嶉</button>' +
      '<button id="__ae_batch_select__" style="width:100%;margin:4px 0;cursor:pointer;background:#fff3e0;border:1px solid #ff9800;">鎵归噺鐐归€夊叏閮?/button>' +

      '<label style="display:flex;align-items:center;gap:4px;margin-top:6px;color:#666;cursor:pointer;">' +
        '<input id="__ae_autoselect__" type="checkbox">' +
        '<span>鑷姩鐐归€夊綋鍓嶉</span>' +
      '</label>' +

      '<div style="margin-top:8px;color:#999;line-height:1.4;">' +
        'TXT鏍煎紡锛? C / 2 ABCD / 3 姝ｇ‘銆?br>' +
        '4 瀛樼枒 鎴栧崟鐙?4锛氬彧璺宠繃锛屼笉鐐瑰瓨鐤戙€?br>' +
        '鎵归噺鐐归€変細浠庡綋鍓嶉寮€濮嬪線鍚庢墽琛屻€?br>' +
        '瑕侀€夊叏鍗凤紝璇峰厛鍥炲埌绗?棰樸€? +
      '</div>';

    document.body.appendChild(p);

    q('#__ae_start__').onclick = collectAll;

    q('#__ae_stop__').onclick = function () {
      state.stopRequested = true;
      toast('姝ｅ湪鍋滄...');
    };

    q('#__ae_json__').onclick = exportJSON;
    q('#__ae_csv__').onclick = exportCSV;
    q('#__ae_copy__').onclick = copyText;

    q('#__ae_clear__').onclick = function () {
      if (state.running) {
        toast('杩愯涓紝鏃犳硶娓呯┖', true);
        return;
      }

      state.rows = [];
      state.seen = {};
      setStatus('宸叉竻绌?);
      toast('鏁版嵁宸叉竻绌?);
    };

    q('#__ae_import_answer__').onclick = importAnswerFile;
    q('#__ae_mark_answer__').onclick = markOrSelectImportedAnswer;
    q('#__ae_batch_select__').onclick = batchSelectAllImportedAnswers;

    q('#__ae_autoselect__').onchange = function () {
      ANSWER_IMPORT.autoSelect = this.checked;
      toast(this.checked ? '宸插紑鍚嚜鍔ㄧ偣閫夊綋鍓嶉' : '宸插叧闂嚜鍔ㄧ偣閫夛紝浠呴珮浜?);
    };

    q('#__ae_close__').onclick = function () {
      state.stopRequested = true;

      var panel = q('#__ae_panel__');

      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    };
  }

  function init() {
    injectPanel();

    window.AutoExportQuestions = {
      cfg: CFG,
      state: state,
      answerImport: ANSWER_IMPORT,

      injectPanel: injectPanel,

      getCurrentQuestion: getCurrentQuestion,
      getCurrentBySelector: getCurrentBySelector,
      getCurrentByFallback: getCurrentByFallback,

      importAnswerFile: importAnswerFile,
      parseAnswerImport: parseAnswerImport,
      markOrSelectImportedAnswer: markOrSelectImportedAnswer,
      batchSelectAllImportedAnswers: batchSelectAllImportedAnswers,

      isImportedSkip: isImportedSkip,

      answerToLetters: answerToLetters,
      getImportedAnswer: getImportedAnswer,
      refillCollectedAnswers: refillCollectedAnswers,

      collectAll: collectAll,
      exportJSON: exportJSON,
      exportCSV: exportCSV,
      copyText: copyText
    };

    console.log('[AE] panel injected');
    toast('閲囬泦闈㈡澘宸插姞杞?);
  }

  function boot() {
    var tries = 0;

    var timer = setInterval(function () {
      tries++;

      if (document.body) {
        clearInterval(timer);

        try {
          init();
        } catch (e) {
          console.error('[AE] init error:', e);
          alert('AE鑴氭湰鍒濆鍖栧け璐ワ細' + e.message);
        }

        return;
      }

      if (tries > 100) {
        clearInterval(timer);
        console.warn('[AE] document.body not found');
      }
    }, 200);
  }

  boot();
})();
