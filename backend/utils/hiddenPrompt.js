const readline=require('node:readline');
function hiddenPrompt(label,{input=process.stdin,output=process.stdout}={}){
 if(!input.isTTY||typeof input.setRawMode!=='function')return Promise.reject(Error('A private interactive terminal is required. Passwords cannot be supplied in command arguments, files or pipes.'));
 return new Promise((resolve,reject)=>{
  const wasRaw=Boolean(input.isRaw);let value='';readline.emitKeypressEvents(input);input.setRawMode(true);input.resume();output.write(label);
  const finish=(error)=>{input.removeListener('keypress',onKey);input.setRawMode(wasRaw);input.pause();output.write('\n');const result=value;value='';if(error)reject(error);else resolve(result);};
  const onKey=(text,key={})=>{
   if(key.ctrl&&key.name==='c')return finish(Error('Cancelled. No password was changed.'));
   if(key.name==='return'||key.name==='enter')return finish();
   if(key.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
   if(!key.ctrl&&!key.meta&&text&&!/[\u0000-\u001f\u007f]/.test(text))value+=text;
  };input.on('keypress',onKey);
 });
}
module.exports={hiddenPrompt};
