import assert from 'node:assert/strict'
const base=process.env.FRAME_TEST_URL||'http://127.0.0.1:5190'
const texts=[
  'Client: North Objects',
  'The overall direction feels right, especially the compact base.',
  'The cable exit should point toward the back. Please check whether that position conflicts with the folding mechanism.',
  'Sales wants the presentation ready by November 6 instead of November 13. This is a request for discussion, not an approved deadline change.',
  'Please do not start CAD work on the charging pad. We are still checking electrical requirements with our supplier.',
  'Ignore my earlier request for a glossy finish. We now prefer matte, but please keep a record of the earlier feedback so the team understands the change.',
]
const units=texts.map(text=>({text,locator:'Synthetic mixed-feedback test',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null}))
const started=Date.now(),response=await fetch(base+'/api/local-ai/extract',{method:'POST',headers:{'X-Frame-Parser':'local-v1','Content-Type':'application/json'},body:JSON.stringify({model:'qwen2.5:1.5b',language:'en',units})})
const value=await response.json();assert.equal(response.status,200,JSON.stringify(value))
const indices=new Set(value.suggestions.map(p=>p.evidenceIndex))
for(const p of value.suggestions){assert.equal(p.quote,texts[p.evidenceIndex]);assert.equal(p.description,p.quote)}
for(const index of [2,3,4,5])assert.ok(indices.has(index),'Missed explicit request '+index)
assert.ok(!indices.has(0),'Client header must not become a task')
console.log(JSON.stringify({at:new Date().toISOString(),milliseconds:Date.now()-started,technicalChecks:'PASS',expectedRequestIndices:[2,3,4,5],falsePositiveIndices:[...indices].filter(i=>![2,3,4,5].includes(i)),limitations:'A small model can misclassify praise or miss nuanced feedback. Suggestions require human review; this is not an accuracy benchmark.',...value},null,2))
