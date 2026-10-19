import { z } from 'zod'
import { PlacementSchema, SourceSchema, ExtractionSchema, BlockSchema, AiSuggestionsSchema,uncertaintiesFor } from './capture-model.ts'
import type { Placement, Source, Extraction, InformationBlock, ExtractedUnit } from './capture-model.ts'
import type { ProjectState, Item } from './model.ts'
import { uid,requiresReview,propose,saveItem } from './engine.ts'
import type { AiSuggestions } from './capture-model.ts'

function event(s: ProjectState, type: string, summary: string, before: unknown, after: unknown): ProjectState {
  return {...s, events: [...s.events, {id:uid(),at:new Date().toISOString(),actor:['blocks_recommended','source_parse_failed','ai_suggestions_saved'].includes(type)?'系统（本地解析）':'本机用户',type,summary,before,after,change:null}]}
}
export function registerSource(s: ProjectState, value: Source) {
  const source = SourceSchema.parse(value), old = s.sources.find(x => x.hash === source.hash)
  if (old) {
    const aliases = [...new Set([...old.aliases, source.name])]
    return event({...s,sources:s.sources.map(x => x.id===old.id?{...x,aliases}:x)},'source_reused','重复文件复用已留存原件与信息块',old,{...old,aliases})
  }
  return event({...s,sources:[...s.sources,source]},'source_received',`已接收原件：${source.name}`,null,source)
}
export function sourceStatus(s: ProjectState, id: string, status: Source['status'], error = '') {
  const old=s.sources.find(x=>x.id===id)
  if(!old) throw Error('来源不存在。')
  const updated={...old,status,error},next={...s,sources:s.sources.map(x=>x.id===id?updated:x)}
  return status==='error'?event(next,'source_parse_failed',`资料处理未完成：${old.name}`,old,updated):next
}
export function recommend(s: ProjectState, unit: ExtractedUnit): Placement {
  const text=unit.text.toLowerCase()
  const groups: [Item['phase'], RegExp, string][] = [
    ['research',/research|competitor|brief|调研|竞品|定义/,'调研/定义'],
    ['concept',/sketch|concept|草图|概念|形态/,'概念/草图'],
    ['development',/cad|structure|arm|prototype|material|cmf|结构|灯臂|样机|材质|表面/,'结构/深化'],
    ['delivery',/handoff|production file|交付|生产文件|包装/,'交付/归档'],
  ]
  const group=groups.find(([,pattern])=>pattern.test(text))
  const specifics: [RegExp,RegExp][]=[[/prototype|test|样机|测试/,/prototype|样机/],[/cmf|material|finish|材质|表面/,/cmf/i],[/cad|structure|arm|结构|灯臂/,/cad|结构/i],[/sketch|草图|形态/,/sketch|草图|形态/i]]
  const match=specifics.find(([pattern])=>pattern.test(text))
  const item=match ? s.items.find(i=>match[1].test(i.title)) : undefined
  // ponytail: transparent keyword matching, no semantic model; replace with grounded Ollama suggestions when evaluated.
  return {itemId:item?.id??null,phase:item?.phase??group?.[0]??null,date:null,origin:'system',revision:0,
    reason:item?`规则匹配“${item.title}”；仅建议关联，日期待定。`:group?`内容命中${group[2]}关键词；建议归入该阶段，日期待定。`:'未找到可靠任务或日期依据；保留在待整理区。'}
}
export function finishExtraction(s: ProjectState, sourceId: string, value: Extraction, keys: string[]) {
  const parsed=ExtractionSchema.parse(value), source=s.sources.find(x=>x.id===sourceId)
  if(!source || keys.length!==parsed.units.length || new Set(keys).size!==keys.length) throw Error('解析来源或片段标识无效。')
  const blocks=[...s.blocks], fresh: InformationBlock[]=[]
  parsed.units.forEach((unit,index)=>{
    const old=blocks.find(b=>b.sourceId===sourceId&&(b.unitKey===keys[index]||JSON.stringify(b.evidence)===JSON.stringify(unit)))
    if(old) return // Reprocessing immutable evidence never overwrites user placement.
    const block=BlockSchema.parse({id:uid(),sourceId,unitKey:keys[index],title:unit.text.replace(/\s+/g,' ').slice(0,72),description:unit.text.slice(0,5000),uncertainties:uncertaintiesFor(unit.text),evidence:unit,placement:recommend(s,unit),createdAt:new Date().toISOString()})
    blocks.push(block);fresh.push(block)
  })
  const next={...s,blocks,sources:s.sources.map(x=>x.id===sourceId?{...x,status:'ready' as const,error:'',parser:parsed.parser,warnings:parsed.warnings}:x)}
  return event(next,'blocks_recommended',`解析完成，保存 ${fresh.length} 个系统建议位置（${source.name}）`,null,fresh)
}

function reviewable(s:ProjectState,id:string,revision:number) {
  const b=s.blocks.find(b=>b.id===id)
  if(!b)throw Error('建议不存在。')
  if(b.review.revision!==revision)throw Error('建议已被其他操作更新，请核对后重试。')
  return b
}
export function reviewBlock(s:ProjectState,id:string,revision:number,status:InformationBlock['review']['status'],acknowledged=false) {
  const old=reviewable(s,id,revision)
  if(old.commit)throw Error('建议已提交；请通过任务或变更记录继续处理。')
  if(status==='confirmed'&&old.uncertainties.length&&!acknowledged)throw Error('请逐条核对并勾选不确定项声明；确认内容不会确认日期、额度或批准状态。')
  const block={...old,review:{status,revision:revision+1,at:new Date().toISOString(),acknowledged:status==='confirmed'&&acknowledged}}
  return event({...s,blocks:s.blocks.map(b=>b.id===id?block:b)},'suggestion_reviewed',`${status==='confirmed'?'内容已确认':status==='dismissed'?'移除建议':'恢复为待确认'}：${old.title}`,old,block)
}
export function editBlock(s:ProjectState,id:string,revision:number,title:string,description:string) {
  const old=reviewable(s,id,revision)
  if(old.commit)throw Error('已提交的建议需通过正式工作项或变更记录修正。')
  const block=BlockSchema.parse({...old,title:title.trim(),description:description.trim(),engine:'manual',uncertainties:[...new Set([...old.uncertainties,...uncertaintiesFor(title+' '+description)])],review:{status:'unreviewed',revision:revision+1,at:new Date().toISOString(),acknowledged:false}})
  if(!block.title||!block.description)throw Error('请填写需求标题和说明。')
  return event({...s,blocks:s.blocks.map(b=>b.id===id?block:b)},'suggestion_edited',`修正建议并重新待审：${block.title}`,old,block)
}
export function validateAiSuggestions(value:unknown,units:ExtractedUnit[]) {
  const parsed=AiSuggestionsSchema.parse(value)
  for(const part of parsed.suggestions){
    const unit=units[part.evidenceIndex]
    if(!unit||!unit.text.includes(part.quote))throw Error('AI返回了无法对应原文的证据，结果未保存。')
    const numbers=(part.title+' '+part.description).match(/\d+(?:\.\d+)?/g)??[]
    const sourceNumbers=new Set(unit.text.match(/\d+(?:\.\d+)?/g)??[])
    if(numbers.some(n=>!sourceNumbers.has(n)))throw Error('AI引入了原文没有的数字，请重试或人工整理。')
  }
  return parsed
}
export function saveAiSuggestions(s:ProjectState,sourceId:string,units:ExtractedUnit[],value:AiSuggestions,keys:string[]) {
  const parsed=validateAiSuggestions(value,units)
  if(!s.sources.some(source=>source.id===sourceId)||keys.length!==parsed.suggestions.length||units.some(u=>!s.blocks.some(b=>b.sourceId===sourceId&&JSON.stringify(b.evidence)===JSON.stringify(u))))throw Error('提取来源无效。')
  const blocks=[...s.blocks],saved:InformationBlock[]=[],previous:InformationBlock[]=[]
  for(const [index,part] of parsed.suggestions.entries()){
    const key=`ollama:${keys[index]}`
    if(blocks.some(b=>b.sourceId===sourceId&&b.unitKey===key))continue
    const evidence=units[part.evidenceIndex]
    const untouched=blocks.find(b=>b.sourceId===sourceId&&b.engine==='rules'&&b.review.revision===0&&!b.commit&&JSON.stringify(b.evidence)===JSON.stringify(evidence))
    const block=BlockSchema.parse({...untouched,id:untouched?.id??uid(),sourceId,unitKey:key,title:part.title,description:part.description,quote:part.quote,evidence,engine:'ollama',
      uncertainties:[...new Set([...part.uncertainties,...uncertaintiesFor(evidence.text)])],review:{status:'unreviewed',revision:untouched?untouched.review.revision+1:0,at:null,acknowledged:false},placement:untouched?.placement??recommend(s,evidence),createdAt:untouched?.createdAt??new Date().toISOString()})
    if(untouched){previous.push(untouched);blocks[blocks.indexOf(untouched)]=block}else blocks.push(block)
    saved.push(block)
  }
  return event({...s,blocks},'ai_suggestions_saved',`已保存 ${saved.length} 条本地AI候选，正式计划未变`,previous,saved)
}
export function commitBlock(s:ProjectState,id:string,reviewRevision:number,item:Item,expectedDataRevision:number) {
  const block=reviewable(s,id,reviewRevision)
  if(block.review.status!=='confirmed')throw Error('请先确认需求内容，再明确落实到工作项。')
  if(block.commit)throw Error('该建议已提交，请从变更记录或工作项继续。')
  if(s.dataRevision!==expectedDataRevision)throw Error('项目已更新，请重新核对。')
  const result=requiresReview(s,item)?propose(s,{kind:'item',item},expectedDataRevision):{state:saveItem(s,item,s.items.find(i=>i.id===item.id)??null),change:null}
  const updated={...block,commit:{itemId:item.id,changeId:result.change?.id??null}}
  return {...result,state:event({...result.state,blocks:result.state.blocks.map(b=>b.id===id?updated:b)},'suggestion_committed',`明确落实建议：${block.title}`,block,updated)}
}
export function placeBlock(s: ProjectState, id:string, value:Placement, expectedRevision:number) {
  const p=PlacementSchema.parse(value), old=s.blocks.find(x=>x.id===id)
  if(!old) throw Error('信息块不存在。')
  if(old.placement.revision!==expectedRevision) throw Error('位置已被其他操作修改，请核对最新位置再移动。')
  const item=p.itemId?s.items.find(x=>x.id===p.itemId):null
  if(p.itemId&&!item) throw Error('目标任务不存在。')
  const placement={...p,phase:item?.phase??p.phase,origin:'user' as const,revision:expectedRevision+1,reason:'用户选择的位置；不改变正式任务或合同基线。'}
  return event({...s,blocks:s.blocks.map(x=>x.id===id?{...x,placement}:x)},'block_placed',`调整资料建议位置：${old.title}`,{blockId:id,placement:old.placement},{blockId:id,placement})
}
export function undoPlacement(s:ProjectState,id:string) {
  const block=s.blocks.find(x=>x.id===id)
  if(!block) throw Error('信息块不存在。')
  const e=[...s.events].reverse().find(e=>e.type==='block_placed'&&e.after&&typeof e.after==='object'&&'blockId' in e.after&&e.after.blockId===id)
  if(!e||!e.before||typeof e.before!=='object'||!('placement' in e.before)) throw Error('没有可撤销的位置调整。')
  const previous=PlacementSchema.parse(e.before.placement)
  const applied=z.object({placement:PlacementSchema}).parse(e.after).placement
  if(applied.revision!==block.placement.revision) throw Error('该操作已撤销或位置已再次改变。')
  const restored={...previous,revision:block.placement.revision+1}
  return event({...s,blocks:s.blocks.map(x=>x.id===id?{...x,placement:restored}:x)},'block_placement_undone',`撤销资料位置调整：${block.title}`,block.placement,restored)
}
