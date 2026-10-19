import {test} from 'node:test'
import assert from 'node:assert/strict'
import {dateBand,weekStart} from '../src/schedule.ts'

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
