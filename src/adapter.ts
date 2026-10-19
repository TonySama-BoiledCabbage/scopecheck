import { useProject, listProjects, openProject, createProject, projectSession, exportProject } from './store/project.ts'
import { refreshChange, withdraw, latestChanges, uid, today, addDays, dayDiff } from './domain/engine.ts'
import { editBlock } from './domain/capture.ts'
import { updateProject } from './domain/projects.ts'
import { importFiles, captureText, retrySource, extractWithOllama, useIngest } from './lib/ingest.ts'
import { getOriginal } from './lib/media-db.ts'
import { ItemSchema, type Item, type Decision } from './domain/model.ts'
import './adapter.css'
import { frame } from './frame.ts'
import { clearDemoSamples, restoreDemoSamples, DEMO_RECOVERY } from './demo-reset.ts'
import { dateBand, scheduleEntries, weekStart, calendarPeriod, stepCalendarDate, type CalendarMode } from './schedule.ts'
import { initI18n, getLanguage } from './i18n.ts'

const $=(s:string)=>document.querySelector<HTMLElement>(s)!
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const userText=(v:unknown)=>`<span data-no-i18n="true">${esc(v)}</span>`
const state=frame.read
let toastTimer:ReturnType<typeof setTimeout>, models:string[]=[]
let calendarDate=today(),calendarMode:CalendarMode='week'
let captureEngine:'ollama'|'rules'='ollama',reviewEngine='ollama'
let aiStatus='Ollama：检测中…'
function notice(message:string){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),5000)}
function close(){ $('#detailDrawer').classList.remove('open');$('#detailDrawer').setAttribute('aria-hidden','true') }
function selectProject(key:string){openProject(key);history.replaceState(null,'',`#project/${encodeURIComponent(key)}`)}
function drawer(title:string,html:string){$('#drawerEyebrow').textContent=title;$('#drawerBody').innerHTML=html;$('#detailDrawer').classList.add('open');$('#detailDrawer').setAttribute('aria-hidden','false');$('#drawerBody input, #drawerBody button')?.focus()}
function nav(view:string){$('#searchPopover').classList.remove('open');document.querySelectorAll<HTMLElement>('.view').forEach(x=>x.classList.toggle('active',x.dataset.view===view));document.querySelectorAll<HTMLElement>('.rail-item').forEach(x=>x.classList.toggle('active',x.dataset.nav===view));window.scrollTo(0,0)}
function projectPanel(panel:string){document.querySelectorAll<HTMLElement>('[data-project-content]').forEach(x=>x.classList.toggle('active',x.dataset.projectContent===panel));document.querySelectorAll<HTMLElement>('[data-project-panel]').forEach(x=>x.classList.toggle('active',x.dataset.projectPanel===panel))}
function on(id:string,fn:()=>unknown){document.getElementById(id)!.onclick=()=>void action(fn)}
let pending=false
async function action(fn:()=>unknown){if(pending)return;pending=true;try{await fn()}catch(e){const msg=e instanceof Error?e.message:String(e);const error=document.getElementById('formError');if(error)error.textContent=msg;notice(msg)}finally{pending=false}}
const errorSlot='<p id="formError" role="alert"></p>'
const field=(label:string,name:string,value:unknown='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}"></label>`
const select=(label:string,name:string,options:string[][],value:string)=>`<label>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></label>`
const statuses=[['planned','未开始'],['active','进行中'],['done','已完成']]
const phases=[['research','调研与定义'],['concept','概念设计'],['development','设计深化'],['delivery','交付与归档']]
function formData(){return new FormData(document.querySelector<HTMLFormElement>('#frameForm')!)}
function taskEditor(id?:string,blockId?:string){
  const session=projectSession(),s=session.read(),original=s.items.find(i=>i.id===id)??null,b=s.blocks.find(b=>b.id===blockId)
  const item:Item=original??{id:uid(),title:b?.title??'',kind:'task',phase:b?.placement.phase??'research',status:'planned',start:null,end:null,remainingDays:null,goal:b?.description??'',scopeRisk:!!b}
  drawer('TASK · FRAME',`<h2>${original?'编辑':'添加'}任务</h2><form id="frameForm" class="center-form">${field('任务名称','title',item.title)}${select('类型','kind',[['task','内部任务'],['milestone','正式里程碑'],['stage','阶段目标']],item.kind)}${select('阶段','phase',phases,item.phase)}${select('状态','status',statuses,item.status)}${field('开始日期','start',item.start,'date')}${field('结束日期','end',item.end,'date')}${field('剩余自然日（未知可留空）','remainingDays',item.remainingDays,'number')}<label>说明<textarea name="goal">${esc(item.goal)}</textarea></label><label><input name="scopeRisk" type="checkbox" ${item.scopeRisk?'checked':''}>涉及范围变更</label></form><p>保存沿用 Frame 校验；正式承诺或范围风险仅记录为变更提议。</p>${errorSlot}<div class="drawer-actions"><button id="saveTask">保存</button><button data-frame-close>取消</button></div>`)
  on('saveTask',async()=>{
    const f=formData(),next={...item,title:String(f.get('title')),kind:String(f.get('kind')) as Item['kind'],phase:String(f.get('phase')) as Item['phase'],status:String(f.get('status')) as Item['status'],start:String(f.get('start'))||null,end:String(f.get('end'))||null,remainingDays:f.get('remainingDays')===''?null:Number(f.get('remainingDays')),goal:String(f.get('goal')),scopeRisk:f.has('scopeRisk')}
    if(b)await frame.commit(b.id,b.review.revision,next,s.dataRevision,session)
    else await frame.saveTask(next,original,session)
    const after=session.read(),normalized=ItemSchema.parse(next)
    const saved=after.items.find(i=>i.id===next.id&&JSON.stringify(i)===JSON.stringify(normalized))
    const change=latestChanges(after).find(c=>c.proposed.kind==='item'&&c.proposed.item.id===next.id&&['proposed','pending'].includes(c.status))
    if(!saved&&!change)throw Error('未找到已保存的任务或变更提议，请保留输入并重试。')
    render();close();nav('project')
    if(saved){projectPanel('plan');notice(saved.start||saved.end?'任务已保存，已打开时间轴。':'任务已保存；尚未排期，请填写日期后显示时间条。')}
    else{projectPanel('changes');changeEditor(change!.id);notice('已保存为待审提议，时间轴显示虚线预览；尚未批准。')}
  })
}
function projectEditor(fresh=false){
  const session=projectSession(),original=session.read().project
  drawer('PROJECT · FRAME',`<h2>${fresh?'新建':'编辑'}项目</h2><form id="frameForm" class="center-form">${field('项目名称','name',fresh?'':original.name)}${field('客户','client',fresh?'':original.client)}${fresh?field('开始日期','start','','date'):''}</form>${errorSlot}<div class="drawer-actions"><button id="saveProject">保存项目</button><button data-frame-close>取消</button></div>`)
  on('saveProject',async()=>{const f=formData();if(fresh){const key=await createProject({name:String(f.get('name')),client:String(f.get('client')),start:String(f.get('start'))||null});selectProject(key)}else await session.run(s=>updateProject(s,{name:String(f.get('name')),client:String(f.get('client')),archived:original.archived},original));render();close();nav('project');notice('项目已保存到本机')})
}
function reviewEditor(id:string){
  const session=projectSession(),b=session.read().blocks.find(x=>x.id===id)!
  const source=session.read().sources.find(x=>x.id===b.sourceId)!
  const committedItem=b.commit&&session.read().items.find(i=>i.id===b.commit!.itemId)
  drawer('REQUIREMENT · FRAME',`<h2 data-no-i18n="true">${esc(b.title)}</h2><p>${esc(b.engine==='rules'?'规则整理（非 AI）':b.engine==='ollama'?'Ollama 本地 AI 候选':'人工整理')} · ${esc(b.review.status)}</p><div class="detail-source">${userText(source.name)} · <span>${esc(b.evidence.locator)}</span></div><blockquote>${esc(b.evidence.text)}</blockquote><form id="frameForm" class="center-form">${field('标题','title',b.title)}<label>需求说明<textarea name="description">${esc(b.description)}</textarea></label><p ${b.uncertainties.length?'data-no-i18n="true"':''}>${b.uncertainties.map(esc).join('<br>')||'无规则识别的不确定项；仍需人工核对。'}</p><label><input type="checkbox" name="ack">已逐条核对不确定项；此操作不批准日期、额度或范围</label></form>${errorSlot}<div class="drawer-actions">${!b.commit?'<button id="editBlock">保存修正</button><button id="confirmBlock">确认内容</button><button id="dismissBlock">移除建议</button>':''}${b.review.status==='confirmed'&&!b.commit?'<button id="commitBlock">落实到工作项</button>':''}${b.commit?.changeId?`<button data-change-id="${esc(b.commit.changeId)}">查看变更审查</button>`:''}${committedItem?`<button data-task-id="${esc(committedItem.id)}">查看已创建任务</button><button data-open-plan>查看时间轴</button>`:''}<button data-source="${esc(source.id)}">查看原件</button></div>`)
  if(b.commit)return
  on('editBlock',async()=>{const f=formData();await session.run(s=>editBlock(s,id,b.review.revision,String(f.get('title')),String(f.get('description'))));render();reviewEditor(id);notice('修正已保存，重新待审')})
  on('confirmBlock',async()=>{const f=formData();if(String(f.get('title'))!==b.title||String(f.get('description'))!==b.description)throw Error('请先保存修正，再确认内容。');await frame.review(id,b.review.revision,'confirmed',f.has('ack'),session);render();reviewEditor(id);notice('需求内容已确认，计划与基线未改变')})
  on('dismissBlock',async()=>{await frame.review(id,b.review.revision,'dismissed',false,session);render();close();notice('建议已移除，原件保留')})
  if(b.review.status==='confirmed')on('commitBlock',()=>taskEditor(undefined,id))
}
function changeEditor(id:string){
  const session=projectSession(),c=latestChanges(session.read()).find(c=>c.id===id)!
  const appliedItemId=c.proposed.kind==='item'?c.proposed.item.id:null
  drawer('CHANGE REVIEW · FRAME',`<h2>正式变更审查</h2><p ${c.proposed.kind==='item'?'data-no-i18n="true"':''}>${esc(c.proposed.kind==='item'?c.proposed.item.title:c.proposed.kind==='delivery'?`交付日 → ${c.proposed.date}`:'额度规则')}</p><p>${esc(c.outcome)}</p>${c.proposed.kind==='item'?`<p>拟议日期：${esc(c.proposed.item.start??'未排期')} — ${esc(c.proposed.item.end??'未定结束日期')}</p>`:''}<p>日期差：${esc(c.assessment.deltaDays??'无法估算')} 天<br>${c.assessment.warnings.map(esc).join('<br>')}</p><p>原基线 V${c.assessment.baseline.version} · 额度已用 ${c.assessment.consumed} · 待确认 ${c.assessment.pending} · 剩余 ${esc(c.assessment.remaining??'未知')}</p><form id="frameForm" class="center-form">${select('工期判断','duration',[['unknown','未知'],['unchanged','不变'],['changed','已调整']],c.decision?.duration??'unknown')}${field('调整后总自然日','durationDays',c.decision?.durationDays,'number')}${select('修改额度','allowance',[['unknown','待确认'],['no','不消耗'],['yes','消耗']],c.decision?.allowance??'unknown')}${field('轮次 / 计费单元','allowanceKey',c.decision?.allowanceKey)}${field('数量','units',c.decision?.units??1,'number')}${select('承诺状态','commitment',[['needs_confirmation','等待客户确认'],['internal','仅内部变更'],['approved','登记书面批准']],c.decision?.commitment??'needs_confirmation')}${field('判断理由','reason',c.decision?.reason)}${field('批准人','approvedBy',c.decision?.approvedBy)}${field('批准日期','approvedAt',c.decision?.approvedAt,'date')}<label>书面依据<textarea name="evidence">${esc(c.decision?.evidence)}</textarea></label>${field('相关来源','relatedSources',c.decision?.relatedSources)}<label><input type="checkbox" name="manualReview">已人工核查估算与影响</label><label><input type="checkbox" name="scopeAuthorized">已核对范围的独立合同授权</label></form>${errorSlot}<div class="drawer-actions">${['proposed','pending'].includes(c.status)?'<button id="decideChange">提交审查</button><button id="refreshChange">重新评估</button><button id="withdrawChange">撤回</button>':''}${appliedItemId&&session.read().items.some(i=>i.id===appliedItemId)?'<button data-open-plan>查看时间轴</button>':''}<button data-frame-close>关闭</button></div>`)
  if(!['proposed','pending'].includes(c.status))return
  on('decideChange',async()=>{const f=formData();await frame.decide(id,{duration:f.get('duration'),durationDays:f.get('durationDays')===''?null:Number(f.get('durationDays')),allowance:f.get('allowance'),allowanceKey:f.get('allowanceKey'),units:Number(f.get('units')),commitment:f.get('commitment'),reason:f.get('reason'),evidence:f.get('evidence'),approvedBy:f.get('approvedBy'),approvedAt:f.get('approvedAt')||null,relatedSources:f.get('relatedSources'),manualReview:f.has('manualReview'),scopeAuthorized:f.has('scopeAuthorized')} as Decision,session);render();changeEditor(id);notice(latestChanges(session.read()).find(c=>c.id===id)!.outcome)})
  on('refreshChange',async()=>{await session.run(s=>refreshChange(s,id).state);render();changeEditor(id)})
  on('withdrawChange',async()=>{await session.run(s=>withdraw(s,id));render();close();notice('提议已撤回，计划与基线未改变')})
}
function deliveryEditor(){const session=projectSession(),s=session.read();drawer('BASELINE · FRAME',`<h2>提议正式交付日期</h2><form id="frameForm" class="center-form">${field('交付日期','date',s.baselines.at(-1)!.deliveryDate,'date')}</form>${errorSlot}<div class="drawer-actions"><button id="proposeDelivery">记录提议</button></div>`);on('proposeDelivery',async()=>{await frame.proposeDelivery(String(formData().get('date'))||null,s.dataRevision,session);render();changeEditor(latestChanges(session.read())[0].id);notice('提议已记录，尚未批准改期')})}
async function sourceEditor(id:string){
  const session=projectSession(),s=session.read().sources.find(x=>x.id===id)!
  drawer('SOURCE · FRAME',`<h2 data-no-i18n="true">${esc(s.name)}</h2><p>${esc(s.status)} · ${esc(s.parser)}<br>${esc(s.error)}<br>${s.warnings.map(esc).join('<br>')}</p><p>${esc(aiStatus)}</p><p id="sourceAiProgress" role="status"></p>${errorSlot}<div class="drawer-actions"><button id="downloadOriginal">下载原件</button><button id="retrySource">重新解析（规则整理）</button><select id="sourceModel" aria-label="本地模型" ${models.length?'':'disabled'}>${models.length?models.map(m=>`<option>${esc(m)}</option>`).join(''):`<option>${getLanguage()==='en'?'Local model unavailable':'本地模型不可用'}</option>`}</select><button id="aiExtract" ${models.length?'':'disabled'}>Ollama 整理</button><button id="sourceRecheck">重新检测 →</button></div>`)
  on('downloadOriginal',async()=>{session.read();const file=await getOriginal(s.hash),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=s.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)})
  on('retrySource',async()=>{session.read();await retrySource(id);if(useIngest.getState().error)throw Error(useIngest.getState().error);render();await sourceEditor(id);notice('解析结果已保存（规则整理）')})
  on('sourceRecheck',async()=>{await detectAi();await sourceEditor(id)})
  if(models.length)on('aiExtract',async()=>{session.read();const count=await extractWithOllama(id,(document.getElementById('sourceModel') as HTMLSelectElement).value,getLanguage());reviewEngine='ollama';render();close();nav('reviews');notice(count?'Ollama 候选已保存，等待人工审核':'本地 AI 未找到可提取的需求；原件保留。')})
}

function render(){
  const s=state(),entries=listProjects(),b=s.baselines.at(-1)!,reviews=s.blocks.filter(x=>x.review.status!=='dismissed'&&(reviewEngine==='all'||x.engine===reviewEngine)),changes=latestChanges(s)
  const projectButton=(key:string,name:string,i:number,description:string)=>`<button class="project-row" data-project-key="${esc(key)}"><span class="project-index ${['blue-bg','yellow-bg','purple-bg'][i%3]}">${i+1}</span><span class="project-row-main"><b>${esc(name)}</b><small>${esc(description)}</small></span><span>→</span></button>`
  $('.projects-list').innerHTML=entries.map((p,i)=>projectButton(p.key,p.state?.project.name??'项目读取失败',i,p.error||(p.state!.project.demo?'Frame 演示数据 · 本机独立存储':p.state!.project.client))).join('')
  $('.project-grid').innerHTML=entries.filter(p=>p.state).slice(0,3).map((p,i)=>`<button class="project-card ${['homesday','northline','orbit'][i]}" data-project-key="${esc(p.key)}"><div class="project-card-top"><span class="project-type">${esc(p.state!.project.demo?'FRAME DEMO':'LOCAL PROJECT')}</span></div><div class="project-card-copy"><h3>${esc(p.state!.project.name)}</h3><p>${esc(p.state!.project.client)}</p><div class="card-meta"><span>${p.state!.items.length} 个工作项</span></div></div></button>`).join('')
  $('.welcome-row h1').textContent='欢迎回来，设计师。';$('.welcome-row p').innerHTML=`当前项目：${userText(s.project.name)} · 数据保存在此浏览器来源中。`;$('.welcome-row .eyebrow').textContent=new Date().toLocaleDateString(getLanguage()==='en'?'en-US':'zh-CN');$('.focus-chip').hidden=true;$('.project-section .text-button').textContent=`查看全部 ${entries.length} 个 →`
  $('.project-hero-detail h1').textContent=s.project.name;$('.project-hero-detail p').textContent=s.project.client;$('.project-hero-detail .eyebrow').textContent=s.project.demo?'FRAME DEMO · 本机演示数据':'LOCAL PROJECT';const stats=document.querySelectorAll('.project-summary b');stats[0].textContent=s.project.archived?'已归档':'进行中';stats[1].textContent=b.deliveryDate??'未约定';stats[2].textContent=String(reviews.filter(x=>x.review.status==='unreviewed').length)
  $('.todo-panel .task-list').innerHTML=s.items.map(i=>`<label class="task-item"><input type="checkbox" data-task-toggle="${esc(i.id)}" ${i.status==='done'?'checked':''}><span class="custom-check"></span><span class="task-project blue" aria-hidden="true"></span><span class="task-copy"><b>${esc(i.title)}</b><small>${esc(i.start??'未排期')} · ${esc(i.end??'未定结束日期')}</small></span></label>`).join('')||'<p>当前项目尚无任务</p>'
  $('.todo-panel .count-badge').textContent=String(s.items.length)
  const taskRows=s.items.map(i=>`<article data-task-id="${esc(i.id)}" tabindex="0" role="button"><small>${esc(i.phase)}</small><b>${esc(i.title)}</b><p>${esc(statuses.find(x=>x[0]===i.status)?.[1])} · ${esc(i.end??'未排期')}</p></article>`).join('')
  $('.kanban').innerHTML=`<div class="kanban-col">${taskRows||'<p>尚无工作项，点击添加任务。</p>'}</div>`;$('.board-panel h2').textContent=`${s.project.name} 待办`
  // Date-only records share an inclusive projection in both calendars and the timeline.
  const schedule=scheduleEntries(s),current=today(),period=calendarPeriod(calendarDate,calendarMode),monday=weekStart(calendarDate)
  const entryTarget=(changeId:string|null,id:string)=>changeId?`data-change-id="${esc(changeId)}"`:`data-task-id="${esc(id)}"`
  $('#calendarView .page-heading p').textContent='当前项目的日期范围；未设置小时排期。'
  $('#calendarSegments').innerHTML=`${(['day','week','month'] as const).map((mode,n)=>`<button data-calendar-mode="${mode}" class="${calendarMode===mode?'active':''}" aria-pressed="${calendarMode===mode}">${['日视图','周视图','月视图'][n]}</button>`).join('')}<button data-calendar-step="-1" aria-label="上一个周期">←</button><button data-week-today>今天</button><button data-calendar-step="1" aria-label="下一个周期">→</button><label class="week-picker">选择日期 <input type="date" id="calendarDate" value="${calendarDate}"></label><span>${period.start}${period.end===period.start?'':' — '+period.end}</span>`

  for(const selector of ['.compact-calendar','.full-week']){
    const container=$(selector),start=selector==='.compact-calendar'?weekStart(current):monday
    if(!container.parentElement!.classList.contains('calendar-scroll')){const wrapper=document.createElement('div');wrapper.className='calendar-scroll';container.before(wrapper);wrapper.append(container)}
    while(container.querySelectorAll('.day-head').length<7)container.querySelector('.day-head')!.insertAdjacentHTML('afterend','<div class="day-head"><small></small><b></b></div>')
    container.querySelectorAll('.cal-event,.full-event,.frame-empty').forEach(x=>x.remove())
    container.querySelectorAll<HTMLElement>('.day-head').forEach((x,n)=>{const date=addDays(start,n);x.hidden=false;x.title=date;x.querySelector('small')!.textContent=new Date(date+'T12:00:00').toLocaleDateString(getLanguage()==='en'?'en-US':'zh-CN',{weekday:'short'});x.querySelector('b')!.textContent=date.slice(-2);x.classList.toggle('today',date===current)})
    container.querySelectorAll<HTMLElement>('.time-label,.full-time-label,.now-line').forEach(x=>x.hidden=true)
    container.querySelector('.calendar-corner span')!.textContent='日期范围'
    const items=schedule.map(entry=>({...entry,band:dateBand(entry.item,start,7)})).filter(x=>x.band)
    container.style.gridTemplateRows=`48px repeat(${Math.max(1,items.length)},72px) minmax(80px,1fr)`
    container.insertAdjacentHTML('beforeend',items.map(({item:i,band,changeId},n)=>`<button class="${selector==='.compact-calendar'?'cal-event':'full-event'} blue ${changeId?'proposal-preview':''}" ${entryTarget(changeId,i.id)} title="${esc(i.title)} · ${esc(i.start??'未定')} — ${esc(i.end??'未定')}" style="grid-column:${band!.offset+2} / span ${band!.length};grid-row:${n+2}"><b>${changeId?'待审提议 · ':''}${userText(i.title)}</b><small>${esc(i.start??'未定')} — ${esc(i.end??'未定')}</small></button>`).join('')||'<p class="frame-empty" style="grid-column:2 / -1;grid-row:2">本周暂无已排期工作项</p>')
  }
  const weekWrapper=$('.full-week').parentElement!;weekWrapper.hidden=calendarMode!=='week'
  let extra=document.getElementById('calendarExtra')
  if(!extra){extra=document.createElement('div');extra.id='calendarExtra';$('.full-calendar-panel').append(extra)}
  extra.hidden=calendarMode==='week'
  const eventButton=({item:i,changeId}:{item:Item;changeId:string|null})=>`<button class="calendar-task blue ${changeId?'proposal-preview':''}" ${entryTarget(changeId,i.id)} title="${esc(i.title)} · ${esc(i.start??'')} — ${esc(i.end??'')}"><b>${changeId?'待审提议 · ':''}${userText(i.title)}</b><small>${esc(i.start??'未排期')} — ${esc(i.end??'未定结束日期')}</small></button>`
  let note=document.getElementById('calendarUnscheduled')
  if(!note){note=document.createElement('section');note.id='calendarUnscheduled';$('#calendarSegments').after(note)}
  const undated=schedule.filter(e=>!e.item.start&&!e.item.end),pending=schedule.filter(e=>e.changeId)
  note.innerHTML=(pending.length?'<p>虚线为待审提议预览，尚未批准，不会修改正式任务或基线。</p>':'')+(undated.length?`<p>未排期：以下记录没有日期，因此没有时间条。</p>${undated.map(eventButton).join('')}`:'')
  note.hidden=!note.innerHTML
  const dayItems=(date:string)=>schedule.filter(e=>dateBand(e.item,date,1))
  if(calendarMode==='day'){
    const items=dayItems(calendarDate)
    extra.innerHTML=`<section class="calendar-day"><h2 data-no-i18n="true">${calendarDate} · ${new Date(calendarDate+'T12:00:00').toLocaleDateString(getLanguage()==='en'?'en-US':'zh-CN',{weekday:'long'})}</h2><p>日期范围 · 无小时排期</p>${items.map(eventButton).join('')||'<p class="frame-empty">当天暂无已排期工作项</p>'}</section>`
  }else if(calendarMode==='month'){
    const first=weekStart(period.start),count=Math.ceil((dayDiff(first,period.start)+period.days)/7)*7
    extra.innerHTML=`<div class="calendar-month">${Array.from({length:7},(_,n)=>`<div class="month-weekday">${new Date(addDays(first,n)+'T12:00:00').toLocaleDateString(getLanguage()==='en'?'en-US':'zh-CN',{weekday:'short'})}</div>`).join('')}${Array.from({length:count},(_,n)=>{const date=addDays(first,n),items=dayItems(date);return `<article class="calendar-month-cell ${date.slice(0,7)!==calendarDate.slice(0,7)?'outside-month':''} ${date===current?'is-today':''}"><button class="calendar-date" data-calendar-day="${date}" aria-label="${date}" title="${date}">${Number(date.slice(-2))}</button><div class="month-tasks">${items.map(eventButton).join('')}</div></article>`}).join('')}</div>`
  }else extra.innerHTML=''
  const dates=schedule.flatMap(({item:i})=>[i.start,i.end]).filter((x):x is string=>!!x).sort(),first=dates[0]??current,last=dates.at(-1)??current,span=Math.max(1,dayDiff(first,last)+1),tickCount=Math.min(5,span)
  $('.roadmap').innerHTML=`<div class="roadmap-content"><div class="roadmap-dates">${Array.from({length:tickCount},(_,n)=>{const offset=Math.round((span-1)*n/Math.max(1,tickCount-1));return `<span style="left:${(offset+.5)/span*100}%">${addDays(first,offset)}</span>`}).join('')}</div>`+schedule.map(({item:i,changeId})=>{const band=dateBand(i,first,span);return `<div class="roadmap-row"><b>${esc(phases.find(x=>x[0]===i.phase)?.[1])}</b><div class="roadmap-task"><button class="roadmap-label ${changeId?'proposal-preview':''}" ${entryTarget(changeId,i.id)}>${changeId?'待审提议 · ':''}${userText(i.title)}<small>${esc(i.start??'未排期')} — ${esc(i.end??'未定结束日期')}</small></button><div class="roadmap-track">${band?`<button class="roadbar rb1 ${changeId?'proposal-preview':''}" aria-label="${changeId?'待审提议 · ':''}${esc(i.title)} · ${esc(i.start??i.end)} — ${esc(i.end??i.start)}" ${entryTarget(changeId,i.id)} style="left:${band.offset/span*100}%;width:${band.length/span*100}%"></button>`:''}</div></div></div>`}).join('')+(schedule.length?'':'<p class="frame-empty">当前项目尚无任务</p>')+'</div>'
  if(!document.getElementById('reviewTools'))$('#reviewsView .page-heading').insertAdjacentHTML('afterend','<div id="reviewTools" class="toolbar"></div>')
  const sourceFragments=[...new Map(s.blocks.map(block=>[block.sourceId+JSON.stringify(block.evidence),block])).values()]
  const latestSource=s.sources.at(-1)
  $('#reviewTools').innerHTML=`<p id="reviewProgress" role="status">${esc(useIngest.getState().busy?useIngest.getState().progress:useIngest.getState().error)}</p><label>查看 <select id="reviewEngine">${[['ollama','本地 AI 候选'],['manual','人工整理'],['rules','原文片段（规则，非 AI）'],['all','全部']].map(([value,label])=>`<option value="${value}" ${value===reviewEngine?'selected':''}>${label} (${value==='rules'?sourceFragments.length:s.blocks.filter(x=>x.review.status!=='dismissed'&&(value==='all'||x.engine===value)).length})</option>`).join('')}</select></label>${latestSource?`<button class="primary-button" data-ai-source="${esc(latestSource.id)}">用本地 AI 整理最新原件</button>`:''}`
  const reviewRows=reviewEngine==='rules'?(sourceFragments.map(x=>`<article class="review-card"><span class="status-orb"></span><span><small>原文片段（只读）</small><b>${userText(x.evidence.text.slice(0,72))}</b><p>${userText(x.evidence.text)}</p></span><button class="text-button" data-block-id="${esc(x.id)}">人工核对</button></article>`).join('')||'<p>尚未上传原件。</p>'):reviews.map(x=>`<button class="review-card" data-block-id="${esc(x.id)}"><span class="status-orb pending"></span><span><small>${esc(x.engine==='rules'?'原文片段（规则，非 AI）':x.engine==='ollama'?'Ollama AI 筛选 · 原文摘录（含句式校验）':'人工整理')}</small><b>${userText(x.title)}</b><p>${esc(x.review.status)}${x.commit?' · 已落实':''}</p></span><em>查看</em></button>`).join('')||'<p>暂无待审核需求。</p>'
  $('.review-list-panel').innerHTML=reviewRows;$('#reviewDetail').innerHTML='<h2>需求审核</h2><p>AI 筛选后摘录原文，含请求用语校验；候选仍需人工核对。</p><p>点击候选查看原文；确认内容不会批准改期。</p>'
  document.querySelectorAll('.nav-dot,.changes-panel .count-badge').forEach(x=>x.textContent=String(reviews.filter(x=>x.review.status==='unreviewed').length))
  $('.changes-panel').querySelectorAll('.change-item').forEach(x=>x.remove());$('.changes-panel .panel-link').insertAdjacentHTML('beforebegin',reviews.slice(0,3).map(x=>`<button class="change-item" data-block-id="${esc(x.id)}"><span class="status-orb pending"></span><span><b>${userText(x.title)}</b><small>${esc(x.review.status)}</small></span><em>查看</em></button>`).join(''))
  const table=$('.change-table-panel');table.querySelectorAll('.change-table-row,.frame-empty').forEach(x=>x.remove());table.insertAdjacentHTML('beforeend',changes.map(c=>`<button class="change-table-row" data-change-id="${esc(c.id)}"><span><b>${esc(c.proposed.kind==='item'?c.proposed.item.title:c.proposed.kind==='delivery'?'正式交付日期':'额度规则')}</b></span><span>${esc(c.changedBy)}</span><span>${esc(c.outcome)}</span><em>${esc(c.status)}</em></button>`).join('')||'<p class="frame-empty">暂无变更记录。</p>')
  $('.baseline-grid').innerHTML=s.baselines.map(v=>`<article class="panel baseline-card"><span class="eyebrow">FORMAL BASELINE · V${v.version}</span><h2>${v.version===1?'初始约定':'批准记录'}</h2><dl><div><dt>交付日期</dt><dd>${esc(v.deliveryDate??'未约定')}</dd></div><div><dt>范围</dt><dd>${Object.values(v.scopeItems).length?userText(Object.values(v.scopeItems).join('；')):esc('未登记')}</dd></div><div><dt>额度</dt><dd>${v.allowance.rule?userText(v.allowance.rule):esc('未约定')}</dd></div><div><dt>批准人 / 日期</dt><dd>${v.approvedBy?userText(v.approvedBy):esc('未登记')} / ${esc(v.approvedAt??'未登记')}</dd></div><div><dt>书面依据</dt><dd>${v.evidence?userText(v.evidence):esc('未登记')}</dd></div></dl><button class="panel-link" data-delivery>提议交付日期变更 →</button></article>`).join('')
  $('.reference-lab .ai-badge').textContent=aiStatus;$('.reference-intro strong').textContent='当前项目原件';$('.reference-intro p').textContent='原件留存在 IndexedDB；规则整理与本地 AI 候选分别标识。';$('.reference-intro button').hidden=true
  $('.reference-grid').innerHTML=s.sources.map(x=>`<article class="reference-card"><div><span class="ref-tag">本机原件 · ${esc(x.status)}</span><b>${esc(x.name)}</b><small>${esc(x.parser||'待解析')} ${esc(x.error)}</small><button class="text-button" data-source="${esc(x.id)}">查看 / 重试 →</button></div></article>`).join('')||'<p>尚未上传原件。</p>'
  $('.capture-target button').textContent=s.project.name+'⌄';$('.capture-target button').dataset.chooseProject='true'
  $('#reviewsView .eyebrow').textContent='REQUIREMENT REVIEW';$('#reviewsView .page-heading p').textContent='规则整理与本地 AI 的候选分别标识；确认内容不会批准改期。'
  $('#captureTitle').textContent='保存原件并整理候选';$('#analyzeButton').textContent=captureEngine==='ollama'?'保存并用本地 AI 整理':'保存原件并解析（规则整理）';($('#analyzeButton') as HTMLButtonElement).disabled=captureEngine==='ollama'&&!models.length;$('.drop-zone span').textContent='原件先保存在本机；解析失败可重试，不会批准需求。'
  $('.notification-button').hidden=false;$('.notification-button span').textContent=String(s.blocks.filter(b=>b.review.status==='unreviewed').length);$('.project-legend').innerHTML=`<span>${esc(s.project.name)}</span>`;document.querySelectorAll('.segmented:not(#calendarSegments),.toolbar-right,.toolbar > .filter-button,.panel-actions .filter-button,.focus-chip .pulse').forEach(x=>(x as HTMLElement).hidden=true)
  if(!document.getElementById('captureOptions'))$('.capture-tabs').insertAdjacentHTML('afterend','<div id="captureOptions" class="capture-options"></div>')
  const chosenModel=(document.getElementById('captureModel') as HTMLSelectElement|null)?.value
  $('#captureOptions').innerHTML=`<label>整理方式<select id="captureEngine"><option value="ollama" ${captureEngine==='ollama'?'selected':''}>Ollama 本地 AI</option><option value="rules" ${captureEngine==='rules'?'selected':''}>原文片段（规则，非 AI）</option></select></label><label>本地模型<select id="captureModel" ${models.length?'':'disabled'}>${models.length?models.map(m=>`<option value="${esc(m)}" ${m===chosenModel?'selected':''}>${esc(m)}</option>`).join(''):`<option>${getLanguage()==='en'?'Local model unavailable':'本地模型不可用'}</option>`}</select></label><p>${esc(aiStatus)}</p><p>AI 筛选后摘录原文，含请求用语校验；候选仍需人工核对。</p><button class="text-button" id="captureRecheck">重新检测 →</button>`
  $('#profileView .page-heading h1').textContent='本机工作空间';$('#profileView .page-heading p').textContent=aiStatus;$('#profileView .profile-grid').innerHTML=`<article class="panel settings-card"><h2>本地服务</h2><p data-no-i18n="true">Ollama · http://127.0.0.1:11434</p><p>本地模型： <span data-no-i18n="true">${models.length?models.map(esc).join(' · '):'—'}</span></p><button id="detectAi"><span>${esc(aiStatus)}</span><b>重新检测 →</b></button><button id="exportData"><span>导出当前项目元数据</span><b>JSON →</b></button><button id="clearDemoSamples"><span>清空演示样例（可恢复）</span><b>→</b></button>${localStorage.getItem(DEMO_RECOVERY)?'<button id="restoreDemoSamples">恢复上次样例备份</button>':''}<p>打开项目资料，选择原件后点击 Ollama 整理。</p><p>原件请在项目资料中单独下载。聊天、邮箱、账户与计时服务尚未接入。</p></article>`
}

const isClearCommand=(value:string)=>value.trim().toLowerCase()==='/clear'
async function clearWorkspace(keys=listProjects().map(p=>p.key)){
  if(useIngest.getState().busy)throw Error('正在保存原件，请等待处理结束。')
  await clearDemoSamples(keys)
  ;($('#captureText') as HTMLTextAreaElement).value='';fileInput.value='';$('#analysisPreview').textContent=''
  ;($('#globalSearch') as HTMLInputElement).value='';$('#searchPopover').classList.remove('open')
  $('#captureModal').classList.remove('open');$('#captureModal').setAttribute('aria-hidden','true')
  reviewEngine='ollama';captureEngine='ollama';selectProject('frame-project-v1');render();close();nav('home')
  notice('样例已清空，空白项目已保存；可在本地 AI 中恢复备份。')
}
function clearSamplesEditor(){
  if(useIngest.getState().busy)throw Error('正在保存原件，请等待处理结束。')
  const entries=listProjects()
  drawer('LOCAL DEMO',`<h2>清空演示样例</h2><p>以下项目将从展示中清空，替换为一个空白项目。本机保留恢复备份和原件；不会删除模型。</p><ul>${entries.map(p=>`<li>${userText(p.state?.project.name??p.key)}</li>`).join('')}</ul>${errorSlot}<div class="drawer-actions"><button id="confirmClearSamples">清空上述样例（可恢复）</button><button data-frame-close>取消</button></div>`)
  on('confirmClearSamples',()=>clearWorkspace(entries.map(p=>p.key)))
}

async function detectAi(){models=[];try{const r=await fetch('/api/local-ai/models',{signal:AbortSignal.timeout(12000),headers:{'X-Frame-Parser':'local-v1'}});const v=await r.json();if(!r.ok)throw Error(v.error||'本地 AI 不可用');models=v.models;aiStatus=models.length?`Ollama 可用 · ${models.length} 个本地模型`:'Ollama 不可用：未发现已安装的本地模型'}catch(e){aiStatus='Ollama 不可用：'+(e instanceof Error?e.message:String(e))}render()}
function chooseProject(){drawer('PROJECTS',`<h2>选择项目</h2>${listProjects().map(p=>`<button class="project-row" data-project-key="${esc(p.key)}">${p.state?userText(p.state.project.name):esc(p.error)}</button>`).join('')}`)}
function search(){const input=$('#globalSearch') as HTMLInputElement,q=input.value.trim().toLowerCase();if(!q){$('#searchPopover').classList.remove('open');return;}if(q.startsWith('/')){$('#searchPopover').innerHTML='/clear'.startsWith(q.trim())?`<button class="search-result" data-web-clear ${pending||useIngest.getState().busy?'disabled':''}>/clear · 清空网页测试数据（可恢复）</button>`:'<p>仅支持 /clear 网页命令</p>';$('#searchPopover').classList.add('open');return;}$('#searchPopover').innerHTML=[...listProjects().filter(p=>p.state&&p.state.project.name.toLowerCase().includes(q)).map(p=>`<button class="search-result" data-project-key="${esc(p.key)}">项目 · ${userText(p.state!.project.name)}</button>`),...state().items.filter(x=>x.title.toLowerCase().includes(q)).map(x=>`<button class="search-result" data-task-id="${esc(x.id)}">任务 · ${userText(x.title)}</button>`),...state().blocks.filter(x=>x.title.toLowerCase().includes(q)).map(x=>`<button class="search-result" data-block-id="${esc(x.id)}">需求 · ${userText(x.title)}</button>`)].join('')||'<p>无匹配结果</p>';$('#searchPopover').classList.add('open')}

// Capture only data actions before prototype demo handlers can report false success.
document.addEventListener('click',event=>{
  if(!(event.target as Element).closest('.search-wrap'))$('#searchPopover').classList.remove('open')
  const el=(event.target as Element).closest<HTMLElement>('button,[data-task-id]');if(!el)return
  const d=el.dataset,text=el.textContent??''
  let fn:(()=>unknown)|undefined
  if(d.nav)fn=()=>nav(d.nav!)
  else if(d.projectPanel)fn=()=>projectPanel(d.projectPanel!)
  else if('openPlan' in d)fn=()=>{close();nav('project');projectPanel('plan')}
  else if(d.projectKey)fn=()=>{selectProject(d.projectKey!);render();close();nav('project')}
  else if(d.taskId)fn=()=>taskEditor(d.taskId)
  else if(d.blockId)fn=()=>reviewEditor(d.blockId!)
  else if(d.changeId)fn=()=>changeEditor(d.changeId!)
  else if(d.source)fn=()=>sourceEditor(d.source!)
  else if('delivery' in d)fn=deliveryEditor
  else if('chooseProject' in d)fn=chooseProject
  else if('frameClose' in d||'closeDrawer' in d)fn=close
  else if('openCapture' in d)fn=()=>{if(el.matches('#projectsView .page-heading [data-open-capture]'))projectEditor(true);else{$('#captureModal').classList.add('open');$('#captureModal').setAttribute('aria-hidden','false')}}
  else if('closeModal' in d)fn=()=>{if(useIngest.getState().busy)throw Error('正在保存原件，请等待处理结束。');$('#captureModal').classList.remove('open');$('#captureModal').setAttribute('aria-hidden','true')}
  else if('captureTab' in d)fn=()=>{document.querySelectorAll<HTMLElement>('[data-capture-content]').forEach(x=>x.classList.toggle('active',x.dataset.captureContent===d.captureTab));document.querySelectorAll('[data-capture-tab]').forEach(x=>x.classList.toggle('active',x===el))}
  else if(el.id==='analyzeButton')fn=async()=>{
    const mode=captureEngine,model=(document.getElementById('captureModel') as HTMLSelectElement).value
    if(mode==='ollama'&&(!models.length||!models.includes(model)))throw Error('本地 AI 不可用，请重新检测；不会自动改用规则整理。')
    const fileTab=$('[data-capture-content="file"]').classList.contains('active')
    let ids:string[]=[]
    if(fileTab){const files=(document.querySelector('.drop-zone input') as HTMLInputElement).files;if(!files?.length)throw Error('请先选择文件。');ids=await importFiles([...files])??[];if(useIngest.getState().error)throw Error(useIngest.getState().error)}
    else ids=[await captureText(($('#captureText') as HTMLTextAreaElement).value,getLanguage())]
    let count=0
    if(mode==='ollama')for(const id of new Set(ids))count+=await extractWithOllama(id,model,getLanguage())
    reviewEngine=mode;render();$('#captureModal').classList.remove('open');$('#captureModal').setAttribute('aria-hidden','true');nav('reviews')
    notice(mode==='rules'?'原件与解析结果已保存（规则整理）':count?'Ollama 候选已保存，等待人工审核':'本地 AI 未找到可提取的需求；原件保留。')
  }
  else if(d.aiSource)fn=async()=>{if(!models.length)throw Error('本地 AI 不可用，请重新检测；不会自动改用规则整理。');const count=await extractWithOllama(d.aiSource!,models[0],getLanguage());reviewEngine='ollama';render();notice(count?'Ollama 候选已保存，等待人工审核':'本地 AI 未找到可提取的需求；原件保留。')}

  else if(el.matches('.board-panel .primary-button,#calendarView .page-heading .primary-button'))fn=()=>taskEditor()
  else if(el.matches('.project-summary .icon-button'))fn=()=>projectEditor()
  else if('webClear' in d)fn=()=>clearWorkspace()
  else if(el.id==='clearDemoSamples')fn=clearSamplesEditor
  else if(el.id==='restoreDemoSamples')fn=async()=>{await restoreDemoSamples();selectProject('frame-project-v1');render();notice('样例备份已恢复。')}
  else if(el.id==='localAiButton')fn=()=>{nav('profile');void detectAi()}
  else if(el.matches('.notification-button'))fn=()=>{reviewEngine='all';render();nav('reviews')}
  else if(el.id==='detectAi'||el.id==='captureRecheck')fn=detectAi
  else if(el.id==='exportData')fn=()=>exportProject()
  else if(d.calendarMode)fn=()=>{if(['day','week','month'].includes(d.calendarMode!)){calendarMode=d.calendarMode as CalendarMode;render()}}
  else if(d.calendarStep)fn=()=>{calendarDate=stepCalendarDate(calendarDate,calendarMode,Number(d.calendarStep));render()}
  else if(d.calendarDay)fn=()=>{calendarDate=d.calendarDay!;calendarMode='day';render()}
  else if('weekToday' in d)fn=()=>{calendarDate=today();render()}
  else if(el.matches('.filter-button')&&!el.closest('#drawerBody'))fn=()=>notice('此筛选尚未接入')
  if(fn){event.preventDefault();event.stopImmediatePropagation();if(d.nav||d.projectPanel||'frameClose' in d||'closeDrawer' in d||'closeModal' in d||el.id==='localAiButton'||el.id==='detectAi'||el.id==='captureRecheck'||el.matches('.notification-button')){try{void fn()}catch(e){notice(String(e))}}else void action(fn)}
},true)
document.addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.id==='captureEngine'){captureEngine=input.value==='rules'?'rules':'ollama';render();return;}if(input.id==='reviewEngine'){reviewEngine=input.value;render();return;}if(input.id==='calendarDate'){if(input.value){calendarDate=input.value;render()}return;}if(!input.dataset.taskToggle)return;event.stopImmediatePropagation();const original=state().items.find(x=>x.id===input.dataset.taskToggle)!;void action(async()=>{try{const next=await frame.saveTask({...original,status:input.checked?'done':'planned'},original);notice(next.items.find(x=>x.id===original.id)?.status===(input.checked?'done':'planned')?'任务状态已保存':'已记录变更提议；任务状态未变')}finally{render()}})},true)
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target as HTMLElement).dataset.taskId){e.preventDefault();taskEditor((e.target as HTMLElement).dataset.taskId)}if(e.key==='Escape'){close();if(!useIngest.getState().busy)$('#captureModal').classList.remove('open')}})
$('#globalSearch').addEventListener('keydown',event=>{
  if(event.isComposing)return
  if(event.key==='Escape'){$('#searchPopover').classList.remove('open');return}
  if(event.key==='ArrowDown'){event.preventDefault();$('#searchPopover button')?.focus();return}
  if(event.key!=='Enter')return
  event.preventDefault();event.stopImmediatePropagation()
  if(isClearCommand((event.target as HTMLInputElement).value)){
    if(pending||useIngest.getState().busy){notice('正在处理，请稍后再清空。');return}
    void action(()=>clearWorkspace())
  }else $('#searchPopover button')?.click()
},true)
$('#globalSearch').addEventListener('input',e=>{e.stopImmediatePropagation();search()},true);$('#globalSearch').addEventListener('focus',e=>{e.stopImmediatePropagation();search()},true)
document.addEventListener('submit',e=>{e.preventDefault();if((e.target as HTMLElement).id==='frameForm')$('#drawerBody .drawer-actions button')?.click()})
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.isComposing&&(e.target as HTMLElement).matches('#frameForm input:not([type=checkbox])')){e.preventDefault();$('#drawerBody .drawer-actions button')?.click()}
})
useIngest.subscribe((x,previous)=>{if(x.busy)$('#analysisPreview').textContent=x.progress;else if(x.error)$('#analysisPreview').textContent=x.error;const progress=document.getElementById('sourceAiProgress');if(progress)progress.textContent=x.busy?x.progress:x.error;const reviewProgress=document.getElementById('reviewProgress');if(reviewProgress)reviewProgress.textContent=x.busy?x.progress:x.error;if(previous.busy&&!x.busy)render()})
const fileInput=document.querySelector<HTMLInputElement>('.drop-zone input')!
const showFiles=()=>{$('.drop-zone span').textContent=[...(fileInput.files??[])].map(x=>x.name).join('；')||'原件先保存在本机；解析失败可重试。'}
fileInput.addEventListener('change',showFiles)
$('.drop-zone').addEventListener('dragover',e=>e.preventDefault())
$('.drop-zone').addEventListener('drop',e=>{e.preventDefault();const files=(e as DragEvent).dataTransfer?.files;if(files){fileInput.files=files;showFiles()}})
window.addEventListener('storage',event=>{try{if(event.key===null||event.key===useProject.getState().key)openProject(useProject.getState().key);render()}catch(e){notice(String(e))}})
// The V2 appended review screen has no matching HTML anchor; retain the original review view.
document.querySelectorAll('.rail-item[data-nav="reviews"]').forEach((x,i)=>{if(i)x.remove()})
try{const key=location.hash.match(/^#project\/([^/]+)/)?.[1];if(key)openProject(decodeURIComponent(key))}catch(e){notice(String(e))}
const localAiButton=document.createElement('button');localAiButton.id='localAiButton';localAiButton.className='language-switch';localAiButton.textContent='本地 AI';localAiButton.setAttribute('aria-label','本地 AI');$('.top-actions').prepend(localAiButton)
window.addEventListener('scopecheck-language',render)
;($('#captureText') as HTMLTextAreaElement).value=''
$('#globalSearch').setAttribute('placeholder','搜索项目、任务… 或输入 /clear')
render();initI18n();void detectAi()

