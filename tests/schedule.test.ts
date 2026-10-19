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
