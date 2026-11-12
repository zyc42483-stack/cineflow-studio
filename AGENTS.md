# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 业务模块（AI 视频创作流水线，双端口版）

- 前端主界面：`src/components/studio.tsx`（模式框架 + 状态管理 + 流水线 + 工作区，`page.tsx` 仅挂载）
  - `src/components/studio/console-panels.tsx`：双端口面板（CreativePanel 创意端口 / ImitatePanel 模仿端口）
  - `src/components/studio/scene-card.tsx`：分镜卡片（画面 + 视频 + 逐镜音频区）
  - `src/components/studio/lamp.tsx`：状态指示灯 / 流水线节点
  - `src/lib/studio-constants.ts`：风格、音色常量
- 共享类型：`src/lib/types.ts`（Scene / ScriptResult / SceneAssets 含逐镜 audio 字段 / StudioMode / ImitateInputType）
- 双端口（左控制台顶部 Tab 切换，localStorage key: cineflow-studio-state-v2 / drafts-v2）：
  - 创意端口：诉求 + 可选参考照片/视频（多模态拆解生成分镜）→ 或直接诉求生成脚本
  - 模仿端口：上传图片/视频模仿 或 mp4 链接识别模仿（先 /api/analyze-link 拉片分析，再拆解生成脚本）；支持主角形象上传（protagonistUrl，优先生图参考保证主角一致）、声音选项、细节补充
- 分步确认流程：脚本 → 画面画布整改（重出/替换/改词）→「确认画面·进入拍摄」（canvasConfirmed 门控解锁视频生成）→ 逐镜视频修改 → 逐镜配音 → 合成
- 后端 API（`src/app/api/`，均基于 `coze-coding-dev-sdk`；视频模型 `doubao-seedance-2-0-260128`，LLM `doubao-seed-2-0-pro-260215` 支持图片/视频多模态输入）：
  - `POST /api/script`：SSE 流式分镜脚本（LLM），产出 JSON：title / musicStyle / scenes[{id,title,visualPrompt,narration,duration}]
  - `POST /api/analyze-link`：SSE 流式视频拉片分析（LLM video_url 多模态理解，面向 mp4 直链）
  - `POST /api/analyze-reference`：SSE 流式，参考素材（图片/视频/拉片文本）+ 诉求/细节 → 分镜脚本（mode: creative|imitate）
  - `POST /api/image`：分镜画面生成（16:9 → 2560x1440，9:16 → 1440x2560），支持 referenceImageUrl
  - `POST /api/video`：图生视频，`generateAudio:true` 同步生成配乐/环境音；传 `referenceVideoUrl` 时切换为全能参考模式（reference_video + reference_image，不可与 first_frame 混用，SDK 强约束）。模仿端口自动以模仿对象为参考视频
  - `POST /api/voice`：TTS 配音（逐镜调用，每镜一条音轨）
  - `POST /api/compose`：sceneAudios 逐镜音频数组 → 逐镜 compileVideoAudio 混音（isAudioReserve:true，音画对齐）→ concatVideos 拼接；单段直通
  - `POST /api/upload`：上传文件到对象存储（限 200MB），返回签名 URL
- 注意：视频生成单段约 5-10 分钟，`maxDuration = 600`（analyze 接口 300）；compose 输入 URL 必须是 http(s)，否则 500

## 本地 CLI 版本（local-agent/）

- 与 Web 版无关的独立命令行工具：`local-agent/agent.mjs`（Node >= 18，ESM，依赖 `coze-coding-dev-sdk`）
- 用法：`node agent.mjs "主题" [--scenes 4] [--style 风格] [--ratio 16:9|9:16] [--voice 音色ID] [--ref 参考视频URL] [--out ./output]`
- 流水线与 Web 版一致：脚本(流式打印+解析) → 生图(并行) → 配音 → 逐镜生视频 → concat + 混音 → fetch 下载 `final.mp4` 到本地
- 本地运行需自行配置 `COZE_WORKLOAD_IDENTITY_API_KEY` 等环境变量（见 local-agent/README.md）
