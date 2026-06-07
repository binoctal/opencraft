**中文** | [English](README.md)

# Opencraft

Claude Code 开发治理中间件 — 自动检测技术栈、强制质量门禁、保持项目健康。

## 功能

Opencraft 是一个**零配置的治理层**，完全自动运行：

- **自动检测** — 每次会话启动时扫描项目技术栈指纹（go.mod、tsconfig.json、pyproject.toml 等）
- **自动验证** — 每次 `git push` 后运行项目对应的验证命令
- **健康监控** — 追踪 CLAUDE.md 行数、技术栈变化、未验证修改
- **上下文注入** — 在会话开始时注入项目治理上下文
- **密钥泄露防护** — 阻止 API 密钥、Token、私钥写入源代码
- **分支保护** — 阻止直接推送到 main/master
- **依赖审计** — 依赖文件变更时发出警告
- **会话交接** — AI 生成会话摘要，跨对话保持连续性
- **CI 对齐** — 检测本地验证与 CI 工作流的不一致

## 安装

```bash
claude plugin marketplace add binoctal/opencraft
claude plugin install opencraft
```

无需其他配置。

## 卸载

```bash
claude plugin uninstall opencraft          # 卸载插件
claude plugin marketplace remove opencraft # 移除 marketplace 源
```

## 工作原理

### 会话启动

启动对话时，opencraft 自动：

1. 从指纹文件检测项目技术栈
2. 生成 `.opencraft/profile.json` 配置验证命令
3. 检查 CI 对齐情况
4. 加载上次会话的交接文档（如存在）
5. 将治理上下文注入对话
6. 显示一行状态摘要

### Git Push

每次 `git push` 后，opencraft 自动运行 profile 中的验证命令。仅验证有文件变更的子项目，通过则静默，失败则阻止推送。

**分支保护**阻止直接推送到 `main` 和 `master`。请使用功能分支。

### 会话结束

结束对话时，opencraft：

1. 检查未提交的变更
2. 提示 Claude 写入会话摘要到 `.opencraft/handoff.md`

## 治理 Hooks

### 密钥泄露防护

**PreToolUse**（Write/Edit）— 在写入磁盘前扫描内容。

| 模式 | 服务 |
|------|------|
| `sk-proj-*` | OpenAI 项目密钥 |
| `sk-*`（48 字符） | OpenAI 旧密钥 |
| `sk_live_*` / `sk_test_*` | Stripe 密钥 |
| `ghp_*` / `gho_*` / `ghu_*` / `ghs_*` | GitHub Token |
| `xox[bposa]-*` | Slack Token |
| `AKIA*` | AWS 访问密钥 |
| `AIza*` | Google API 密钥 |
| `eyJ*` | JWT Token |
| `-----BEGIN PRIVATE KEY-----` | 私钥 |

**智能白名单**：包含 `test`、`example`、`TODO`、`placeholder` 等关键词的行会被跳过。`.env` 文件始终放行。

### 分支保护

**PreToolUse**（`git push`）— 阻止推送到受保护分支。

- 默认保护：`main`、`master`
- 检测 force push 尝试
- 解析推送目标（不仅检查当前分支）

### 依赖变更审计

**PostToolUse**（Write/Edit）— 依赖文件变更时发出非阻塞警告。

监控：`package.json`、`go.mod`、`requirements.txt`、`pyproject.toml`、`Cargo.toml`、`Gemfile`、`composer.json`、`pom.xml`、`build.gradle`、`pubspec.yaml` 等。

### CI 对齐

**SessionStart** — 对比 `.github/workflows/*.yml` 中的命令与治理 profile。报告不匹配项。

### 会话交接

**Stop** — 提示 Claude 写入简短的 AI 生成摘要到 `.opencraft/handoff.md`。

**SessionStart** — 加载交接文档作为新会话的上下文。

### 约定发现（v0.7.0+）

**SessionStart** — 自动扫描代码库，检测命名约定、结构模式和常用库。结果保存到 `.opencraft/conventions.md`（人类可读）和 `.opencraft/conventions.json`（机器缓存）。

扫描器：
- **命名** — 函数/变量/文件命名风格（camelCase、snake_case 等）
- **结构** — 平均函数长度、测试目录、源码目录
- **模式** — 错误处理、状态管理、测试框架
- **导入** — 路径别名、导入风格、barrel exports

可通过 `.opencraft/overrides.yaml` 覆盖检测到的约定。

### 决策连续性（v0.8.0+）

**SessionStart** — 从 cccmemory（或 `.opencraft/decisions.md` 回退源）读取历史决策并注入上下文。确保 AI 不会重新讨论已确定的架构选择。

### 架构守卫（v0.9.0+）

**PostToolUse**（Write/Edit）— 修改源文件时，警告依赖该文件的文件。两级解析：codegraph MCP（AST 精确）→ grep（正则回退）。非阻塞警告。

### 质量基线（v1.0.0+）

**SessionStart** — 跨会话追踪代码质量指标：
- 函数长度（平均值、P75、P90）
- 文件长度（平均值、最大值）
- TODO/FIXME/HACK 计数
- 测试比率
- 重复代码块
- 反模式（大文件、上帝模块）

显著变化（>5%）时显示趋势。快照保存到 `.opencraft/quality-snapshot.json`。

## 支持的技术栈

| 指纹文件 | 技术栈 | 默认验证命令 |
|---------|--------|-------------|
| `go.mod` | Go | `go vet ./...`、`go test ./...` |
| `tsconfig.json` | TypeScript | `npx tsc --noEmit` |
| `package.json`（无 tsconfig） | JavaScript | `npm test` |
| `pyproject.toml` / `setup.py` | Python | `pytest` |
| `Cargo.toml` | Rust | `cargo check`、`cargo test` |
| `pom.xml` | Java | `mvn test` |
| `build.gradle` | Java | `gradle test` |
| `build.gradle.kts` | Kotlin | `./gradlew test` |
| `Gemfile` | Ruby | `bundle exec rspec` |
| `composer.json` | PHP | `phpunit` |
| `*.csproj` / `*.sln` | .NET | `dotnet test` |
| `Package.swift` | Swift | `swift test` |
| `mix.exs` | Elixir | `mix test` |
| `pubspec.yaml` | Dart/Flutter | `flutter test` |

多技术栈项目完全支持——所有检测到的技术栈都会贡献验证命令。

### Monorepo 支持

Opencraft 自动检测 monorepo 并使用工作区级别的命令：

| Monorepo 工具 | 检测文件 | 验证命令 |
|---------------|---------|---------|
| pnpm | `pnpm-workspace.yaml` | `pnpm -r run test` |
| turbo | `turbo.json` | `turbo run test`（优先使用） |
| Lerna | `lerna.json` | `npx lerna run test` |
| Nx | `nx.json` | `nx run-many --target=test` |
| npm workspaces | `package.json` workspaces | `npm run test --workspaces` |

当 turbo 与其他 monorepo 工具共存时（如 pnpm + turbo），优先使用 turbo 命令。子项目技术栈自动扫描并纳入 profile。

## Skills

| Skill | 说明 |
|-------|------|
| `opencraft:setup` | 查看或调整自动生成的治理配置 |
| `opencraft:verify` | 手动运行 profile 中的验证命令 |
| `opencraft:onboard` | 治理概念引导 |

大多数时候不需要调用任何 skill——治理通过 hooks 自动运行。

## 存储

所有 opencraft 生成的文件存放在 `.opencraft/`：

| 文件 | 用途 |
|------|------|
| `.opencraft/profile.json` | 自动生成的治理配置 |
| `.opencraft/handoff.md` | AI 生成的会话摘要 |
| `.opencraft/conventions.md` | 检测到的代码约定（人类可读） |
| `.opencraft/conventions.json` | 代码约定（机器缓存） |
| `.opencraft/decisions.md` | 历史决策记录 |
| `.opencraft/quality-snapshot.json` | 质量指标快照 |

将 `.opencraft/` 添加到 `.gitignore` 以排除版本控制。

## Hooks

| Hook | 事件 | 作用 |
|------|------|------|
| `session-start.cjs` | SessionStart | 检测技术栈、生成 profile、检查 CI 对齐、加载交接文档 |
| `pre-tool-use.cjs` | PreToolUse | Write/Edit 密钥扫描、git push 分支保护 |
| `post-tool-use.cjs` | PostToolUse | Write/Edit 依赖审计、git push 验证 |
| `stop.cjs` | Stop | 决策自动追加、未提交变更提醒 |

## 可见性

Opencraft 采用三级可见性策略：

- **静默（Level 0）** — 验证通过：无输出
- **提示（Level 1）** — 会话启动状态摘要：`[opencraft] ✅ Go | 2 changes | 42-line CLAUDE.md`
- **阻塞（Level 2）** — 验证失败或密钥检测：错误详情 + 操作被阻止

## 兼容插件

| 插件 | 定位 | 兼容？ |
|------|------|--------|
| [Superpowers](https://github.com/anthropics/claude-plugins-official) | TDD、调试、代码审查 | 是 — 互补 |
| [OpenSpec](https://github.com/fission-ai/openspec) | 变更管理、结构化工作流 | 是 — opencraft 读取活跃变更作为上下文 |

不会冲突——opencraft 使用 `<opencraft-context>` 标签，不影响其他插件。

## 项目级 Hooks

项目特定的守卫模板在 `templates/project-hooks/`：

- `deploy-safety-guard.js` — 部署前检查（tsc、vitest、vite build、wrangler 配置）
- `submodule-push-guard.js` — 确保子模块先提交和推送

## License

MIT
