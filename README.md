# B站 QWERG 快捷键禁用（油猴脚本）

只拦 **Q / W / E / R / G** 五个键，防止看视频时误触点赞、投币、收藏、三连、关注。

方向键、空格、F、Esc 等其它快捷键**一律不动**；焦点在输入框 / 弹幕框 / 可编辑区时**放行**，所以评论照样打得出 qwerg。

**装上即静默生效**：默认不显示悬浮窗、不弹提示，五个键开箱就是全部拦截，不需要任何配置。

## 安装（油猴 / Tampermonkey / Violentmonkey）

点下面的链接，脚本管理器会自动弹出安装页：

**https://raw.githubusercontent.com/dtsummery/bilibili-qwerg-blocker/main/bilibili-qwerg-blocker.user.js**

如果直连 raw 打不开（国内常见），用镜像：

- https://gh-proxy.com/https://raw.githubusercontent.com/dtsummery/bilibili-qwerg-blocker/main/bilibili-qwerg-blocker.user.js
- https://gcore.jsdelivr.net/gh/dtsummery/bilibili-qwerg-blocker@main/bilibili-qwerg-blocker.user.js

也可以把 `bilibili-qwerg-blocker.user.js` 下载后直接拖进浏览器窗口。

装好后**刷新 B 站页面**（脚本在 `document-start` 注入，不作用于已打开的页面）。

## 生效标志

打开任意 B 站视频页，按住 Q 不再点赞即为生效。**页面上不会出现任何悬浮窗或提示**。

## 配置

默认五个键全部拦截，不需要做任何事。

### 唤出设置面板（可选）

控制台执行：

```js
__qwerg.panel()   // 显示面板；面板建出后会常驻到刷新
```

### 单独关掉某个键

```js
localStorage["qwerg-disabled"] = {"q":true,"w":true,"e":true,"r":true,"g":true}
```

把对应键设为 `false` 即放行该键（`true` = 禁用 / 拦截）。

## 诊断

```js
__qwerg.diag()    // 打印拦截统计与每个键的状态
__qwerg.state     // 当前 state（true = 已禁用）
__qwerg.toast()   // 手动弹一次右下角提示，排查用
```

## 匹配范围

```js
@match  https://www.bilibili.com/*
@match  https://player.bilibili.com/*
@match  https://*.bilibili.com/*
@match  *://*.bilibili.com/*
@run-at document-start
@grant  none
```

## 来源与许可

- 上游项目：**[cgy141514/bilibili-qwerg-blocker](https://github.com/cgy141514/bilibili-qwerg-blocker)**
- 原作者：cgy141514
- 许可：MIT
- 本仓库版本：1.1.0（原样保存，未改动逻辑）

本仓库仅作个人安装与分发副本，版权归原作者所有。
