import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('原始CSS逐字保留，HTML保留结构并更新产品名称与模块入口，原型JS只增加两个空节点保护',()=>{
  const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n')
  assert.equal(read('styles.css'),read('reference/styles.css'))
  assert.equal(read('index.html'),read('reference/index.html').replace('Frame — Designer Workspace','Manage Your Tasks — Local Project Workspace').replace('Frame — 面向独立设计师的 AI 项目管理原型','Manage Your Tasks — 面向独立设计师的本地 AI 项目管理工作空间').replace('aria-label="Frame 首页"><span>f</span>','aria-label="Manage Your Tasks 首页"><span>M</span>').replace('<script src="app.js"></script>','<script type="module" src="app.js"></script>\n    <script type="module" src="/src/adapter.ts"></script>'))
  assert.equal(read('app.js'),read('reference/app.js').replace("document.getElementById('floatingCapture').onclick", "if(document.getElementById('floatingCapture')) document.getElementById('floatingCapture').onclick").replace("document.getElementById('profileScreen').before", "document.getElementById('profileScreen')?.before"))
})
test('适配命令复用真实存储：正式提议、旧表单拒绝、项目切换拒绝、容量失败保护',async()=>{
  const values=new Map<string,string>();let full=false
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(full)throw Error('QuotaExceededError');values.set(k,v)},get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null}})
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:()=>unknown)=>fn()}}})
  const {frame}=await import('../src/frame.ts')
  const {latestChanges,refreshChange,today}=await import('../src/domain/engine.ts')
  const key=await frame.createProject({name:'adapter test',client:'test',start:null});frame.openProject(key)
  const item={id:'test-task',title:'内部任务',kind:'task' as const,phase:'research' as const,status:'planned' as const,start:null,end:null,remainingDays:null,goal:'',scopeRisk:false}
  await frame.saveTask(item,null)
  const before=frame.read(),session=frame.projectSession()
  await frame.saveTask({...item,title:'范围候选',scopeRisk:true},item)
  assert.deepEqual(frame.read().items,before.items);assert.deepEqual(frame.read().baselines,before.baselines)
  assert.equal(latestChanges(frame.read())[0].status,'proposed')
  await frame.saveTask({...item,status:'active'},item)
  await assert.rejects(frame.saveTask({...item,title:'过期表单',scopeRisk:true},item),/已更新/)
  const snapshot=values.get(key),current=frame.read(),active=current.items[0]
  full=true;await assert.rejects(frame.saveTask({...active,status:'done'},active),/Quota/)
  assert.equal(values.get(key),snapshot);assert.deepEqual(frame.read(),current);full=false
  const change=latestChanges(frame.read())[0]
  await session.run(s=>refreshChange(s,change.id).state)
  await frame.decide(change.id,{duration:'unknown',durationDays:null,allowance:'no',allowanceKey:'',units:1,commitment:'approved',reason:'适配测试',evidence:'仅测试',approvedBy:'测试人',approvedAt:today(),relatedSources:'',manualReview:true,scopeAuthorized:true})
  const scoped=frame.read().items[0]
  await assert.rejects(frame.saveTask({...scoped,scopeRisk:false},scoped),/不能.*绕过/)
  const other=await frame.createProject({name:'other',client:'',start:null});frame.openProject(other)
  await assert.rejects(frame.saveTask(item,null,session),/切换/)
  assert.equal(frame.read().items.length,0)
})
