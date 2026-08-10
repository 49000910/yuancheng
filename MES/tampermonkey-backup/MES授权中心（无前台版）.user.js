// ==UserScript==
// @name         MES鎺堟潈涓績锛堟棤鍓嶅彴鐗堬級
// @namespace    tm.mes.auth.center.hidden
// @version      1.1.1
// @description  MES鑴氭湰缁熶竴鎺堟潈涓績锛屾棤鍓嶅彴鎸夐挳锛屼粎蹇嵎閿墦寮€绠＄悊闈㈡澘锛屾敮鎸佺簿鍑嗗埌鍒嗛挓銆佸湪绾跨画鏈熷強寮哄埗杩囨湡鍒锋柊
// @match        https://w3.huawei.com/mespmm/wipweb*
// @match        https://w3.huawei.com/mespmm/wipweb/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  console.log('[MES鎺堟潈涓績] 宸插姞杞斤紝鏃犲墠鍙扮増锛?, location.href);

  var AUTH_STATE_KEY = 'MES_AUTH_CENTER_STATE_V1';
  var AUTH_ALLOW_KEY = 'MES_AUTH_CENTER_ALLOW_JOBS_V1';
  var AUTH_EXPIRES_KEY = 'MES_AUTH_JOB_EXPIRES_V2';
  var EXPIRE_DAYS_KEY = 'MES_AUTH_EXPIRE_DAYS';

  // 锛岃嚜宸辨敼
  var ADMIN_PASSWORD = '1231';

  // 榛樿鎺堟潈宸ュ彿
  var DEFAULT_ALLOW_JOBS = [
    '82023703'
  ];

  var DEFAULT_EXPIRE_DAYS = parseFloat(localStorage.getItem(EXPIRE_DAYS_KEY)) || 15;

  var ACCOUNT_SELECTORS = [
    '.user-info-name .user-name-display',
    '.user-name-display',
    '.user-info-name'
  ];

  var panelAuthed = false;

  function formatTimeLeft(ms) {
    if (ms <= 0) return '宸茶繃鏈?;
    var totalMinutes = Math.floor(ms / 60000);
    var days = Math.floor(totalMinutes / (60 * 24));
    var hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    var minutes = totalMinutes % 60;

    var res = '';
    if (days > 0) res += days + '澶?';
    if (hours > 0 || days > 0) res += hours + '灏忔椂 ';
    res += minutes + '鍒嗛挓';
    return res.trim();
  }

  function getJobExpires() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_EXPIRES_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveJobExpires(obj) {
    localStorage.setItem(AUTH_EXPIRES_KEY, JSON.stringify(obj));
  }

  function getAccountText() {
    for (var i = 0; i < ACCOUNT_SELECTORS.length; i++) {
      var el = document.querySelector(ACCOUNT_SELECTORS[i]);
      var text = el && el.textContent ? el.textContent.trim() : '';
      if (text) return text;
    }
    return '';
  }

  function getJobNumber(text) {
    var m = String(text || '').match(/\b\d{6,12}\b/);
    return m ? m[0] : '';
  }

  function loadAllowJobs() {
    var arr = null;
    try {
      arr = JSON.parse(localStorage.getItem(AUTH_ALLOW_KEY) || 'null');
    } catch (e) {}

    if (!Array.isArray(arr)) {
      arr = DEFAULT_ALLOW_JOBS.slice();
      localStorage.setItem(AUTH_ALLOW_KEY, JSON.stringify(arr));

      var expiresObj = getJobExpires();
      var now = Date.now();
      arr.forEach(function(job) {
        if (!expiresObj[job]) {
          expiresObj[job] = now + (DEFAULT_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
        }
      });
      saveJobExpires(expiresObj);
    }

    return arr.map(function (x) {
      return String(x || '').trim();
    }).filter(function (x) {
      return /^\d{6,12}$/.test(x);
    });
  }

  function saveAllowJobs(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (x) {
      x = String(x || '').trim();
      if (!/^\d{6,12}$/.test(x)) return;
      if (!seen[x]) {
        seen[x] = 1;
        out.push(x);
      }
    });
    localStorage.setItem(AUTH_ALLOW_KEY, JSON.stringify(out));
    return out;
  }

  function checkAuth() {
    var accountText = getAccountText();
    var jobNumber = getJobNumber(accountText);
    var allowJobs = loadAllowJobs();

    var ok = false;
    var status = '';
    var reason = '';

    if (!accountText) {
      status = 'unknown';
      reason = '鏈娴嬪埌璐﹀彿淇℃伅';
    } else if (!jobNumber) {
      status = 'unknown';
      reason = '鏈彁鍙栧埌宸ュ彿';
    } else if (allowJobs.indexOf(jobNumber) >= 0) {
      var expiresObj = getJobExpires();
      var expireTime = expiresObj[jobNumber] || 0;
      var timeLeft = expireTime - Date.now();

      if (timeLeft <= 0) {
        // 宸茶繃鏈燂紝浠庢湭鎺堟潈鍒楄〃绉婚櫎
        allowJobs = allowJobs.filter(function(j) { return j !== jobNumber; });
        localStorage.setItem(AUTH_ALLOW_KEY, JSON.stringify(allowJobs));

        // 娓呯悊杩囨湡鐨勬棤鐢ㄥ績璺虫椂闂存埑
        delete expiresObj[jobNumber];
        saveJobExpires(expiresObj);

        status = 'unauthorized';
        reason = '鎺堟潈宸茶繃鏈?;

        // 姘旀场鎻愮ず
        var bubble = document.createElement('div');
        bubble.textContent = '宸ュ彿 ' + jobNumber + ' 鎺堟潈宸茶繃鏈燂紝椤甸潰鍗冲皢寮哄埗鍒锋柊...';
        bubble.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#cf1322;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(bubble);

        // 鈽呪槄鈽?鏂板闃绘柇閫昏緫锛氳繃鏈熷悗寮哄埗鍒锋柊椤甸潰锛屾竻鐞嗘帀姝ｅ湪杩愯鐨勫姛鑳?鈽呪槄鈽?        setTimeout(function() {
            location.reload();
        }, 1500); // 寤惰繜1.5绉掓墽琛岋紝璁╃敤鎴风湅鍒扮孩鏉℃彁绀?
      } else {
        ok = true;
        status = 'authorized';
        reason = '鎺堟潈宸ュ彿锛屽墿浣?' + formatTimeLeft(timeLeft);
      }
    } else {
      status = 'unauthorized';
      reason = '鏈巿鏉冨伐鍙?;
    }

    var data = {
      ok: ok,
      status: status,
      reason: reason,
      accountText: accountText,
      jobNumber: jobNumber,
      allowJobs: allowJobs,
      ts: Date.now()
    };

    try {
      localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(data));
      window.__MES_AUTH_CENTER_STATE__ = data;
      window.dispatchEvent(new CustomEvent('mes-auth-center-update', { detail: data }));
    } catch (e) {}

    return data;
  }

  function ensureBody(fn) {
    if (document.body) { fn(); return; }
    var timer = setInterval(function () {
      if (document.body) { clearInterval(timer); fn(); }
    }, 100);
  }

  function openPanel() {
    ensureBody(function () {
      var old = document.getElementById('mes-auth-center-panel');
      if (old) {
        old.style.display = 'block';
        refreshPanel();
        return;
      }

      var box = document.createElement('div');
      box.id = 'mes-auth-center-panel';
      box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%, -50%);z-index:2147483647;width:480px;background:#fff;color:#222;border:1px solid #d9d9d9;border-radius:10px;box-shadow:0 10px 35px rgba(0,0,0,.25);font-size:12px;overflow:hidden;font-family:Arial, "Microsoft YaHei", sans-serif;';

      box.innerHTML =
        '<div style="height:40px;line-height:40px;background:#1677ff;color:#fff;padding:0 12px;display:flex;justify-content:space-between;align-items:center;">' +
          '<b>MES鎺堟潈涓績</b>' +
          '<button id="mes-auth-center-close" style="border:0;border-radius:6px;padding:3px 9px;cursor:pointer;">鍏抽棴</button>' +
        '</div>' +
        '<div style="padding:12px;">' +
          '<div style="margin-bottom:8px;">褰撳墠璐﹀彿锛?span id="mes-auth-center-account">璇诲彇涓?/span></div>' +
          '<div style="margin-bottom:8px;">褰撳墠宸ュ彿锛?span id="mes-auth-center-job">璇诲彇涓?/span></div>' +
          '<div style="margin-bottom:8px;">鎺堟潈鐘舵€侊細<span id="mes-auth-center-state">璇诲彇涓?/span></div>' +
          '<hr style="margin:10px 0;">' +
          '<div id="mes-auth-center-login-box">' +
            '<div style="margin-bottom:6px;">绠＄悊瀵嗙爜</div>' +
            '<input id="mes-auth-center-pwd" type="password" placeholder="杈撳叆绠＄悊瀵嗙爜" style="width:100%;height:30px;box-sizing:border-box;">' +
            '<div style="margin-top:8px;"><button id="mes-auth-center-login">杩涘叆绠＄悊</button></div>' +
            '<div id="mes-auth-center-login-msg" style="margin-top:6px;color:#cf1322;"></div>' +
          '</div>' +
          '<div id="mes-auth-center-admin-box" style="display:none;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
              '<span>娣诲姞鏂板伐鍙?閲嶇疆鏃堕棿</span>' +
            '</div>' +
            '<div style="display:flex;gap:5px;margin-bottom:8px;">' +
              '<input id="mes-auth-center-new-job" placeholder="杈撳叆宸ュ彿(濡?2023703)" style="flex:2;height:30px;box-sizing:border-box;">' +
              '<input id="mes-auth-center-new-days" type="number" step="0.1" placeholder="澶╂暟" style="flex:1;height:30px;box-sizing:border-box;" value="' + DEFAULT_EXPIRE_DAYS + '">' +
            '</div>' +
            '<div style="margin-top:4px;margin-bottom:8px;">' +
              '<button id="mes-auth-center-add" style="background:#1677ff;color:#fff;border:0;padding:5px 8px;border-radius:4px;cursor:pointer;">娣诲姞/閲嶇疆</button> ' +
              '<button id="mes-auth-center-add-current">娣诲姞褰撳墠</button> ' +
              '<button id="mes-auth-center-refresh">鍒锋柊妫€娴?/button>' +
            '</div>' +
            '<hr style="margin:10px 0;">' +
            '<div style="margin-bottom:6px;font-weight:bold;">宸叉巿鏉冨伐鍙?(鏀寔鍦ㄧ嚎澧炲姞鏃堕棿)</div>' +
            '<div id="mes-auth-center-list" style="max-height:260px;overflow:auto;border:1px solid #eee;border-radius:6px;padding:8px;background:#fafafa;"></div>' +
            '<div id="mes-auth-center-msg" style="margin-top:6px;color:#389e0d;"></div>' +
          '</div>' +
          '<div style="margin-top:10px;color:#888;line-height:1.5;">' +
            '蹇嵎閿細F10 / Ctrl+F10銆傛巿鏉冧腑蹇冩棤鍓嶅彴鎸夐挳锛屽彧鍦ㄥ悗鍙板啓鍏ユ巿鏉冪姸鎬併€? +
          '</div>' +
        '</div>';

      document.body.appendChild(box);

      document.getElementById('mes-auth-center-close').onclick = function () { box.style.display = 'none'; };

      document.getElementById('mes-auth-center-login').onclick = function () {
        var pwd = document.getElementById('mes-auth-center-pwd').value;
        var msg = document.getElementById('mes-auth-center-login-msg');
        if (pwd !== ADMIN_PASSWORD) { msg.textContent = '瀵嗙爜閿欒'; return; }
        msg.textContent = '';
        panelAuthed = true;
        document.getElementById('mes-auth-center-login-box').style.display = 'none';
        document.getElementById('mes-auth-center-admin-box').style.display = 'block';
        renderAllowList();
      };

      document.getElementById('mes-auth-center-pwd').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { document.getElementById('mes-auth-center-login').click(); }
      });

      document.getElementById('mes-auth-center-add').onclick = function () {
        var input = document.getElementById('mes-auth-center-new-job');
        var daysInput = document.getElementById('mes-auth-center-new-days');
        addJob(input.value, daysInput.value);
      };

      document.getElementById('mes-auth-center-add-current').onclick = function () {
        var st = checkAuth();
        var daysInput = document.getElementById('mes-auth-center-new-days');
        if(st.jobNumber) { addJob(st.jobNumber, daysInput.value); }
      };

      document.getElementById('mes-auth-center-refresh').onclick = function () {
        checkAuth();
        refreshPanel();
      };

      refreshPanel();
    });
  }

  function refreshPanel() {
    var st = checkAuth();
    var accountEl = document.getElementById('mes-auth-center-account');
    var jobEl = document.getElementById('mes-auth-center-job');
    var stateEl = document.getElementById('mes-auth-center-state');

if (accountEl) accountEl.textContent = st.accountText || '鏈娴嬪埌';
    if (jobEl) jobEl.textContent = st.jobNumber || '鏈瘑鍒?; // 淇锛氭妸 accountEl 鏀瑰洖 jobEl


    if (stateEl) {
      stateEl.textContent = st.ok ? '宸叉巿鏉? : '鏈巿鏉冿細' + st.reason;
      stateEl.style.color = st.ok ? '#389e0d' : '#cf1322';
    }

    if (panelAuthed) {
      updateListTimeText();
    }
  }

  function addJob(job, days) {
    job = String(job || '').trim();
    days = parseFloat(days);

    var msg = document.getElementById('mes-auth-center-msg');

    if (!/^\d{6,12}$/.test(job)) {
      if (msg) { msg.style.color = '#cf1322'; msg.textContent = '宸ュ彿鏍煎紡涓嶆纭?; }
      return;
    }

    if (isNaN(days) || days <= 0) {
      if (msg) { msg.style.color = '#cf1322'; msg.textContent = '璇疯緭鍏ユ湁鏁堢殑澶╂暟 (鏀寔灏忔暟锛屽 0.5)'; }
      return;
    }

    var list = loadAllowJobs();
    var expiresObj = getJobExpires();

    var currentExpire = expiresObj[job] || 0;
    var baseTime = currentExpire > Date.now() ? currentExpire : Date.now();

    var msToAdd = days * 24 * 60 * 60 * 1000;
    expiresObj[job] = baseTime + msToAdd;
    saveJobExpires(expiresObj);

    if (list.indexOf(job) < 0) {
      list.push(job);
      saveAllowJobs(list);
    }

    checkAuth();
    renderAllowList();

    if (msg) {
      msg.style.color = '#389e0d';
      msg.textContent = '鎿嶄綔鎴愬姛锛? + job + ' 宸插鍔?' + days + ' 澶╂潈闄愶紒';
    }
  }

  function removeJob(job) {
    var list = loadAllowJobs().filter(function (x) { return x !== job; });
    saveAllowJobs(list);

    var expiresObj = getJobExpires();
    delete expiresObj[job];
    saveJobExpires(expiresObj);

    checkAuth();
    renderAllowList();

    var msg = document.getElementById('mes-auth-center-msg');
    if (msg) { msg.style.color = '#cf1322'; msg.textContent = '宸插垹闄わ細' + job + '锛屽缓璁埛鏂伴〉闈?; }
  }

  function renderAllowList() {
    var box = document.getElementById('mes-auth-center-list');
    if (!box) return;

    var list = loadAllowJobs();
    var expiresObj = getJobExpires();
    var now = Date.now();

    if (!list.length) {
      box.innerHTML = '<div style="color:#999;padding:10px;text-align:center;">鏆傛棤鎺堟潈宸ュ彿</div>';
      return;
    }

    box.innerHTML = '';

    list.forEach(function (job) {
      var expireTime = expiresObj[job] || 0;
      var timeLeft = expireTime - now;
      var isExpired = timeLeft <= 0;

      var row = document.createElement('div');
      row.style.cssText = 'padding:8px;border-bottom:1px solid #eee;background:#fff;border-radius:4px;margin-bottom:6px;';

      var infoRow = document.createElement('div');
      infoRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';

      var jobSpan = document.createElement('span');
      jobSpan.innerHTML = '<b style="font-size:13px;">' + job + '</b>';

      var timeSpan = document.createElement('span');
      timeSpan.id = 'time-text-' + job;
      timeSpan.style.cssText = 'font-size:11px;font-weight:bold;color:' + (isExpired ? '#cf1322' : '#389e0d');
      timeSpan.textContent = isExpired ? '宸茶繃鏈? : '鍓╀綑 ' + formatTimeLeft(timeLeft);

      infoRow.appendChild(jobSpan);
      infoRow.appendChild(timeSpan);

      var ctrlRow = document.createElement('div');
      ctrlRow.style.cssText = 'display:flex;gap:4px;align-items:center;';

      var input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.placeholder = '澧炲姞澶╂暟';
      input.style.cssText = 'flex:1;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 5px;font-size:11px;';

      var btnAddTime = document.createElement('button');
      btnAddTime.textContent = '+澧炲姞';
      btnAddTime.style.cssText = 'padding:4px 6px;background:#1677ff;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:11px;';
      btnAddTime.onclick = function() {
        var val = input.value;
        if (!val) { alert('璇疯緭鍏ヨ澧炲姞鐨勫ぉ鏁?); return; }
        addJob(job, val);
        input.value = '';
      };

      var btnDel = document.createElement('button');
      btnDel.textContent = '鍒犻櫎';
      btnDel.style.cssText = 'padding:4px 6px;background:#fff;color:#cf1322;border:1px solid #cf1322;border-radius:4px;cursor:pointer;font-size:11px;';
      btnDel.onclick = function() { removeJob(job); };

      ctrlRow.appendChild(input);
      ctrlRow.appendChild(btnAddTime);
      ctrlRow.appendChild(btnDel);

      row.appendChild(infoRow);
      row.appendChild(ctrlRow);
      box.appendChild(row);
    });
  }

  function updateListTimeText() {
    var list = loadAllowJobs();
    var expiresObj = getJobExpires();
    var now = Date.now();

    list.forEach(function(job) {
      var el = document.getElementById('time-text-' + job);
      if (el) {
        var expireTime = expiresObj[job] || 0;
        var timeLeft = expireTime - now;
        if (timeLeft <= 0) {
          el.textContent = '宸茶繃鏈?;
          el.style.color = '#cf1322';
        } else {
          el.textContent = '鍓╀綑 ' + formatTimeLeft(timeLeft);
          el.style.color = '#389e0d';
        }
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F10' || (e.ctrlKey && e.key === 'F10')) {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    }
  }, true);

  function boot() {
    checkAuth();
    setInterval(function () {
      checkAuth();
      var panel = document.getElementById('mes-auth-center-panel');
      if (panel && panel.style.display !== 'none') {
        refreshPanel();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
