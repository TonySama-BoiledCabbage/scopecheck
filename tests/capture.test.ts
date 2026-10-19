import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed.ts'
import { validateState, requiresReview, propose } from '../src/domain/engine.ts'
import { registerSource, sourceStatus, finishExtraction, placeBlock, undoPlacement } from '../src/domain/capture.ts'
import type { Source, Extraction } from '../src/domain/capture-model.ts'

const source:Source={id:'source1',hash:'a'.repeat(64),batchId:'batch1',name:'Screenshot_003.png',aliases:['Screenshot_003.png'],mime:'image/png',size:100,importedAt:'2026-10-16T12:00:00Z',status:'queued',error:'',parser:'',warnings:[]}
const extraction:Extraction={parser:'actual-parser-result',warnings:[],units:[{text:'CAD arm needs adjustment.',locator:'原图区域 1',page:null,bounds:[0,0,1,.5],startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}]}
function ready(){return finishExtraction(registerSource(createSeed(),source),source.id,extraction,['unit1'])}

test('建议自动持久化为独立资料位置，不改变正式任务、基线或额度',()=>{
  const original=createSeed(),s=ready(),block=s.blocks[0]
  assert.equal(block.placement.origin,'system');assert.equal(block.placement.itemId,'cad');assert.equal(block.placement.date,null)
  assert.deepEqual(s.items,original.items);assert.deepEqual(s.baselines,original.baselines);assert.deepEqual(s.allowanceUses,original.allowanceUses)
  assert.equal(validateState(JSON.parse(JSON.stringify(s))).blocks[0].placement.itemId,'cad')
})
test('重复原件和重新解析不重复生成块；人工位置不被覆盖',()=>{
  let s=ready(),block=s.blocks[0]
  s=placeBlock(s,block.id,{...block.placement,itemId:'prototype',date:'2026-11-02'},0)
  s=registerSource(s,{...source,id:'newid',name:'different-name.png'})
  s=finishExtraction(s,source.id,extraction,['unit1'])
  assert.equal(s.sources.length,1);assert.equal(s.blocks.length,1)
  assert.equal(s.blocks[0].placement.itemId,'prototype');assert.equal(s.blocks[0].placement.origin,'user')
  assert.ok(s.sources[0].aliases.includes('different-name.png'))
})
test('拖到正式节点仍仅改变资料建议；落实动作才触发审查',()=>{
  const initial=ready(),block=initial.blocks[0]
  const s=placeBlock(initial,block.id,{...block.placement,itemId:'concept-review',date:'2026-10-23'},0)
  assert.deepEqual(s.items,initial.items);assert.deepEqual(s.baselines,initial.baselines)
  const newMilestone={...s.items[3],id:'new-milestone',start:'2026-10-23',end:'2026-10-23'}
  assert.equal(requiresReview(s,newMilestone),true)
  const proposal=propose(s,{kind:'item',item:newMilestone})
  assert.equal(proposal.change?.status,'proposed');assert.deepEqual(proposal.state.baselines,s.baselines)
})
test('位置撤销追加事件；过期位置提交和重复撤销被拒绝',()=>{
  const s=ready(),block=s.blocks[0],moved=placeBlock(s,block.id,{...block.placement,date:'2026-11-01'},0)
  assert.throws(()=>placeBlock(moved,block.id,block.placement,0),/其他操作/)
  const undone=undoPlacement(moved,block.id)
  assert.equal(undone.blocks[0].placement.date,null);assert.equal(undone.events.length,moved.events.length+1)
  assert.throws(()=>undoPlacement(undone,block.id),/撤销/)
  assert.throws(()=>placeBlock(s,block.id,{...block.placement,itemId:'missing'},0),/不存在/)
})
test('schema v1 恢复添加媒体字段且不丢原有事件/基线；未知版本拒绝',()=>{
  const s=createSeed(),v1={...s,schemaVersion:1,sources:undefined,blocks:undefined}
  const restored=validateState(v1)
  assert.equal(restored.schemaVersion,2);assert.deepEqual(restored.baselines,s.baselines);assert.deepEqual(restored.events,s.events)
  assert.deepEqual(restored.blocks,[]);assert.throws(()=>validateState({...s,schemaVersion:3}))
})
test('无内容匹配时留待整理，不使用导入时间作为建议日期',()=>{
  const result=finishExtraction(registerSource(createSeed(),source),source.id,{...extraction,units:[{...extraction.units[0],text:'An unclear conversation without dates.'}]},['u'])
  assert.equal(result.blocks[0].placement.phase,null);assert.equal(result.blocks[0].placement.date,null)
})

test('解析失败和重试不丢旧块，失败原因留在追加事件中',()=>{
  const initial=ready(),failed=sourceStatus(initial,source.id,'error','解析取消')
  const retried=sourceStatus(failed,source.id,'processing')
  assert.deepEqual(retried.blocks,initial.blocks)
  assert.equal(retried.events.at(-1)?.type,'source_parse_failed')
  assert.match(JSON.stringify(retried.events.at(-1)?.after),/解析取消/)
})
