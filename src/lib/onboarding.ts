import { z } from 'zod'
export const GUIDE_KEY='frame-onboarding-v1'
const GuideSchema=z.object({version:z.literal(1),step:z.number().int().min(0).max(4),status:z.enum(['active','skipped','completed']),updatedAt:z.iso.datetime()})
export function initialGuideStep(raw:string|null):number|null {
  if(raw===null)return 0
  try{const saved=GuideSchema.parse(JSON.parse(raw));return saved.status==='active'?saved.step:null}catch{return null}
}
export function saveGuide(storage:Pick<Storage,'setItem'>,step:number,status:'active'|'skipped'|'completed') {
  const value=GuideSchema.parse({version:1,step,status,updatedAt:new Date().toISOString()})
  storage.setItem(GUIDE_KEY,JSON.stringify(value))
}
