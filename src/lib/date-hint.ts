import type {ExtractedUnit} from '../domain/capture-model.ts'

const months=['january','february','march','april','may','june','july','august','september','october','november','december']
const words:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7}
const valid=(year:number,month:number,day:number)=>{
  const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const stamp=new Date(date+'T00:00:00Z')
  return Number.isFinite(stamp.getTime())&&stamp.toISOString().slice(0,10)===date?date:null
}
// Resolve only a model-selected, verbatim date phrase. Never use upload time or today's date.
export function resolveDateHint(quote:string,unit:ExtractedUnit):string|null {
  if(!quote.trim()||!unit.text.includes(quote))return null
  const raw=unit.eventTimeRaw??unit.occurredAt??''
  const reference=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/)
  const anchor=reference?valid(+reference[1],+reference[2],+reference[3]):null
  const found:string[]=[]
  let invalid=false
  for(const m of quote.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)){
    const date=valid(+m[1],+m[2],+m[3]);if(date)found.push(date);else invalid=true
  }
  const monthPattern=new RegExp('\\b('+months.join('|')+')[ \\t]+(\\d{1,2})(?:st|nd|rd|th)?(?:,?[ \\t]+(\\d{4}))?\\b','gi')
  for(const m of quote.matchAll(monthPattern)){
    const year=m[3]?+m[3]:anchor?+anchor.slice(0,4):null
    const date=year?valid(year,months.indexOf(m[1].toLowerCase())+1,+m[2]):null
    if(date&&(m[3]||!anchor||date>=anchor))found.push(date);else invalid=true
  }
  for(const m of quote.matchAll(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]/g)){
    const year=m[1]?+m[1]:anchor?+anchor.slice(0,4):null
    const date=year?valid(year,+m[2],+m[3]):null
    if(date&&(m[1]||!anchor||date>=anchor))found.push(date);else invalid=true
  }
  const offsets:number[]=[]
  for(const match of quote.matchAll(/\b(?:within|in)\s+(\d{1,2}|one|two|three|four|five|six|seven)\s+(?:calendar\s+)?days?\b|([一二两三四五六七]|\d{1,2})天[内后]/gi)){
    const word=(match[1]??match[2]).toLowerCase();offsets.push(words[word]??Number(word))
  }
  if(/\bday after tomorrow\b|后天/i.test(quote))offsets.push(2)
  else if(/\btomorrow\b|明天/i.test(quote))offsets.push(1)
  for(const offset of offsets){
    if(!anchor||!Number.isInteger(offset)||offset<1||offset>31||/business days?|工作日/i.test(quote))invalid=true
    else found.push(new Date(Date.parse(anchor+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10))
  }
  // Ambiguous weekdays, ranges and conflicting dates must remain for human review.
  const unique=[...new Set(found)]
  return !invalid&&unique.length===1?unique[0]:null
}
