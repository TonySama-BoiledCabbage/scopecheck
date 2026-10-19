import assert from 'node:assert/strict'
const base=process.env.FRAME_TEST_URL||'http://127.0.0.1:5190'
const model='qwen2.5:1.5b'
const headers={'X-Frame-Parser':'local-v1','Content-Type':'application/json'}
const response=await fetch(base+'/api/local-ai/models',{headers})
assert.equal(response.status,200)
assert.ok((await response.json()).models.includes(model),'模型尚未安装或不可用')
const results=[]
for(const text of [
  '请增加地图搜索和区域筛选。具体筛选条件还没有确定。',
  'Please add a 9:16 version of the launch video. We still need to confirm whether this is included in the current scope.',
  '把交付提前到下周五，但还没获得客户的书面确认。',
]){
  const unit={text,locator:'本机部署验证',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}
  const started=Date.now(),r=await fetch(base+'/api/local-ai/extract',{method:'POST',headers,body:JSON.stringify({model,units:[unit]})})
  const value=await r.json()
  assert.equal(r.status,200,JSON.stringify(value))
  assert.ok(value.suggestions.length>0,'模型没有返回可审核候选')
  for(const part of value.suggestions){assert.equal(part.evidenceIndex,0);assert.ok(text.includes(part.quote));assert.ok(part.title&&part.description)}
  results.push({source:text,milliseconds:Date.now()-started,result:'PASS',...value})
}
console.log(JSON.stringify({at:new Date().toISOString(),model,base,status:'PASS',results},null,2))
