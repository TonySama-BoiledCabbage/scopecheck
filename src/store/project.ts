import { create } from 'zustand'
import { createSeed } from '../domain/seed.ts'
import { validateState } from '../domain/engine.ts'
import type { ProjectState } from '../domain/model.ts'

import { createEmptyProject,ProjectInput } from '../domain/projects.ts'
import type { z } from 'zod'

export const LEGACY_KEY='frame-project-v1'
const PREFIX='frame-project:'
const validKey=(key:string)=>key===LEGACY_KEY||/^frame-project:[0-9a-f-]{36}$/.test(key)
function readProject(key:string) {
  if(!validKey(key))throw Error('无效的项目地址。')
  const raw=localStorage.getItem(key)
  if(!raw){if(key===LEGACY_KEY)return createSeed();throw Error('项目不存在，或已被其他窗口清除。')}
  const s=validateState(JSON.parse(raw))
  if(key!==LEGACY_KEY&&key!==PREFIX+s.project.id)throw Error('项目身份与存储位置不一致，原始数据已保留。')
  return s
}
let initial = createSeed()
let startupError = ''
try {
  initial=readProject(LEGACY_KEY)
} catch { startupError = '本地数据无法读取或版本不兼容。已保留原始数据，禁止覆盖；请先导出原始数据。' }

type Store = {
  data: ProjectState
  key: string
  error: string
  blocked: boolean
  run: (fn: (state: ProjectState) => ProjectState) => Promise<ProjectState>
}
function boundRun(key:string):Store['run'] {
  const run:Store['run']=async fn=>{
    const save = () => {
      const store=useProject.getState()
      if(store.run!==run)throw Error('项目已切换，请返回原项目后重新操作。')
      if (store.blocked) throw Error(store.error)
      const current = store.data
      const raw = localStorage.getItem(key)
      if (raw) {
        const stored = readProject(key)
        if (stored.revision !== current.revision) {
          useProject.setState({data: stored})
          throw Error('其他窗口已更新项目，已载入新版本。请检查后重新操作。')
        }
      } else if (key!==LEGACY_KEY||current.revision !== 0) throw Error('本地存储已被其他窗口清除。请先导出当前数据，再刷新页面。')
      const next = validateState({...fn(current), revision: current.revision + 1})
      if(next.project.id!==current.project.id)throw Error('不能改变项目身份。')
      if(raw && JSON.parse(raw).schemaVersion===1 && !localStorage.getItem('frame-project-v1-backup-before-v2')) {
        localStorage.setItem('frame-project-v1-backup-before-v2',raw)
      }
      // ponytail: bounded text snapshot; originals already use IndexedDB. Move metadata there when history outgrows this limit.
      localStorage.setItem(key, JSON.stringify(next))
      useProject.setState({data: next, error: ''})
      return next
    }
    try {
      if (!navigator.locks) throw Error('当前浏览器不支持安全的多窗口写入，请使用本机 localhost 上的现代浏览器。')
      return await navigator.locks.request(key, save)
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请导出备份后重试。'
      if(useProject.getState().run===run)useProject.setState({error: message})
      throw Error(message)
    }
  }
  return run
}
export const useProject=create<Store>(()=>({data:initial,key:LEGACY_KEY,error:startupError,blocked:!!startupError,run:boundRun(LEGACY_KEY)}))

export function openProject(key:string) {
  const data=readProject(key)
  useProject.setState({key,data,error:'',blocked:false,run:boundRun(key)})
  return data
}
export function projectSession(){
  const run=useProject.getState().run
  return {run,read:()=>{if(useProject.getState().run!==run)throw Error('项目已切换，本次处理不会写入其他项目。');return useProject.getState().data}}
}
export type ProjectEntry={key:string;state:ProjectState|null;error:string}
export function listProjects():ProjectEntry[] {
  const keys=new Set([LEGACY_KEY])
  // ponytail: scan local metadata for a small studio; add an index if project count makes this measurable.
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX)&&validKey(key))keys.add(key)}
  return [...keys].map(key=>{try{return {key,state:readProject(key),error:''}}catch{return {key,state:null,error:'项目数据无法读取；请先导出原始数据。原件和快照均未覆盖。'}}})
}
export async function createProject(input:z.input<typeof ProjectInput>) {
  const state=createEmptyProject(input),key=PREFIX+state.project.id
  if(!navigator.locks)throw Error('当前浏览器不支持安全写入。')
  await navigator.locks.request(key,()=>{if(localStorage.getItem(key))throw Error('项目已存在，请重试。');localStorage.setItem(key,JSON.stringify(state))})
  return key
}
export const projectHref=(route:string,key=useProject.getState().key)=>`#project/${encodeURIComponent(key)}/${route}`
export const draftKey=()=>useProject.getState().key===LEGACY_KEY?'frame-feedback-draft':`${useProject.getState().key}:draft`

export function exportProject(raw = false,key=useProject.getState().key) {
  const data = raw ? localStorage.getItem(key) ?? '' : JSON.stringify(readProject(key), null, 2)
  const url = URL.createObjectURL(new Blob([data], {type: 'application/json'}))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = raw ? 'frame-recovery.json' : `frame-project-${readProject(key).project.id}.json`; anchor.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
