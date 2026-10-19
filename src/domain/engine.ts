import { StateSchema, DateSchema, ItemSchema, RelationSchema, TargetSchema, DecisionSchema } from './model.ts'
import type { ProjectState, Item, Relation, Target, Decision, Change, AuditEvent } from './model.ts'

export const uid = () => crypto.randomUUID()
export const today = () => new Date().toLocaleDateString('en-CA')
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
export const addDays = (a: string, n: number) => new Date(Date.parse(a) + n * 86400000).toISOString().slice(0, 10)
export function rescheduleItem(value:Item,date:string):Item {
  const item=ItemSchema.parse(value);DateSchema.parse(date)
  if(item.kind==='milestone')return {...item,start:date,end:date}
  const anchor=item.start??item.end
  if(!anchor)return {...item,start:date,end:null}
  const delta=dayDiff(anchor,date)
  return ItemSchema.parse({...item,start:item.start?addDays(item.start,delta):null,end:item.end?addDays(item.end,delta):null})
}
export const currentBaseline = (s: ProjectState) => s.baselines.at(-1)!
export const latestChanges = (s: ProjectState): Change[] => [...new Map(s.events.filter(e => e.change).map(e => [e.change!.id, e.change!])).values()].reverse()
export const isFormal = (s: ProjectState, id: string) => id in currentBaseline(s).milestones || id in currentBaseline(s).stageGoals
export const consumed = (s: ProjectState) => s.allowanceUses.reduce((n, x) => n + x.units, 0)

export function allowanceCharge(s: ProjectState, c: Change, d: Decision) {
  const a = currentBaseline(s).allowance
  const key = a.type === 'per_request' ? `request:${c.id}` : `${a.type}:${d.allowanceKey.trim()}`
  const units = a.type === 'custom' ? d.units : 1
  const used = s.allowanceUses.find(x => x.key === key)
  return {key, units, additional: used ? 0 : units}
}
export function pendingAllowance(s: ProjectState) {
  const groups = new Map<string, number>()
  for (const c of latestChanges(s)) {
    if (c.status !== 'pending' || !c.decision || c.decision.allowance === 'no') continue
    const charge = allowanceCharge(s, c, c.decision)
    const key = c.decision.allowanceKey.trim() ? charge.key : c.id
    groups.set(key, Math.max(groups.get(key) ?? 0, charge.additional))
  }
  return [...groups.values()].reduce((n, x) => n + x, 0)
}
function append(s: ProjectState, type: string, summary: string, before: unknown, after: unknown, change: Change | null = null): ProjectState {
  const event: AuditEvent = {id: uid(), at: new Date().toISOString(), actor: '本机用户', type, summary, before, after, change}
  return {...s, events: [...s.events, event]}
}
export function reachable(items: Item[], relations: Relation[], id: string, direction: 'up' | 'down') {
  const seen = new Set<string>(), queue = [id]
  while (queue.length) {
    const node = queue.shift()!
    for (const r of relations.filter(r => r.type === 'dependency' && (direction === 'up' ? r.target : r.source) === node)) {
      const next = direction === 'up' ? r.source : r.target
      if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
  }
  return items.filter(i => seen.has(i.id))
}
export function validateRelation(s: ProjectState, r: Relation) {
  RelationSchema.parse(r)
  if (!s.items.some(i => i.id === r.source) || !s.items.some(i => i.id === r.target)) throw Error('关系两端必须是当前项目中的条目。')
  if (r.source === r.target) throw Error('条目不能关联自身。')
  if (s.relations.some(e => e.id !== r.id && e.type === r.type && e.source === r.source && e.target === r.target)) throw Error('这条关系已经存在。')
  if (r.type === 'dependency' && reachable(s.items, s.relations.filter(e => e.id !== r.id), r.target, 'down').some(i => i.id === r.source)) throw Error('无法建立：这会形成循环阻塞依赖。请调整依赖方向。')
}
export function validateState(value: unknown): ProjectState {
  // v1 has no media metadata; preserve every existing item, baseline and event.
  const migrated = value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1 ? {...value, schemaVersion: 2} : value
  const s = StateSchema.parse(migrated)
  for (const list of [s.items, s.relations, s.baselines, s.events]) if (new Set(list.map(x => x.id)).size !== list.length) throw Error('数据包含重复 ID。')
  for (const r of s.relations) validateRelation(s, r)
  for (const b of s.baselines) {
    if (Object.keys(b.milestones).some(id => !s.items.some(i => i.id === id && i.kind === 'milestone'))) throw Error('基线包含无效里程碑。')
    if (Object.keys(b.stageGoals).some(id => !s.items.some(i => i.id === id && i.kind === 'stage'))) throw Error('基线包含无效阶段。')
    if (Object.keys(b.scopeItems).some(id => !s.items.some(i => i.id === id))) throw Error('基线包含无效范围条目。')
  }
  if (new Set(s.allowanceUses.map(x => x.key)).size !== s.allowanceUses.length) throw Error('额度重复记账。')
  if (new Set(s.sources.map(x => x.id)).size !== s.sources.length || new Set(s.sources.map(x => x.hash)).size !== s.sources.length) throw Error('来源重复。')
  if (new Set(s.blocks.map(x => x.id)).size !== s.blocks.length) throw Error('信息块重复。')
  for (const b of s.blocks) {
    if (!s.sources.some(x => x.id === b.sourceId)) throw Error('信息块来源失联。')
    if (b.placement.itemId && !s.items.some(i => i.id === b.placement.itemId)) throw Error('信息块关联任务不存在。')
  }
  return s
}

export function estimate(s: ProjectState, asOf = today()) {
  const unknown = (explanation: string) => ({days: null, end: null, explanation})
  if (!s.project.start || !s.items.length) return unknown('缺少项目开始日期或工作安排，需要人工判断。')
  if (s.items.some(i => !i.end || (i.kind !== 'milestone' && i.status !== 'done' && (!i.start || i.remainingDays === null)))) return unknown('部分条目未排期或剩余工作量未知，需要人工判断。')
  const ends = new Map<string, string>()
  const visit = (id: string): string => {
    if (ends.has(id)) return ends.get(id)!
    const item = s.items.find(i => i.id === id)!
    if (item.status === 'done') { ends.set(id, item.end!); return item.end! }
    const upstream = s.relations.filter(r => r.type === 'dependency' && r.target === id).map(r => visit(r.source))
    const earliest = [item.start ?? item.end!, asOf, ...upstream.map(d => addDays(d, 1))].sort().at(-1)!
    // ponytail: calendar-day estimate assumes unlimited resources; add calendars/capacity only with a defined scheduling model.
    const finish = [item.end!, addDays(earliest, Math.max(0, (item.remainingDays ?? 0) - 1))].sort().at(-1)!
    ends.set(id, finish)
    return finish
  }
  const end = s.items.map(i => visit(i.id)).sort().at(-1)!
  return {days: Math.max(1, dayDiff(s.project.start, end) + 1), end, explanation: '自然日估算 · 按排程、阻塞依赖与剩余工作计算；未计入资源容量。'}
}
export function requiresReview(s: ProjectState, item: Item) {
  const old = s.items.find(i => i.id === item.id)
  return (!old && (item.scopeRisk || item.kind === 'milestone')) ||
    (!!old && item.scopeRisk && JSON.stringify(old) !== JSON.stringify(item)) ||
    (!!old && isFormal(s, old.id) && (old.start !== item.start || old.end !== item.end || old.goal !== item.goal || old.title !== item.title || old.kind !== item.kind))
}
export function saveItem(s: ProjectState, value: Item, original?: Item | null): ProjectState {
  const item = ItemSchema.parse(value), old = s.items.find(i => i.id === item.id)
  if (original !== undefined && JSON.stringify(old ?? null) !== JSON.stringify(original)) throw Error('条目已被其他操作更新。请关闭并重新打开详情，避免覆盖新内容。')
  if (requiresReview(s, item)) throw Error('此操作涉及正式承诺或范围风险，必须先完成变更审查。')
  if (old && old.kind !== item.kind) throw Error('已有条目的类型不能直接修改。')
  const items = old ? s.items.map(i => i.id === item.id ? item : i) : [...s.items, item]
  return append({...s, items, dataRevision: s.dataRevision + 1}, old ? 'item_updated' : 'item_created', `${old ? '更新' : '新建'}内部条目：${item.title}`, old ?? null, item)
}
export function addRelation(s: ProjectState, r: Relation): ProjectState {
  validateRelation(s, r)
  return append({...s, relations: [...s.relations, r], dataRevision: s.dataRevision + 1}, 'relation_created', '建立关系', null, r)
}
export function removeRelation(s: ProjectState, id: string): ProjectState {
  const r = s.relations.find(x => x.id === id)
  if (!r) throw Error('关系不存在。')
  return append({...s, relations: s.relations.filter(x => x.id !== id), dataRevision: s.dataRevision + 1}, 'relation_removed', '移除关系', r, null)
}
function originalValue(s: ProjectState, t: Target): Target | null {
  const b = currentBaseline(s)
  if (t.kind === 'delivery') return {kind: 'delivery', date: b.deliveryDate}
  if (t.kind === 'allowance') return {kind: 'allowance', config: b.allowance}
  const old = s.items.find(i => i.id === t.item.id)
  return old ? {kind: 'item', item: old} : null
}
export function assess(s: ProjectState, t: Target) {
  const b = currentBaseline(s), old = originalValue(s, t)
  const changed = t.kind === 'item' ? {...s, items: old ? s.items.map(i => i.id === t.item.id ? t.item : i) : [...s.items, t.item]} : s
  const before = estimate(s), after = estimate(changed)
  const dateBefore = old?.kind === 'item' ? old.item.end : old?.kind === 'delivery' ? old.date : null
  const dateAfter = t.kind === 'item' ? t.item.end : t.kind === 'delivery' ? t.date : null
  const upstream = t.kind === 'item' ? reachable(s.items, s.relations, t.item.id, 'up') : []
  const downstream = t.kind === 'item' ? reachable(s.items, s.relations, t.item.id, 'down') : []
  const impacts = t.kind === 'item' ? s.relations.filter(r => r.source === t.item.id && r.type === 'impact').map(r => s.items.find(i => i.id === r.target)!.title) : []
  const warnings: string[] = []
  if (!after.days) warnings.push('Cannot Estimate：数据不足，必须人工判断。')
  if (dateBefore && dateAfter && dateBefore !== dateAfter && b.deliveryDate) warnings.push('节点移动不会自动修改合同交付日；需检查压缩工期、并行工作与资源变化。')
  if (b.deliveryDate && after.end && after.end > b.deliveryDate) warnings.push('当前预测超出合同交付日。')
  if (t.kind === 'item' && t.item.end && upstream.some(i => i.end && i.end >= t.item.end!)) warnings.push('拟议节点日期早于或等于上游完成日，存在依赖冲突。')
  if (t.kind === 'item' && t.item.scopeRisk) warnings.push('Scope Change 候选：额度余额不等于范围授权。')
  return {deltaDays: dateBefore && dateAfter ? dayDiff(dateBefore, dateAfter) : null, before, after,
    upstream: upstream.map(i => i.title), downstream: downstream.map(i => i.title), impacts, warnings,
    baseline: b, consumed: consumed(s), pending: pendingAllowance(s), remaining: b.allowance.included === null ? null : Math.max(0, b.allowance.included - consumed(s))}
}
export function propose(s: ProjectState, value: Target, expectedRevision?: number): {state: ProjectState; change: Change} {
  if (expectedRevision !== undefined && s.dataRevision !== expectedRevision) throw Error('项目已变化，请重新打开表单并核对后提出变更。')
  const target = TargetSchema.parse(value), old = originalValue(s, target)
  if (JSON.stringify(old) === JSON.stringify(target)) throw Error('内容没有变化。')
  if (target.kind === 'item' && old?.kind === 'item' && target.item.kind !== old.item.kind) throw Error('已有条目的类型不能修改。')
  const change: Change = {id: uid(), proposedAt: new Date().toISOString(), changedBy: '本机用户', baseDataRevision: s.dataRevision,
    original: old, proposed: target, assessment: assess(s, target), decision: null, status: 'proposed', approvedAt: null, outcome: '提议已记录，尚未修改项目。'}
  return {state: append(s, 'change_proposed', '提出变更，等待影响评估与确认', old, target, change), change}
}
export function refreshChange(s: ProjectState, id: string) {
  const old = latestChanges(s).find(c => c.id === id)
  if (!old || !['pending', 'proposed'].includes(old.status)) throw Error('此变更不能继续处理。')
  const change: Change = {...old, original: originalValue(s, old.proposed), baseDataRevision: s.dataRevision, assessment: assess(s, old.proposed), status: 'proposed', outcome: '已按当前项目重新评估。'}
  return {state: append(s, 'change_reassessed', '重新评估变更', old, change, change), change}
}
export function outcome(s: ProjectState, c: Change, value: Decision) {
  const d = DecisionSchema.parse(value), a = currentBaseline(s).allowance
  if (c.baseDataRevision !== s.dataRevision) throw Error('项目已变化。请关闭并从变更记录重新评估，避免覆盖新的安排。')
  if (d.duration === 'changed' && d.durationDays === null) throw Error('请填写调整后的人工预计总工期。')
  if ((!c.assessment.before.days || !c.assessment.after.days) && !d.manualReview) throw Error('估算信息不足，请确认已人工检查。')
  if (d.commitment === 'approved' && (!d.evidence.trim() || !d.approvedBy.trim() || !d.approvedAt)) throw Error('请填写客户确认人、确认日期及书面依据。')
  if (d.approvedAt && d.approvedAt > today()) throw Error('批准日期不能在未来。')
  if (c.proposed.kind !== 'item' && d.commitment === 'internal') throw Error('合同截止日或额度规则属于正式承诺，不能按仅内部变更处理。')
  if (d.allowance === 'yes' && a.type !== 'per_request' && !d.allowanceKey.trim()) throw Error('请填写审核轮次或自定义计费单元，防止重复扣额。')
  const charge = allowanceCharge(s, c, d)
  if (d.allowance === 'yes' && a.type === 'custom' && s.allowanceUses.some(x => x.key === charge.key && x.units !== charge.units)) throw Error('该计费单元已有不同数量，不能重复记账；请核对合同归属。')
  const reasons: string[] = []
  if (d.commitment === 'needs_confirmation') reasons.push('等待客户确认')
  if (d.allowance === 'unknown') reasons.push('修改额度尚未确定或存在争议')
  if (d.allowance === 'yes' && (a.included === null || !a.rule.trim())) reasons.push('合同额度或规则尚未明确')
  if (d.allowance === 'yes' && a.included !== null && consumed(s) + charge.additional > a.included) reasons.push('超出合同修改额度，需先批准调整额度')
  if (c.proposed.kind === 'item' && c.proposed.item.scopeRisk && (d.commitment !== 'approved' || !d.scopeAuthorized)) reasons.push('范围变更尚未按合同单独授权')
  if (c.proposed.kind === 'allowance') {
    if (c.proposed.config.included !== null && c.proposed.config.included < consumed(s) + (d.allowance === 'yes' ? charge.additional : 0)) reasons.push('拟议额度低于已确认消耗')
    if (c.proposed.config.type !== a.type && consumed(s)) reasons.push('已有消耗时变更计费单位需要迁移核对，第一阶段保留待确认')
  }
  return {status: reasons.length ? 'pending' as const : d.commitment === 'approved' ? 'applied_baseline' as const : 'applied_internal' as const,
    explanation: reasons.length ? reasons.join('；') : d.commitment === 'approved' ? '按人工登记的批准依据更新正式基线，保留旧版本。' : '仅更新内部计划，正式基线保持不变。', charge}
}
export function commitChange(s: ProjectState, id: string, value: Decision): ProjectState {
  const c = latestChanges(s).find(c => c.id === id)
  if (!c || !['proposed', 'pending'].includes(c.status)) throw Error('此变更已经处理，不能重复提交。')
  const d = DecisionSchema.parse(value), result = outcome(s, c, d)
  const applied = result.status !== 'pending'
  let next = {...s}
  if (applied) {
    const t = c.proposed
    if (t.kind === 'item') next.items = s.items.some(i => i.id === t.item.id) ? s.items.map(i => i.id === t.item.id ? t.item : i) : [...s.items, t.item]
    if (d.duration === 'changed') next.project = {...s.project, manualDurationDays: d.durationDays}
    if (d.allowance === 'yes' && result.charge.additional) next.allowanceUses = [...s.allowanceUses, {key: result.charge.key, units: result.charge.additional, changeId: id}]
    if (result.status === 'applied_baseline') {
      const b = currentBaseline(s)
      const baseline = {...b, id: uid(), version: b.version + 1, createdAt: new Date().toISOString(), evidence: d.evidence, approvedBy: d.approvedBy, approvedAt: d.approvedAt,
        deliveryDate: t.kind === 'delivery' ? t.date : b.deliveryDate,
        allowance: t.kind === 'allowance' ? t.config : b.allowance,
        milestones: t.kind === 'item' && t.item.kind === 'milestone' ? {...b.milestones, [t.item.id]: t.item.end} : b.milestones,
        stageGoals: t.kind === 'item' && t.item.kind === 'stage' ? {...b.stageGoals, [t.item.id]: t.item.goal} : b.stageGoals,
        scopeItems: t.kind === 'item' && t.item.scopeRisk ? {...b.scopeItems, [t.item.id]: `${t.item.title}\n${t.item.goal}`} : b.scopeItems}
      next.baselines = [...s.baselines, baseline]
    }
    next.dataRevision = s.dataRevision + 1
  }
  const record: Change = {...c, decision: d, status: result.status, approvedAt: result.status === 'applied_baseline' ? d.approvedAt : null, outcome: result.explanation}
  return append(next, result.status, result.explanation, c.original, c.proposed, record)
}
export function withdraw(s: ProjectState, id: string): ProjectState {
  const c = latestChanges(s).find(c => c.id === id)
  if (!c || !['proposed', 'pending'].includes(c.status)) throw Error('仅未应用的提议可以撤回。')
  const record: Change = {...c, status: 'withdrawn', outcome: '用户撤回，内部计划与正式基线均未改变。'}
  return append(s, 'change_withdrawn', record.outcome, c, record, record)
}
export function addCorrection(s: ProjectState, eventId: string, note: string) {
  if (!s.events.some(e => e.id === eventId) || !note.trim()) throw Error('请选择记录并填写修正说明。')
  return append(s, 'correction', `修正说明：${note.trim()}`, {eventId}, {note: note.trim()})
}
