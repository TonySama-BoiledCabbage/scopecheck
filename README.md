# ScopeCheck V2 → Frame 本地适配

已恢复右上角中英文切换，首次默认英文并记住选择。任务竖排与日历日期换行已修复，详见 `BILINGUAL_FIX.md`。已有中文项目和原文不会被自动改写。英文演示可使用新建的 `ScopeCheck English Demo` 项目。

前端基础是用户指定的 `ScopeCheck_Web_Prototype_V2`。没有使用 ScopeApp.tsx，没有创建云端项目数据库。项目、工作项、审核、变更和基线继续使用 Frame 的 localStorage；文件原件继续使用 IndexedDB `frame-originals/files`。

独立 Git 仓库，分支 `scopecheck/frame-adapter`。原型原件留在 `reference/`，Frame 的 domain、store、ingest、media-db 直接复制复用；主项目及其他演示未修改。

## 启动

在本目录双击 `START_SCOPECHECK.cmd`，或在 PowerShell 执行：

```powershell
Copy-Item .env.example .env.local # 已有 .env.local 时无需执行
npm run dev
```

打开 <http://127.0.0.1:5190/>。本次交付已复制现有 Node 依赖并配置 `.env.local`。后续经用户授权，另在工作目录部署了 Ollama 与 qwen2.5:1.5b；操作见 `LOCAL_AI_GUIDE.md`。端口占用会明确报错，不会自动换端口或停止其他演示。已有服务运行时直接打开页面即可。

`FRAME_PYTHON` 使用原 Frame 配置的 Python 3.12；`FRAME_PARSER_PATH`、`FRAME_MODELS_PATH` 只读复用原项目现有解析包和模型。Python 3.14 能解析文字/PDF，但无法加载现有 NumPy cp312 的 OCR 扩展，故不要替换解释器。移动目录时按实际位置调整 `.env.local`；它不入 Git。缺少 Node 依赖时可自行执行 `npm ci`，启动脚本不自动安装依赖或模型。

```powershell
npm run typecheck
npm test
npm run build
npm run preview # 先停止本目录 dev；preview 同样提供本地解析与 Ollama 接口
node scripts/verify-http.mjs # 服务运行时
```

不要用文件双击或普通静态文件服务器运行 `index.html`/`dist`：需要 Vite 的解析插件与 localhost 安全上下文。

## 浏览器数据边界

localStorage 和 IndexedDB 按完整来源（协议、主机、端口、浏览器配置文件）隔离。5190 不会读取 5182/5183 的现有项目。本次没有导入、迁移、清理任何既有数据。新来源默认展示的是 Frame 明确标识的演示种子；新建项目会创建真正的独立空项目，初始基线没有合同批准信息。

若之后需要在原 Frame 来源中使用这套前端，须由使用者先停止原来源服务，再以相同主机和端口启动这份适配目录，例如 `npm run dev -- --port 5182`。这会直接读取该浏览器来源的既有存储，后续操作也会写入这些真实项目；本次未执行此操作。`localhost` 和 `127.0.0.1` 也不是相同来源。不要为“共享数据”复制 localStorage 或更换存储方案。

## 使用

1. 项目 → 新建项目；项目右上 `•••` 可编辑名称和客户。
2. 项目 → 待办 → 添加任务；点任务、周历事件或时间轴条目可编辑。普通内部任务直接持久化，正式节点/范围风险只记录提议。
3. 捕捉新信息 → 文字或文件 → **保存原件并解析（规则整理）**。按真实解析结果产生候选，原文/文件先留存，失败保留输入、文件选择与原件；成功部分不回滚或伪称整批成功。
4. 待确认 → 查看原文 → 修正或确认内容。确认内容不会修改任务、额度或基线；有不确定项时须显式核对声明。
5. 确认后的候选可“落实到工作项”，默认勾选范围风险。需要正式审查的候选出现在项目 → 变化；继续填写影响、额度、理由、批准人、日期及书面依据，由原领域规则决定待确认、内部应用或正式基线应用。
6. 基线显示所有版本。交付日变更从“提议交付日期变更”进入，批准前不改合同日期。旧基线保留。
7. 项目 → 计划中的原件卡片可下载、重新解析，并在本机 Ollama 确实可用时选择已安装本地模型整理。规则候选显示“规则整理（非 AI）”，不会伪装为 AI 结果。未连接或无本地模型时明确不可用，没有自动降级冒充 AI。应用不自动下载模型；本轮已按用户后续授权单独部署 Qwen。

周历保留原型列与事件块，按真实日期范围绑定；Frame 没有小时字段，因此不保存原型演示中的 09:00 等虚构时间。日/月视图、小时排期、计时、账户、邮件/聊天连接与部分筛选尚无后端能力，隐藏或明确提示未接入。

导出项目 JSON 只含元数据，原件须从资料卡片单独下载；未新增备份格式。

## 文件说明

- `src/frame.ts`：小型项目/任务/审核/变更命令接口，全部通过原 store 的锁和校验写入。
- `src/adapter.ts`：原型 DOM 的数据绑定、原有弹窗中的必要表单和命令调用；在捕获阶段拦截原演示的数据动作，防止虚假成功提示。
- `src/domain/`、`src/store/project.ts`、`src/lib/media-db.ts`：原 Frame 实现，保持不改；`src/lib/ingest.ts` 仅补可选语言参数及新笔记文件名本地化。
- `scripts/parser-plugin.ts` 保持原实现；`scripts/local-ai-plugin.ts` 复用原调用与校验，仅补可选输出语言和提示词。
- `scripts/extract.py`：只补可配置解析包与模型目录，使独立目录复用已有运行环境。
- `index.html`：仅把原脚本标为模块以支持构建，并增加适配脚本。页面结构不改。
- `app.js`：仅对 V2 引用的两个不存在节点增加空值保护；其余原脚本保留。
- `styles.css`：与指定原型 SHA256 完全一致。`src/adapter.css` 补 hidden 语义、表单、语言切换按钮，以及任务行和日期表头的显示修复。
- `API.md`：能力与按钮映射、命令及 HTTP 协议。
- `VERIFICATION.md`、`verification/`：真实验证范围和结果。

浏览器真实流程检查页：<http://127.0.0.1:5190/tests/flow.html>。点击“运行验证”会在当前独立来源创建明确标记的测试项目，使用真实浏览器存储与 HTTP，不会连接其他演示的数据。它不测试操作系统文件选择器；自动选择文件受当前 Chrome 扩展权限限制。

