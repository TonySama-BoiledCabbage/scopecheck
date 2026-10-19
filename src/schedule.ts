import {dayDiff, addDays} from './domain/engine.ts'

export const weekStart=(date:string)=>addDays(date,-((new Date(date+'T12:00:00').getDay()+6)%7))
export type CalendarMode='day'|'week'|'month'

export function calendarPeriod(date:string,mode:CalendarMode){
  const start=mode==='month'?date.slice(0,7)+'-01':mode==='week'?weekStart(date):date
  const end=mode==='month'?addDays(stepCalendarDate(start,'month',1),-1):addDays(start,mode==='week'?6:0)
  return {start,end,days:dayDiff(start,end)+1}
}

export function stepCalendarDate(date:string,mode:CalendarMode,step:number){
  if(mode!=='month')return addDays(date,step*(mode==='week'?7:1))
  const next=new Date(date.slice(0,7)+'-01T12:00:00Z')
  next.setUTCMonth(next.getUTCMonth()+step)
  const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate()
  next.setUTCDate(Math.min(Number(date.slice(-2)),last))
  return next.toISOString().slice(0,10)
}

// A missing endpoint is a single known date, never a made-up duration.
export function dateBand(item:{start:string|null;end:string|null},first:string,days:number){
  const start=item.start??item.end,end=item.end??item.start
  if(!start||!end)return null
  const offset=Math.max(0,dayDiff(first,start)),last=Math.min(days-1,dayDiff(first,end))
  return last<offset?null:{offset,length:last-offset+1}
}
