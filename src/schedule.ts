import {dayDiff, addDays} from './domain/engine.ts'

export const weekStart=(date:string)=>addDays(date,-((new Date(date+'T12:00:00').getDay()+6)%7))

// A missing endpoint is a single known date, never a made-up duration.
export function dateBand(item:{start:string|null;end:string|null},first:string,days:number){
  const start=item.start??item.end,end=item.end??item.start
  if(!start||!end)return null
  const offset=Math.max(0,dayDiff(first,start)),last=Math.min(days-1,dayDiff(first,end))
  return last<offset?null:{offset,length:last-offset+1}
}
