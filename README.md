# B站快捷键禁用（油猴脚本）

禁用 B 站播放器**除方向键与 Esc 外的全部快捷键**，防止看视频时误触点赞、投币、收藏、三连、关注、弹幕开关、静音、全屏、倍速、多P 切换。

**装上即静默生效**：默认不显示悬浮窗、不弹提示，不需要任何配置。

## 拦什么 / 留什么

| 拦截 | 覆盖的 B 站功能 |
|---|---|
| 字母键 | Q 点赞 · W 投币 · E 收藏 · R 三连 · G 关注 · F 全屏 · M 静音 · D 开关弹幕 |
| 数字键 | Shift+1 / Shift+2 / Shift+3… 倍速 |
| 符号键 | `[` 多P 上一个 · `]` 多P 下一个 |
| 空格 | 播放 / 暂停 |
| 回车 | 发弹幕 |
| 媒体键 | 键盘上的 play/pause |

| 放行 | 原因 |
|---|---|
| ← ↑ → ↓ 方向键 | 用户要求保留 |
| Esc | 用户要求保留 |
| Ctrl / Alt / Meta 组合键 | 否则 Ctrl+C、Ctrl+W、Alt+Tab 全废 |
| F1–F12、Tab | 浏览器功能键，拦掉页面就没法操作了 |
| 焦点在输入框 / 弹幕框 / 可编辑区 | 否则评论打不出字 |
| 输入法组合中 | 否则中文输入被打断 |

## 安装

点开即触发油猴安装页：

```
https://gcore.jsdelivr.net/gh/dtsummery/bilibili-qwerg-blocker@main/bilibili-qwerg-blocker.user.js
```

镜像备用：

```
https://testingcf.jsdelivr.net/gh/dtsummery/bilibili-qwerg-blocker@main/bilibili-qwerg-blocker.user.js
https://gh-proxy.com/https://raw.githubusercontent.com/dtsummery/bilibili-qwerg-blocker/main/bilibili-qwerg-blocker.user.js
```

> `raw.githubusercontent.com` 直连有 CDN 缓存延迟，版本号可能滞后几分钟。

装好后 **Ctrl + Shift + R 强制刷新** B 站页面（脚本在 `document-start` 注入，不作用于已打开的页面）。

## 两层拦截

1. **捕获阶段截停**：在 `window` / `document` 的捕获阶段挂监听，命中后 `preventDefault` + `stopImmediatePropagation`
2. **短路站方 handler**：劫持 `EventTarget.prototype.addEventListener`，站方每次注册 `keydown` / `keyup` / `keypress` 时塞一个前置判断，命中就不调它的 handler

第 2 层是为「统计显示拦住了、视频照样响应」这种情况加的 —— B 站部分播放器组件会抢注册 window 捕获监听，只靠第 1 层时它的 handler 已经先跑完了。有了第 2 层，不再依赖注册顺序。

## 验证

```js
__qwerg.version     // '1.5.0'
__qwerg.stats       // { seen, blocked, last }
```

按几个键后 `seen` / `blocked` 应同步增长。

页面 `<html>` 上还有每秒刷新的属性，不开控制台也能看：

```html
<html data-qwerg="1.5.0" data-qwerg-keys="6/6" data-qwerg-stat="seen=12;blocked=12;short=12;last=q:blocked">
```

- `seen` — 收到几个受管按键
- `blocked` — 第 1 层拦了几次
- `short` — 第 2 层短路站方 handler 几次

## 按需调整

```js
__qwerg.panel()                    // 唤出面板（面板建出后常驻到刷新）
__qwerg.diag()                     // 打印统计与各类别状态
__qwerg.probe('q')                 // 查某个键归到哪类、会不会被拦
__qwerg.set('letters', false)      // 放行全部字母键（其余照旧）
__qwerg.set('letters', true)       // 恢复拦截
__qwerg.reset()                    // 全部恢复启用并清配置
```

类别 id：`letters` / `digits` / `symbols` / `space` / `enter` / `media`

配置存在 `localStorage["qwerg-disabled-v3"]`：

```js
{"letters":true,"digits":true,"symbols":true,"space":true,"enter":true,"media":true}
```

`true` = 拦截，`false` = 放行。

## 来源与许可

- 上游项目：**[cgy141514/bilibili-qwerg-blocker](https://github.com/cgy141514/bilibili-qwerg-blocker)**
- 原作者：cgy141514
- 许可：MIT
- 本仓库版本：1.5.0（已按需求改为「除方向键和 Esc 外全拦」+ 静默 + 加强层）

本仓库仅作个人安装与分发副本，版权归原作者所有。