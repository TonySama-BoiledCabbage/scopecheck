import {test} from 'node:test'
import assert from 'node:assert/strict'
import {aiBatches} from '../src/lib/ai-batches.ts'
import {validateAiSuggestions} from '../src/domain/capture.ts'
import {requestExcerpt} from '../src/lib/request-excerpt.ts'
const unit=(text:string)=>({text:text.trim(),locator:'test',page:null,bounds:null,startSeconds:null,endSeconds:null,eventTimeRaw:null,occurredAt:null,author:null})

test('long evidence batches retain exact units and map model indices back without truncation',()=>{
  const units=Array.from({length:33},(_,n)=>unit('Please review this design request '+n+'. '.repeat(80)))
  const batches=aiBatches(units)
  assert.deepEqual(batches.flatMap(b=>b.units),units)
  assert.ok(batches.every(b=>b.units.length<=6&&b.units.reduce((n,u)=>n+u.text.length,0)<=4000))
  for(const batch of batches)assert.equal(units[batch.offset],batch.units[0])
  assert.throws(()=>aiBatches([unit('x'.repeat(4001))]),/4000/)
  assert.deepEqual(aiBatches([]),[])
  const part={evidenceIndex:7,title:'Review request 7',quote:units[7].text,description:units[7].text,uncertainties:[]}
  assert.equal(validateAiSuggestions({suggestions:[part]},units).suggestions[0].quote,units[7].text)
  assert.throws(()=>validateAiSuggestions({suggestions:[{...part,quote:'invented evidence'}]},units),/证据/)
})

test('wording guard labels original requests without inventing titles, choices or approval',()=>{
  for(const text of ['Client: North Objects','Project: ARC Desktop Lamp','The overall direction feels right, especially the compact base.','Thanks for the update. The weather has improved. I will be travelling on Friday, so email is better than a call.'])assert.equal(requestExcerpt(text),null)
  const question='Please confirm whether the PDF should use British or American English.'
  assert.equal(requestExcerpt(question),question)
  assert.equal(requestExcerpt('The cable exits forward. Please check the hinge clearance.'),'Please check the hinge clearance.')
  assert.equal(requestExcerpt('请不要开始 CAD 工作。'),'请不要开始 CAD 工作。')
})
