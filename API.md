## Local AI update

`POST /api/local-ai/extract` retains its existing request/response schema, localhost/origin/call-header checks, 4000-character per-request limit and evidence/numeric validation. `language` controls model instruction language; original excerpts retain their original language. A new response header `X-Frame-AI-Mode: local-model-selection-with-wording-guard-and-verbatim-excerpts` identifies the constrained mode. Internally, local Ollama `/api/chat` returns an actionable boolean per source unit; the adapter copies source excerpts into candidate fields and passes them through Frame validation. This is not a project CRUD service or automatic approval API.

The browser batches long originals, remaps evidence indices and persists only after every batch validates. See the current-flow section in `LOCAL_AI_GUIDE.md` for limits and verification.

# 接口与能力映射

语言扩展：`/api/local-ai/extract` 可选传入 `language: "en" | "zh"`，省略时沿用中文；响应头 `X-Frame-AI-Language` 表示本次请求语言。`extractWithOllama(sourceId,model,language?)` 和 `captureText(text,language?)` 支持同一参数。英文界面请求英文候选，quote仍须逐字对应原文；原有schema、证据校验与审核门槛保持。

## 存储架构

没有 `/api/projects`、`/api/tasks` 等服务端 CRUD。浏览器命令复用原项目 `frame-project-v1` / `frame-project:<UUID>` 元数据；每次写入使用 Web Locks、revision 和 schema 校验，写入成功后才发布内存状态。IndexedDB 保存原件 Blob，以 SHA256 为键，项目 metadata 保存来源和证据定位。项目切换绑定会话，旧会话拒绝继续写入。

| 原型控件 / 数据需求 | 实际调用 | 结果与边界 |
| --- | --- | --- |
| 项目列表、卡片、捕捉目标 | listProjects / openProject | 读取本浏览器来源的真实项目；错误条目不可默默覆盖 |
| 新建项目、项目资料 | createProject / updateProject | 独立 UUID 存储；名称与客户修改不改变日期承诺 |
| 添加任务、编辑、完成勾选 | frame.saveTask → saveItem 或 propose | 正式/范围风险必须审查，不能直接改基线 |
| 文字捕捉、文件选择 | captureText / importFiles | 原件先存 IndexedDB，再登记来源，再 HTTP 解析，再保存候选 |
| 原件卡片、重新解析 | getOriginal / retrySource | 失败保留原件；同项目同哈希去重 |
| 候选修正、确认、移除 | editBlock / frame.review | 证据不改；审核 revision 防覆盖；确认不等于批准 |
| 落实工作项 | frame.commit → commitBlock | 明确的人工作项选择；范围/正式项只提议 |
| 变化审查 / 重评 / 撤回 | frame.decide / refreshChange / withdraw | 检查 dataRevision、额度、范围授权和批准依据 |
| 基线记录、正式截止日 | baselines / frame.proposeDelivery | 提议不改日期，批准追加版本，不覆盖旧基线 |
| 本地 AI 状态 / 原件 AI 整理 | models / extractWithOllama | 只用已安装的本机模型；模型输出经 schema、逐字证据和数字校验 |
| 搜索 / 导出 | 真实本地项目、任务、需求 / exportProject | 没有把演示搜索结果冒充真实数据；导出不含 Blob |
| 日/月视图、小时排期、账户等 | 无对应业务接口 | 保留周历结构并显示真实日期；未接入能力明确标示或隐藏 |

## 浏览器命令

从 `src/frame.ts` 导入 `frame`；解析入口另从 `src/lib/ingest.ts` 导入。所有写命令返回 Promise，失败抛错（注意原 ingest 的 importFiles/retrySource 用 `useIngest.getState().error` 报告部分失败）。不能仅凭 Promise resolve 提示整批成功。

```ts
const key = await frame.createProject({name:'项目',client:'客户',start:'2026-10-18'})
frame.openProject(key)
const session = frame.projectSession() // 表单打开或异步处理开始时捕获
const before = session.read()
await frame.saveTask(item, originalItemOrNull, session)
await frame.review(block.id, block.review.revision, 'confirmed', acknowledged, session)
await frame.commit(block.id, block.review.revision, item, before.dataRevision, session)
await frame.proposeDelivery('2026-12-20', before.dataRevision, session)
await frame.decide(change.id, decision, session)
```

`Item`、`Decision` 的完整类型和 Zod 约束在 `src/domain/model.ts`。批准必须由操作者登记真实批准人、非未来日期和书面依据；估算信息不足时必须人工核查；范围风险还需独立范围授权，额度余额不能替代授权。已应用变更不可重复提交，过期评估需 `refreshChange` 后重新核对。

```ts
await importFiles(files)
const ingest = useIngest.getState()
if (ingest.error) throw Error(ingest.error)
// 通过来源 status、parser、warnings、blocks 核对每一份资料的真实结果。
```

## HTTP

仅限 `http://127.0.0.1:<port>` 或 `http://localhost:<port>`；每次必须带 `X-Frame-Parser: local-v1`。有 Origin 时必须与 Host 完全同源。保留原插件的本机 Host、同源、方法、大小、超时及结构校验。

| 方法与路径 | 请求 | 成功 | 失败 |
| --- | --- | --- | --- |
| POST `/api/extract?name=<文件名>&mime=<MIME>` | `Content-Type: application/octet-stream`，原始文件 bytes；最多50MB | `{parser,warnings,units:[{text,locator,page,bounds,startSeconds,endSeconds,eventTimeRaw,occurredAt,author}]}` | `{error}`；403 非本机/非同源/缺调用头，405 方法，413 大小，422 解析，500 运行环境 |
| GET `/api/local-ai/models` | 调用头 | `{models:[name],endpoint}`，仅已安装本地模型 | 503 `{error}`，UI 显示不可用 |
| POST `/api/local-ai/extract` | JSON `{model,units}`；最多40个证据片段、4000字、256KB | `{suggestions:[{evidenceIndex,quote,title,description,uncertainties}]}` | 503 `{error}`，已有原件与候选不变 |

AI 接口最长120秒；原件解析最长5分钟。不会创建云端项目，没有模型拉取接口。返回文字、原件和 README 都作为不可信项目资料处理，不授予操作权限；本地 AI 系统提示同样要求不遵守资料中的指令。

失败恢复：输入和文件选择保持；从原件卡片查看错误并重新解析。若 IndexedDB 成功、metadata 因容量失败而未登记，原件仍在，重新选择同一文件或提交同一原文即可按哈希恢复登记。不要清理浏览器数据来“修复”解析错误。

## Optional verified date hint in local AI responses

`POST /api/local-ai/extract` retains its existing request shape. Internally Qwen returns `{actionable, dateQuote}`; `dateQuote` is an exact substring of that evidence unit or null. The adapter response retains `suggestions` and may add `dateHint: {quote: "within three days", date: "2026-10-22"}` to a suggestion when the unit's source-message date is 2026-10-19. This optional field is independently recomputed by `validateAiSuggestions` before persistence. Missing or unverifiable context leaves the date unset. It is a proposed work date, not approval or a model-generated duration. No new storage backend or endpoint is introduced.
