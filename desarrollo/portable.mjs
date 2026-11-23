import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const folder='dist';
let html=await readFile(path.join(folder,'index.html'),'utf8');
const script=html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const css=html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if(!script||!css)throw new Error('Faltan archivos de la compilación.');
const js=await readFile(path.join(folder,script[1]),'utf8');
const styles=await readFile(path.join(folder,css[1]),'utf8');
const images={};
for(const library of ['evidencia','rotores']){
 for(const f of await readdir(path.join(folder,library))){
   const data=await readFile(path.join(folder,library,f));
   images['./'+library+'/'+f]='data:image/'+(f.endsWith('.png')?'png':'webp')+';base64,'+data.toString('base64');
 }
}
html=html.replace(script[0],'').replace(css[0],()=>'<style>'+styles+'</style>').replace('</body>',()=>'<script>window.MAREA_ASSETS='+JSON.stringify(images)+'</script><script type="module">'+js.replaceAll('</script','<\\/script')+'</script></body>');
const notices=[];
for (const pkg of ['three','lucide','@fontsource-variable/dm-sans','@fontsource/barlow-condensed']){
  notices.push(pkg+'\n'+await readFile(path.join('node_modules',pkg,'LICENSE'),'utf8'));
}
html=html.replace('</body>',()=>'<script type="text/plain" id="third-party-notices">'+notices.join('\n\n')+'</script></body>');
await writeFile('../index.html',html);
console.log('index.html · versión portátil creada.');
