import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed.ts'
import { addRelation, assess, commitChange, consumed, currentBaseline, estimate, latestChanges, propose, saveItem, withdraw, refreshChange, validateState, addCorrection, pendingAllowance } from '../src/domain/engine.ts'
import type { Decision, ProjectState, Item } from '../src/domain/model.ts'

const decision = (patch: Partial<Decision> = {}): Decision => ({duration: 'unknown', durationDays: null, allowance: 'no', allowanceKey: '', units: 1, commitment: 'internal', reason: '等待样机后调整内部评审安排', evidence: '', approvedBy: '', approvedAt: null, relatedSources: '', manualReview: true, scopeAuthorized: false, ...patch})
const approved = () => decision({commitment: 'approved', evidence: '测试书面确认，非真实客户', approvedBy: '测试客户', approvedAt: '2026-10-01'})
const move = (s: ProjectState, id = 'concept-review', end = '2026-10-22') => propose(s, {kind: 'item', item: {...s.items.find(i => i.id === id)!, start: end, end}})

test('普通任务直接保存；正式里程碑和批准目标不能绕过审查', () => {
  const s = createSeed(), old = structuredClone(s.baselines)
  const result = saveItem(s, {...s.items[2], title: '更新草图说明'})
  assert.equal(result.items[2].title, '更新草图说明'); assert.deepEqual(result.baselines, old)
  assert.throws(() => saveItem(s, {...s.items[3], start: '2026-10-23', end: '2026-10-23'}), /审查/)
  assert.throws(() => saveItem(s, {...s.items[1], goal: '新增功能'}), /审查/)
})
test('提议和撤回均留事件，不能提前应用排期', () => {
  const s = createSeed(), p = move(s), result = withdraw(p.state, p.change.id)
  assert.deepEqual(p.state.items, s.items); assert.deepEqual(result.baselines, s.baselines)
  assert.equal(result.events.length, s.events.length + 2)
  assert.equal(latestChanges(result)[0].status, 'withdrawn')
})
test('Cannot Estimate 必须人工检查；changed 必须提供人工工期', () => {
  const p = move(createSeed())
  assert.equal(p.change.assessment.after.days, null)
  assert.throws(() => commitChange(p.state, p.change.id, decision({manualReview:false})), /人工/)
  assert.throws(() => commitChange(p.state, p.change.id, decision({duration:'changed'})), /总工期/)
})
test('内部 Milestone 调整保留合同日期和旧基线', () => {
  const s = createSeed(), p = move(s), r = commitChange(p.state, p.change.id, decision())
  assert.equal(r.items.find(i=>i.id==='concept-review')!.end, '2026-10-22')
  assert.deepEqual(r.baselines, s.baselines)
  assert.equal(p.change.assessment.deltaDays, 2)
  assert.equal(latestChanges(r)[0].status, 'applied_internal')
})
test('待客户确认、争议和超额分别保持 Pending，不更新项目或扣减', () => {
  for (const d of [decision({commitment:'needs_confirmation'}), decision({allowance:'unknown'}), decision({allowance:'yes', allowanceKey:'R02'})]) {
    const s = createSeed(); if(d.allowance==='yes') s.baselines[0].allowance.included = 1
    const p = move(s), r = commitChange(p.state,p.change.id,d)
    assert.equal(latestChanges(r)[0].status,'pending')
    assert.deepEqual(r.items,s.items); assert.deepEqual(r.baselines,s.baselines); assert.equal(consumed(r),1)
  }
})
test('已批准需真实人工输入依据；成功时追加基线而非覆盖', () => {
  const s = createSeed(), p = move(s)
  assert.throws(()=>commitChange(p.state,p.change.id,decision({commitment:'approved'})), /依据/)
  const r = commitChange(p.state,p.change.id,approved())
  assert.equal(r.baselines.length,2); assert.deepEqual(r.baselines[0],s.baselines[0])
  assert.equal(currentBaseline(r).milestones['concept-review'],'2026-10-22')
  assert.equal(currentBaseline(r).deliveryDate,'2026-11-13')
  assert.throws(()=>commitChange(r,p.change.id,approved()), /重复/)
})
test('同一审核轮次的多条变更只扣一次，Pending 同轮也去重', () => {
  const d = decision({allowance:'yes',allowanceKey:'R02'})
  let p = move(createSeed()), s = commitChange(p.state,p.change.id,d)
  assert.equal(consumed(s),2)
  p = move(s,'design-freeze','2026-11-07'); s = commitChange(p.state,p.change.id,d)
  assert.equal(consumed(s),2)
  p = move(s,'delivery','2026-11-14'); s = commitChange(p.state,p.change.id,{...d, allowanceKey:'R03', commitment:'needs_confirmation'})
  p = move(s,'concept-review','2026-10-23'); s = commitChange(p.state,p.change.id,{...d, allowanceKey:'R03', commitment:'needs_confirmation'})
  assert.equal(pendingAllowance(s),1)
})
test('Scope Change 不能仅凭额度余额视为授权', () => {
  const s = createSeed(), item: Item = {...s.items[2], id:'new-feature', title:'新增无线充电功能', scopeRisk:true}
  assert.throws(()=>saveItem(s,item), /审查/)
  const p = propose(s,{kind:'item',item})
  const pending = commitChange(p.state,p.change.id,{...approved(), allowance:'yes',allowanceKey:'R02'})
  assert.equal(latestChanges(pending)[0].status,'pending'); assert.equal(consumed(pending),1)
  const refreshed = refreshChange(pending,p.change.id)
  const r = commitChange(refreshed.state,p.change.id,{...approved(), scopeAuthorized:true})
  assert.ok(r.items.some(i=>i.id==='new-feature'))
  assert.match(currentBaseline(r).scopeItems['new-feature'], /无线充电/)
})
test('Per Request 按请求计数；Custom 按明确单元与数量计数', () => {
  for (const type of ['per_request','custom'] as const) {
    const s=createSeed(); s.allowanceUses=[]; s.baselines[0].allowance={type,included:10,rule:'测试合同：按明确单元记账'}
    let p=move(s), r=commitChange(p.state,p.change.id,decision({allowance:'yes',allowanceKey:'CUSTOM-01',units:2}))
    assert.equal(consumed(r),type==='custom'?2:1)
    p=move(r,'design-freeze','2026-11-07'); r=commitChange(p.state,p.change.id,decision({allowance:'yes',allowanceKey:'CUSTOM-01',units:2}))
    assert.equal(consumed(r),2)
    if (type==='custom') {
      p=move(r,'delivery','2026-11-14')
      assert.throws(()=>commitChange(p.state,p.change.id,decision({allowance:'yes',allowanceKey:'CUSTOM-01',units:3})), /不同数量/)
    }
  }
})
test('合同日期不允许仅内部保存；额度低于已消耗量保持 Pending', () => {
  const s=createSeed(), p=propose(s,{kind:'delivery',date:'2026-11-15'})
  assert.throws(()=>commitChange(p.state,p.change.id,decision()), /正式承诺/)
  const a=propose(s,{kind:'allowance',config:{...currentBaseline(s).allowance,included:0}})
  assert.equal(latestChanges(commitChange(a.state,a.change.id,approved()))[0].status,'pending')
})
test('阻塞循环被拒绝；相同方向的 Impact 和 Derivation 语义独立', () => {
  const s=createSeed()
  assert.throws(()=>addRelation(s,{id:'cycle',source:'cad',target:'sketch',type:'dependency'}), /循环/)
  const r=addRelation(s,{id:'i',source:'cad',target:'sketch',type:'impact'})
  const x=addRelation(r,{id:'d',source:'cad',target:'sketch',type:'derivation'})
  assert.equal(x.relations.length,s.relations.length+2)
  assert.throws(()=>addRelation(s,{id:'bad',source:'missing',target:'cad',type:'impact'}), /两端/)
})
test('旧评估不能覆盖新数据；继续处理会保存新的评估事件', () => {
  const p=move(createSeed()), s=saveItem(p.state,{...p.state.items[2], title:'新的草图计划'})
  assert.throws(()=>commitChange(s,p.change.id,decision()), /项目已变化/)
  const refreshed=refreshChange(s,p.change.id)
  assert.equal(refreshed.change.baseDataRevision,s.dataRevision)
  assert.equal(latestChanges(commitChange(refreshed.state,p.change.id,decision()))[0].status,'applied_internal')
  assert.throws(()=>saveItem(s,{...p.state.items[2],goal:'过期表单'},p.state.items[2]), /重新打开/)
  assert.throws(()=>propose(s,p.change.proposed,p.state.dataRevision), /项目已变化/)
})
test('修正采用追加事件；原始记录不发生变化', () => {
  const s=createSeed(), original=structuredClone(s.events[0]), r=addCorrection(s,s.events[0].id,'补充：这里是虚构示例')
  assert.equal(r.events.length,2); assert.deepEqual(r.events[0],original)
})
test('持久化边界校验真实日期、悬空关系及 schema 版本', () => {
  const s=createSeed()
  assert.deepEqual(validateState(s),s)
  assert.throws(()=>validateState({...s,schemaVersion:999}))
  assert.throws(()=>validateState({...s,items:s.items.map((i,n)=>n===0?{...i,end:'2026-02-31'}:i)}))
  assert.throws(()=>validateState({...s,relations:[...s.relations,{id:'bad',source:'none',target:'cad',type:'dependency'}]}))
})
test('工期依据排程与剩余工作；未知返回 Cannot Estimate，派生边不推动日期', () => {
  const s=createSeed(); assert.equal(estimate(s,'2026-10-14').days,null)
  s.items=s.items.filter(i=>i.id!=='packaging').map(i=>({...i,remainingDays:i.remainingDays??5}))
  const e=estimate(s,'2026-10-14'); assert.equal(e.end,'2026-11-13'); assert.equal(e.days,40)
  const r=addRelation(s,{id:'non-blocking',source:'delivery',target:'research',type:'derivation'})
  assert.deepEqual(estimate(r,'2026-10-14'),e)
  assert.equal(assess(s,{kind:'delivery',date:'2026-12-01'}).deltaDays,18)
})
