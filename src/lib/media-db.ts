// Blobs live in IndexedDB; the existing project snapshot stores only metadata/references.
let connection: Promise<IDBDatabase> | undefined
function db() {
  return connection ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('frame-originals',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('files')
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>{connection=undefined;reject(request.error??Error('原件存储无法打开。'))}
    request.onblocked=()=>{connection=undefined;reject(Error('原件存储被旧窗口占用，请关闭旧窗口后重试。'))}
  })
}
export async function saveOriginal(hash:string,file:Blob) {
  const database=await db()
  await new Promise<void>((resolve,reject)=>{
    const transaction=database.transaction('files','readwrite')
    transaction.objectStore('files').put(file,hash)
    transaction.oncomplete=()=>resolve()
    transaction.onerror=()=>reject(transaction.error??Error('原件保存失败。'))
    transaction.onabort=()=>reject(transaction.error??Error('原件保存已中止。'))
  })
}
export async function getOriginal(hash:string):Promise<Blob> {
  const database=await db()
  return new Promise((resolve,reject)=>{
    const request=database.transaction('files').objectStore('files').get(hash)
    request.onsuccess=()=>request.result instanceof Blob?resolve(request.result):reject(Error('当前浏览器缺少原件，请重新上传相同文件恢复。'))
    request.onerror=()=>reject(request.error??Error('读取原件失败。'))
  })
}
export async function sha256(data:BufferSource) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('')
}
