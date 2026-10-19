import { create } from 'zustand'
import { useProject,projectSession } from '../store/project'
import { uid } from '../domain/engine'
import { registerSource, sourceStatus, finishExtraction,saveAiSuggestions,validateAiSuggestions } from '../domain/capture'
import { ExtractionSchema } from '../domain/capture-model'
import { getOriginal, saveOriginal, sha256 } from './media-db'

type IngestState={busy:boolean;progress:string;error:string;freshIds:string[];setError:(error:string)=>void;stop:()=>void}
let cancellation:AbortController|null=null
export const useIngest=create<IngestState>(set=>({busy:false,progress:'',error:'',freshIds:[],setError:error=>set({error}),stop:()=>cancellation?.abort()}))
type Session=ReturnType<typeof projectSession>
useProject.subscribe((s,previous)=>{if(s.run!==previous.run){cancellation?.abort();useIngest.setState({freshIds:[],error:'',progress:''})}})

async function parseSource(id:string,signal:AbortSignal,session:Session) {
  const {run}=session,source=session.read().sources.find(x=>x.id===id)
  if(!source)throw Error('当前项目中找不到这份原件。')
  await run(s=>sourceStatus(s,id,'processing'))
  useIngest.setState({progress:`正在解析 ${source.name} · 原件已留存`})
  try {
    const file=await getOriginal(source.hash)
    const response=await fetch(`/api/extract?${new URLSearchParams({name:source.name,mime:source.mime})}`,{method:'POST',headers:{'X-Frame-Parser':'local-v1','Content-Type':'application/octet-stream'},body:file,signal})
    const raw=await response.json()
    if(!response.ok) throw Error(raw.error??'解析失败。')
    const extracted=ExtractionSchema.parse(raw)
    const units=[...new Map(extracted.units.map(u=>[JSON.stringify(u),u])).values()]
    const keys=await Promise.all(units.map(u=>sha256(new TextEncoder().encode(JSON.stringify(u)))))
    const oldIds=new Set(session.read().blocks.map(b=>b.id))
    const next=await run(s=>finishExtraction(s,id,{...extracted,units},keys))
    const fresh=next.blocks.filter(b=>b.sourceId===id&&!oldIds.has(b.id)).map(b=>b.id)
    useIngest.setState(s=>({freshIds:[...s.freshIds,...fresh]}))
  } catch(error) {
    const message=signal.aborted?'解析已取消；原件保留，可继续解析。':error instanceof Error?error.message:'解析失败。'
    try{await run(s=>sourceStatus(s,id,'error',message))}catch{ /* Keep prior durable state; next retry recovers the retained original. */ }
    throw Error(message)
  }
}
async function sequence(ids:string[],signal:AbortSignal,session:Session) {
  const errors:string[]=[]
  for(const id of ids){if(signal.aborted)break;try{await parseSource(id,signal,session)}catch(error){errors.push(error instanceof Error?error.message:'解析失败。')}}
  if(errors.length)useIngest.setState({error:errors.join('；')})
}
export async function importFiles(files:File[],session=projectSession()) {
  if(useIngest.getState().busy)return
  if(!files.length)return
  useIngest.setState({busy:true,error:'',progress:'正在保存原件…',freshIds:[]})
  cancellation=new AbortController()
  const {run}=session
  const ids:string[]=[],received:string[]=[],batchId=uid(),errors:string[]=[]
  try {
    session.read()
    if(files.length>50)throw Error('一次最多 50 个文件，请分批拖入。')
    // Save all originals first, so cancellation/transcription failure cannot lose the other batch files.
    for(const file of files){
      try{
        if(file.size>50*1024*1024||file.size===0)throw Error(`${file.name}：单文件须为 1 字节至 50 MB。`)
        const hash=await sha256(await file.arrayBuffer())
        await saveOriginal(hash,file)
        const old=session.read().sources.find(x=>x.hash===hash)
        const id=old?.id??uid()
        await run(s=>registerSource(s,{id,hash,batchId,name:file.name,aliases:[file.name],mime:file.type,size:file.size,importedAt:new Date().toISOString(),status:'queued',error:'',parser:'',warnings:[]}))
        received.push(id)
        if(!old||old.status!=='ready')ids.push(id)
      }catch(error){errors.push(error instanceof Error?error.message:'原件保存失败。')}
    }
    await sequence([...new Set(ids)],cancellation.signal,session)
    if(errors.length)useIngest.setState(s=>({error:[s.error,...errors].filter(Boolean).join('；')}))
  }catch(error){useIngest.setState({error:error instanceof Error?error.message:'导入失败。'})}
  finally{useIngest.setState({busy:false,progress:useIngest.getState().error?'本批次存在待处理项，请查看错误提示和原件状态。':ids.length?'本批次处理结束；成功解析的建议已保存。':'文件已检查；重复内容复用已有信息块。'});cancellation=null}
  return received
}
export async function retrySource(id:string) {
  if(useIngest.getState().busy)return
  useIngest.setState({busy:true,error:'',freshIds:[]});cancellation=new AbortController()
  const session=projectSession()
  try{await sequence([id],cancellation.signal,session)}finally{useIngest.setState({busy:false,progress:'处理结束；人工位置不会被覆盖。'});cancellation=null}
}

export async function captureText(text:string) {
  if(useIngest.getState().busy)throw Error('请等待当前处理结束。')
  if(!text.trim())throw Error('请先输入客户反馈或会议笔记。')
  const session=projectSession(),file=new File([text],`反馈笔记-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`,{type:'text/plain'})
  const hash=await sha256(await file.arrayBuffer())
  session.read()
  await importFiles([file],session)
  const source=session.read().sources.find(s=>s.hash===hash)
  if(!source||source.status!=='ready')throw Error(useIngest.getState().error||'原文处理未完成，输入保留，请重试。')
  return source.id
}
export async function extractWithOllama(sourceId:string,model:string) {
  if(useIngest.getState().busy)throw Error('请等待当前处理结束。')
  const session=projectSession(),{run}=session
  const units=[...new Map(session.read().blocks.filter(b=>b.sourceId===sourceId).map(b=>[JSON.stringify(b.evidence),b.evidence])).values()]
  if(!units.length)throw Error('请先解析原件内容。')
  useIngest.setState({busy:true,error:'',progress:'本地AI正在整理需求；原件已保存…',freshIds:[]})
  cancellation=new AbortController()
  try{
    const response=await fetch('/api/local-ai/extract',{method:'POST',headers:{'X-Frame-Parser':'local-v1','Content-Type':'application/json'},body:JSON.stringify({model,units}),signal:cancellation.signal})
    const raw=await response.json();if(!response.ok)throw Error(raw.error||'本地AI提取失败。')
    const result=validateAiSuggestions(raw,units)
    const keys=await Promise.all(result.suggestions.map(part=>sha256(new TextEncoder().encode(JSON.stringify({part,evidence:units[part.evidenceIndex]})))))
    const before=new Map(session.read().blocks.map(b=>[b.id,b.engine]))
    const next=await run(s=>saveAiSuggestions(s,sourceId,units,result,keys))
    useIngest.setState({freshIds:next.blocks.filter(b=>b.engine==='ollama'&&before.get(b.id)!=='ollama').map(b=>b.id),progress:result.suggestions.length?'本地AI候选已保存，等待人工审核；正式计划未变。':'未找到可提取的需求；可继续人工整理，原件保留。'})
  }catch(error){const message=cancellation.signal.aborted?'AI提取已取消，原件和已有建议保留。':error instanceof Error?error.message:'AI提取失败。';useIngest.setState({error:message});throw Error(message)}
  finally{useIngest.setState({busy:false});cancellation=null}
}
