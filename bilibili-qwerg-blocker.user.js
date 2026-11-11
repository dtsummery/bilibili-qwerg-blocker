// ==UserScript==
// @name         【哔哩哔哩】禁用 Q W E R G 快捷键
// @name:en      Bilibili — Block Q/W/E/R/G
// @namespace    https://github.com/cgy141514/bilibili-qwerg-blocker
// @version      1.2.1
// @description  只拦 Q / W / E / R / G 五个键，防止看视频时误触点赞、投币、收藏、三连、关注。装上即静默生效（默认不显示悬浮窗），输入框内不拦截，方向键与其它快捷键一律不动。
// @description:en  Blocks only Q/W/E/R/G on Bilibili player pages so you never like, coin, favorite, triple-combo or follow by accident. Silent by default (no floating panel); typing in inputs is unaffected.
// @author       cgy141514
// @license      MIT
// @icon         https://static.hdslb.com/images/favicon.ico
// @match        https://www.bilibili.com/*
// @match        https://player.bilibili.com/*
// @match        https://*.bilibili.com/*
// @match        *://*.bilibili.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/**
 * B 站 Q/W/E/R/G 快捷键禁用
 *
 * 只做一件事：这五个键按下时不产生任何效果。
 *
 * 为什么 @grant none
 *   这是本脚本能跑通的前提。带 @grant GM_* 时，Tampermonkey 会把脚本包进沙箱
 *   执行，脚本里的 window / document 是包装过的 Xray 对象，事件监听虽然大多
 *   能用，但一旦管理器版本、隔离模式、CSP 有半点偏差，就会静默失效且很难查。
 *   @grant none 让脚本直接跑在页面主环境，和扩展的 content script 等价
 *   （唯一区别是后者跑在隔离世界，这里跑在主世界），行为可预测得多。
 *
 * 实现要点
 * 1. window 与 document 的捕获阶段双挂载。捕获比页面自身（含播放器）的
 *    冒泡监听早，命中后 preventDefault + stopImmediatePropagation 直接切断
 *    整条传播链，页面收不到事件，长按类快捷键的收尾也一并拦住。
 *    B 站确实在 window 捕获阶段注册过监听（biliMirror），但真正的快捷键
 *    业务逻辑挂在冒泡阶段，所以这里必胜。
 * 2. 焦点在输入框 / 弹幕框 / 可编辑区时放行，否则评论打不出 qwerg。
 * 3. @match 覆盖全部 *.bilibili.com，并把脚本注入 player.bilibili.com 等
 *    播放器 iframe：不注入到 frame 内，焦点一进播放器顶层就收不到键盘事件，
 *    快捷键会「照常生效」。
 * 4. 默认五个键全开，装上立刻生效，不需要先去面板勾选。
 *
 * 存储
 *   localStorage["qwerg-disabled"] = {"q":true,"w":true,"e":true,"r":true,"g":true}
 */
(function () {
    "use strict";

    const VERSION = "1.1.0";
    const IS_FRAME = window.self !== window.top;
    const TAG = "[QWERG]";

    /* ================================================================== *
     * 按键表
     * ================================================================== */
    const KEYS = [
        { id: "q", label: "Q", desc: "点赞 / 取消点赞（长按三连）" },
        { id: "w", label: "W", desc: "投币" },
        { id: "e", label: "E", desc: "收藏" },
        { id: "r", label: "R", desc: "长按一键三连" },
        { id: "g", label: "G", desc: "关注 UP 主" },
    ];

    // e.key 拿不到时的兜底
    const CODE_MAP = { 81: "q", 87: "w", 69: "e", 82: "r", 71: "g" };

    /* ================================================================== *
     * 配置：默认全开
     * ================================================================== */
    // v2：v1 的键曾把配置存成全 false（面板上误点「全部启用」后会一直不拦截），
    // 而 v1.2 起面板默认隐藏、没法再改回来。换键名让旧值失效，回到默认全拦截。
    const STORE_KEY = "qwerg-disabled-v2";
    const LEGACY_STORE_KEYS = ["qwerg-disabled"];
    const state = { q: true, w: true, e: true, r: true, g: true };

    function load() {
        let raw = null;
        try {
            raw = localStorage.getItem(STORE_KEY);
        } catch (e) {
            return; // localStorage 不可用时直接用默认全开
        }
        if (!raw) return;
        try { raw = JSON.parse(raw); } catch (e) { return; }
        if (!raw || typeof raw !== "object") return;
        KEYS.forEach(function (def) {
            if (typeof raw[def.id] === "boolean") state[def.id] = raw[def.id];
        });
    }

    /** 清掉配置并回到全拦截（控制台 __qwerg.reset() 可调）。 */
    function reset() {
        KEYS.forEach(function (def) { state[def.id] = true; });
        try {
            localStorage.removeItem(STORE_KEY);
            LEGACY_STORE_KEYS.forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) { /* 忽略 */ }
        refresh();
        markDom();
        console.log(TAG, "已重置为全部拦截 " + enabledCount() + "/" + KEYS.length);
        return enabledCount();
    }

    function save() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn(TAG, "保存配置失败", e);
        }
    }

    load();

    const enabledCount = () => KEYS.filter(function (d) { return state[d.id] === true; }).length;

    /* ================================================================== *
     * 拦截
     * ================================================================== */

    // 事件落在输入框 / 文本域 / 可编辑区域时视为「正在打字」。
    // 不用 instanceof Element：事件可能来自 iframe / shadow root 等别的 realm，
    // 那种情况下 instanceof 会误判成「不是元素」从而放行。
    function isTyping(e) {
        let node = null;
        if (typeof e.composedPath === "function") {
            const path = e.composedPath();
            if (path && path.length) node = path[0];
        }
        if (!node) node = e.target;
        while (node && node.nodeType === 3 /* TEXT_NODE */) node = node.parentNode;
        if (!node || node.nodeType !== 1 /* ELEMENT_NODE */) return false;
        if (node.isContentEditable) return true;
        if (node.closest && node.closest('[contenteditable=""], [contenteditable="true"]')) return true;
        const tag = node.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    // 归一化成 a-z 里的单个字母；Shift 会得到大写，toLowerCase 抹平
    function keyOf(e) {
        const k = typeof e.key === "string" ? e.key.toLowerCase() : "";
        if (k.length === 1 && k >= "a" && k <= "z") return k;
        return CODE_MAP[e.keyCode] || CODE_MAP[e.which] || null;
    }

    // 页面可能冻结事件对象，逐项单独 try
    function swallow(e) {
        try { e.preventDefault(); } catch (err) { /* 忽略 */ }
        try { e.returnValue = false; } catch (err) { /* 忽略 */ }
        try { e.stopImmediatePropagation(); } catch (err) { /* 忽略 */ }
        try { e.stopPropagation(); } catch (err) { /* 忽略 */ }
    }

    // 诊断：记录最近发生过什么，控制台 __qwerg.diag() 可查
    const stats = { seen: 0, blocked: 0, last: null };

    function onKey(e) {
        if (e.isComposing || e.keyCode === 229) return; // 输入法组合中，跳过

        const k = keyOf(e);
        if (!k || !Object.prototype.hasOwnProperty.call(state, k)) return;

        stats.seen++;
        const inInput = isTyping(e);

        if (state[k] !== true || inInput) {
            stats.last = { key: k, type: e.type, blocked: false, reason: inInput ? "焦点在输入框" : "该键未启用" };
            return;
        }

        swallow(e);
        stats.blocked++;
        stats.last = { key: k, type: e.type, blocked: true, reason: "已拦截", inFrame: IS_FRAME };
    }

    // 捕获阶段挂载：window 先于 document，命中后 stopImmediatePropagation
    // 会把事件完全截停，document 那层根本收不到。
    // 未命中时两层都会拿到同一个事件，用 WeakSet 去重，避免统计翻倍。
    const seenEvents = new WeakSet();

    function guard(e) {
        if (seenEvents.has(e)) return;
        seenEvents.add(e);
        onKey(e);
    }

    ["keydown", "keyup"].forEach(function (type) {
        window.addEventListener(type, guard, true);
        document.addEventListener(type, guard, true);
    });

    /* ================================================================== *
     * 设置面板（只在顶层页面创建，iframe 内只拦截不建面板）
     * ================================================================== */
    const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.box {
  --bg: #ffffff; --fg: #18191c; --sub: #61666d;
  --line: rgba(0, 0, 0, .12); --soft: rgba(0, 0, 0, .05); --hover: rgba(0, 0, 0, .08);
  --accent: #00aeec;
  width: 236px;
  font: 12px/1.6 system-ui, "Microsoft YaHei", "PingFang SC", sans-serif;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .16);
  overflow: hidden; color-scheme: light;
}
.box.dark {
  --bg: #1e2026; --fg: #e7e9ee; --sub: #9aa4b2;
  --line: rgba(255, 255, 255, .14); --soft: rgba(255, 255, 255, .07); --hover: rgba(255, 255, 255, .14);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .5); color-scheme: dark;
}
.hd {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 9px; cursor: pointer; background: var(--soft); user-select: none;
}
.fold { width: 10px; color: var(--sub); font-size: 10px; }
.title { flex: 1; font-weight: 600; white-space: nowrap; }
.sum { color: var(--accent); font-size: 11px; }
.close { color: var(--sub); padding: 0 2px; cursor: pointer; }
.close:hover { color: #ff7a7a; }
.bd { padding: 4px 6px; }
.row {
  display: grid; grid-template-columns: 15px 22px 1fr; gap: 0 7px;
  align-items: center; padding: 3px 5px; border-radius: 5px; cursor: pointer;
}
.row:hover { background: var(--hover); }
.row input { margin: 0; accent-color: var(--accent); cursor: pointer; }
.row .k { font-weight: 700; font-family: ui-monospace, Consolas, monospace; }
.row .d { color: var(--sub); font-size: 11px; }
.ft { display: flex; gap: 6px; padding: 6px 9px 8px; border-top: 1px solid var(--line); }
.btn {
  flex: 1; padding: 4px 0; text-align: center; border-radius: 5px;
  cursor: pointer; background: var(--soft); user-select: none;
}
.btn:hover { background: var(--hover); }
.box.collapsed .bd, .box.collapsed .ft { display: none; }
`;

    let host = null;
    let ui = null;
    const boxes = {};

    function buildPanel() {
        if (host || IS_FRAME) return;
        const parent = document.body || document.documentElement;
        if (!parent) return;

        host = document.createElement("div");
        host.id = "qwerg-blocker";
        host.style.cssText =
            "position:fixed;top:88px;right:20px;z-index:2147483647;" +
            "margin:0;padding:0;border:0;background:transparent;width:auto;height:auto;";

        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML =
            "<style>" + CSS + "</style>" +
            '<div class="box">' +
            '<div class="hd"><span class="fold"></span>' +
            '<span class="title">Q W E R G 禁用</span>' +
            '<span class="sum"></span>' +
            '<span class="close" title="关闭面板（刷新页面可恢复）">✕</span></div>' +
            '<div class="bd"></div>' +
            '<div class="ft"><div class="btn" data-all="1">全部禁用</div>' +
            '<div class="btn" data-all="0">全部启用</div></div>' +
            "</div>";

        ui = {
            box: shadow.querySelector(".box"),
            hd: shadow.querySelector(".hd"),
            fold: shadow.querySelector(".fold"),
            sum: shadow.querySelector(".sum"),
            close: shadow.querySelector(".close"),
            bd: shadow.querySelector(".bd"),
            fts: Array.prototype.slice.call(shadow.querySelectorAll(".btn")),
        };

        KEYS.forEach(function (def) {
            const row = document.createElement("label");
            row.className = "row";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = state[def.id] === true;
            cb.addEventListener("change", function () {
                state[def.id] = cb.checked;
                save();
                refresh();
            });

            const k = document.createElement("span");
            k.className = "k";
            k.textContent = def.label;

            const d = document.createElement("span");
            d.className = "d";
            d.textContent = def.desc;

            row.append(cb, k, d);
            ui.bd.appendChild(row);
            boxes[def.id] = cb;
        });

        ui.hd.addEventListener("click", function (e) {
            if (e) e.stopPropagation();
            ui.box.classList.toggle("collapsed");
            refresh();
        });

        ui.close.addEventListener("click", function (e) {
            e.stopPropagation();
            host.remove();
        });

        ui.fts.forEach(function (btn) {
            btn.addEventListener("click", function () {
                const on = btn.dataset.all === "1";
                KEYS.forEach(function (def) { state[def.id] = on; });
                save();
                refresh();
            });
        });

        applyTheme();
        if (window.matchMedia) {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            if (typeof mq.addEventListener === "function") mq.addEventListener("change", applyTheme);
            else if (typeof mq.addListener === "function") mq.addListener(applyTheme);
        }

        parent.appendChild(host);
        refresh();
    }

    function applyTheme() {
        if (!ui) return;
        const dark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        ui.box.classList.toggle("dark", dark);
    }

    function refresh() {
        if (!ui) return;
        KEYS.forEach(function (def) {
            if (boxes[def.id]) boxes[def.id].checked = state[def.id] === true;
        });
        ui.sum.textContent = enabledCount() + "/" + KEYS.length;
        ui.fold.textContent = ui.box.classList.contains("collapsed") ? "▸" : "▾";
    }

    /* ================================================================== *
     * 启动提示 + 控制台接口
     * ================================================================== */
    function toast() {
        const parent = document.body || document.documentElement;
        if (!parent || IS_FRAME) return;
        const el = document.createElement("div");
        el.style.cssText =
            "position:fixed;right:16px;bottom:16px;z-index:2147483647;" +
            "padding:6px 10px;border-radius:8px;font:12px/1.5 system-ui,sans-serif;" +
            "background:rgba(0,174,236,.95);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);" +
            "cursor:pointer;user-select:none;transition:opacity .3s;";
        el.textContent = "QWERG 已生效 " + enabledCount() + "/" + KEYS.length;
        el.title = "点击关闭；控制台执行 __qwerg.diag() 查看判定详情";
        el.addEventListener("click", function () { el.remove(); });
        parent.appendChild(el);
        setTimeout(function () {
            el.style.opacity = "0";
            setTimeout(function () { el.remove(); }, 300);
        }, 3500);
    }

    window.__qwerg = {
        version: VERSION,
        inFrame: IS_FRAME,
        state: state,
        /** 唤出设置面板（默认不显示；面板一旦建出就常驻到刷新）。 */
        panel: function () {
            if (IS_FRAME) return console.warn(TAG, "iframe 内不建面板");
            buildPanel();
            return host;
        },
        /** 显示一次右下角提示（默认不弹，排查时可手动调）。 */
        toast: toast,
        /** 重置为全部拦截并清掉本地配置（v1 残留的 false 会一并清掉）。 */
        reset: reset,
        /** 本次页面实际拦截次数，用于确认脚本在工作。 */
        stats: stats,
        diag: function () {
            const table = KEYS.map(function (def) {
                return { 键: def.label, 已禁用: state[def.id] === true, 作用: def.desc };
            });
            const out = {
                version: VERSION,
                在iframe里: IS_FRAME,
                已禁用: enabledCount() + "/" + KEYS.length,
                收到相关按键: stats.seen,
                实际拦截: stats.blocked,
                最近一次: stats.last,
            };
            console.log("QWERG", out);
            console.table(table);
            return { seen: stats.seen, blocked: stats.blocked, last: stats.last, state: state, enabled: table };
        },
        probe: function (key) {
            const k = String(key).toLowerCase();
            const known = Object.prototype.hasOwnProperty.call(state, k);
            const out = { key: k, 是否受管: known, 已禁用: known ? state[k] === true : null };
            console.log("probe", out);
            return out;
        },
        set: function (key, on) {
            const k = String(key).toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(state, k)) {
                console.warn("不是受管的键：", k);
                return false;
            }
            state[k] = on === true;
            save();
            refresh();
            return true;
        },
    };

    // DOM 上的可查标记：与扩展版一致，方便统一验证，
    // 也方便在不打开控制台的情况下确认脚本是否注入。
    function markDom() {
        try {
            document.documentElement.setAttribute("data-qwerg", VERSION);
            document.documentElement.setAttribute("data-qwerg-keys", enabledCount() + "/" + KEYS.length);
        } catch (e) { /* 忽略 */ }
    }

    setInterval(function () {
        try {
            document.documentElement.setAttribute(
                "data-qwerg-stat",
                "seen=" + stats.seen + ";blocked=" + stats.blocked +
                ";last=" + (stats.last ? stats.last.key + ":" + (stats.last.blocked ? "blocked" : stats.last.reason) : "-")
            );
        } catch (e) { /* 忽略 */ }
    }, 1000);

    /* ================================================================== *
     * 启动
     * ================================================================== */
    function boot() {
        markDom();
        if (IS_FRAME) return; // iframe 内只拦截，不建面板不弹提示
        // 默认静默生效：不建悬浮窗、不弹提示。五个键开箱即全部拦截，
        // 需要单独关掉某个键时在控制台执行 __qwerg.panel() 唤出面板。
    }

    // document-start 时 body 还不存在，两种时机都要覆盖
    if (document.body) {
        boot();
    } else {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    }
    // body 可能被 SPA 路由重建，兜一层（只刷新 DOM 标记，不重建面板）
    window.addEventListener("load", markDom, { once: true });

    console.log(TAG, "v" + VERSION + (IS_FRAME ? " (iframe)" : "") +
        " 已就绪 " + enabledCount() + "/" + KEYS.length +
        "（静默模式，无悬浮窗）；__qwerg.panel() 唤出设置面板，__qwerg.diag() 查看判定详情");
})();
