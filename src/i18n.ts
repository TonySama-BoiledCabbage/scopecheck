import {prototypePairs} from './prototype-translations.ts'

export type Language='en'|'zh'
let language:Language='en'
export const getLanguage=()=>language
const additions:[string,string][]=[
  ['待审提议 · ','Pending proposal · '],['拟议日期：','Proposed dates: '],['虚线为待审提议预览，尚未批准，不会修改正式任务或基线。','Dashed entries preview pending proposals. They are not approved and do not change tasks or baselines.'],['未排期：以下记录没有日期，因此没有时间条。','Unscheduled: these records have no dates, so no timeline bar is shown.'],
  ['查看变更审查','View Change Review'],['查看已创建任务','View Created Task'],['查看时间轴','View Timeline'],['任务已保存，已打开时间轴。','Task saved. Timeline opened.'],['任务已保存；尚未排期，请填写日期后显示时间条。','Task saved without dates. Add dates to display a timeline bar.'],['已保存为待审提议，时间轴显示虚线预览；尚未批准。','Saved as a pending proposal with a dashed timeline preview. It is not approved.'],['未找到已保存的任务或变更提议，请保留输入并重试。','No saved task or proposal found. Keep your input and retry.'],
  ['搜索项目、任务… 或输入 /clear','Search projects, tasks… or type /clear'],['清空网页测试数据（可恢复）','Clear web demo data (recoverable)'],['仅支持 /clear 网页命令','Only the /clear web command is supported'],['正在处理，请稍后再清空。','Processing is in progress. Wait before clearing.'],
  ['原文片段（只读）','Original Segment (Read Only)'],['人工核对','Review Manually'],
  ['Ollama AI 筛选 · 原文摘录（含句式校验）','Ollama AI Selection · Source Excerpt + Wording Check'],['AI 筛选后摘录原文，含请求用语校验；候选仍需人工核对。','AI selects requests with a wording check; candidate content is quoted from the original and still needs human review.'],
  ['全部','All'],
  ['保存并用本地 AI 整理','Save & Organise with Local AI'],['原文片段（规则，非 AI）','Original Segments (Rules, not AI)'],['用本地 AI 整理最新原件','Organise Latest Original with Local AI'],['本地 AI 候选','Local AI Suggestions'],['整理方式','Processing method'],['本地 AI 不可用，请重新检测；不会自动改用规则整理。','Local AI unavailable. Check the connection again; processing will not fall back to rules.'],['本地 AI 未找到可提取的需求；原件保留。','Local AI found no actionable requests. The original is retained.'],['单个原文片段超过4000字，请分段后重试；原件保留。','A single source segment exceeds 4000 characters. Split it and retry; the original is retained.'],
  ['清空演示样例（可恢复）','Clear Demo Samples (Recoverable)'],['清空演示样例','Clear Demo Samples'],['清空上述样例（可恢复）','Clear Listed Samples (Recoverable)'],['恢复上次样例备份','Restore Previous Samples'],['以下项目将从展示中清空，替换为一个空白项目。本机保留恢复备份和原件；不会删除模型。','The listed projects will be replaced with one empty project. A local recovery backup and originals will be retained. Installed models are kept.'],['样例已清空，空白项目已保存；可在本地 AI 中恢复备份。','Samples cleared and an empty project saved. Restore the backup from Local AI.'],['样例备份已恢复。','Sample backup restored.'],
  ['日视图','Day'],['周视图','Week'],['月视图','Month'],['上一个周期','Previous period'],['下一个周期','Next period'],['当天暂无已排期工作项','No scheduled work items on this day'],
  ['打开项目资料，选择原件后点击 Ollama 整理。','Open project materials, select an original, then choose Organise with Ollama.'],['本地模型不可用','Local model unavailable'],['本地模型：','Local models:'],['本地 AI','Local AI'],
  ['当前项目的日期范围；未设置小时排期。','Date ranges for the current project. No hourly appointments.'],['上一周','Previous week'],['下一周','Next week'],['选择日期','Choose date'],['今天','Today'],['未定结束日期','No end date'],['未排期','Unscheduled'],['未定','Not set'],
  ['主导航','Main navigation'],['个人设置','Workspace Settings'],
  ['规则整理与本地 AI 的候选分别标识；确认内容不会批准改期。','Rule-based and local AI suggestions are labelled separately. Confirming content does not approve a deadline change.'],
  ['保存沿用 Frame 校验；正式承诺或范围风险仅记录为变更提议。','Frame validates every save. Formal commitments and scope risks are recorded as change proposals.'],
  ['已逐条核对不确定项；此操作不批准日期、额度或范围','I have reviewed the uncertainties. This does not approve dates, allowances, or scope.'],
  ['无规则识别的不确定项；仍需人工核对。','No uncertainties flagged by rules. Human review is still required.'],
  ['点击候选查看原文；确认内容不会批准改期。','Open a suggestion to review its source. Confirming content does not approve rescheduling.'],
  ['原件请在项目资料中单独下载。聊天、邮箱、账户与计时服务尚未接入。','Download originals individually from project materials. Chat, email, accounts, and time tracking are not connected.'],
  ['原件先保存在本机；解析失败可重试，不会批准需求。','Originals are saved locally first. Failed parsing can be retried; requirements are not approved automatically.'],
  ['原件先保存在本机；解析失败可重试。','Originals are saved locally first. Failed parsing can be retried.'],
  ['原件留存在 IndexedDB；规则整理与本地 AI 候选分别标识。','Originals are retained in IndexedDB. Rule-based and local AI suggestions are labelled separately.'],
  ['原件与规则整理候选已保存；请在待确认页面审核。','Originals and rule-based suggestions saved. Review them in the review queue.'],
  ['原件与解析结果已保存（规则整理）','Originals and parsing results saved (rule-based)'],
  ['保存原件并解析（规则整理）','Save & Parse (Rules)'],['保存原件并整理候选','Save originals and organise suggestions'],
  ['重新解析（规则整理）','Parse Again (Rules)'],['解析结果已保存（规则整理）','Parsing results saved (rule-based)'],
  ['Ollama 候选已保存，等待人工审核','Ollama suggestions saved for human review'],
  ['规则整理（非 AI）','Rule-based (not AI)'],['Ollama 本地 AI 候选','Ollama Local AI Suggestion'],['Ollama 本地 AI','Ollama Local AI'],['人工整理','Manually organised'],
  ['本机工作空间','Local Workspace'],['本地服务','Local Services'],['重新检测 →','Check Again →'],['导出当前项目元数据','Export Project Metadata'],
  ['欢迎回来，设计师。','Welcome back, designer.'],['当前项目：','Current project: '],[' · 数据保存在此浏览器来源中。',' · Data is saved in this browser origin.'],
  ['未接入计时','Timer not connected'],['当前项目尚无任务','This project has no tasks yet'],['尚无工作项，点击添加任务。','No work items yet. Add a task to get started.'],
  ['本周暂无已排期工作项','No scheduled work items this week'],['暂无待审核需求。','No requirements to review.'],['暂无变更记录。','No change records yet.'],['尚未上传原件。','No originals uploaded yet.'],
  ['Frame 演示数据 · 本机独立存储','Frame demo data · Separate local storage'],['FRAME DEMO · 本机演示数据','FRAME DEMO · Local demo data'],['项目读取失败','Unable to read project'],
  ['查看全部','View all '],[' 个工作项',' work items'],[' 个 →',' →'],['当前项目原件','Project Originals'],['本机原件','Local Original'],
  ['Ollama：检测中…','Ollama: checking…'],['Ollama 可用 · ','Ollama available · '],[' 个本地模型',' local model(s)'],['Ollama 不可用：','Ollama unavailable: '],
  ['未发现已安装的本地模型','No installed local models found'],['本地 AI 不可用','Local AI is unavailable'],['本地模型','Local model'],['Ollama 整理','Organise with Ollama'],
  ['未连接本机Ollama。请启动本地服务并安装模型；也可明确选择规则整理。','Cannot connect to local Ollama. Start the local service and install a model, or explicitly choose rule-based processing.'],
  ['AI返回了无法对应原文的证据，结果未保存。','AI returned a quote that does not match the source. The result was not saved.'],
  ['本地AI响应结构或证据不合法，结果未保存。','Invalid local AI response structure or evidence. The result was not saved.'],
  ['请先选择文件。','Choose a file first.'],['请先输入客户反馈或会议笔记。','Enter client feedback or meeting notes first.'],['请等待当前处理结束。','Wait for the current operation to finish.'],
  ['正在保存原件，请等待处理结束。','Saving originals. Wait for the operation to finish.'],['正在保存原件…','Saving originals…'],['正在解析 ','Parsing '],[' · 原件已留存',' · Original retained'],
  ['本地AI正在整理需求；原件已保存…','Local AI is organising requirements; originals are saved…'],['本机用户','Local user'],
  ['任务状态已保存','Task status saved'],['任务已保存到本机','Task saved locally'],['项目已保存到本机','Project saved locally'],
  ['变更提议已保存，计划与基线未改变','Change proposal saved. The plan and baseline are unchanged.'],['已记录变更提议；任务状态未变','Change proposal recorded. Task status is unchanged.'],
  ['需求内容已确认，计划与基线未改变','Requirement content confirmed. The plan and baseline are unchanged.'],['建议已移除，原件保留','Suggestion dismissed. The original is retained.'],
  ['修正已保存，重新待审','Edits saved. The suggestion needs review again.'],['请先保存修正，再确认内容。','Save your edits before confirming the content.'],
  ['提议已记录，尚未修改项目。','Proposal recorded. The project has not changed.'],['提议已记录，尚未批准改期','Proposal recorded. Rescheduling is not approved.'],
  ['提议已撤回，计划与基线未改变','Proposal withdrawn. The plan and baseline are unchanged.'],
  ['按人工登记的批准依据更新正式基线，保留旧版本。','Formal baseline updated using the recorded approval evidence. Previous versions are retained.'],
  ['仅更新内部计划，正式基线保持不变。','Only the internal plan was updated. The formal baseline is unchanged.'],
  ['范围变更尚未按合同单独授权','Scope change has not been separately authorised'],['等待客户确认','Awaiting client confirmation'],
  ['请填写客户确认人、确认日期及书面依据。','Enter the approver, approval date, and written evidence.'],
  ['请逐条核对并勾选不确定项声明；确认内容不会确认日期、额度或批准状态。','Review each uncertainty and tick the acknowledgement. Confirming content does not confirm dates, allowances, or approval.'],
  ['项目已变化。请关闭并从变更记录重新评估，避免覆盖新的安排。','The project has changed. Reassess the change before continuing.'],
  ['结束日期不能早于开始日期','End date cannot precede start date'],['批准日期不能在未来。','Approval date cannot be in the future.'],
  ['此筛选尚未接入','This filter is not connected yet'],['当前显示本周真实日期范围；小时排期和日 / 月视图尚未接入','Showing actual date ranges for this week. Hourly, day, and month scheduling are not connected.'],
  ['任务名称','Task name'],['新增任务','New Task'],['添加任务','Add Task'],['编辑任务','Edit Task'],['任务','Task'],['名称','Name'],
  ['新建项目','New Project'],['编辑项目','Edit Project'],['项目名称','Project name'],['保存项目','Save Project'],['选择项目','Choose Project'],['客户','Client'],
  ['正式里程碑','Formal Milestone'],['内部任务','Internal Task'],['阶段目标','Stage Goal'],['调研与定义','Research & Definition'],['概念设计','Concept Design'],['设计深化','Design Development'],['交付与归档','Delivery & Archive'],
  ['剩余自然日（未知可留空）','Remaining calendar days (leave blank if unknown)'],['开始日期','Start date'],['结束日期','End date'],['涉及范围变更','Scope change risk'],
  ['未定结束日期','No end date'],['未排期','Unscheduled'],['未约定','Not agreed'],['未登记','Not recorded'],['未开始','Not started'],['已归档','Archived'],['进行中','In progress'],['已完成','Completed'],['待安排','Unscheduled'],['未定','Unknown'],
  ['需求审核','Requirement Review'],['需求说明','Requirement description'],['保存修正','Save Edits'],['确认内容','Confirm Content'],['移除建议','Dismiss Suggestion'],['落实到工作项','Create Work Item'],['查看原件','View Original'],['已落实','Submitted'],
  ['正式变更审查','Formal Change Review'],['提议交付日期变更 →','Propose Delivery Date Change →'],['提议正式交付日期','Propose a Formal Delivery Date'],['正式交付日期','Formal delivery date'],
  ['日期差：','Date difference: '],['无法估算','Cannot estimate'],['原基线','Original baseline'],['额度已用','Allowance used'],['待确认','Needs review'],['剩余','Remaining'],
  ['工期判断','Duration assessment'],['调整后总自然日','Adjusted total calendar days'],['修改额度','Revision allowance'],['额度规则','Allowance rules'],['轮次 / 计费单元','Round / billing unit'],
  ['承诺状态','Commitment status'],['判断理由','Reason for decision'],['批准人 / 日期','Approver / Date'],['批准人','Approved by'],['批准日期','Approval date'],['书面依据','Written evidence'],['相关来源','Related sources'],
  ['已人工核查估算与影响','I have manually reviewed estimates and impact'],['已核对范围的独立合同授权','I have verified separate contractual scope authorisation'],
  ['提交审查','Submit Review'],['重新评估','Reassess'],['记录提议','Record Proposal'],['撤回','Withdraw'],['仅内部变更','Internal change only'],['登记书面批准','Record written approval'],['不消耗','Does not consume allowance'],['消耗','Consumes allowance'],['不变','Unchanged'],['已调整','Changed'],['未知','Unknown'],
  ['初始约定','Initial Agreement'],['批准记录','Approval Record'],['交付日期','Delivery date'],['交付日 →','Delivery date →'],['范围','Scope'],['额度','Allowance'],['数量','Units'],['说明','Description'],['标题','Title'],['类型','Type'],['阶段','Phase'],['状态','Status'],
  ['查看 / 重试 →','View / Retry →'],['下载原件','Download Original'],['待解析','Awaiting parsing'],['结构化消息 / 原文分段','Structured messages / source segments'],
  ['无时区或含糊日期保留原文；相对日期不自动换算。链接附件不会自动下载。','Ambiguous dates and missing time zones are retained as written. Relative dates are not converted; linked attachments are not downloaded.'],
  ['日期范围','Date range'],['无小时排期','No hourly schedule'],['日期','Date'],['周一','Mon'],['周二','Tue'],['周三','Wed'],['周四','Thu'],['周五','Fri'],['周六','Sat'],['周日','Sun'],
  ['需求 · ','Requirement · '],['项目 · ','Project · '],['任务 · ','Task · '],['无匹配结果','No matches'],['保存','Save'],['取消','Cancel'],['关闭','Close'],
]
const canonical:[string,string][]=[['RECENTLY UPDATED','最近更新'],['THIS WEEK','本周'],['TODAY','今天'],['NEEDS REVIEW','待确认'],['YOUR WORK','你的项目'],['SCHEDULE','时间安排'],['ACCOUNT','账户'],['PROJECT PLAN','项目计划'],['DESIGN INTELLIGENCE','设计智能'],['WORKFLOW','工作流程'],['DECISIONS & CHANGES','决定与变化'],['QUICK CAPTURE','快速捕捉'],['REQUIREMENT REVIEW','需求审核']]
const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const translations=new Map([...prototypePairs,...additions])
const pattern=new RegExp([...translations.keys()].sort((a,b)=>b.length-a.length).map(escaped).join('|'),'g')
export function translate(text:string,lang:Language){
  if(lang==='en')return text.replace(/^文字 · 第 (\d+) 行$/,'Text · Line $1').replace(pattern,match=>translations.get(match)!)
  const fixed=new Map(canonical)
  return text.replace(new RegExp(canonical.map(([key])=>escaped(key)).join('|'),'g'),match=>fixed.get(match)!)
}

export function initI18n(){
  try{language=localStorage.getItem('scopecheck-language')==='zh'?'zh':'en'}catch{/* Preference storage may be unavailable; English still works. */}
  const toggle=document.createElement('button');toggle.className='language-switch';toggle.dataset.noI18n='true'
  document.querySelector('.top-actions')!.prepend(toggle)
  const originals=new WeakMap<Node,{base:string;rendered:string}>()
  const attributes=new WeakMap<Element,Map<string,{base:string;rendered:string}>>()
  const protectedContent='script,style,input,textarea,#sourceModel option,#captureModel option,[contenteditable],[data-no-i18n="true"],blockquote,.project-row-main b,.project-row-main small,.project-card-copy h3,.project-card-copy p,.project-hero-detail h1,.project-hero-detail>div>p,.task-copy b,.kanban article b,.roadbar,[data-task-id] b,.review-card b,.change-item b,.change-table-row>span:first-child b,.reference-card b,.project-legend,.capture-target button'
  const observer=new MutationObserver(apply)
  function apply(){
    observer.disconnect()
    document.documentElement.lang=language==='en'?'en':'zh-CN'
    // ponytail: scan the small prototype DOM once per mutation batch; use explicit keys if it grows.
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
    let node:Node|null
    while((node=walker.nextNode())){
      if(node.parentElement?.closest(protectedContent))continue
      const text=node.nodeValue??'',old=originals.get(node),base=old&&old.rendered===text?old.base:text
      const rendered=translate(base,language);originals.set(node,{base,rendered});if(text!==rendered)node.nodeValue=rendered
    }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element=>{
      if(element.closest('[data-no-i18n="true"]')||element.matches('[data-task-id]'))return
      const saved=attributes.get(element)??new Map()
      for(const name of ['placeholder','title','aria-label']){
        const text=element.getAttribute(name);if(text===null)continue
        const old=saved.get(name),base=old&&old.rendered===text?old.base:text,rendered=translate(base,language)
        saved.set(name,{base,rendered});if(text!==rendered)element.setAttribute(name,rendered)
      }
      attributes.set(element,saved)
    })
    toggle.textContent=language==='en'?'中文':'English';toggle.setAttribute('aria-label',language==='en'?'Switch to Chinese':'切换为英文')
    observer.observe(document.body,{subtree:true,childList:true,characterData:true})
  }
  toggle.onclick=()=>{language=language==='en'?'zh':'en';try{localStorage.setItem('scopecheck-language',language)}catch{/* Keep the current session usable. */}window.dispatchEvent(new Event('scopecheck-language'));apply()}
  apply()
}
