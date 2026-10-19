import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed.ts'
import { rescheduleItem,saveItem,requiresReview,propose,dayDiff } from '../src/domain/engine.ts'

test('拖动改期保留时长、状态、未知字段与合同基线；正式节点仅建立提议',()=>{
  const s=createSeed(),task=s.items.find(i=>i.id==='sketch')!
  const moved=rescheduleItem(task,'2026-10-25')
  assert.equal(moved.start,'2026-10-25');assert.equal(moved.status,task.status);assert.equal(moved.remainingDays,task.remainingDays)
  assert.equal(dayDiff(moved.start!,moved.end!),dayDiff(task.start!,task.end!))
  const saved=saveItem(s,moved,task)
  assert.deepEqual(saved.baselines,s.baselines);assert.deepEqual(saved.allowanceUses,s.allowanceUses)
  assert.equal(saved.events.length,s.events.length+1)
  assert.throws(()=>saveItem(saved,rescheduleItem(task,'2026-10-27'),task),/其他操作/)
  const milestone=s.items.find(i=>i.kind==='milestone')!,proposal=rescheduleItem(milestone,'2026-11-01')
  assert.equal(proposal.start,proposal.end);assert.ok(requiresReview(s,proposal));assert.throws(()=>saveItem(s,proposal),/审查/)
  const pending=propose(s,{kind:'item',item:proposal},s.dataRevision)
  assert.deepEqual(pending.state.items,s.items);assert.deepEqual(pending.state.baselines,s.baselines)
  const unknown=rescheduleItem({...task,start:null,end:null,remainingDays:null},'2026-10-30')
  assert.equal(unknown.start,'2026-10-30');assert.equal(unknown.end,null);assert.equal(unknown.remainingDays,null)
  assert.equal(rescheduleItem({...task,start:null,end:'2026-10-19'},'2026-10-31').start,null)
  assert.equal(rescheduleItem({...task,start:'2026-10-19',end:null},'2026-10-31').end,null)
  const leap=rescheduleItem({...task,start:'2028-02-28',end:'2028-03-01'},'2028-02-29')
  assert.equal(leap.end,'2028-03-02');assert.throws(()=>rescheduleItem(task,'2026-02-30'))
})
