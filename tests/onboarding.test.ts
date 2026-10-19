import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GUIDE_KEY,initialGuideStep,saveGuide } from '../src/lib/onboarding.ts'
test('首次教程可跳过、完成后不自动重播，进行中恢复；偏好写入不触碰项目且报告失败',()=>{
  const values=new Map([['frame-project-v1','existing project snapshot']]),storage={setItem:(key:string,value:string)=>{values.set(key,value)}}
  assert.equal(initialGuideStep(null),0)
  saveGuide(storage,2,'active');assert.equal(initialGuideStep(values.get(GUIDE_KEY)!),2)
  saveGuide(storage,2,'skipped');assert.equal(initialGuideStep(values.get(GUIDE_KEY)!),null)
  saveGuide(storage,4,'completed');assert.equal(initialGuideStep(values.get(GUIDE_KEY)!),null)
  saveGuide(storage,0,'active');assert.equal(initialGuideStep(values.get(GUIDE_KEY)!),0)
  assert.equal(initialGuideStep('broken preference'),null)
  assert.throws(()=>saveGuide(storage,5,'active'))
  assert.throws(()=>saveGuide({setItem:()=>{throw Error('QuotaExceededError')}},1,'active'),/QuotaExceededError/)
  assert.equal(values.get('frame-project-v1'),'existing project snapshot');assert.equal(values.size,2)
})
