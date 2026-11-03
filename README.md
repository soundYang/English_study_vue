# Word Reading · AI 英语阅读训练

用你正在学的单词，生成属于你的英文阅读材料。

Word Reading 是一个基于个人词汇库的 AI 英语阅读训练前端：选择难度、篇幅与词源，由后端生成英文文章；完成阅读理解后，再回到词汇库复习生词、查看学习统计。

> 本仓库只包含前端。使用真实数据需要配套后端服务；也可以开启内置 Mock 模式，离线体验完整页面流程。

## 功能

- **AI 文章生成**：难度、篇幅、题型与词源可配置；生成过程展示真实阶段进度，支持取消与失败重试。
- **阅读答题**：文章与题目双栏阅读、倒计时、答题进度、未作答确认、提交后查看解析。
- **词汇管理**：单词增删改查、批量导入、词性与释义、基础词库、自选重点词。
- **复习与统计**：每日复习队列、复习轮次、连续学习天数、近 30 天学习热力图。
- **账号体系**：注册登录、游客浏览、每日免费额度、自备 API Key、个人学习数据。
- **管理后台**：用户台账、用户反馈、运行日志。
- **体验细节**：桌面与移动端响应式布局、键盘焦点、减少动效偏好、加载骨架屏。

## 技术栈

| 类别     | 技术                             |
| -------- | -------------------------------- |
| 框架     | Vue 3（`<script setup>`）        |
| 构建     | Vite                             |
| 状态管理 | Pinia                            |
| 路由     | Vue Router                       |
| 请求     | Axios                            |
| 动画     | GSAP                             |
| 图标     | lucide-vue-next                  |
| 测试     | Vitest + @vue/test-utils + jsdom |
| 格式化   | Prettier                         |

## 快速开始

要求 Node.js 20 及以上。

```bash
npm install
cp .env.example .env
npm run dev
```

默认使用 Mock 数据（`VITE_USE_MOCK=true`），不需要后端即可浏览主要页面与演示流程。

### 连接真实后端

在 `.env` 中关闭 Mock：

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
```

开发服务器会把同源的 `/api` 转发到本机 `3000` 端口的后端；生产环境由反向代理处理，前端不需要写死后端地址。

### 环境变量

| 变量                 | 默认值 | 说明                                         |
| -------------------- | ------ | -------------------------------------------- |
| `VITE_USE_MOCK`      | `true` | 使用本地 Mock 数据；生产构建建议设为 `false` |
| `VITE_API_BASE_URL`  | `/api` | 接口基址，推荐保持相对路径                   |
| `VITE_AUTH_ENFORCED` | `true` | 未登录访问受保护页面时是否跳转登录页         |

生产构建时若 `VITE_USE_MOCK=false`，Mock 数据源与演示账号会被替换为空占位，不进入 `dist`。

## 配套后端

本仓库只包含前端，真实数据由配套的 Word Reading 后端提供：

- **后端仓库**：[soundYang/English_study_Node](https://github.com/soundYang/English_study_Node)
- **本地默认地址**：`http://localhost:3000`，接口前缀为 `/api`；健康检查：`http://localhost:3000/api/health`
- **技术栈**：Node.js（≥ 22）+ Express 5 + MongoDB + DeepSeek
- **启动方式**：先启动 MongoDB，再按后端仓库的 README 配置 `.env`，运行 `npm run dev`

前端通过 `VITE_API_BASE_URL=/api` 访问接口：开发环境由 Vite 代理到 `http://localhost:3000`，生产环境由反向代理转发同源 `/api`。后端未启动时，可以保持 `VITE_USE_MOCK=true` 使用本地 Mock 数据。

## 常用脚本

| 命令              | 说明                                 |
| ----------------- | ------------------------------------ |
| `npm run dev`     | 启动开发服务器                       |
| `npm run build`   | 生产构建，并生成图片的 WebP 兄弟文件 |
| `npm run preview` | 本地预览构建产物                     |
| `npm test`        | 运行全部单元测试                     |
| `npm run format`  | 使用 Prettier 格式化源码             |

## 目录结构

```text
src/
├─ __tests__/    跨模块测试
├─ admin/        管理后台（独立布局与路由）
├─ api/          接口门面
├─ assets/       静态资源
├─ component/    通用组件
├─ composables/  组合式函数
├─ config/       运行时配置
├─ errors/       错误类型与文案
├─ layouts/      页面布局
├─ mock/         本地 Mock 数据源与适配器
├─ router/       路由与鉴权守卫
├─ stores/       Pinia 状态
├─ styles/       主题与全局样式
├─ unit/         纯函数与单元测试
└─ views/        业务页面
```

## 测试与构建

```bash
npm test
npm run build
```

构建产物输出到 `dist/`。构建脚本会同时生成图片的 `.webp` 兄弟文件，部署时保持原文件名即可按 `Accept` 头协商。

## 说明

- 本仓库为个人学习与作品展示项目，不包含后端实现。
- Mock 数据仅用于本地开发与演示；生产环境请关闭 Mock 并接入真实接口。
