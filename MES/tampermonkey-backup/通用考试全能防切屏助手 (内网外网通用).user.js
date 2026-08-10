// ==UserScript==
// @name         通用考试全能防切屏助手 (内网外网通用)
// @namespace    http://tampermonkey.net
// @version      4.0
// @description  强制锁死浏览器可见性 API，拦截所有切屏检测事件，支持所有域名
// @author       User
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. 定义核心锁定函数
    const lock = (obj, prop, val) => {
        try {
            Object.defineProperty(obj, prop, {
                get: () => val,
                set: () => {},
                configurable: false
            });
        } catch (e) { console.warn(`无法锁定属性: ${prop}`); }
    };

    // 2. 锁死所有已知的可见性接口 (核心防检测)
    lock(document, 'visibilityState', 'visible');
    lock(document, 'webkitVisibilityState', 'visible');
    lock(document, 'mozVisibilityState', 'visible');
    lock(document, 'msVisibilityState', 'visible');
    lock(document, 'hidden', false);
    lock(document, 'webkitHidden', false);

    // 3. 拦截所有失焦和状态改变事件 (暴力拦截模式)
    const events = [
        'visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange',
        'blur', 'focusout', 'mouseleave', 'mouseout', 'pagehide'
    ];

    events.forEach(evt => {
        window.addEventListener(evt, (e) => {
            e.stopImmediatePropagation(); // 核心：抢在考试脚本前拦截
        }, true);
        document.addEventListener(evt, (e) => {
            e.stopImmediatePropagation();
        }, true);
    });

    // 4. 伪造全屏环境 (解决退出全屏被记录的问题)
    const getRoot = () => document.documentElement;
    lock(document, 'fullscreenElement', getRoot());
    lock(document, 'webkitFullscreenElement', getRoot());
    lock(document, 'mozFullScreenElement', getRoot());

    // 5. 阻止点击外部链接跳转
    window.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href && !target.href.startsWith(window.location.origin) && !target.href.includes('javascript')) {
            e.preventDefault();
            e.stopPropagation();
            if(confirm("脚本已拦截外部跳转，是否强制前往？\n" + target.href)) {
                window.open(target.href, '_blank');
            }
        }
    }, true);

    console.log("%c [SYSTEM] 全局防切屏模式已启动 (支持内网/外网) ", "color: white; background: #28a745; font-size: 14px; font-weight: bold;");
})();
