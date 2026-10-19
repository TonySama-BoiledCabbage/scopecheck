import { z } from 'zod'
import { StateSchema,DateSchema } from './model.ts'
import type { ProjectState } from './model.ts'
import { uid,validateState } from './engine.ts'

export const ProjectInput = z.object({name:z.string().trim().min(1,'请输入项目名称。').max(160),client:z.string().trim().max(160),start:DateSchema.nullable()})
export function createEmptyProject(value:z.input<typeof ProjectInput>):ProjectState {
  const input=ProjectInput.parse(value),at=new Date().toISOString()
  const project={...input,id:uid(),manualDurationDays:null,demo:false,archived:false}
  return validateState({schemaVersion:2,revision:0,dataRevision:0,project,items:[],relations:[],sources:[],blocks:[],allowanceUses:[],
    baselines:[{id:uid(),version:1,createdAt:at,deliveryDate:null,milestones:{},stageGoals:{},scopeItems:{},allowance:{type:'custom',included:null,rule:''},constraints:'',evidence:'',approvedBy:'',approvedAt:null}],
    events:[{id:uid(),at,actor:'本机用户',type:'project_created',summary:`新建项目「${input.name}」；未设置合同承诺。`,before:null,after:project,change:null}]})
}
export function updateProject(s:ProjectState,value:Pick<ProjectState['project'],'name'|'client'|'archived'>,original:ProjectState['project']):ProjectState {
  if(JSON.stringify(s.project)!==JSON.stringify(original))throw Error('项目资料已被其他操作更新，请重新打开后编辑。')
  ProjectInput.parse({name:value.name,client:value.client,start:s.project.start})
  const project=StateSchema.shape.project.parse({...s.project,...value})
  // The home editor only changes identity and archive visibility, never dates or commitments.
  if(project.id!==s.project.id||project.start!==s.project.start||project.demo!==s.project.demo||project.manualDurationDays!==s.project.manualDurationDays)throw Error('主页不能修改项目计划或身份。')
  return {...s,project,events:[...s.events,{id:uid(),at:new Date().toISOString(),actor:'本机用户',type:'project_updated',summary:project.archived!==s.project.archived?(project.archived?'归档项目，全部资料与历史保留。':'恢复项目。'):`更新项目资料：${project.name}`,before:s.project,after:project,change:null}]}
}
