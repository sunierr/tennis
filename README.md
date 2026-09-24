# Match Point

网球约球 MVP：**发布约球信息，帮助水平相近的球友组队**。

- 前端：Vue 3 + Vite + Pinia + vue-router（`apps/web`）
- 后端：Node.js + Express 5 + Prisma + MySQL（`apps/server`）
- 实时通道：`ws` 挂在同一个 HTTP server 的 `/ws`（只做服务端推送，发消息仍走 HTTP）
- 平台无关层：`packages/shared`（类型 / 水平匹配算法 / HTTP 核心 / 接口定义 / 时间窗）
- 登录只用账号 + 密码，不接入验证码
- 后期以 uni-app 迁移为微信小程序，见下方「uni-app 迁移清单」

功能范围：发现（列表 + 筛选 + 推荐排序）→ 发布约球 → 报名 / 退出 → 球局详情 → 群聊与单聊 → 社区（发帖 / 多图 / 标签 / 点赞 / 评论）。

## 环境准备

```bash
brew services start mysql
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS match_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

安装依赖（三个包各自独立安装，**不使用 npm workspaces**）：

```bash
cd apps/server && npm install
cd ../web && npm install
cd ../../packages/shared && npm install
```

配置环境变量：把 `apps/server/.env.example` 复制为 `apps/server/.env`。`JWT_SECRET` 至少 32 位，缺失或过短会直接启动失败（`src/env.ts` 用 zod 校验）。

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | MySQL 连接串 |
| `JWT_SECRET` | 是 | 至少 32 位 |
| `PORT` | 否 | 默认 3000 |
| `CORS_ORIGIN` | 否 | 逗号分隔白名单；不填允许所有来源（开发方便，生产必须填） |
| `PUBLIC_BASE_URL` | 否 | 上传图片的对外基地址，默认 `http://localhost:3000`。**必须是绝对地址**，见下方「图片上传」 |

初始化数据库（schema 位于 `apps/server/prisma/`）：

```bash
npm run prisma:migrate     # npx prisma migrate dev
npm run prisma:generate
npm --prefix apps/server run seed   # 灌测试种子（清库重建：12 张业务表全清）
```

种子账号：`seedhost`（阿发，3.5 级，所有球局与动态的发起人）、`seedviewer`（小球友，3.0 级，部分球局的报名者），密码统一 `passw0rd`。种子含 6 场球局、3 条社区动态（带图与标签）、每场球局一个群聊及若干消息。

启动：

```bash
npm run dev:server   # http://localhost:3000
npm run dev:web      # http://localhost:5173（/api 已代理到 3000）
```

其他脚本：

```bash
npm run test:shared   # 共享包单测（node --test + tsx）
npm run typecheck     # shared / server / web 三处类型检查
npm run build:web     # 前端产物
```

## 水平体系（核心）

- 自评水平用 **NTRP 1.0 - 7.0，0.5 一档**，**存储为 ×10 整数**（`levelTenths`，10-70）：不用 Float（比较/区间/排序不可靠），不用 String（无法查询排序）。整数十分位天然支持「±0.5 级容差 = ±5」。
- 用户自评是**单值**；约球的水平要求始终是**区间** `[levelMinTenths, levelMaxTenths]`（单值场景令 min === max），因为「3.0 左右都行」是主流需求。
- 匹配三段式：区间距离（`shared/level/fit.ts`）→ Prisma 硬过滤（±5 = ±0.5 级）→ 服务端 JS 排序（`recommendScore`：水平 .6 / 时间 .25 / 成局度 .15）。排序放在 JS 而非 SQL，是为了可单测、可三端复用。
- 档位文案（入门/休闲/进阶/竞赛）与 `levelLabel`、`isFull`、`tags`、`participantsLevelAvg`、`levelFit` 都是**派生字段，不落库**，由纯函数从基础字段算出。
- 时间窗（今天/明天/本周末/本周）**固定按 Asia/Shanghai 计算**，不使用服务器本地时区——`weekend` 这类依赖星期的窗口最容易「本地对、上线错」，逻辑收口在 `shared/time/range.ts` 并已有单测。

## 接口约定

- 成功直接返回资源或分页对象 `{ items, total, page, pageSize, hasMore }`；错误统一 `{ code, message, details? }`，`message` 是可直接展示的中文。
- 错误码：`400 VALIDATION_ERROR` / `401 UNAUTHORIZED` / `403 FORBIDDEN` / `404 NOT_FOUND` / `409 ACCOUNT_EXISTS|ALREADY_JOINED|MATCH_FULL|MATCH_NOT_OPEN` / `429 RATE_LIMITED` / `500 INTERNAL_ERROR`（不泄漏堆栈）。
- 鉴权：`Authorization: Bearer <jwt>`，payload `{ sub: userId }`，30 天有效。
- 响应**绝不含** `account` / `password` / `creatorId`；约球里的发起人只暴露 `{ id, nickname, levelTenths, city }`，由 serializer 白名单强制。
- `fee` 是 `Decimal(10,2)` 且**可空**，serializer 必须转换后再返回（否则前端拿到 `"60.00"` 字符串）；`null` 只出现在「其他」费用且发起人没写金额时。
- **`capacity` 统计的是「含发起人的总人数」**：发起人在创建时就被写入一条 `MatchParticipant(status: JOINED)`，因此 `participantCount`、`participantsLevelAvg`、卡片头像叠层都包含他；`isFull = participantCount >= capacity`，`spotsLeft = capacity - participantCount`。人数上限由**赛制**决定（`SINGLES` 2 / `DOUBLES` 4 / `TRAINING` 由发布者选 2-6），前端传的 `capacity` 只对 `TRAINING` 生效。
- 费用三态 `feeType`：`TREAT`（我请客，`fee` 恒 0）/ `AA`（`fee` 必填且 > 0，缺了返回 400）/ `OTHER`（`fee` 可空，以 `notes` 为准）。列表的 `free=true` 筛选映射的是 `feeType = TREAT`（「免费场」= 有人请客），不是 `fee = 0`。
- 报名的重复校验靠发起人那条占位行：已存在 `JOINED` 参与者行（含发起人自己）一律 `409 ALREADY_JOINED`；发起人的名额不能单独退出（`400`），要撤销整场请走 `POST /api/matches/:id/cancel`。
- `POST /api/matches/:id/cancel` 不接收取消理由：数据模型里没有 `cancelReason` 字段，先不接收以免「收了却丢掉」。
- 报名的并发一致性：`prisma.$transaction` 内对 MatchPost 行加 `FOR UPDATE` 锁，再校验状态/超员，最后用 `upsert` 复用被软取消的行（`@@unique([matchId, userId])` 作第二道防线）。

### 聊天

- **实时是加速，HTTP 才是正确性来源**：WS 只做服务端 → 客户端单向推送，发消息仍走 `POST /api/conversations/:id/messages`（一套鉴权、一套错误码、一套幂等，避免双份校验逻辑漂移）。
- 握手鉴权走 query（浏览器 WebSocket 构造函数不能自定义 header）：`/ws?token=<jwt>`；服务端校验 JWT 后还要校验**会话成员身份**（`leftAt IS NULL`），非组员连不上。日志里不打印 query 中的 token。
- 心跳 30s ping/pong；客户端断线按 1s→2s→4s…30s 封顶的指数退避重连，重连成功后用 `afterId` 补拉缺口。
- 消息增量拉取参数：首屏不带参（取最近 `limit` 条）→ 向上翻页带 `beforeId` → 断线追赶带 `afterId`；一律按 `id` 升序返回。
- 成员资格以 `leftAt` 是否为空判断（为空才算组员）。退出报名置 `leftAt` 而不是删行：重新报名可清空恢复，历史消息的发送者身份也留得住。
- 单聊靠 `pairKey`（`minId:maxId`）幂等 upsert —— 连点两次私聊只产生一个会话，不会刷出一堆空会话。群聊靠 `Conversation.matchId @unique` 保证「一场球只有一个群」。
- 未读用「消息 `id` > `lastReadMessageId`」算，不用时间戳（同秒多条会漏读）；计数只统计他人发送的消息，游标只前进并做 clamp。

### 社区

- 删帖是**软删**（`status = DELETED`），行保留、信息流按 `status = ACTIVE` 过滤，作者删完立刻从流里消失且详情返回 404（仅作者可删，他人 403）。
- 点赞数 / 评论数**不落库**，由 Prisma `_count` 现算；点赞用 `upsert` 保证连点幂等，取消点赞用 `DELETE`（重复取消不报错）。
- 同一用户 **60 秒 1 帖**（`429 RATE_LIMITED`）。判据是「查该作者最近一帖的 `createdAt`」而不是内存计数器 —— 多实例安全。
- 标签最多 3 个，以中文 `name` 直接做唯一键（不引入 slug），按 `name` upsert 后连 `PostTag`。热门标签用 `_count` 排序且只数 `ACTIVE` 帖子 —— 否则软删的帖子会把用户带进空流。
- `Tag.postCount` 冗余计数**建了但不写入**：当前用 `_count` 排序已够，预留给将来的性能优化，不提前背双写一致性的负担。
- `PostStatus.HIDDEN` 是预留位，本期不做审核后台。

### 图片上传

- `POST /api/uploads`：multipart 单文件，字段名 `file`，**≤ 5MB**、仅 `jpg/png/webp`，返回 `{ url, width?, height? }`。
- 存储走本地磁盘 `apps/server/uploads/` + `express.static` 挂在 `/uploads`（`maxAge 7d`；文件名是 UUID，内容不可变所以敢长缓存）。该目录启动时自动创建，已写进 `.gitignore`。
- **返回给前端的必须是绝对 URL**（`PUBLIC_BASE_URL` 拼接）——小程序 `<image>` 没有「当前域名」概念，相对路径 `/uploads/x.jpg` 加载不出来。
- 文件名由服务端用 `randomUUID()` 生成，**不接受客户端传来的名字** —— 从根上杜绝路径穿越，也避开中文名/空格的兼容问题。
- 宽高由服务端在落库时量（客户端只回传 `url`，尺寸不让前端说了算），用于前端按真实比例撑开占位、图片加载时不跳高；量不出来（损坏/非图片）不影响上传成功，前端退化成固定比例。
- 迁移 OSS 时只需重写 `apps/server/src/storage/index.ts` 这一个文件 + 跑一次数据搬迁：数据库只存 URL，不含任何本地路径假设。

## 目录结构

```
packages/shared/src        平台无关层：迁移小程序时 100% 复用
  types/                   enums / user / match / chat / post / api
  level/                   ntrp.ts（十分位↔显示）  fit.ts（距离 / 契合度 / 推荐分）
  time/                    range.ts（时间窗）  format.ts（展示与 datetime-local 互转）
  http/                    types.ts（HttpAdapter / PlatformStorage）  client.ts
  api/endpoints.ts         createApi(http) —— 路径字符串只在此处出现
apps/server/src            分层后端：env / db / lib / middleware / serializers / modules
  modules/                 auth / users / matches / conversations / posts / tags / uploads
  storage/index.ts         全站唯一的文件存储接触点（本地磁盘 ↔ 将来 OSS）
  realtime/gateway.ts      ws 网关：握手鉴权 / 订阅表 / 心跳 / 广播
  serializers/             出参白名单：实体 → 前端可见字段
apps/web/src               platform(平台适配) / api / stores / router / components / pages / styles
  platform/                http.ts / storage.ts / navigation.ts / realtime.ts / upload.ts / env.ts
apps/server/uploads/       上传的图片（不进版本库，见 .gitignore）
design/prototype.html      视觉基准（不参与构建，token 值取自它的 :root）
```

共享包用**源码直连**（`@shared` alias + tsconfig `paths` 指向 `../../packages/shared/src`），不启用 workspaces：零重装、零构建步骤，uni-app（同为 Vite 工程）可复用同一 alias。代价是 server 将来若需要 `tsc` 产物，要把 `rootDir` 调到 `../..` 并同步改 `start` 脚本；MVP 阶段 server 只跑 `tsx`，暂不兑现。

## uni-app 迁移清单

| 类别 | 内容 | 迁移动作 |
|---|---|---|
| 100% 复用 | `packages/shared/**`（类型、水平算法、http client、endpoints、时间窗） | 不动，只加 alias |
| 100% 复用 | `styles/tokens.css`（值改 rpx）、`stores/**`（Pinia 无 DOM 依赖） | 复制 + 改单位 |
| 重写（约 30 行） | `platform/http.ts`（→ `uni.request`）、`storage.ts`（→ `uni.getStorageSync`）、`navigation.ts`（→ `uni.navigateTo`） | 新增 `.uni.ts` 实现 |
| 重写（约 40 行） | `platform/upload.ts` + `http.ts` 的 `postForm`（→ `uni.uploadFile`）、`platform/realtime.ts`（→ `uni.connectSocket`） | 新增 `.uni.ts` 实现 |
| 重写（主要工作量） | `pages/**`、`components/**`：`div → view`、`span → text`、`img → image`、input 事件签名差异 | 逐页移植 |
| 配置替换 | `router/index.ts` → `pages.json`；`vite.config.ts` → uni 插件 | 手工 |
| 配置替换 | 底部导航 → `pages.json` 的 `tabBar`（5 槽、`midButton` 承载中间的「发布」凸起按钮） | 手工，见 `AppTabBar.vue` 与 `routes.ts` 的 `meta.tab` |
| 平台差异 | 聊天页键盘顶起：web 靠 `calc(100vh - var(--topbar-height))` 的 flex 列布局把输入框压在底部；小程序里键盘弹起不改 `100vh`，要换 `adjust-position` / `uni.onKeyboardHeightChange` | 只改 `ChatPage.vue` 的布局层 |
| 协议约束 | 实时通道要 `wss://` 合法域名（开发期开发者工具可勾选「不校验合法域名」）；轮询不保留，`afterId` 补拉逻辑原样复用 | 服务端配证书 |

**现在就遵守的七条收口**（迁移就绪度的验收标准，已全量 grep 确认）：

1. `axios` 只出现在 `apps/web/src/platform/http.ts`
2. `localStorage` 只出现在 `apps/web/src/platform/storage.ts`
3. `router.push/replace` 只出现在 `apps/web/src/platform/navigation.ts`（其余页面用 `go(name, params)` / `goPath(path)`，用路由 name 不用 path；`switchTab` 内部用 `replace`，避免 tab 来回切把历史栈堆深）
4. `type="datetime-local"` 只出现在 `apps/web/src/components/ui/BaseDateTime.vue`（小程序完全没有这个控件，迁移时换 `<picker mode="date"> + <picker mode="time">`）
5. `/api` 前缀只在 `packages/shared/src/api/endpoints.ts` 定义一处
6. **文件上传**只在 `apps/web/src/platform/upload.ts`（`FormData` 的构造在此，multipart 发送在 `http.ts` 的 `postForm`）
7. **WebSocket** 只在 `apps/web/src/platform/realtime.ts`（页面只调 `subscribe()`，不直接碰 `new WebSocket`）

**其他已做的迁移准备**

- 尺寸/间距/圆角只允许引用 token（`styles/tokens.css`），组件里不散写字面数值——迁移时改这一个文件即可整体切 rpx。
- 关键布局不用 `clamp()` / `max()` / `100vw`；顶栏 `backdrop-filter` 用 `@supports` 包裹并配实色兜底，`position: sticky` 也不是唯一手段。
- 登录态只存 token（key 仍是 `match_point_token`），用户信息以 `GET /users/me` 为唯一真相源——不把昵称当会话状态存。
- 详情页参数只传 `id`，其余从接口取（小程序只能传 query string）。
- 前端产物里**没有任何随包图片资源**：网球 logo 与全部图标都是 CSS / 内联 SVG 绘制，迁移天然极低。社区与聊天里的图片都来自用户上传（存绝对 URL），迁移时 `img → image` 即可。

## 已知取舍

- 自评水平必然有人虚报。MVP 用纯自评（UI 上标注「自评水平」），但落库 `levelAtJoinTenths` 快照让「队内均水平」可回溯，将来若切换到赛后互评校准不会返工。
- 列表候选集靠「城市 + 默认 30 天时间窗 + 水平区间」硬过滤压到单城市几百条量级；service 有候选上限保护。单城市 OPEN 局稳定超过 2000 条时应考虑换成 SQL 排序。
- **图片存本地磁盘**：单机 MVP 完全够用，代价是换机器或多实例会丢图。将来换 OSS 只改 `apps/server/src/storage/index.ts` + 跑一次数据搬迁，因为数据库只存 URL、不含本地路径假设。
- **多实例广播未做**：WS 的订阅表是单进程内存 `Map`，部署多实例时必须先补 Redis pub/sub，否则 A 实例发的消息推不到连在 B 实例上的用户。这是已知限制，不是 bug —— 单实例部署不受影响。
- **社区内容风险**：开放发帖必然带来垃圾内容与违规图片。MVP 的最小对策是「限流（同用户 60 秒 1 帖）+ `PostStatus.HIDDEN` 预留 + 上传类型/大小白名单」，不做敏感词系统与人工审核后台（那是运营工具，不是 MVP 的活儿）。
- **标签的两种建模**：`Tag.postCount` 冗余计数能换「热门标签」的高效排序，但引入双写一致性负担。当前用 `_count` 排序、`postCount` 只建不写，避免为一个未验证的性能问题提前背负担。
- 约球编辑与结束（`PATCH /matches/:id`、`POST /matches/:id/finish`）本期未实现。