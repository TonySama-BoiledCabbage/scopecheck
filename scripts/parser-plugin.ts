import type { Plugin, Connect } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

export function parserPlugin(configuredPython?:string): Plugin {
  let root=''
  const middleware: Connect.NextHandleFunction = async (req:IncomingMessage,res:ServerResponse,next) => {
    if(!req.url?.startsWith('/api/extract')) return next()
    const fail=(message:string,status=400)=>{if(!res.writableEnded){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:message}))}}
    if(req.method!=='POST') return fail('仅支持 POST。',405)
    const host=req.headers.host??''
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||req.headers['x-frame-parser']!=='local-v1'||(req.headers.origin&&req.headers.origin!==`http://${host}`)) return fail('仅允许本机同源上传。',403)
    const url=new URL(req.url,`http://${host}`), name=(url.searchParams.get('name')??'upload').slice(0,500), mime=url.searchParams.get('mime')??''
    let temp=''
    try {
      const chunks:Buffer[]=[];let bytes=0
      for await(const part of req){bytes+=part.length;if(bytes>50*1024*1024) return fail('单文件超过 50 MB 限制。',413);chunks.push(Buffer.from(part))}
      temp=await mkdtemp(join(tmpdir(),'frame-extract-'));const file=join(temp,'source');await writeFile(file,Buffer.concat(chunks))
      const python=configuredPython||process.env.FRAME_PYTHON || (existsSync(join(root,'.venv','Scripts','python.exe'))?join(root,'.venv','Scripts','python.exe'):'python')
      const child=spawn(python,[join(root,'scripts','extract.py'),file,name,mime],{cwd:root,windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}})
      let stdout='',stderr=''
      const timer=setTimeout(()=>child.kill(),300000)
      const disconnect=()=>{if(!res.writableEnded)child.kill()};res.once('close',disconnect)
      child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>16_000_000)child.kill()})
      child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4000)})
      const code=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)}).finally(()=>{clearTimeout(timer);res.off('close',disconnect)})
      let result;try{result=JSON.parse(stdout)}catch{throw Error(`解析器不可用，请运行 npm run setup:parser。${stderr.slice(-400)}`)}
      if(code!==0||result.error) return fail(result.error??'解析已取消或超过 5 分钟，请重试。',422)
      res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(result))
    } catch(error){fail(error instanceof Error?error.message:'本地解析失败。',500)}
    finally{if(temp&&resolve(temp).startsWith(resolve(join(tmpdir(),'frame-extract-'))))await rm(temp,{recursive:true,force:true})}
  }
  return {name:'frame-local-parser',configResolved(c){root=resolve(c.root)},configureServer(s){s.middlewares.use(middleware)},configurePreviewServer(s){s.middlewares.use(middleware)}}
}
