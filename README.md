# TaskPilot · 任务调度台

本地化 **Electron** 桌面应用：用 **Cron 表达式** 调度在本机执行的 **Python 脚本**，SQLite 持久化任务与运行记录，stdout/stderr 写入磁盘，界面为 **Vue 3 + Element Plus**。

A local **Electron** desktop app: schedule **Python** scripts with **cron-style** expressions, persist tasks & runs in **SQLite**, pipe **stdout/stderr** to disk, UI built with **Vue 3** and **Element Plus**.

---

## 中文

### 主要功能

- **任务**：配置 Python 解释器路径、脚本路径、工作目录、参数（JSON）、超时、**并发策略**（跳过 / 排队 / 并行），以及 Cron 计划。
- **调度**：内置基于 `cron-parser` 的轮询调度，支持与预览一致的 Cron 表达式。
- **日志**：按任务与时间范围分页查看运行历史；可打开单次运行的 stdout/stderr 文件。
- **概览**：连通性自检、任务/运行汇总、近期执行、预计下次 Cron 触发等。
- **设置**：如开机启动、托盘缩小等。

### 环境要求

- **Node.js** 建议使用 **20+**（esbuild 打包目标为 `node20`）。
- **npm** 安装依赖。
- 运行脚本需本机已安装或可执行的 **Python**（路径在任务配置中指定）。

### 安装与开发

```bash
npm install
npm run dev
```

开发模式会用 **concurrently** 并行启动：`esbuild`（watch）打主进程/`preload`、`Vite` 开发服务器（默认端口 **5173**）、以及 **Electron**。首次请先执行过一次 `esbuild`（`dev` 的 `main` 脚本会自动生成），或单独执行：

```bash
npm run dev:main
```

另开终端或直接 `npm run dev` 全流程。

### 构建与运行

```bash
npm run build
npm run start          # 使用 dist-renderer / dist-electron 启动 Electron
npm run dist           # electron-builder 打出安装包（配置见 package.json）
```

打包产物默认输出目录：`release-out`（Windows NSIS，`x64`）。

### 数据与日志位置

运行时数据（数据库、日志根目录、`settings.json` 等）位于 Electron **`userData`**，随操作系统与用户配置变化；日志文件一般位于 `userData/logs/<taskId>/`。

### 常用脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发联动（main + preload + renderer + Electron） |
| `npm run build` | 生产构建前端与主进程 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `vue-tsc` 类型检查 |
| `npm run gen:icons` | 图标资源生成（构建前也会在 `prebuild` 触发） |

### 目录概要

| 路径 | 说明 |
|------|------|
| `electron/` | 主进程、preload、SQLite、调度、Python 拉起、IPC |
| `src/` | 渲染进程：`views/`、`router/`、`components/` |
| `src/shared/` | 渲染与主进程共用的类型等 |
| `examples/scripts/` | 示例 Python 脚本 |
| `dist-renderer/` / `dist-electron/` | 构建输出 |
| `assets/`、`tools/` | 资源与脚本工具 |

---

## English

### Features

- **Tasks**: Configure Python interpreter, script path, working directory, args (JSON), timeout, **concurrency policy** (skip / queue / parallel), and Cron schedule.
- **Scheduler**: Polling-based runner using **`cron-parser`**, aligned with Cron preview in the UI.
- **Logs**: Paginated runs per task (or all tasks), optional **datetime range** filter; inspect stdout/stderr files per run.
- **Dashboard**: Connectivity check, task/run stats, recent executions, approximate **next Cron fire** times.
- **Settings**: e.g. open at login, minimize to tray.

### Prerequisites

- **Node.js** **20+** recommended (esbuild target is `node20`).
- **npm** for installs.
- A working **Python** on the machine whose path you set per task.

### Install & development

```bash
npm install
npm run dev
```

Starts **esbuild** (watch for main/preload), **Vite** (default dev server port **5173**), and **Electron**.

### Production build & packaging

```bash
npm run build
npm run start           # Electron using dist-renderer / dist-electron
npm run dist            # electron-builder (see package.json → `build`)
```

Artifacts go to **`release-out`** (Windows NSIS, `x64` by config).

### Data & logs

App data (**SQLite**, log root **`userData/logs/...`**, `settings.json`, etc.) lives under Electron **`userData`**.

### Useful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Full dev stack (main + preload + renderer + Electron) |
| `npm run build` | Production build for renderer & main |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vue/TS checks with `vue-tsc` |
| `npm run gen:icons` | Icon generation (`prebuild` runs it too) |

### Repo layout

| Path | Role |
|------|------|
| `electron/` | Main process, preload, SQLite, scheduler, IPC, Python spawning |
| `src/` | Renderer: routes, views, components |
| `src/shared/` | Shared types/utilities consumable by both sides |
| `examples/scripts/` | Sample Python scripts |
| `dist-renderer/` / `dist-electron/` | Build output |
| `assets/`, `tools/` | Assets and tooling |