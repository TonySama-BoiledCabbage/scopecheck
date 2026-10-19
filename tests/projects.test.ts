import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeed } from '../src/domain/seed.ts'
import { updateProject,createEmptyProject } from '../src/domain/projects.ts'
import { registerSource,finishExtraction } from '../src/domain/capture.ts'

test('项目主页存储隔离、旧项目无损、空白合同、归档恢复、并发与失败保护',async()=>{
  const legacy=createSeed();legacy.items[2].title='保留用户编辑';legacy.revision=9
  const values=new Map([['frame-project-v1',JSON.stringify(legacy)],['frame-feedback-draft','旧项目草稿']]);let fail=false
  const storage={get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('QuotaExceededError');values.set(k,v)}}
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
  Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(_k:string,save:()=>unknown)=>save()}},configurable:true})
  const {useProject,openProject,createProject,listProjects,projectSession,draftKey,projectHref}=await import('../src/store/project.ts')
  const oldRaw=values.get('frame-project-v1')
  assert.equal(listProjects()[0].state!.items[2].title,'保留用户编辑')
  assert.equal(values.get('frame-project-v1'),oldRaw)
  assert.equal(draftKey(),'frame-feedback-draft')
  assert.throws(()=>createEmptyProject({name:' ',client:'',start:null}))
  const key=await createProject({name:'音箱',client:'',start:null})
  openProject(key)
  const blank=useProject.getState().data
  assert.equal(blank.project.demo,false);assert.equal(blank.project.start,null)
  assert.equal(blank.items.length,0);assert.equal(blank.blocks.length,0);assert.equal(blank.relations.length,0)
  assert.equal(blank.baselines[0].deliveryDate,null);assert.equal(blank.baselines[0].allowance.included,null)
  assert.equal(blank.baselines[0].approvedAt,null);assert.equal(blank.baselines[0].approvedBy,'')
  assert.notEqual(draftKey(),'frame-feedback-draft');assert.ok(projectHref('timeline').includes(encodeURIComponent(key)))
  values.set(draftKey(),'音箱草稿')
  const source={id:'same-source',hash:'a'.repeat(64),batchId:'batch',name:'截图.png',aliases:[],mime:'image/png',size:2,importedAt:'2026-10-18T12:00:00Z',status:'queued' as const,error:'',parser:'',warnings:[]}
  await useProject.getState().run(s=>finishExtraction(registerSource(s,source),source.id,{parser:'ocr',warnings:[],units:[{text:'检查音箱外壳',locator:'region 1',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}]},['unit']))
  const session=projectSession(),oldRun=session.run,baseline=useProject.getState().data.baselines
  openProject('frame-project-v1')
  assert.equal(useProject.getState().data.sources.length,0);assert.equal(values.get(draftKey()),'旧项目草稿')
  assert.throws(()=>session.read(),/项目已切换/)
  await assert.rejects(oldRun(s=>s),/项目已切换/)
  assert.equal(values.get('frame-project-v1'),oldRaw)
  openProject(key)
  assert.equal(values.get(draftKey()),'音箱草稿');assert.equal(useProject.getState().data.blocks.length,1)
  await assert.rejects(oldRun(s=>s),/项目已切换/)
  let s=useProject.getState().data
  await useProject.getState().run(current=>updateProject(current,{name:'音箱二版',client:'客户 A',archived:true},s.project))
  assert.equal(listProjects().find(e=>e.key===key)!.state!.project.archived,true)
  assert.deepEqual(useProject.getState().data.baselines,baseline)
  s=useProject.getState().data;const snapshot=values.get(key)
  fail=true
  await assert.rejects(useProject.getState().run(current=>updateProject(current,{...s.project,archived:false},s.project)),/QuotaExceeded/)
  await assert.rejects(createProject({name:'未保存',client:'',start:null}),/QuotaExceeded/)
  assert.equal(values.get(key),snapshot);assert.equal(useProject.getState().data.project.archived,true)
  assert.equal(listProjects().length,2)
  fail=false
  await useProject.getState().run(current=>updateProject(current,{...s.project,archived:false},s.project))
  assert.equal(useProject.getState().data.project.archived,false)
  const external=useProject.getState().data;values.set(key,JSON.stringify({...external,revision:external.revision+1,project:{...external.project,client:'其他窗口'}}))
  await assert.rejects(useProject.getState().run(current=>updateProject(current,{...external.project,name:'过期改名'},external.project)),/其他窗口/)
  assert.equal(useProject.getState().data.project.client,'其他窗口')
  const secondKey=await createProject({name:'同原件的另一个项目',client:'',start:null});openProject(secondKey)
  await useProject.getState().run(s=>registerSource(s,source))
  assert.equal(useProject.getState().data.blocks.length,0)
  assert.equal(JSON.parse(values.get(key)!).blocks.length,1)
  const broken='frame-project:00000000-0000-0000-0000-000000000000'
  values.set(broken,'{invalid')
  assert.equal(listProjects().find(e=>e.key===broken)!.state,null)
  assert.equal(values.get(broken),'{invalid')
  assert.throws(()=>openProject('frame-local-model'),/无效/)
  assert.equal(values.get('frame-project-v1'),oldRaw)
})
