import {test} from 'node:test'
import assert from 'node:assert/strict'
import {dateBand,weekStart,calendarPeriod,stepCalendarDate} from '../src/schedule.ts'

test('date-only placement includes Sunday, clips week edges, preserves one-day and undated records',()=>{
  assert.equal(weekStart('2026-10-18'),'2026-10-12')
  assert.equal(weekStart('2026-11-01'),'2026-10-26')
  assert.deepEqual(dateBand({start:'2026-10-18',end:'2026-10-18'},'2026-10-12',7),{offset:6,length:1})
  assert.deepEqual(dateBand({start:'2026-10-08',end:'2026-10-19'},'2026-10-12',7),{offset:0,length:7})
  assert.equal(dateBand({start:'2026-10-19',end:'2026-10-20'},'2026-10-12',7),null)
  assert.equal(dateBand({start:null,end:null},'2026-10-12',7),null)
  assert.deepEqual(dateBand({start:null,end:'2026-10-18'},'2026-10-12',7),{offset:6,length:1})
  assert.deepEqual(dateBand({start:'2026-10-18',end:null},'2026-10-12',7),{offset:6,length:1})
})

test('day/month navigation handles year boundaries, leap days and clamped month ends',()=>{
  assert.deepEqual(calendarPeriod('2026-10-18','day'),{start:'2026-10-18',end:'2026-10-18',days:1})
  assert.deepEqual(calendarPeriod('2026-10-18','week'),{start:'2026-10-12',end:'2026-10-18',days:7})
  assert.deepEqual(calendarPeriod('2024-02-29','month'),{start:'2024-02-01',end:'2024-02-29',days:29})
  assert.deepEqual(calendarPeriod('2026-02-28','month'),{start:'2026-02-01',end:'2026-02-28',days:28})
  assert.equal(stepCalendarDate('2026-12-31','month',1),'2027-01-31')
  assert.equal(stepCalendarDate('2026-01-31','month',1),'2026-02-28')
  assert.equal(stepCalendarDate('2024-03-31','month',-1),'2024-02-29')
  assert.equal(stepCalendarDate('2026-11-01','day',1),'2026-11-02')
  assert.equal(stepCalendarDate('2026-12-31','week',1),'2027-01-07')
})


test('pending schedule previews are read-only, retain proposed dates, and disappear after withdrawal or application',async()=>{
  const {scheduleEntries}=await import('../src/schedule.ts')
  const {createEmptyProject}=await import('../src/domain/projects.ts')
  const {propose,withdraw,commitChange,today}=await import('../src/domain/engine.ts')
  const base=createEmptyProject({name:'Preview test',client:'Synthetic',start:'2026-10-19'})
  const item={id:'preview',title:'Pending colour change',kind:'task' as const,phase:'concept' as const,status:'planned' as const,start:'2026-10-20',end:'2026-10-22',remainingDays:null,goal:'Synthetic test',scopeRisk:true}
  const proposal=propose(base,{kind:'item',item},base.dataRevision)
  const before=JSON.stringify(proposal.state),entries=scheduleEntries(proposal.state)
  assert.equal(entries.length,1);assert.equal(entries[0].changeId,proposal.change.id)
  assert.deepEqual(dateBand(entries[0].item,'2026-10-19',7),{offset:1,length:3})
  assert.equal(JSON.stringify(proposal.state),before)
  assert.deepEqual(proposal.state.items,base.items);assert.deepEqual(proposal.state.baselines,base.baselines)
  assert.equal(scheduleEntries(withdraw(proposal.state,proposal.change.id)).length,0)
  const pending=commitChange(proposal.state,proposal.change.id,{duration:'unknown',durationDays:null,allowance:'no',allowanceKey:'',units:1,commitment:'needs_confirmation',reason:'Synthetic pending check',evidence:'',approvedBy:'',approvedAt:null,relatedSources:'',manualReview:true,scopeAuthorized:false})
  assert.equal(scheduleEntries(pending)[0].changeId,proposal.change.id);assert.equal(pending.items.length,0)
  const applied=commitChange(pending,proposal.change.id,{duration:'unknown',durationDays:null,allowance:'no',allowanceKey:'',units:1,commitment:'approved',reason:'Synthetic approval test',evidence:'Test fixture only',approvedBy:'Fixture reviewer',approvedAt:today(),relatedSources:'',manualReview:true,scopeAuthorized:true})
  const appliedEntries=scheduleEntries(applied)
  assert.equal(appliedEntries.length,1);assert.equal(appliedEntries[0].changeId,null)
  assert.equal(appliedEntries[0].item.id,item.id);assert.equal(applied.items.length,1)
})
