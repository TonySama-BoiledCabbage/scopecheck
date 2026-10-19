import { useProject, listProjects, openProject, createProject, projectSession, exportProject } from './store/project.ts'
import { saveItem, requiresReview, propose, commitChange, uid } from './domain/engine.ts'
import { reviewBlock, commitBlock } from './domain/capture.ts'
import type { Item, Decision, ProjectState } from './domain/model.ts'
// Thin command facade: all writes go through Frame's locked, revision-checked store.
export const frame = {
  listProjects, openProject, createProject, projectSession, exportProject,
  read:()=>useProject.getState().data,
  saveTask:async(item:Item,original:Item|null,session=projectSession())=>session.run(s=>{
    if(JSON.stringify(s.items.find(x=>x.id===item.id)??null)!==JSON.stringify(original))throw Error('条目已更新，请重新打开后编辑。')
    if((original?.scopeRisk||item.id in s.baselines.at(-1)!.scopeItems)&&!item.scopeRisk)throw Error('已登记的范围风险不能通过取消勾选绕过变更审查。')
    return requiresReview(s,item)?propose(s,{kind:'item',item},s.dataRevision).state:saveItem(s,item,original)
  }),
  review:async(id:string,revision:number,status:'confirmed'|'dismissed'|'unreviewed',ack=false,session=projectSession())=>session.run(s=>reviewBlock(s,id,revision,status,ack)),
  commit:async(id:string,revision:number,item:Item,dataRevision:number,session=projectSession())=>session.run(s=>commitBlock(s,id,revision,item,dataRevision).state),
  proposeDelivery:async(date:string|null,revision:number,session=projectSession())=>session.run(s=>propose(s,{kind:'delivery',date},revision).state),
  decide:async(id:string,decision:Decision,session=projectSession())=>session.run(s=>commitChange(s,id,decision)),

}



// Reuse Frame features/Capture.tsx EvidenceDialog materialisation; no UI port.
export function draftFromBlock(state:ProjectState,block:ProjectState['blocks'][number]):Item {
  const old=state.items.find(item=>item.id===block.placement.itemId)
  const source=state.sources.find(source=>source.id===block.sourceId)
  if(!source)throw Error('找不到需求原件，请重新打开项目。')
  const evidence=`来源：${source.name} · ${block.evidence.locator} · block:${block.id}`
  const requirement=block.description||block.evidence.text,date=block.placement.date
  return old
    ?{...old,goal:`${old.goal}\n${requirement}\n${evidence}`,...(date?{end:date,start:old.kind==='milestone'?date:old.start&&old.start>date?date:old.start}:{})}
    :{id:uid(),title:block.title,kind:'task',phase:block.placement.phase??'concept',status:'planned',start:date,end:date,remainingDays:null,goal:`${requirement}\n${evidence}`,scopeRisk:false}
}
