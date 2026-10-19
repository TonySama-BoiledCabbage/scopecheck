import assert from 'node:assert/strict'
const base=process.env.FRAME_TEST_URL||'http://127.0.0.1:5190'
const cases=[
 {text:'Please send the updated image by October 21, 2026.',expected:'2026-10-21'},
 {text:'Please send the revised cover within three days.',expected:'2026-10-22'},
 {text:'Please schedule our next design review for October 23, 2026, from 10:00 to 10:30 AM EDT.',expected:'2026-10-23'},
 {text:'Please send the revised cover within three days.',anchor:null,expected:null},
]
const results=[]
for(const c of cases){
 const started=Date.now(),unit={text:c.text,locator:'AI date test',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:c.anchor===null?null:'2026-10-19 09:00 EDT',occurredAt:null,author:'Client'}
 const response=await fetch(base+'/api/local-ai/extract',{method:'POST',headers:{'Content-Type':'application/json','X-Frame-Parser':'local-v1'},body:JSON.stringify({model:'qwen2.5:1.5b',language:'en',units:[unit]}),signal:AbortSignal.timeout(150000)})
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.ok(data.suggestions.length>0)
 const result=data.suggestions[0];assert.equal(result.dateHint?.date??null,c.expected,JSON.stringify(result));assert.equal(result.quote,c.text)
 results.push({input:c.text,anchor:unit.eventTimeRaw,dateHint:result.dateHint??null,milliseconds:Date.now()-started,status:'PASS'})
}
console.log(JSON.stringify({model:'qwen2.5:1.5b',projectWrites:false,results},null,2))
