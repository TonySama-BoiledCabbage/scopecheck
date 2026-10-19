import {frame} from '../src/frame.ts'
import {importFiles,captureText,useIngest} from '../src/lib/ingest.ts'
import {getOriginal,sha256} from '../src/lib/media-db.ts'
import {latestChanges,today} from '../src/domain/engine.ts'
import type {Item,Decision} from '../src/domain/model.ts'
const report=document.querySelector('#report')!
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)}
document.querySelector<HTMLButtonElement>('#run')!.onclick=async()=>{
  const results:{name:string;result:string}[]=[]
  const check=async(name:string,fn:()=>unknown)=>{await fn();results.push({name,result:'PASS'});report.textContent=JSON.stringify({results},null,2)}
  try{
    let key=''
    await check('真实项目创建与任务持久化',async()=>{
      key=await frame.createProject({name:'自动验证 '+new Date().toISOString(),client:'独立测试数据',start:today()});frame.openProject(key)
      const item:Item={id:crypto.randomUUID(),title:'测试内部任务',kind:'task',phase:'research',status:'planned',start:today(),end:today(),remainingDays:1,goal:'测试',scopeRisk:false}
      await frame.saveTask(item,null);frame.openProject(key);assert(frame.read().items[0].title===item.title,'任务未持久化')
    })
    let sourceId=''
    await check('真实文件批次：TXT成功、不支持格式失败、两份原件均留存',async()=>{
      const files=await Promise.all(['feedback.txt','unsupported.scopecheck'].map(async name=>new File([await (await fetch('./fixtures/'+name)).blob()],name,{type:'application/octet-stream'})))
      await importFiles(files)
      assert(!!useIngest.getState().error,'失败必须显式返回')
      const s=frame.read();assert(s.sources.length===2,'必须登记两份原件');assert(s.sources.some(x=>x.status==='ready')&&s.sources.some(x=>x.status==='error'),'成功/失败状态错误')
      for(const file of files){const hash=await sha256(await file.arrayBuffer());assert(await (await getOriginal(hash)).text()===await file.text(),'原件不一致')}
      sourceId=s.sources.find(x=>x.status==='ready')!.id
      const count=s.blocks.length;await importFiles([files[0]]);assert(frame.read().blocks.length===count,'重复文件生成重复候选')
    })
    await check('规则候选明确标识；确认内容不改变任务或基线',async()=>{
      const before=frame.read(),b=before.blocks.find(x=>x.sourceId===sourceId)!
      assert(b.engine==='rules','规则冒充AI');await frame.review(b.id,b.review.revision,'confirmed',true)
      assert(JSON.stringify(frame.read().items)===JSON.stringify(before.items),'确认内容改变任务');assert(JSON.stringify(frame.read().baselines)===JSON.stringify(before.baselines),'确认内容改变基线')
    })
    await check('落实范围需求仅记录提议，待确认不应用；缺失批准依据拒绝',async()=>{
      const s=frame.read(),b=s.blocks.find(x=>x.sourceId===sourceId)!,item={...s.items[0],id:crypto.randomUUID(),title:b.title,goal:b.description,scopeRisk:true}
      await frame.commit(b.id,b.review.revision,item,s.dataRevision)
      const c=latestChanges(frame.read())[0];assert(c.status==='proposed','未形成提议');assert(frame.read().items.length===1,'提议提前应用')
      const d:Decision={duration:'unknown',durationDays:null,allowance:'no',allowanceKey:'',units:1,commitment:'needs_confirmation',reason:'自动流程核对',evidence:'',approvedBy:'',approvedAt:null,relatedSources:sourceId,manualReview:true,scopeAuthorized:false}
      await frame.decide(c.id,d);assert(latestChanges(frame.read())[0].status==='pending','待确认被应用')
      let rejected=false;try{await frame.decide(c.id,{...d,commitment:'approved'})}catch{rejected=true}assert(rejected,'缺失批准依据仍成功')
      await frame.decide(c.id,{...d,commitment:'approved',scopeAuthorized:true,evidence:'独立测试项目的模拟书面授权，不代表真实合同',approvedBy:'自动验收测试',approvedAt:today()})
      assert(frame.read().baselines.length===2,'未追加基线');assert(frame.read().baselines[0].version===1,'旧基线丢失');assert(frame.read().items.length===2,'批准未应用')
    })
    await check('正式交付日提议不自动改期，批准才追加新基线',async()=>{
      const before=frame.read(),date='2026-12-20';await frame.proposeDelivery(date,before.dataRevision)
      assert(frame.read().baselines.at(-1)!.deliveryDate===null,'提议提前改期')
      const c=latestChanges(frame.read())[0]
      await frame.decide(c.id,{duration:'unknown',durationDays:null,allowance:'no',allowanceKey:'',units:1,commitment:'approved',reason:'测试正式交付日期',evidence:'仅自动验收测试用，不代表客户批准',approvedBy:'自动验收测试',approvedAt:today(),relatedSources:'',manualReview:true,scopeAuthorized:false})
      assert(frame.read().baselines.at(-1)!.deliveryDate===date,'正式交付日期未应用');assert(frame.read().baselines.length===3,'未保留基线历史')
    })
    await check('项目切换不串写；另一个项目不出现文件、任务或基线',async()=>{
      const session=frame.projectSession(),other=await frame.createProject({name:'自动隔离验证',client:'',start:null});frame.openProject(other)
      let rejected=false;try{await session.run(s=>s)}catch{rejected=true}assert(rejected,'过期会话串写');assert(!frame.read().items.length&&!frame.read().sources.length&&frame.read().baselines.length===1,'项目数据泄漏');frame.openProject(key)
    })
    await check('localStorage容量失败保留原件与输入，重试可恢复',async()=>{
      const original=Storage.prototype.setItem,text='容量失败验收：保留此原文 '+crypto.randomUUID()
      const hash=await sha256(new TextEncoder().encode(text)),before=JSON.stringify(frame.read())
      let rejected=false
      try{Storage.prototype.setItem=function(){throw Error('QuotaExceededError test')};try{await captureText(text)}catch{rejected=true}}finally{Storage.prototype.setItem=original}
      assert(rejected,'容量失败仍报告成功');assert(text.includes('保留此原文'),'输入丢失');assert(await (await getOriginal(hash)).text()===text,'容量失败原件未保留');assert(JSON.stringify(frame.read())===before,'失败发布了不持久的状态')
      await captureText(text);assert(frame.read().sources.some(x=>x.hash===hash&&x.status==='ready'),'重试未恢复原件元数据')
    })
    report.textContent=JSON.stringify({at:new Date().toISOString(),project:key,status:'PASS',results,ollama:'成功生成未验证：本机Ollama未连接'},null,2)
  }catch(e){report.textContent=JSON.stringify({status:'FAIL',results,error:e instanceof Error?e.message:String(e)},null,2)}
}
