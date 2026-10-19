import {createEmptyProject} from './domain/projects.ts'
import {validateState} from './domain/engine.ts'

export const DEMO_RECOVERY='scopecheck-demo-recovery'
const legacy='frame-project-v1'
const projectKey=(key:string)=>key===legacy||/^frame-project:[0-9a-f-]{36}$/.test(key)

async function locked<T>(keys:string[],fn:()=>T,index=0):Promise<T>{
  if(!navigator.locks)throw Error('当前浏览器不支持安全写入。')
  return index===keys.length?fn():navigator.locks.request(keys[index],()=>locked(keys,fn,index+1))
}

export async function clearDemoSamples(keys:string[]){
  if(!keys.length||keys.some(key=>!projectKey(key)))throw Error('无效的项目地址。')
  return locked([...new Set([legacy,...keys,DEMO_RECOVERY])].sort(),()=>{
    const previous=localStorage.getItem(DEMO_RECOVERY)
    const records:Record<string,string>={}
    for(const key of [...keys,...keys.map(key=>key+':draft'),'frame-feedback-draft','frame-project-v1-backup-before-v2']){
      const raw=localStorage.getItem(key);if(raw!==null)records[key]=raw
    }
    for(const key of keys)if(records[key])validateState(JSON.parse(records[key]))
    const replacement=JSON.stringify(createEmptyProject({name:'Untitled Project',client:'',start:null}))
    // Save recovery first: quota failure must leave every original project in place.
    // ponytail: local recovery history grows with resets; quota exhaustion rejects the reset before deletion.
    localStorage.setItem(DEMO_RECOVERY,JSON.stringify({records,replacement,previous:previous?JSON.parse(previous):null}))
    try{
      localStorage.setItem(legacy,replacement)
      for(const key of Object.keys(records))if(key!==legacy)localStorage.removeItem(key)
    }catch(error){
      for(const [key,raw] of Object.entries(records))localStorage.setItem(key,raw)
      if(!(legacy in records))localStorage.removeItem(legacy)
      if(previous)localStorage.setItem(DEMO_RECOVERY,previous);else localStorage.removeItem(DEMO_RECOVERY)
      throw error
    }
  })
}

export async function restoreDemoSamples(){
  const raw=localStorage.getItem(DEMO_RECOVERY);if(!raw)throw Error('没有可恢复的样例备份。')
  const saved=JSON.parse(raw) as {records:Record<string,string>;replacement:string;previous?:unknown}
  const keys=Object.keys(saved.records)
  if(keys.some(key=>!projectKey(key)&&!/^frame-project:[0-9a-f-]{36}:draft$/.test(key)&&!['frame-feedback-draft','frame-project-v1-backup-before-v2',legacy+':draft'].includes(key)))throw Error('恢复备份不合法。')
  return locked([...new Set([legacy,...keys.filter(projectKey),DEMO_RECOVERY])].sort(),()=>{
    if(localStorage.getItem(DEMO_RECOVERY)!==raw||localStorage.getItem(legacy)!==saved.replacement)throw Error('空白项目已有新数据，不能覆盖恢复。')
    for(const key of keys)if(key!==legacy&&localStorage.getItem(key)!==null)throw Error('原项目位置已有新数据，不能覆盖恢复。')
    for(const key of keys.filter(projectKey))validateState(JSON.parse(saved.records[key]))
    for(const [key,value] of Object.entries(saved.records))localStorage.setItem(key,value)
    if(!(legacy in saved.records))localStorage.removeItem(legacy)
    if(saved.previous)localStorage.setItem(DEMO_RECOVERY,JSON.stringify(saved.previous));else localStorage.removeItem(DEMO_RECOVERY)
  })
}
