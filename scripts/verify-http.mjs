import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const base=process.env.FRAME_TEST_URL||'http://127.0.0.1:5190'
const results=[]
async function check(name,fn){await fn();results.push({name,result:'PASS'})}
const headers={'X-Frame-Parser':'local-v1','Content-Type':'application/octet-stream'}
await check('页面和适配入口可访问',async()=>{const r=await fetch(base);assert.equal(r.status,200);assert.match(await r.text(),/adapter|assets\/index/)})
await check('真实TXT解析保留证据',async()=>{const text='请整理包装交付文件。';const r=await fetch(base+'/api/extract?name=test.txt&mime=text/plain',{method:'POST',headers,body:text});assert.equal(r.status,200);const json=await r.json();assert.ok(json.units.some(x=>x.text.includes(text)));assert.ok(json.parser)})
for(const name of ['brief.pdf','brief.png'])await check('真实文件解析 '+name,async()=>{const r=await fetch(base+'/api/extract?name='+name,{method:'POST',headers,body:await readFile(new URL('../tests/fixtures/'+name,import.meta.url))});const json=await r.json();assert.equal(r.status,200,JSON.stringify(json));assert.ok(json.units.some(x=>/packaging/i.test(x.text)));assert.ok(json.units[0].bounds)})
await check('缺少本机调用头被拒绝',async()=>{const r=await fetch(base+'/api/extract?name=test.txt',{method:'POST',body:'text'});assert.equal(r.status,403)})
await check('外部Origin被拒绝',async()=>{const r=await fetch(base+'/api/extract?name=test.txt',{method:'POST',headers:{...headers,Origin:'https://example.org'},body:'text'});assert.equal(r.status,403)})
await check('不支持格式返回真实失败',async()=>{const r=await fetch(base+'/api/extract?name=unsupported.scopecheck',{method:'POST',headers,body:await readFile(new URL('../tests/fixtures/unsupported.scopecheck',import.meta.url))});assert.equal(r.status,422);assert.ok((await r.json()).error)})
await check('Ollama状态返回可用模型或明确错误',async()=>{const r=await fetch(base+'/api/local-ai/models',{headers});const json=await r.json();assert.ok(r.status===200?Array.isArray(json.models):r.status===503&&json.error);results.push({ollama:r.status===200?json.models:json.error})})
console.log(JSON.stringify({at:new Date().toISOString(),base,results},null,2))
