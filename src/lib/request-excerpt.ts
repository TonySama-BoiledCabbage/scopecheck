// A transparent wording guard, not an AI classifier. Indirect requests may need manual review.
const requestWords=/\b(?:please|could (?:you|we|it)|can (?:you|we)|would (?:you|we|it)|should|wants?|needs?|treat|ignore|prefer|confirm)\b|[?？]|请|能否|是否|希望|需要|改为|不要|暂缓|确认/i
export function requestExcerpt(text:string){
  const sentence=text.split(/(?<=[.!?。！？])\s+/).find(part=>requestWords.test(part))
  return sentence?.replace(/\s+/g,' ').trim().slice(0,160)??null
}
