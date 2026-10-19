import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveDateHint} from '../src/lib/date-hint.ts'
import {createEmptyProject} from '../src/domain/projects.ts'
import {registerSource,finishExtraction,saveAiSuggestions,validateAiSuggestions,placeBlock} from '../src/domain/capture.ts'
import {draftFromBlock} from '../src/frame.ts'
const unit=(text:string,eventTimeRaw:string|null='2026-10-19 09:02 EDT')=>({text,locator:'Line 1',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw,occurredAt:null,author:'Client'})

test('model date quotes resolve exact dates and anchored relative days without inventing missing context',()=>{
  for(const [quote,date] of [['2026-10-21','2026-10-21'],['October 21, 2026','2026-10-21'],['October 21','2026-10-21'],['within two days','2026-10-21'],['in 3 days','2026-10-22'],['tomorrow','2026-10-20'],['day after tomorrow','2026-10-21'],['2026年10月23日','2026-10-23'],['三天内','2026-10-22']])assert.equal(resolveDateHint(quote,unit('Please send it '+quote)),date)
  for(const quote of ['next week','next Friday','03/04/2026','October 21','within two days','2 business days','2026-02-30','2026-99-99','October 21 or October 22'])assert.equal(resolveDateHint(quote,unit('Please send it '+quote,null)),null)
  assert.equal(resolveDateHint('October 20',unit('Please send it October 20','2026-10-21 09:00 EDT')),null)
  assert.equal(resolveDateHint('2026-10-21',unit('No dates here')),null)
  assert.equal(resolveDateHint('October 21',unit('Please send it October 21','03/04/2026 09:00')),null)
  assert.equal(resolveDateHint('within two days, by October 21',unit('Please send it within two days, by October 21')),'2026-10-21')
  assert.equal(resolveDateHint('tomorrow or in three days',unit('Please send it tomorrow or in three days')),null)
  assert.equal(resolveDateHint('within two days, by October 22',unit('Please send it within two days, by October 22')),null)
})

test('verified AI date fills original task draft but cannot overwrite manual placement or approve a baseline',()=>{
  const u=unit('Please send the image within two days.'),source={id:'dated-source',hash:'d'.repeat(64),batchId:'dates',name:'chat.txt',aliases:[],mime:'text/plain',size:80,importedAt:'2026-10-19T00:00:00Z',status:'queued' as const,error:'',parser:'',warnings:[]}
  const base=createEmptyProject({name:'Date check',client:'Synthetic',start:null})
  const ready=finishExtraction(registerSource(base,source),source.id,{parser:'text',warnings:[],units:[u]},['dated-unit'])
  const part={evidenceIndex:0,title:u.text,quote:u.text,description:u.text,uncertainties:[],dateHint:{quote:'within two days',date:'2026-10-21'}}
  assert.throws(()=>validateAiSuggestions({suggestions:[{...part,dateHint:{...part.dateHint,date:'2026-10-22'}}]},[u]),/日期/)
  const ai=saveAiSuggestions(ready,source.id,[u],{suggestions:[part]},['model-dates'])
  const block=ai.blocks.find(b=>b.engine==='ollama')!,draft=draftFromBlock(ai,block)
  assert.equal(block.placement.date,'2026-10-21');assert.equal(draft.start,'2026-10-21');assert.equal(draft.end,'2026-10-21')
  assert.deepEqual(ai.items,base.items);assert.deepEqual(ai.baselines,base.baselines)
  const manuallyPlaced=placeBlock(ready,ready.blocks[0].id,{...ready.blocks[0].placement,date:'2026-10-25'},0)
  const kept=saveAiSuggestions(manuallyPlaced,source.id,[u],{suggestions:[part]},['manual-kept'])
  assert.equal(kept.blocks.find(b=>b.engine==='ollama')!.placement.date,'2026-10-25')
})
