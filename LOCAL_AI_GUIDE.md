## Current local AI flow (supersedes earlier generation notes)

Capture Context now defaults to **Ollama Local AI**, with an explicit model selector, connection status, Check Again button and **Save & Organise with Local AI** action. Rules remain a separate explicit choice, labelled **Original Segments (Rules, not AI)**. If no local model is available, the AI action is disabled; failed AI requests never silently become rule results.

For an already saved original, open Review and use **Organise Latest Original with Local AI**. Candidate filters separate local AI selections, manual work, all original segments and all active review records. Original-segment view includes evidence retained in earlier/replaced AI drafts, so a model rejection cannot make source text disappear.

Qwen 1.5B is used for per-message request classification through Ollama's chat API with actual system/user/assistant roles. A clearly labelled request-wording guard runs before classification. Titles are excerpts from a request-bearing sentence; descriptions and quotes are copied verbatim from the same original segment. The UI explicitly labels this hybrid as **Ollama AI Selection · Source Excerpt + Wording Check**. It does not present model-written interpretations as source facts or translate original-language evidence.

Long sources are processed in sequential batches (up to 6 original units, approximately 1800 characters per batch; a single unit may use the existing 4000-character API limit). Original units and global evidence indices are preserved. All batches must pass the original Frame validation before candidates are persisted. The overall domain result still permits at most 40 suggestions per extraction. Progress shows the real batch number. Reprocessing dismisses only untouched, unreviewed AI drafts through existing domain review events; manual edits, reviewed/committed work and user placements are preserved.

Real browser result for the user's current ARC conversation: 6 batches completed; 20 local AI selections saved; 2 manual records retained; 34 unique original segments remain readable; formal work items remain 0 and delivery remains unagreed. Candidate count is not an accuracy score. The small model still misses some nuances (including one requested presentation date change in this run), and the conservative wording guard may miss indirect requests. Review the original-segment view for omissions. No model was downloaded or changed.

Verification: 37 Node tests, typecheck and build pass. UI evidence: `verification/ai-repair-ui.json`, `verification/ai-repaired-review.png`, `verification/ai-capture-choice.png`. A further command-line HTTP/model regression run was not executed because automatic approval review hit its usage limit; it is not reported as passed. The earlier tool outputs and documents describe earlier protocol versions and should be read historically. Reproducible mixed-case check: `node scripts/verify-ai-mixed.mjs` (requires the local service and model).

## 页面入口

右上角的 **本地 AI / Local AI** 是常驻入口，点击打开本地服务面板并重新读取连接状态。面板展示 Ollama 地址、实际已安装模型和重新检测按钮。当前实测模型为 `qwen2.5:1.5b`。

实际整理：项目 → 计划 → 项目资料 → 查看原件 → Ollama 整理。模型不可用时，模型选择器和整理按钮保留但禁用；重新检测按钮仍可用。不会自动下载模型。

本次修复已实测 EN/ZH 入口及本地服务状态；TXT、PDF、PNG 解析与模型列表等8项HTTP检查通过。截图：`verification/local-ai-entry.png`。

# 本机模型启动与比赛演示

本轮使用官方 Ollama 便携版与 `qwen2.5:1.5b`。模型是开放权重模型，采用 Apache 2.0 许可；资料经现有 HTTP 插件发往本机11434端口，不使用 DeepSeek、OpenAI 或其他云端模型 API。

## 每次启动

1. 双击本目录 `START_LOCAL_AI.cmd`，保留服务窗口。若11434已运行同一服务，不需要重复启动。
2. 双击 `START_SCOPECHECK.cmd`，保留网页服务窗口。若5190已运行，不需要重复启动。
3. 浏览器打开 <http://127.0.0.1:5190/>，进入个人设置，点“重新检测”。应显示本地模型可用。

模型与运行程序放在此交付目录的上两级 `work/ollama/` 中：`runtime/ollama.exe` 和 `models/`。没有加入系统 PATH，没有设开机自启动。压缩包不包含大型运行程序或模型；移动交付目录时需相应保留工作目录，或另行安装官方 Ollama 并运行同一模型。

原件解析继续使用原 Frame 已有的 Python 环境。所有服务都只监听本机；`127.0.0.1:5190` 无法让比赛评委远程访问，因此提交本机运行的视频演示。

## 录屏步骤

1. 新建项目 `ScopeCheck AI demo`，用合成的客户反馈，避免展示真实客户资料。
2. 点击“捕捉新信息”，输入：

   ```text
   Please add a 9:16 version of the launch video. We still need to confirm whether this is included in the current scope.
   ```

3. 点“保存原件并解析（规则整理）”。这里仅完成原件留存和规则解析，不能在视频里称为模型生成。
4. 关闭捕捉弹窗，进入项目 → 计划 → 原件卡片“查看 / 重试”。选择 `qwen2.5:1.5b`，点“Ollama 整理”。
5. 等待真实模型返回后，进入“待确认”，展示标为 **Ollama 本地 AI 候选** 的需求、逐字原文证据和不确定项。
6. 点“确认内容”，解释这不会自动修改正式计划。再点“落实到工作项”，保留范围风险，保存为变更提议。
7. 在“变化”展示审查，说明没有书面批准时计划和基线不会提前改变。若演示批准，使用明确标为测试的批准人和依据，并展示旧基线仍保留。

建议视频2–3分钟，重点展示真实模型候选与原文之间的关系。无需把整个软件的所有页面都展示一遍。

## 验证和排错

```powershell
node scripts/verify-ai.mjs
```

此检查通过 ScopeCheck 本地 HTTP 接口向真实模型提交3份合成反馈，检查结构、非空候选、原文引用，并输出每次耗时。不会修改项目数据。

- 模型不可用：检查本机服务窗口，再到个人设置重新检测。
- 模型整理报错：保留原件，检查错误提示；不要把规则候选改名冒充 AI。
- 第一次整理较慢：需要加载模型。不要重复点击，等待结果或明确错误。
- 模型输出未通过证据校验：结果不会保存，可缩短原文后重试。
- AI请求最多40个片段、4000字；演示时使用上述短反馈。

来源：[Ollama Windows 文档](https://docs.ollama.com/windows)、[Qwen2.5 1.5B 模型与许可](https://ollama.com/library/qwen2.5:1.5b)。
