// Shared offline exports. Android uses scoped native storage; browsers use a download URL.
export function downloadBlob(blob,filename){
  if(window.NativeBridge?.saveFile){
    const reader=new FileReader();
    reader.onload=()=>{try{window.NativeBridge.saveFile(filename,blob.type,String(reader.result).split(',')[1]);}catch(e){window.__vv?.nativeSaveResult(false,'File could not be saved.');}};
    reader.onerror=()=>window.__vv?.nativeSaveResult(false,'File could not be read.');
    reader.readAsDataURL(blob);return 'native';
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'browser';
}
