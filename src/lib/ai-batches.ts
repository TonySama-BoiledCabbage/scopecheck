import type {ExtractedUnit} from '../domain/capture-model.ts'

// Small local models lose requests in long conversations. Preserve each original evidence unit.
export function aiBatches(units:ExtractedUnit[]){
  const batches:{units:ExtractedUnit[];offset:number}[]=[]
  let batch:ExtractedUnit[]=[],size=0,offset=0
  for(const unit of units){
    if(unit.text.length>4000)throw Error('单个原文片段超过4000字，请分段后重试；原件保留。')
    if(batch.length&&(batch.length>=6||size+unit.text.length>1800)){
      batches.push({units:batch,offset});offset+=batch.length;batch=[];size=0
    }
    batch.push(unit);size+=unit.text.length
  }
  if(batch.length)batches.push({units:batch,offset})
  return batches
}
