<h1 align="center">安徽广电文旅政策咨询智能体</h1>

<p align="center">
  基于RAG架构的专业政策咨询AI智能体，由安徽广电AIGC实验室与合肥生成式人工智能共同开发。
</p>

<p align="center">
  <a href="#功能特性"><strong>功能特性</strong></a> ·
  <a href="#技术架构"><strong>技术架构</strong></a> ·
  <a href="#本地运行"><strong>本地运行</strong></a> ·
  <a href="#vercel-一键部署"><strong>Vercel 部署</strong></a> ·
  <a href="#项目结构"><strong>项目结构</strong></a> ·
  <a href="#致谢"><strong>致谢</strong></a>
</p>
<br/>

## 功能特性

- **RAG检索增强生成** — 基于上传的政策文档进行精准问答，AI仅依据知识库内容回答，避免幻觉
- **自适应阈值检索** — 首次高阈值（0.78）检索，命中不足时自动降级重试（最低0.50），兼顾精准与召回
- **上下文截断** — 单条文档限长1500字符，总context限长6000字符，防止无关内容溢出大模型窗口
- **来源标注** — 每条检索文档自动标注政策文件名，AI回答时引用具体政策来源
- **知识库管理** — 提供中文知识库管理页，可进行上传、搜索、全文预览、批量删除与重复文件处理，支持"返回首页"快捷导航
- **多格式文档上传与向量化** — 支持 `TXT / MD / CSV / JSON / HTML / XML / PDF / DOCX / DOC`，自动提取文本、分块、生成嵌入向量并存入向量数据库
- **语义相似度搜索** — 使用pgvector进行向量相似度匹配，召回最相关的政策片段
- **流式对话** — 基于Vercel AI SDK实现流式响应，实时生成回答
- **用户认证** — 基于Supabase Auth的完整用户认证系统（支持GitHub OAuth），含密码修改功能
- **聊天历史** — 对话记录持久化存储，支持历史会话管理（侧边栏弹出面板含遮罩层，z-index 高于顶部导航，视觉清晰无重叠）
- **深色模式** — 支持亮色/暗色主题切换
- **响应式设计** — 适配桌面端与移动端

## 技术架构

### 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | [Next.js 13](https://nextjs.org) (App Router) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/docs) v3 + `@ai-sdk/anthropic` |
| 大语言模型 | [MiniMax](https://api.minimaxi.com) `MiniMax-M2.7`（Anthropic 兼容端点） |
| 嵌入模型 | [Supabase gte-small](https://supabase.com/docs/guides/ai) (384维，免费) |
| 数据库 | [Supabase Postgres](https://supabase.com) + [pgvector](https://github.com/pgvector/pgvector) |
| 认证 | [Supabase Auth](https://supabase.com/auth) |
| UI组件 | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) |
| 样式 | [Tailwind CSS](https://tailwindcss.com) |
| 文档解析 | [pdf-parse](https://npmjs.com/package/pdf-parse) (PDF) / [mammoth](https://npmjs.com/package/mammoth) (DOCX) / [word-extractor](https://npmjs.com/package/word-extractor) (DOC) |
| 语言 | TypeScript 5.x |
| 包管理 | pnpm |

### RAG工作流程

```
用户提问
  │
  ▼
┌─────────────────────────┐
│  1. 生成查询嵌入向量      │  Supabase Edge Function
│     (Query Embedding)    │  gte-small (384维)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. 自适应阈值向量检索    │  Supabase pgvector
│     (match_documents)    │  初始阈值 0.78，不足时降级至 0.50
│     最多检索 10 条         │  命中 < 2 条则逐步降低阈值重试
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  3. 上下文截断           │  单条 ≤ 1500 字符
│     (Context Truncate)   │  总量 ≤ 6000 字符
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  4. 构建增强提示          │  System Prompt + 检索上下文
│     (Augmented Prompt)   │  无相关资料时要求明确说明
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  5. 流式生成回答          │  MiniMax-M2.7
│     (Stream Response)    │  (@ai-sdk/anthropic 兼容端点)
└─────────────────────────┘
```

### 文档上传流程

```
进入知识库管理页 → 上传文件 → 文本提取 → 分块(1000字符) → 生成嵌入向量 → 存入Supabase documents表
```

### 知识库管理能力

- 中文管理界面：统一处理知识文件上传、查看与清理
- 自动刷新详情：上传后立即刷新列表，显示文件类型、大小、导入时间、字符数与分块数
- 片段搜索：按文件名或知识内容关键词检索已入库片段
- 全文预览：查看单个知识文件的完整入库文本
- 批量删除：支持多选后批量清理知识文件
- 重复文件策略：可选择覆盖同名旧文件，或保留重复文件为独立记录

## 本地运行

### 环境要求

- Node.js 18+（推荐 20+，Node.js 18 已被 Supabase SDK 标记为 deprecated）
- pnpm（项目使用 pnpm 管理依赖）
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### 配置环境变量

复制 `.env.example` 文件并填写必要的环境变量：

```bash
cp .env.example .env.local
```

需要配置以下环境变量：

| 变量名 | 说明 |
|--------|------|
| `Model_API_KEY` | MiniMax API密钥（从 [MiniMax开放平台](https://api.minimaxi.com) 获取，`sk-cp-` 前缀 Token Plan Key） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase项目URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务端密钥（绕过RLS，用于知识库写入和RPC查询） |
| `NEXT_PUBLIC_AUTH_GITHUB` | 是否启用GitHub OAuth（`true`/`false`） |
| `AUTH_GITHUB_ID` | GitHub OAuth App ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Secret |
| `KNOWLEDGE_ADMIN_SECRET` | 知识库管理会话签名密钥，建议配置为随机长字符串 |

> ⚠️ 注意：请勿将 `.env.local` 文件提交到代码仓库，以免泄露密钥。

### 安装依赖并启动开发服务器

```bash
pnpm install
pnpm dev
```

应用将在 [localhost:3000](http://localhost:3000/) 运行。

### 配置GitHub OAuth（可选）

如果启用GitHub OAuth登录，请按照 [Supabase GitHub OAuth设置指南](https://supabase.com/docs/guides/auth/social-login/auth-github) 进行配置，并在Supabase Dashboard的 [Auth > URL configuration](https://app.supabase.com/project/_/auth/url-configuration) 中设置站点URL。

### 配置Supabase Edge Function（嵌入生成）

项目使用 Supabase Edge Function 生成文本嵌入向量，需手动部署：

1. 在 Supabase Dashboard 创建 `embed` Edge Function
2. 使用 `Supabase.ai.Session('gte-small')` 生成 384 维向量
3. 调用方式：`POST {SUPABASE_URL}/functions/v1/embed` + `apikey` 头 + `{ input: "文本" }`

### 配置数据库（向量匹配函数）

确保 `documents` 表的 `embedding` 列类型为 `vector(384)`，并部署 `match_documents` 函数。详见 [supabase/migrations/](supabase/migrations/) 目录下的 SQL 文件。

## Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AIGCcn/ct_ah_gov)

### 部署前准备

1. **Supabase 项目**：已创建并配置好 `documents` 表（`embedding` 列为 `vector(384)`）和 `match_documents` 函数
2. **Supabase Edge Function**：已部署 `embed` 函数
3. **MiniMax API Key**：已获取 `sk-cp-` 前缀的 Token Plan Key
4. **GitHub OAuth**（可选）：已在 Supabase Dashboard 配置好 GitHub Provider

### 部署步骤

1. 点击上方 **Deploy with Vercel** 按钮
2. 输入仓库地址 `https://github.com/AIGCcn/ct_ah_gov`
3. 在 Vercel 配置页面填入所有环境变量（参考上表）
4. 点击 Deploy

### Vercel 环境变量清单

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `Model_API_KEY` | ✅ | MiniMax Token Plan Key |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 服务端密钥 |
| `NEXT_PUBLIC_AUTH_GITHUB` | ❌ | 是否启用 GitHub OAuth |
| `AUTH_GITHUB_ID` | ❌ | GitHub OAuth App ID |
| `AUTH_GITHUB_SECRET` | ❌ | GitHub OAuth App Secret |
| `KNOWLEDGE_ADMIN_SECRET` | ❌ | 知识库管理密钥（不配置则使用默认值） |

## 项目结构

```
Consulting/
├── app/
│   ├── api/
│   │   ├── auth/callback/     # 认证回调
│   │   ├── chat/route.ts      # 聊天API（RAG核心逻辑）
│   │   ├── knowledge/         # 知识库管理API（搜索、预览、删除、认证）
│   │   └── upload/route.ts    # 文档上传API（向量化入库）
│   ├── chat/[id]/             # 聊天详情页
│   ├── knowledge/             # 知识库管理页
│   ├── share/[id]/            # 分享页
│   ├── sign-in/               # 登录页
│   ├── sign-up/               # 注册页
│   ├── actions.ts             # Server Actions（聊天CRUD）
│   ├── layout.tsx             # 根布局
│   └── page.tsx               # 首页
├── components/
│   ├── ui/                    # shadcn/ui 基础组件
│   ├── chat.tsx               # 聊天主组件
│   ├── chat-panel.tsx         # 聊天面板
│   ├── chat-message.tsx       # 消息气泡
│   ├── empty-screen.tsx       # 欢迎页（含政策相关示例问题）
│   ├── header.tsx             # 顶部导航（含侧边栏触发、知识库入口）
│   ├── user-menu.tsx          # 用户下拉菜单（密码修改、退出登录）
│   ├── sidebar.tsx            # 侧边栏容器（Sheet 弹出面板）
│   ├── sidebar-list.tsx       # 聊天历史列表
│   ├── sidebar-footer.tsx     # 侧边栏底部（主题切换 + 清除记录）
│   ├── theme-toggle.tsx       # 明暗主题切换
│   ├── clear-history.tsx      # 清除聊天记录
│   ├── knowledge-dashboard.tsx # 知识库管理界面（上传、搜索、预览、批量删除）
│   ├── login-form.tsx         # 登录/注册表单
│   ├── tailwind-indicator.tsx # 响应式断点指示器（仅开发环境）
│   └── providers.tsx          # 主题等 Provider 封装
├── lib/
│   ├── hooks/                 # 自定义Hooks
│   ├── knowledge-admin.ts     # 知识库服务层
│   ├── knowledge-parser.ts    # PDF/DOCX/DOC 等文本提取
│   ├── knowledge-types.ts     # 知识库类型定义
│   ├── types.ts               # 类型定义
│   └── utils.ts               # 工具函数
├── supabase/
│   ├── functions/
│   │   └── embed/index.ts     # Edge Function: gte-small 嵌入生成
│   ├── migrations/
│   │   ├── 20230707053030_init.sql       # 聊天表初始化
│   │   ├── 20260507_vector_384.sql       # documents 表 384 维向量迁移
│   │   └── match_documents.sql           # 向量匹配函数（原始 1536 维）
│   ├── config.toml            # Supabase本地配置
│   └── seed.sql               # 种子数据
├── auth.ts                    # 认证工具函数
├── middleware.ts               # 中间件（会话校验）
└── package.json
```

### 关键文件说明

- [route.ts](app/api/chat/route.ts) — RAG核心逻辑：查询嵌入 → 自适应阈值检索 → 上下文截断 → 流式生成
- [upload/route.ts](app/api/upload/route.ts) — 文档上传：文件解析 → 分块 → 嵌入 → 存储
- [page.tsx](app/knowledge/page.tsx) — 知识库管理页入口
- [knowledge-dashboard.tsx](components/knowledge-dashboard.tsx) — 知识文件上传、搜索、预览与批量管理界面
- [knowledge-admin.ts](lib/knowledge-admin.ts) — 知识文件聚合、全文读取、搜索、删除与导入逻辑
- [knowledge-parser.ts](lib/knowledge-parser.ts) — PDF、DOCX、DOC 与文本文件解析（PDF 使用动态 import 避免 SSR 报错）
- [user-menu.tsx](components/user-menu.tsx) — 用户下拉菜单（密码修改、退出登录）
- [empty-screen.tsx](components/empty-screen.tsx) — 欢迎页面，含政策文档相关示例问题
- [header.tsx](components/header.tsx) — 顶部导航栏，组合侧边栏触发器、用户菜单、知识库入口

### RAG 参数配置

`app/api/chat/route.ts` 中的 `RAG_CONFIG` 对象集中管理所有检索参数：

| 参数 | 值 | 说明 |
|------|-----|------|
| `initialThreshold` | 0.78 | 初始相似度阈值 |
| `minThreshold` | 0.50 | 自适应降级最低阈值 |
| `thresholdStep` | 0.05 | 每次降级步长 |
| `minMatchCount` | 2 | 触发降级的最少命中数 |
| `maxMatchCount` | 10 | 单次最大检索文档数 |
| `maxChunkChars` | 1500 | 单条文档最大字符数 |
| `maxContextChars` | 6000 | 总 context 最大字符数 |

## 注意事项

- **禁用 Edge Runtime**：页面不得声明 `export const runtime = 'edge'`，否则 `cookies()` / `requestAsyncStorage` 不可用会导致崩溃
- **`next.config.js` 特殊配置**：
  - `serverComponentsExternalPackages` 排除了 `pdfjs-dist` / `pdf-parse` / `@napi-rs/canvas` 以避免 ESM 打包错误
  - 客户端 webpack alias 将这些模块设为 `false`，请勿移除
  - `eslint.ignoreDuringBuilds: true` 绕过 pnpm 环境下 tailwindcss ESLint 插件解析问题
- **`pdf-parse` 动态导入**：`knowledge-parser.ts` 中 PDF 解析使用 `await import('pdf-parse')`，不可改为顶层静态 import（会触发 `DOMMatrix is not defined`）
- **Edge Function 鉴权**：`generateEmbedding` 调用 Supabase Edge Function 生成嵌入向量时必须使用 `service_role` key（通过 `apikey` 头传入），使用 `anon key` 会返回 401 导致嵌入降级为全零向量、检索无法命中
- **tsconfig.json**：`moduleResolution` 设置为 `"bundler"` 以正确解析 `ai/react` 等包的 exports 字段
- **MiniMax Token Plan Key**：`sk-cp-` 前缀密钥仅支持 Anthropic 兼容端点调用 Chat 模型（MiniMax-M2.7），不支持原生 Embeddings API
- **Vercel 环境无需 ws polyfill**：Vercel Serverless 原生支持 WebSocket，`knowledge-admin.ts` 中不使用 `import ws from 'ws'`（本地 Node.js 18 开发如遇 Realtime WebSocket 问题可临时添加）
- **流式响应必须使用 Data Stream 协议**：`app/api/chat/route.ts` 中须调用 `result.toDataStream()` 而非 `toDataStreamResponse()`。前端 `useChat`（`@ai-sdk/react`）期望 Vercel AI SDK Data Stream 格式（`code:JSON\n` 帧结构，如 `0:"text"\n`），`toTextStreamResponse()` 返回纯文本会导致前端无法解析、聊天回复不显示
- **MiniMax 空错误帧过滤**：MiniMax-M2.7 通过 Anthropic 兼容端点调用时会在流中发送空 error 事件（`3:""`），这些并非真正的错误，但前端 `processDataProtocolResponse` 遇到 `type="error"` 会直接 throw 导致回答不显示。`route.ts` 中通过 `TransformStream` 过滤掉这些空 error 帧，只保留有实质内容的 error
- **pnpm lockfile 同步**：每次修改 `package.json` 后必须运行 `pnpm install` 更新 `pnpm-lock.yaml`，否则 Vercel CI 会报 `ERR_PNPM_OUTDATED_LOCKFILE`
- [match_documents.sql](supabase/migrations/match_documents.sql) — pgvector向量匹配函数定义

## 更新日志

### 2026-05-11

- **RAG 嵌入生成 401 修复**：`generateEmbedding` 调用 Supabase Edge Function 时使用了 anon key，导致 401 未授权 → embedding 降级为全零向量 → 向量检索无法命中。修复：`route.ts` 和 `knowledge-admin.ts` 中的 `generateEmbedding` 统一改用 `service_role` key 调用 Edge Function，确保嵌入向量正常生成
- **pnpm standalone 部署方案**：添加 `.npmrc`（`node-linker=hoisted`）使 pnpm 生成平铺 node_modules，解决 standalone 构建跨机器部署时 symlink 丢失问题；新增 `deploy/prepare-deploy.js` 自动化部署准备脚本
- **部署流程文档化**：生产部署改为 `pnpm build && cd ../deploy && node prepare-deploy.js`，输出目录 `deploy/` 可整体复制到目标机器运行

### 2026-05-10

- **Chat History 侧边栏遮罩层级修复**：将 Sheet 组件（Portal / Overlay / Content）的 `z-index` 从 `z-50` 提升至 `z-[100]`，确保遮罩层完整覆盖顶部导航栏（`sticky z-50`），彻底解决 Chat History 文字与用户图标视觉重叠的问题
- **聊天回答与输入框重叠修复**：将 ChatPanel 底部渐变背景从 `from-muted/10 to-muted/30` 调整为 `from-muted/60 to-muted/95`，大幅提升渐变区不透明度，避免消息文本透过来与输入框视觉重叠；同时将消息区域底部内边距从 `pb-[200px]` 增加至 `pb-[220px]`
- **系统提示词更新**：优化 RAG 系统提示词，要求 AI 回答时明确标注信息出自哪个具体政策文件（使用"根据《xxx》、《xxx》的通知"格式引用），简化输出字数要求（无字数要求时不超过 800 字），并在无法回答时给出注明 AI 生成的暖心建议

### 2026-05-08

- **知识库页"返回首页"按钮**：在 `/knowledge` 页面登录前后均添加了"返回首页"快捷导航（含箭头图标），方便用户随时跳回聊天首页
- **Chat History 侧边栏遮罩修复**：为 Sheet 弹出面板增加了半透明遮罩层（`bg-black/50`），修复了 Chat History 文字与用户图标视觉重叠的问题；同时优化了面板定位（`inset-y-0 left-0`），确保从左侧滑出的定位精准
- **聊天回答不显示修复**：MiniMax-M2.7 通过 Anthropic 兼容端点（`api.minimaxi.com/anthropic/v1`）调用时会在流式响应中发送空 error 事件（`3:""`），前端 `@ai-sdk/ui-utils` 的 `processDataProtocolResponse` 遇到 `type="error"` 直接 throw 导致后续文本内容被丢弃。修复方案：在 `route.ts` 中用 `TransformStream` 过滤掉空 error 帧（`3:""`），只保留有实质内容的 error，使 AI 回答正常渲染

## 政策文档

项目包含以下政策原文（位于 `政策原文/` 目录）：

- 《关于促进微短剧产业发展的若干举措（征求意见稿）》
- 《关于加快推进广播电视和网络视听产业高质量发展的实施意见》
- 《文旅与广电深度融合双向赋能工作指引》
- 《视听文旅融合发展三年行动计划（2026-2028）》

上传这些文档后，智能体即可基于这些政策内容进行专业咨询问答。

## 致谢

本项目基于 [Vercel AI Chatbot](https://github.com/supabase-community/vercel-ai-chatbot) 模板开发，感谢以下贡献者：

- Jared Palmer ([@jaredpalmer](https://twitter.com/jaredpalmer)) - [Vercel](https://vercel.com)
- Shu Ding ([@shuding\_](https://twitter.com/shuding_)) - [Vercel](https://vercel.com)
- shadcn ([@shadcn](https://twitter.com/shadcn)) - [Contractor](https://shadcn.com)
- Thor Schaeff ([@thorwebdev](https://twitter.com/thorwebdev)) - [Supabaseifier](https://thor.bio)
