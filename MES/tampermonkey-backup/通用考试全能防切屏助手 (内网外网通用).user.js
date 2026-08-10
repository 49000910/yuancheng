// ==UserScript==
// @name         閫氱敤鑰冭瘯鍏ㄨ兘闃插垏灞忓姪鎵?(鍐呯綉澶栫綉閫氱敤)
// @namespace    http://tampermonkey.net
// @version      4.0
// @description  寮哄埗閿佹娴忚鍣ㄥ彲瑙佹€?API锛屾嫤鎴墍鏈夊垏灞忔娴嬩簨浠讹紝鏀寔鎵€鏈夊煙鍚?// @author       User
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 1. 瀹氫箟鏍稿績閿佸畾鍑芥暟
    const lock = (obj, prop, val) => {
        try {
            Object.defineProperty(obj, prop, {
                get: () => val,
                set: () => {},
                configurable: false
            });
        } catch (e) { console.warn(`鏃犳硶閿佸畾灞炴€? ${prop}`); }
    };

    // 2. 閿佹鎵€鏈夊凡鐭ョ殑鍙鎬ф帴鍙?(鏍稿績闃叉娴?
    lock(document, 'visibilityState', 'visible');
    lock(document, 'webkitVisibilityState', 'visible');
    lock(document, 'mozVisibilityState', 'visible');
    lock(document, 'msVisibilityState', 'visible');
    lock(document, 'hidden', false);
    lock(document, 'webkitHidden', false);

    // 3. 鎷︽埅鎵€鏈夊け鐒﹀拰鐘舵€佹敼鍙樹簨浠?(鏆村姏鎷︽埅妯″紡)
    const events = [
        'visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'msvisibilitychange',
        'blur', 'focusout', 'mouseleave', 'mouseout', 'pagehide'
    ];

    events.forEach(evt => {
        window.addEventListener(evt, (e) => {
            e.stopImmediatePropagation(); // 鏍稿績锛氭姠鍦ㄨ€冭瘯鑴氭湰鍓嶆嫤鎴?        }, true);
        document.addEventListener(evt, (e) => {
            e.stopImmediatePropagation();
        }, true);
    });

    // 4. 浼€犲叏灞忕幆澧?(瑙ｅ喅閫€鍑哄叏灞忚璁板綍鐨勯棶棰?
    const getRoot = () => document.documentElement;
    lock(document, 'fullscreenElement', getRoot());
    lock(document, 'webkitFullscreenElement', getRoot());
    lock(document, 'mozFullScreenElement', getRoot());

    // 5. 闃绘鐐瑰嚮澶栭儴閾炬帴璺宠浆
    window.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href && !target.href.startsWith(window.location.origin) && !target.href.includes('javascript')) {
            e.preventDefault();
            e.stopPropagation();
            if(confirm("鑴氭湰宸叉嫤鎴閮ㄨ烦杞紝鏄惁寮哄埗鍓嶅線锛焅n" + target.href)) {
                window.open(target.href, '_blank');
            }
        }
    }, true);

    console.log("%c [SYSTEM] 鍏ㄥ眬闃插垏灞忔ā寮忓凡鍚姩 (鏀寔鍐呯綉/澶栫綉) ", "color: white; background: #28a745; font-size: 14px; font-weight: bold;");
})();
