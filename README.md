# B站 QWERG 快捷键禁用（油猴脚本）

只拦 **Q / W / E / R / G** 五个键，防止看视频时误触点赞、投币、收藏、三连、关注。

方向键、空格、F、Esc 等其它快捷键**一律不动**；焦点在输入框 / 弹幕框 / 可编辑区时**放行**，所以评论照样打得出 qwerg。

## 安装（油猴 / Tampermonkey / Violentmonkey）

点下面的链接，脚本管理器会自动弹出安装页：

**https://raw.githubusercontent.com/dtsummery/bilibili-qwerg-blocker/main/bilibili-qwerg-blocker.user.js**

如果直连 raw 打不开（国内常见），用镜像：

- https://gh-proxy.com/https://raw.githubusercontent.com/dtsummery/bilibili-qwerg-blocker/main/bilibili-qwerg-blocker.user.js
- https://gcore.jsdelivr.net/gh/dtsummery/bilibili-qwerg-blocker@main/bilibili-qwerg-blocker.user.js

也可以把 `bilibili-qwerg-blocker.user.js` 下载后直接拖进浏览器窗口。

装好后**刷新 B 站页面**（脚本在 `document-start` 注入，不作用于已打开的页面）。

## 生效标志

打开任意 B 站视频页，右下角会闪一条提示，按 Q 不再点赞。

## 配置

单独关掉某个键：

```js
localStorage["qwerg-disabled"] = {"q":true,"w":true,"e":true,"r":true,"g":true}
```

把对应键设为 `false` 即放行该键。

## 诊断

脚本在页面控制台挂了 `__qwerg`：

```js
__qwerg.diag()   // 最近拦截记录与统计
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
