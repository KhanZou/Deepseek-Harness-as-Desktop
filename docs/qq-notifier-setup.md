# 用 QQ 打通 DSH 的出站通知 + 入站远程对话（dsh-notifier 实操）

> 适用：DSH Web（`dsh web`）+ `dsh-notifier` 插件。本文记录一次真实可用的配置过程，含踩坑点，可直接照做复用到其它电脑。
> **不要**把 `appSecret` / 管理台 token 提交进仓库——本文全部用占位符。

## 0. 为什么选 QQ（而不是微信）

`dsh-notifier` 的能力矩阵里，六个入站通道是 `telegram / feishu / qq / wxpusher / wechat / dingtalk`：

| | 微信个人号 | **QQ 官方机器人** |
|---|---|---|
| 出站（推给你） | ❌ 无出站适配器（必须另配 PushPlus/Server酱/企微） | ✅ `qq-bot` |
| 入站（你发命令 / 审批） | ✅ 扫码授权（long-poll） | ✅ `qq`（WS 长连接，**无需公网**） |
| 审批按钮 | ❌ 只能回 `1`/`2` | ✅ **单聊原生审批键盘** |
| 提问选项卡 | ❌ 编号回复 | ✅ 单聊选项卡片（点一下即答） |
| 费用 | 出站需付费/额度 | ✅ 免费 |
| 稳定性 | ⚠️ 源码标注 `realDeviceVerified: false`（个人号有风控） | 官方机器人协议 |

结论：**要"两边都在同一个 App 里、免费、还能点按钮"→ 选 QQ。**

## 1. 前置条件

- DSH 已跑起来：`dsh web`（本文以 `D:\deepseek-harness` 为例，profile = `web`）
- 插件已安装：
  ```powershell
  cd /d D:\deepseek-harness
  corepack pnpm dsh plugin --profile web add dsh-notifier
  ```
- ⚠️ **pnpm 11 的构建脚本放行**：安装时若报 `ERR_PNPM_IGNORED_BUILDS`（如 `node-pty`、`protobufjs`），在 profile 的 `pnpm-workspace.yaml` 里放行（pnpm 11 已不再读 package.json 的 `pnpm.onlyBuiltDependencies`）：
  ```yaml
  # %USERPROFILE%\.dsh\profiles\web\pnpm-workspace.yaml
  allowBuilds:
    node-pty: true
    protobufjs: true
  ```
  然后重跑 `corepack pnpm dsh plugin --profile web install`（会构建并把插件写进 `dsh.profile.bundles`）。

## 2. 在 QQ 开放平台创建机器人

1. 打开 <https://q.qq.com>，用 QQ 扫码登录，创建「**机器人**」应用。
2. 在「开发设置」里记下 **AppID** 与 **AppSecret**。
3. 按平台要求开启机器人能力（尤其：**单聊主动消息**权限，否则出站发送会报错）。
4. 把机器人加为你的 QQ 好友（在开放平台里配置/发布测试范围）。

## 3. 固定管理台 token 并打开管理台

管理台是配渠道的地方（仅绑 `127.0.0.1`）。给它一个**固定 token**，免得每次重启都要看一次性启动链接：

```yaml
# %USERPROFILE%\.dsh\profiles\web\cordis.patch.yml
- id: dsh-notifier
  config:
    admin:
      enabled: true
      token: <自己设一个随机串>
```

重启后打开：

```
http://127.0.0.1:8104/#token=<上面那个 token>
```

> 不设 token 时：首次启动会在日志打印一次性首访链接；丢了就删 `state.json` 里的 `admin:token-hash` 再重启重新生成。

## 4. 配「入站 QQ」（先做这步）

管理台 →「通知渠道」→ **QQ（入站）** 卡片：

- 方式 A：点 **「扫码授权」**（页面出二维码，手机 QQ 扫一下，凭证自动写入）——若该流程不可用，用方式 B。
- 方式 B：**手动填 `appId` + `appSecret`**（与出站同一套凭证）→ 保存。

凭证落在插件状态文件（键 `qq:account`）：

```
%USERPROFILE%\.dsh\dsh-notifier\state.json
```

**保存后必须重启一次 DSH**（入站连接在启动时组装）。重启日志出现下面这行即成功：

```
[dsh-notifier] inbound 已启动：qq WebSocket 网关（文本审批通知 + 编号回复裁决）
[dsh-notifier/inbound:qq] QQ 网关已就绪（session ...）
```

## 5. 配「出站 QQ」（`qq-bot`）

管理台 →「通知渠道」→ **QQ 机器人（qq-bot）** 卡片，填四个字段：

| 字段 | 填什么 | 说明 |
|---|---|---|
| `appId` | 机器人 AppID | 与入站同一套 |
| `appSecret` | 机器人 AppSecret | 与入站同一套 |
| `targetType` | **`user`** | ⚠️ 必须是**精确的小写 `user`**（单聊）。留空会**默认按群聊**处理 → 报 `groupId 未填写` |
| `userId` | **你的 openid** | ⚠️ **不是 QQ 号**！形如 `0123ABCD4567EF890123ABCD4567EF89` |

`userId`(openid) 怎么拿：见下一步（私聊机器人 → 插件回报你的身份）。

群聊推送则：`targetType = group` + `groupId = <群 open id>`（机器人入群后 @ 它一次即可在事件里拿到）。

## 6. 配对：把"你的 QQ"绑成 owner

1. 取配对码：管理台「成员」页铸一枚，或读宿主生成的文件
   ```
   %USERPROFILE%\.dsh\dsh-notifier\bootstrap-paircode.txt
   ```
   （**10 分钟有效**，过期重新铸）
2. **用 QQ 私聊机器人**，发送：
   ```
   /pair <配对码>
   ```
   首位绑定者成为 **owner**。
3. 发送任意消息（或 `/whoami`），机器人会回报你的 **QQ 身份（openid）**，例如：
   ```
   你的QQ身份是 0123ABCD4567EF890123ABCD4567EF89
   ```
   把它填回第 5 步的 `userId`。
4. ⚠️ **必须私聊**：群里只有 @机器人 才送达，且配对不能在群里做。

## 7. 开启「远程对话」（converse）

`dsh-notifier` 的策略默认值：

```js
observe: true, approve: true, stop: true,   // 默认开
converse: false,                            // ← 远程对话默认关，必须显式开
groupChatControl: false                     // 群聊控制默认关（建议保持）
```

不开启时，在 QQ 里发普通文本会收到：

```
远程对话默认关闭，请在 session policy 中显式开启
```

**开启方式（二选一）**

- **基线（推荐，所有会话生效）** —— 写进 profile 的 `cordis.patch.yml`：
  ```yaml
  - id: dsh-notifier
    config:
      admin: { enabled: true, token: <管理台 token> }
      inbound:
        control:
          capabilities:
            converse: true
  ```
  改完**重启 DSH**。
- **单会话覆盖** —— 管理台 → 顶部「打开高级设置」→「会话」页 → 选会话 → 打开 `converse`（写入 `route:sessions.<id>.control`，不重启即生效）。

## 8. 验证

```powershell
# 出站自检（管理台 API，token 换成你自己的）
curl.exe -X POST "http://127.0.0.1:8104/api/channels/outbound/qq-bot/test" ^
  -H "Authorization: Bearer <管理台 token>"
# 期望：{"ok":true,"channel":"qq-bot","detail":"已发送测试消息，请到客户端确认收到"}
```

QQ 里再试：
- `/whoami` → 看身份与绑定状态
- `/status` → 看会话进度
- 直接发一句普通文本 → 应该作为任务发给 agent（不再是"远程对话默认关闭"）

## 9. 日常用法（都在 QQ 里）

| 你在 QQ 里做 | 效果 |
|---|---|
| 直接发文本 | 给 agent 下新任务（followup） |
| `! 改成方案B` | 任务中途纠偏（steer） |
| 点审批按钮 / 回 `1`（允许一次）、`2`（拒绝） | 远程审批（沉默永不批准） |
| 点选项卡 / 回编号 | 回答 agent 的提问 |
| `/status` `/stop` `/quiet` `/help` `/agent` `/route` | 状态、停止、静音、帮助等 |

出站侧：每轮 `turn/end`、`agent/error`、`approval/asked` 都会自动推送到 QQ；长任务还有心跳与"疑似卡住"提醒。

## 10. 本次踩过的坑（排错速查）

| 现象 | 原因 | 修法 |
|---|---|---|
| `qq-bot 未配置：groupId（群 open id…）未填写` | `targetType` 缺省时按 **group** 处理 | 填 `targetType: user` |
| 同上，但明明填了 user | 值被存成了带引号的字面量 `"user"`（多了引号） | 改成裸值 `user` |
| `qq-bot 返回 HTTP 400 {"message":"请求的资源不存在(用户/群已注销)"}` | `userId` 填的是 **QQ 号**，而接口要 **openid** | 用第 6 步拿到的 openid 替换 |
| 配好渠道但没生效 | 入站连接/投递层在启动时组装 | **重启 DSH**（管理台"测试发送"不受此限） |
| 安装插件时报 `ERR_PNPM_IGNORED_BUILDS` | pnpm 11 默认不跑依赖构建脚本 | 见第 1 节的 `pnpm-workspace.yaml` → `allowBuilds` |
| QQ 机器人不应答 | 未配对 / 在群里发（未 @）/ 会话过期 | 私聊发 `/pair`；群里 @机器人 |

## 11. 已知问题

- **远程提问（agent 反过来问你选择题）在当前 DSH 版本装配失败**，日志：
  ```
  [dsh-notifier] questions 桥装配失败，已跳过（其余能力不受影响）:
    cannot get property "userQuestions" without inject
  ```
  原因：宿主（DSH 0.1.6-alpha.1）的 `userQuestions` 服务注入方式与插件期望不一致。**通知 / 远程对话 / 远程审批不受影响**。
- 插件作者公告：**2026-10-01 前在考试期**，issue/PR 回复会延迟。

## 12. 多台电脑复用

1. **插件**：每台机器执行第 1 节安装命令（或直接复用你私有的 profile 配置）。
2. **凭证**：同一个 QQ 机器人可在多台机器复用同一 `appId`/`appSecret`；但**每台机器要各自做配对**（openid 相同，配对是机器本地的白名单）。
3. **配置片段**：把第 3、7 节的 `cordis.patch.yml` 片段复制过去（token 可各机不同），重启即可。
4. `state.json`（含渠道凭证/配对/路由）在 `%USERPROFILE%\.dsh\dsh-notifier\`，**不要提交进任何仓库**。
