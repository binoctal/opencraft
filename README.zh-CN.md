**中文** | [English](README.md)

# Opencraft

Claude Code 开发治理中间件 — 自动检测技术栈、通过 hooks 强制质量门禁、保持项目健康。

## 功能

Opencraft 是一个**零配置的治理层**，完全自动运行：

- **自动检测** — 每次会话启动时扫描项目技术栈指纹（go.mod、tsconfig.json、pyproject.toml 等）
- **自动验证** — 每次 `git commit` 后运行项目对应的验证命令
- **健康监控** — 追踪 CLAUDE.md 行数、技术栈变化、未验证修改
- **上下文注入** — 在会话开始时注入项目治理上下文

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
2. 生成 `.claude/opencraft-profile.json` 配置验证命令
3. 将治理上下文注入对话
4. 显示一行状态摘要

### Git 提交

每次 `git commit` 后，opencraft 自动运行 profile 中的验证命令。通过则静默，失败则拒绝提交。

### 会话结束

结束对话时，opencraft 检查是否有未提交的变更，提醒未验证的修改。

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

当 turbo 与其他 monorepo 工具共存时（如 pnpm + turbo），优先使用 turbo 命令以获得缓存加速。子项目技术栈自动扫描并纳入 profile。

## Skills

| Skill | 说明 |
|-------|------|
| `opencraft:setup` | 查看或调整自动生成的治理配置 |
| `opencraft:verify` | 手动运行 profile 中的验证命令 |
| `opencraft:onboard` | 治理概念引导 |

大多数时候不需要调用任何 skill——治理通过 hooks 自动运行。

## Hooks

| Hook | 事件 | 作用 |
|------|------|------|
| `session-start.cjs` | SessionStart | 检测技术栈、生成 profile、注入治理上下文 |
| `post-tool-use.cjs` | PostToolUse (git commit) | 运行 profile 中的验证命令，失败则拒绝提交 |
| `stop.cjs` | Stop | 检查未提交变更，提醒验证 |

## 可见性

Opencraft 采用三级可见性策略：

- **静默（Level 0）** — 验证通过：无输出
- **提示（Level 1）** — 会话启动状态摘要：`[opencraft] ✅ Go | 2 changes | 42-line CLAUDE.md`
- **阻塞（Level 2）** — 验证失败：错误详情 + 提交被拒绝

## 兼容插件

| 插件 | 定位 | 兼容？ |
|------|------|--------|
| [Superpowers](https://github.com/anthropics/claude-plugins-official) | TDD、调试、代码审查 | 是 — 互补 |
| [OpenSpec](https://github.com/fission-ai/openspec) | 变更管理、结构化工作流 | 是 — opencraft 读取活跃变更作为上下文 |

不会冲突——opencraft 使用 `<opencraft-context>` 标签，不影响其他插件。

## License

MIT
