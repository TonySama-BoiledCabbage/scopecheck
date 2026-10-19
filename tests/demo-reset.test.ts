import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createEmptyProject} from '../src/domain/projects.ts'
import {clearDemoSamples,restoreDemoSamples,DEMO_RECOVERY} from '../src/demo-reset.ts'

test('sample cleanup is recoverable, preserves preferences and never overwrites new demo work',async()=>{
  const values=new Map<string,string>();let full=false
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(full)throw Error('QuotaExceededError');values.set(k,v)},removeItem:(k:string)=>values.delete(k)}})
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:()=>unknown)=>fn()}}})
  const original=JSON.stringify(createEmptyProject({name:'Synthetic sample',client:'test',start:null}))
  const other=createEmptyProject({name:'Another sample',client:'',start:null}),key='frame-project:'+other.project.id
  values.set(key,JSON.stringify(other));values.set(key+':draft','sample draft')
  values.set('frame-project-v1',original);values.set('scopecheck-language','en')
  full=true;await assert.rejects(clearDemoSamples(['frame-project-v1']),/Quota/)
  assert.equal(values.get('frame-project-v1'),original);assert.equal(values.has(DEMO_RECOVERY),false)
  full=false;await clearDemoSamples(['frame-project-v1',key])
  assert.equal(values.has(key),false);assert.equal(values.has(key+':draft'),false)
  const clean=values.get('frame-project-v1')!,state=JSON.parse(clean)
  assert.equal(state.project.demo,false);assert.equal(state.project.start,null)
  for(const key of ['items','sources','blocks','relations','allowanceUses'])assert.deepEqual(state[key],[])
  assert.equal(state.baselines[0].deliveryDate,null);assert.equal(values.get('scopecheck-language'),'en')
  values.set('frame-project-v1',original)
  await assert.rejects(restoreDemoSamples(),/新数据/)
  values.set('frame-project-v1',clean);await restoreDemoSamples()
  assert.equal(values.get('frame-project-v1'),original);assert.equal(values.has(DEMO_RECOVERY),false)
  assert.equal(values.get(key),JSON.stringify(other));assert.equal(values.get(key+':draft'),'sample draft')
  await clearDemoSamples(['frame-project-v1',key])
  const firstBackup=JSON.parse(values.get(DEMO_RECOVERY)!)
  const firstEmpty=values.get('frame-project-v1')!
  await clearDemoSamples(['frame-project-v1'])
  assert.deepEqual(JSON.parse(values.get(DEMO_RECOVERY)!).previous,firstBackup)
  await restoreDemoSamples()
  assert.equal(values.get('frame-project-v1'),firstEmpty)
  assert.deepEqual(JSON.parse(values.get(DEMO_RECOVERY)!),firstBackup)
  await restoreDemoSamples()
  assert.equal(values.get('frame-project-v1'),original)
  assert.equal(values.get(key),JSON.stringify(other));assert.equal(values.has(DEMO_RECOVERY),false)
})
