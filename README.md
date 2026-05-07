<h1 align="center">安徽广电文旅政策咨询智能体</h1>

<p align="center">
  基于RAG架构的专业政策咨询AI智能体，由安徽广电AIGC实验室与合肥生成式人工智能共同开发。
</p>

<p align="center">
  <a href="#功能特性"><strong>功能特性</strong></a> ·
  <a href="#技术架构"><strong>技术架构</strong></a> ·
  <a href="#本地运行"><strong>本地运行</strong></a> ·
  <a href="#项目结构"><strong>项目结构</strong></a> ·
  <a href="#致谢"><strong>致谢</strong></a>
</p>
<br/>

## 功能特性

- **RAG检索增强生成** — 基于上传的政策文档进行精准问答，AI仅依据知识库内容回答，避免幻觉
- **知识库管理** — 提供中文知识库管理页，可进行上传、搜索、全文预览、批量删除与重复文件处理
- **多格式文档上传与向量化** — 支持 `TXT / MD / CSV / JSON / HTML / XML / PDF / DOCX / DOC`，自动提取文本、分块、生成嵌入向量并存入向量数据库
- **语义相似度搜索** — 使用pgvector进行向量相似度匹配，召回最相关的政策片段
- **流式对话** — 基于Vercel AI SDK实现流式响应，实时生成回答
- **用户认证** — 基于Supabase Auth的完整用户认证系统（支持GitHub OAuth）
- **聊天历史** — 对话记录持久化存储，支持历史会话管理
- **深色模式** — 支持亮色/暗色主题切换
- **响应式设计** — 适配桌面端与移动端

## 技术架构

### 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | [Next.js 13](https://nextjs.org) (App Router) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/docs) |
| 大语言模型 | [MiniMax](https://api.minimaxi.com) `abab6.5s-chat` |
| 嵌入模型 | MiniMax `embo-01` (1536维) |
| 数据库 | [Supabase Postgres](https://supabase.com) + [pgvector](https://github.com/pgvector/pgvector) |
| 认证 | [Supabase Auth](https://supabase.com/auth) |
| UI组件 | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) |
| 样式 | [Tailwind CSS](https://tailwindcss.com) |
| 语言 | TypeScript |

### RAG工作流程

```
用户提问
  │
  ▼
┌─────────────────────────┐
│  1. 生成查询嵌入向量      │  MiniMax embo-01
│     (Query Embedding)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. 向量相似度搜索        │  Supabase pgvector
│     (match_documents)    │  阈值: 0.78, Top-5
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  3. 构建增强提示          │  System Prompt + 检索上下文
│     (Augmented Prompt)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  4. 流式生成回答          │  MiniMax abab6.5s-chat
│     (Stream Response)    │
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

- Node.js 18+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### 配置环境变量

复制 `.env.example` 文件并填写必要的环境变量：

```bash
cp .env.example .env
```

需要配置以下环境变量：

| 变量名 | 说明 |
|--------|------|
| `Model_API_KEY` | MiniMax API密钥（从 [MiniMax开放平台](https://api.minimaxi.com) 获取） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase项目URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名密钥 |
| `NEXT_PUBLIC_AUTH_GITHUB` | 是否启用GitHub OAuth（`true`/`false`） |
| `AUTH_GITHUB_ID` | GitHub OAuth App ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Secret |
| `KNOWLEDGE_ADMIN_SECRET` | 知识库管理会话签名密钥，建议配置为随机长字符串 |

> ⚠️ 注意：请勿将 `.env` 文件提交到代码仓库，以免泄露密钥。

### 启动Supabase

```bash
npm install supabase --save-dev
npx supabase start
```

### 安装依赖并启动开发服务器

```bash
npm install
npm run dev
```

应用将在 [localhost:3000](http://localhost:3000/) 运行。

### 配置GitHub OAuth（可选）

如果启用GitHub OAuth登录，请按照 [Supabase GitHub OAuth设置指南](https://supabase.com/docs/guides/auth/social-login/auth-github) 进行配置，并在Supabase Dashboard的 [Auth > URL configuration](https://app.supabase.com/project/_/auth/url-configuration) 中设置站点URL。

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
│   ├── empty-screen.tsx       # 欢迎页（含示例问题）
│   ├── header.tsx             # 顶部导航
│   ├── sidebar.tsx            # 侧边栏（聊天历史）
│   └── ...                    # 其他组件
├── lib/
│   ├── hooks/                 # 自定义Hooks
│   ├── knowledge-admin.ts     # 知识库服务层
│   ├── knowledge-parser.ts    # PDF/DOCX/DOC 等文本提取
│   ├── knowledge-types.ts     # 知识库类型定义
│   ├── types.ts               # 类型定义
│   └── utils.ts               # 工具函数
├── supabase/
│   ├── migrations/
│   │   ├── 20230707053030_init.sql       # 聊天表初始化
│   │   └── match_documents.sql           # 文档表 + 向量匹配函数
│   ├── config.toml            # Supabase本地配置
│   └── seed.sql               # 种子数据
├── auth.ts                    # 认证工具函数
├── middleware.ts               # 中间件（会话校验）
└── package.json
```

### 关键文件说明

- [route.ts](app/api/chat/route.ts) — RAG核心逻辑：查询嵌入 → 向量搜索 → 上下文注入 → 流式生成
- [upload/route.ts](app/api/upload/route.ts) — 文档上传：文件解析 → 分块 → 嵌入 → 存储
- [page.tsx](app/knowledge/page.tsx) — 知识库管理页入口
- [knowledge-dashboard.tsx](components/knowledge-dashboard.tsx) — 知识文件上传、搜索、预览与批量管理界面
- [knowledge-admin.ts](lib/knowledge-admin.ts) — 知识文件聚合、全文读取、搜索、删除与导入逻辑
- [knowledge-parser.ts](lib/knowledge-parser.ts) — PDF、DOCX、DOC 与文本文件解析
- [match_documents.sql](supabase/migrations/match_documents.sql) — pgvector向量匹配函数定义
- [empty-screen.tsx](components/empty-screen.tsx) — 欢迎页面，包含政策咨询示例问题

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
