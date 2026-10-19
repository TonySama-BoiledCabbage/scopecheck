import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed.ts'
import { validateState } from '../src/domain/engine.ts'
import { registerSource,finishExtraction,reviewBlock,editBlock,saveAiSuggestions,validateAiSuggestions,placeBlock,commitBlock } from '../src/domain/capture.ts'
import type { Source,Extraction } from '../src/domain/capture-model.ts'
const source:Source={id:'review-source',hash:'b'.repeat(64),batchId:'review-batch',name:'未命名.txt',aliases:[],mime:'text/plain',size:80,importedAt:'2026-10-18T12:00:00Z',status:'queued',error:'',parser:'',warnings:[]}
const extraction:Extraction={parser:'text',warnings:[],units:[{text:'灯臂再加长一点，下周看样机。这算一轮修改吗？',locator:'段落 1',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}]}
const ready=()=>finishExtraction(registerSource(createSeed(),source),source.id,extraction,['unit'])
const ai={suggestions:[{evidenceIndex:0,quote:'灯臂再加长一点',title:'调整灯臂长度',description:'客户希望灯臂加长，尺寸待确认。',uncertainties:['尺寸待确认。']}]}
test('审核、修正、移除和恢复保留原文与正式承诺，旧修订不可覆盖',()=>{
  const s=ready(),b=s.blocks[0]
  assert.throws(()=>reviewBlock(s,b.id,0,'confirmed'),/不确定/)
  const confirmed=reviewBlock(s,b.id,0,'confirmed',true)
  assert.deepEqual(confirmed.items,s.items);assert.deepEqual(confirmed.baselines,s.baselines);assert.deepEqual(confirmed.allowanceUses,s.allowanceUses)
  assert.throws(()=>editBlock(confirmed,b.id,0,'新标题','新说明'),/其他操作/)
  const edited=editBlock(confirmed,b.id,1,'修正需求','保留原始反馈供核对。')
  assert.equal(edited.blocks[0].review.status,'unreviewed');assert.equal(edited.blocks[0].engine,'manual');assert.deepEqual(edited.blocks[0].evidence,b.evidence)
  const removed=reviewBlock(edited,b.id,2,'dismissed'),restored=reviewBlock(removed,b.id,3,'unreviewed')
  assert.equal(restored.blocks[0].review.status,'unreviewed');assert.equal(restored.events.length,s.events.length+4)
  assert.equal(validateState(JSON.parse(JSON.stringify(restored))).blocks[0].review.revision,4)
})
test('AI证据逐字校验、数字校验、重复去重与用户位置保留',()=>{
  assert.throws(()=>validateAiSuggestions({suggestions:[{...ai.suggestions[0],quote:'伪造原文'}]},extraction.units),/证据/)
  assert.throws(()=>validateAiSuggestions({suggestions:[{...ai.suggestions[0],description:'加长30毫米'}]},extraction.units),/数字/)
  let s=ready(),b=s.blocks[0]
  s=placeBlock(s,b.id,{...b.placement,itemId:'prototype',date:null},0)
  s=saveAiSuggestions(s,source.id,extraction.units,ai,['ai-key'])
  assert.equal(s.blocks.length,1);assert.equal(s.blocks[0].engine,'ollama');assert.equal(s.blocks[0].quote,ai.suggestions[0].quote)
  assert.equal(s.blocks[0].placement.origin,'user');assert.equal(s.blocks[0].placement.itemId,'prototype')
  s=saveAiSuggestions(s,source.id,extraction.units,ai,['ai-key'])
  s=finishExtraction(s,source.id,extraction,['unit'])
  assert.equal(s.blocks.length,1)
  const approved=reviewBlock(s,b.id,1,'confirmed',true)
  const reparsed=saveAiSuggestions(approved,source.id,extraction.units,{suggestions:[{...ai.suggestions[0],title:'新候选'}]},['other'])
  assert.deepEqual(reparsed.blocks[0],approved.blocks[0]);assert.equal(reparsed.blocks.length,2)
  assert.throws(()=>saveAiSuggestions(s,source.id,[{...extraction.units[0],text:'其他原文'}],{suggestions:[]},[]),/来源/)
})
test('确认内容和提交是两个动作，正式里程碑只建立提议且重复提交被拒绝',()=>{
  const s=ready(),b=s.blocks[0],milestone=s.items.find(i=>i.kind==='milestone')!
  assert.throws(()=>commitBlock(s,b.id,0,{...milestone,end:'2026-10-25',start:'2026-10-25'},s.dataRevision),/先确认/)
  const reviewed=reviewBlock(s,b.id,0,'confirmed',true)
  const result=commitBlock(reviewed,b.id,1,{...milestone,end:'2026-10-25',start:'2026-10-25'},s.dataRevision)
  assert.equal(result.change?.status,'proposed');assert.deepEqual(result.state.items,s.items);assert.deepEqual(result.state.baselines,s.baselines)
  assert.equal(result.state.blocks[0].commit?.changeId,result.change?.id)
  assert.throws(()=>commitBlock(result.state,b.id,1,milestone,s.dataRevision),/已提交/)
  const task={...s.items.find(i=>i.kind==='task')!,id:'explicit-new-task',start:null,end:null,scopeRisk:false}
  const internal=commitBlock(reviewed,b.id,1,task,s.dataRevision)
  assert.equal(internal.change,null);assert.ok(internal.state.items.some(i=>i.id===task.id));assert.deepEqual(internal.state.baselines,s.baselines)
  const oldBlock={...b} as Record<string,unknown>;delete oldBlock.review;delete oldBlock.engine;delete oldBlock.description;delete oldBlock.uncertainties;delete oldBlock.commit;delete oldBlock.quote
  assert.equal(validateState({...s,blocks:[oldBlock]}).blocks[0].review.status,'unreviewed')
})
