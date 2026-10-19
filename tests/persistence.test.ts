import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rescheduleItem,saveItem } from '../src/domain/engine.ts'
import { registerSource, finishExtraction, placeBlock } from '../src/domain/capture.ts'

test('真实保存命令遇到容量错误保留资料位置和任务日期，重试才发布新状态',async()=>{
  const values=new Map<string,string>();let fail=false
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('QuotaExceededError');values.set(key,value)}},configurable:true})
  Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(_key:string,save:()=>unknown)=>save()}},configurable:true})
  const {useProject}=await import('../src/store/project.ts')
  await useProject.getState().run(s=>finishExtraction(registerSource(s,{id:'s',hash:'f'.repeat(64),batchId:'b',name:'screen.png',aliases:[],mime:'image/png',size:1,importedAt:'2026-10-16T12:00:00Z',status:'queued',error:'',parser:'',warnings:[]}), 's',{parser:'ocr',warnings:[],units:[{text:'CAD',locator:'region 1',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}]},['u']))
  const before=useProject.getState().data,block=before.blocks[0],saved=values.get('frame-project-v1')
  const draft={...block.placement,date:'2026-11-02'}
  fail=true
  await assert.rejects(useProject.getState().run(s=>placeBlock(s,block.id,draft,0)),/QuotaExceededError/)
  assert.deepEqual(useProject.getState().data,before)
  assert.equal(values.get('frame-project-v1'),saved)
  assert.equal(draft.date,'2026-11-02')
  fail=false
  await useProject.getState().run(s=>placeBlock(s,block.id,draft,0))
  assert.equal(JSON.parse(values.get('frame-project-v1')!).blocks[0].placement.origin,'user')
  assert.deepEqual(useProject.getState().data.items,before.items)
  const beforeTask=useProject.getState().data,task=beforeTask.items.find(i=>i.id==='sketch')!,moved=rescheduleItem(task,'2026-10-24'),snapshot=values.get('frame-project-v1')
  fail=true
  await assert.rejects(useProject.getState().run(s=>saveItem(s,moved,task)),/QuotaExceededError/)
  assert.deepEqual(useProject.getState().data,beforeTask);assert.equal(values.get('frame-project-v1'),snapshot)
  fail=false
  await useProject.getState().run(s=>saveItem(s,moved,task))
  assert.equal(useProject.getState().data.items.find(i=>i.id===task.id)!.start,'2026-10-24')
})
