const fs=require('fs');
function jpg(b){let i=2;while(i<b.length){if(b[i]!==0xFF){i++;continue;}const m=b[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];}i+=2+b.readUInt16BE(i+2);}return[0,0];}
function png(b){return[b.readUInt32BE(16),b.readUInt32BE(20)];}
for(const f of process.argv.slice(2)){try{const b=fs.readFileSync(f);const d=f.endsWith('.png')?png(b):jpg(b);console.log((d[0]+'x'+d[1]).padEnd(12), Math.round(b.length/1024)+'KB', f.split('/').pop());}catch(e){console.log('ERR', f, e.message);}}
