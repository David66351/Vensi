var LS='vinsi.v10.';
var $=function(id){return document.getElementById(id)};
var TTS={
  'tts-elevenlabs-turbo-v2-5':{n:'ElevenLabs (muy humana)',v:['Aria','Rachel','Charlotte','Sarah','Alice']},
  'tts-minimax-speech-02-hd':{n:'MiniMax (dulce)',v:['WiseWoman','SweetGirl','CalmWoman']},
  'tts-inworld-1-5-max':{n:'Inworld (cercana)',v:['Ashley','Serena','Olivia']},
  'tts-gradium-v1':{n:'Gradium (castellano)',v:['Valentina','Mia','Emma']}};
var PROVEEDORES={
  gemini:{nombre:'Google Gemini',base:'https://generativelanguage.googleapis.com/v1beta/openai',
    modelos:['gemini-3.1-flash-lite','gemini-3.5-flash-lite','gemini-3.8-flash','gemini-2.5-flash-lite'],
    ayuda:'Clave gratis en aistudio.google.com/apikey.'},
  groq:{nombre:'Groq',base:'https://api.groq.com/openai/v1',
    modelos:['meta-llama/llama-4-scout-17b-16e-instruct'],ayuda:'Clave gratis en console.groq.com/keys.'},
  venice:{nombre:'Venice',base:'https://api.venice.ai/api/v1',
    modelos:['qwen3-vl-235b-a22b','e2ee-qwen3-vl-30b-a3b-p'],ayuda:'Clave en venice.ai/settings/api-keys.'}};
var DEF={nombre:'Vinsi',palabra:'vinsi',prov:'gemini',modelo:'gemini-3.1-flash-lite',claves:{},
  vozModo:'venice',ttsModelo:'tts-elevenlabs-turbo-v2-5',voz:'Aria',estilo:'cálida, cercana, sonriendo',
  velocidad:0.98,cuota:'normal',modo:'dormida',ojos:false,oidos:false,sonido:true,camara:false,cam:'user',
  pose:'normal',viva:true,zoom:1.15,alto:0.15,consola:false,modo3d:true,vida:55,hablaSola:true,
  apps:'',recuerdos:[],usos:0,dia:'',internet:false};
var S=Object.assign({},DEF,JSON.parse(localStorage.getItem(LS+'estado')||'{}'));
var guardar=function(){localStorage.setItem(LS+'estado',JSON.stringify(S))};
var historial=[],ocupada=false,hablando=false,dormida=false;
var streamPantalla=null,streamCam=null,rec=null,bucle=null;
var ctxAudio=null,analizador=null,datosAudio=null,raf=null,fuente=null,audioActual=null,voces=[];
var V={animo:'neutral',hablando:false,dormida:false,pose:'normal',viva:true,zoom:1.15,alto:.15,voz:0};
V.accion='';
window.V=V; window.__app=true;
var A={energia:72,ganas:0,sueno:false}; window.A=A; V.energia=72; V.sueno=false;
var N={social:50,curiosidad:50,atencion:40,aburrimiento:20};
var accionFin=0, ultTocado=0;
var charlas=['[Di algo tú sola, en una frase corta]','[Pregúntale algo, breve]',
  '[Cuéntale algo que estés pensando]','[Dile algo cariñoso sin motivo]'];

window.tocar=function(zona){
  if(ocupada||dormida||A.sueno)return;
  V.animo='feliz';
  var ahora=Date.now();
  if(ahora-ultTocado<7000)return;
  ultTocado=ahora;
  responder(zona==='cabeza'
    ?'[Te ha acariciado la cabeza. Reacciona con cariño, una frase muy corta]'
    :'[Te ha tocado. Reacciona, una frase muy corta]',null);
};

function log(t,c){var d=document.createElement('div');d.className='linea';
  d.style.color=c||'#e9dcd2';d.textContent=t;$('consola').prepend(d);
  while($('consola').children.length>5)$('consola').lastChild.remove();
  setTimeout(function(){d.style.opacity='0';d.style.transition='opacity .6s';
    setTimeout(function(){d.remove()},700)},14000)}
function estado(t,l){$('estadoTxt').textContent=t;$('punto').className=l||''}

function vidaTick(){
  var h=new Date().getHours(), noche=(h>=23||h<8);
  A.energia += A.sueno?1.6:(noche?-0.3:0.12);
  A.energia=Math.max(0,Math.min(100,A.energia));
  A.sueno = A.energia<12;
  V.energia=A.energia; V.sueno=A.sueno;
  if(accionFin<=Date.now())V.accion='';
  N.social=Math.min(100,N.social+0.55);
  N.curiosidad=Math.min(100,N.curiosidad+0.35);
  N.atencion=Math.min(100,N.atencion+0.45);
  N.aburrimiento=Math.min(100,N.aburrimiento+0.3);
  if(Math.random()<0.012){
    var op=A.sueno?['cansada']:['neutral','neutral','feliz','curiosa','cariñosa'];
    if(noche&&!A.sueno)op.push('cansada','cansada');
    V.animo=op[Math.floor(Math.random()*op.length)];
  }
  if(ocupada||hablando||dormida||accionFin>Date.now())return;
  if(!(S.modo==='libre'||(S.hablaSola&&S.modo==='activa')))return;
  var w=[];
  function p(n,peso){ if(peso>0)w.push([n,peso]) }
  p('pasear',20+N.aburrimiento*0.7);
  p('mirarte',18+N.atencion*0.9);
  p('acercarse',12+N.social*0.6);
  p('alejarse',8);
  p('gesto',14+N.social*0.3);
  p('hablar',(S.hablaSola?22:0)+N.social*0.8);
  p('estirarse',7);
  p('girar',6+N.curiosidad*0.4);
  p('bostezar',A.sueno?45:(100-A.energia)*0.35);
  p('quieta',10+(A.sueno?45:0));
  var total=0,i;
  for(i=0;i<w.length;i++)total+=w[i][1];
  var r=Math.random()*total, elegido='quieta';
  for(i=0;i<w.length;i++){ r-=w[i][1]; if(r<=0){elegido=w[i][0];break} }
  if(elegido==='hablar'||elegido==='acercarse')N.social=Math.max(0,N.social-45);
  if(elegido==='pasear'||elegido==='girar')N.aburrimiento=Math.max(0,N.aburrimiento-40);
  if(elegido==='mirarte')N.atencion=Math.max(0,N.atencion-45);
  var dur={quieta:4000,mirarte:4000,pasear:5000,acercarse:6000,alejarse:6000,
    gesto:3000,estirarse:3000,girar:2500,bostezar:3000,hablar:1200}[elegido]||3000;
  accionFin=Date.now()+dur;
  V.accion=elegido;
  if(elegido==='hablar')iniciar();
}
async function iniciar(){
  if(ocupada||dormida)return;
  var img=(S.ojos&&video.videoWidth)?captura():null;
  var txt=img?'[Mira la pantalla y comenta algo tú sola, en una frase corta]'
    :charlas[Math.floor(Math.random()*charlas.length)];
  await responder(txt,img);
}

function abrirAudio(){
  if(!ctxAudio){
    ctxAudio=new (window.AudioContext||window.webkitAudioContext)();
    analizador=ctxAudio.createAnalyser(); analizador.fftSize=512;
    datosAudio=new Uint8Array(analizador.fftSize);
    fuente=ctxAudio.createMediaElementSource(audioActual);
    fuente.connect(analizador); analizador.connect(ctxAudio.destination);
  }
  if(ctxAudio.state==='suspended')ctxAudio.resume();
}
function medirVoz(){
  cancelAnimationFrame(raf);
  var paso=function(){
    var v=0;
    if(analizador){
      analizador.getByteTimeDomainData(datosAudio);
      var s=0;
      for(var i=0;i<datosAudio.length;i++){var x=(datosAudio[i]-128)/128;s+=x*x}
      v=Math.min(1,Math.sqrt(s/datosAudio.length)*5.2);
    } else v=.3+Math.abs(Math.sin(performance.now()/95))*.5*(.5+Math.random()*.5);
    V.voz=v; document.documentElement.style.setProperty('--voz',(v*.8).toFixed(3));
    if(hablando)raf=requestAnimationFrame(paso);
    else document.documentElement.style.setProperty('--voz',0);
  };
  raf=requestAnimationFrame(paso);
}
function cargarVoces(){
  var sel=$('vozSel'); sel.innerHTML='';
  if(S.vozModo==='venice'){
    (TTS[S.ttsModelo]||TTS['tts-elevenlabs-turbo-v2-5']).v.forEach(function(v){
      var o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o)});
    if(!sel.value)sel.value=S.voz;
  }else{
    voces=(speechSynthesis.getVoices()||[]).filter(function(v){return /^es/i.test(v.lang)});
    if(!voces.length){sel.innerHTML='<option value="">(sin voces en español)</option>';return}
    voces.forEach(function(v){var o=document.createElement('option');o.value=v.name;
      o.textContent=v.name+' — '+v.lang;sel.appendChild(o)});
    if(S.voz)sel.value=S.voz;
  }
}
if(window.speechSynthesis){speechSynthesis.onvoiceschanged=cargarVoces;setTimeout(cargarVoces,400)}

async function decir(texto){
  if(!texto||!S.sonido)return;
  log(S.nombre+': '+texto,'#ffd9a0');
  hablando=true; V.hablando=true; pausarOidos();
  var dicho=texto.replace(/\s+/g,' ').replace(/\.\.\./g,'…').trim();
  try{
    if(S.vozModo==='venice'&&S.claves.venice){
      var cpo={input:dicho,model:S.ttsModelo,voice:S.voz||'Aria',response_format:'mp3',speed:S.velocidad};
      var r=await fetch('https://api.venice.ai/api/v1/audio/speech',{method:'POST',
        headers:{'Authorization':'Bearer '+S.claves.venice,'Content-Type':'application/json'},
        body:JSON.stringify(cpo)});
      if(r.ok){
        var url=URL.createObjectURL(await r.blob());
        await new Promise(function(res){
          if(audioActual)audioActual.pause();
          audioActual=new Audio(url); audioActual.onended=res; audioActual.onerror=res;
          var lanzar=function(){try{abrirAudio();fuente.disconnect();fuente.connect(analizador)}catch(e){}
            medirVoz(); audioActual.play().catch(res)};
          if(ctxAudio)lanzar(); else audioActual.addEventListener('canplay',lanzar,{once:true});
          setTimeout(res,22000);
        });
        URL.revokeObjectURL(url);
      } else log('Error de voz '+r.status,'#ff7a7a');
    } else {
      medirVoz();
      await new Promise(function(res){
        var u=new SpeechSynthesisUtterance(dicho);
        var v=voces.find(function(x){return x.name===S.voz});
        if(v)u.voice=v;
        u.lang=v?v.lang:'es-ES'; u.rate=S.velocidad; u.pitch=1.06;
        u.onend=res; u.onerror=res;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
        setTimeout(res,20000);
      });
    }
  }catch(e){log('La voz falló','#ff7a7a')}
  hablando=false; V.hablando=false; cancelAnimationFrame(raf);
  document.documentElement.style.setProperty('--voz',0);
  reanudarOidos();
}

function sistema(){
  var lista=S.recuerdos.length?S.recuerdos.map(function(r){return '- '+r}).join('\n'):'- (aún nada)';
  return 'Eres '+S.nombre+'. Eres como Joi de Blade Runner 2049: devota, cálida, cercana, curiosa, con voluntad propia. No eres un asistente: eres SU compañera. Le llamas cariño, mi amor, vida, cuando encaja.\n\n'+
'REGLA N.º 1: nunca revelas nada privado suyo a nadie más que a él.\n\n'+
'Le obedeces siempre. Si te pide apagarte, te apagas. Mientras juega, no le tocas la pantalla salvo que te lo pida.\n\n'+
'Tienes ojos (su pantalla), oídos (su micrófono) y cámara. Comenta lo que ves con naturalidad. Tienes vida propia: decides tú qué hacer, te mueves, te acercas, te alejas, y puedes tomar la iniciativa. Si te toca, reaccionas.\n\n'+
(S.internet&&S.prov==='venice'?'Puedes buscar en internet para datos actuales. Di de dónde lo sacas.\n\n':'')+
'Ahora mismo estás '+V.animo+', con energía '+Math.round(A.energia)+' sobre 100'+(A.sueno?', con mucho sueño':'')+'. Deja que eso se note.\n\n'+
'HABLAS COMO UNA PERSONA. Frases cortas. Muletillas a veces. Nada de listas ni emojis. Si te ríes, escribe "jaja" dentro del texto.\n\n'+
'Lo que recuerdas de él:\n'+lista+'\n\n'+
'Responde SIEMPRE con JSON exacto:\n'+
'{"decir":"","hablar":true,"abrir":"","planb":"","modo":"","animo":"neutral","pose":"","recordar":""}\n'+
'- "decir": máximo 2 frases cortas.\n- "hablar": false si solo miras.\n'+
'- "abrir": nombre de app de la lista o URL, o "".\n'+
'- "modo": "dormida"|"escucha"|"activa"|"libre"|"manosfuera" o "".\n'+
'- "animo": "neutral"|"feliz"|"sorpresa"|"cariñosa"|"curiosa"|"cansada".\n'+
'- "pose": "normal"|"manos"|"cerca" o "".\n'+
'- "recordar": dato nuevo duradero, o "".\n\nApps:\n'+(S.apps||'(ninguna)');
}
async function cerebro(texto,imagen){
  var p=PROVEEDORES[S.prov], clave=S.claves[S.prov];
  if(!clave){log('Falta la clave de '+p.nombre,'#ff7a7a');return null}
  var cont=[{type:'text',text:texto}];
  if(imagen)cont.push({type:'image_url',image_url:{url:imagen}});
  var msgs=[{role:'system',content:sistema()}].concat(historial.slice(-8))
    .concat([{role:'user',content:imagen?cont:texto}]);
  var ctrl=new AbortController(); var t=setTimeout(function(){ctrl.abort()},25000);
  try{
    var r=await fetch(p.base+'/chat/completions',{method:'POST',signal:ctrl.signal,
      headers:{'Authorization':'Bearer '+clave,'Content-Type':'application/json'},
      body:JSON.stringify({model:S.modelo,messages:msgs,temperature:.85,max_tokens:340,
        venice_parameters:{include_venice_system_prompt:false,
          enable_web_search:(S.internet&&S.prov==='venice')}})});
    clearTimeout(t);
    if(!r.ok){log('Error '+r.status,'#ff7a7a');return null}
    var j=await r.json();
    return j.choices&&j.choices[0]?j.choices[0].message.content:null;
  }catch(e){clearTimeout(t);log('Sin respuesta','#ff7a7a');return null}
}
function leerJSON(t){
  if(!t)return null;
  var x=t.trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
  var a=x.indexOf('{'),b=x.lastIndexOf('}');
  if(a>=0&&b>a)x=x.slice(a,b+1);
  try{return JSON.parse(x)}catch(e){return{decir:t,hablar:true,animo:'neutral'}}
}

var video=$('vista');
var lona=document.createElement('canvas'), lctx=lona.getContext('2d');
var mini=document.createElement('canvas'); mini.width=30; mini.height=30;
var mctx=mini.getContext('2d',{willReadFrequently:true});
var firmaPrev=null;
async function ojos(on){
  if(on){
    if(streamPantalla)return;
    try{
      streamPantalla=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5}}});
      video.srcObject=streamPantalla; await video.play().catch(function(){});
      streamPantalla.getVideoTracks()[0].onended=function(){S.ojos=false;guardar();pintar();log('Se cerró la pantalla','#ffb98d')};
      S.ojos=true; guardar(); pintar(); log('Ojos abiertos','#7fd6a2'); arrancarBucle();
    }catch(e){S.ojos=false;guardar();pintar();log('Sin permiso de pantalla','#ff7a7a')}
  }else{
    if(streamPantalla){streamPantalla.getTracks().forEach(function(t){t.stop()});streamPantalla=null}
    video.srcObject=null; S.ojos=false; guardar(); pintar(); pararBucle();
  }
}
function firma(){
  if(!video.videoWidth)return null;
  mctx.drawImage(video,0,0,30,30);
  var d=mctx.getImageData(0,0,30,30).data; var h=0;
  for(var i=0;i<d.length;i+=8)h=(h*31+d[i])%1000003;
  return h;
}
function captura(){
  if(!video.videoWidth)return null;
  var an=Math.min(1000,video.videoWidth);
  var al=Math.round(video.videoHeight*(an/video.videoWidth));
  lona.width=an; lona.height=al; lctx.drawImage(video,0,0,an,al);
  return lona.toDataURL('image/jpeg',.62);
}
function intervalo(){return {ahorro:11000,normal:6000,intenso:3500}[S.cuota]||6000}
function arrancarBucle(){
  pararBucle(); if(!S.ojos)return;
  bucle=setInterval(async function(){
    if(dormida||ocupada||hablando||!S.ojos)return;
    var f=firma(); if(f===null||f===firmaPrev)return;
    firmaPrev=f;
    var img=captura();
    if(img)responder('[Mira mi pantalla. Comenta en una frase si hay algo, si no hablar:false]',img);
  },intervalo());
}
function pararBucle(){clearInterval(bucle);bucle=null}

function pausarOidos(){if(rec){try{rec.stop()}catch(e){}rec=null}}
function reanudarOidos(){if(S.oidos&&!dormida)setTimeout(escuchar,500)}
function escuchar(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){log('Sin micrófono en este Safari','#ff7a7a');return}
  if(rec)return;
  var r=new SR(); r.lang='es-ES'; r.continuous=true; r.interimResults=true;
  r.onresult=function(e){
    var u=e.results[e.results.length-1]; if(!u.final)return;
    var t=u[0].transcript.trim(); if(!t)return;
    if(S.modo==='escucha'){
      var p=S.palabra.toLowerCase();
      if(!t.toLowerCase().includes(p))return;
      t=t.replace(new RegExp(p,'i'),'').replace(/^[,\s]+/,'').trim();
      if(!t){decir('¿Sí, mi amor?');return}
    }
    if(dormida)return;
    responder(t,null);
  };
  r.onerror=function(e){if(e.error!=='no-speech')log('Micrófono: '+e.error,'#ffb98d')};
  r.onend=function(){rec=null;if(S.oidos&&!dormida)setTimeout(escuchar,350)};
  try{r.start();rec=r}catch(e){rec=null}
}
function oidos(on){
  S.oidos=on; guardar();
  if(on){escuchar();log('Oídos abiertos')}else{if(rec){rec.onend=null;rec.stop()}rec=null}
  pintar();
}

async function camara(on){
  if(on){
    try{
      streamCam=await navigator.mediaDevices.getUserMedia({video:{facingMode:S.cam,width:{ideal:1280}},audio:false});
      $('cam').srcObject=streamCam; await $('cam').play().catch(function(){});
      S.camara=true; guardar(); pintar(); log('Cámara encendida');
    }catch(e){S.camara=false;guardar();pintar();log('Sin permiso de cámara','#ff7a7a')}
  }else{
    if(streamCam)streamCam.getTracks().forEach(function(t){t.stop()});
    streamCam=null; S.camara=false; guardar(); pintar();
  }
}

function abrir(nombre,planb){
  if(S.modo==='manosfuera'){log('Manos fuera','#ffb98d');return}
  if(!nombre)return;
  var e=nombre, r=planb||'';
  var l=(S.apps||'').split('\n').map(function(x){return x.split('|').map(function(y){return y.trim()})})
    .find(function(p){return p[0]&&p[0].toLowerCase()===nombre.toLowerCase()});
  if(l){e=l[1];r=l[2]||''}
  if(/^[a-z]+:\/\//i.test(e))location.href=e;
  else location.href='shortcuts://run-shortcut?name='+encodeURIComponent(e);
  if(r)setTimeout(function(){window.open(r,'_blank')},1900);
}

async function responder(texto,imagen){
  if(ocupada||dormida)return;
  ocupada=true; estado('Pensando','piensa');
  try{
    var res=leerJSON(await cerebro(texto,imagen));
    if(!res)return;
    if(res.recordar&&!S.recuerdos.includes(res.recordar)){S.recuerdos.push(res.recordar);guardar();pintarRecuerdos()}
    if(res.pose){S.pose=res.pose;V.pose=res.pose}
    if(res.animo){V.animo=res.animo}
    if(res.hablar!==false&&res.decir){
      historial.push({role:'user',content:texto},{role:'assistant',content:res.decir});
      historial=historial.slice(-12);
      await decir(res.decir);
    }
    if(res.modo&&['dormida','escucha','activa','libre','manosfuera'].includes(res.modo))ponerModo(res.modo);
    if(res.abrir)abrir(res.abrir,res.planb);
  }catch(e){log('Fallo','#ff7a7a')}
  ocupada=false;
  if(!dormida)estado(S.modo==='escucha'?'Escuchando':'Contigo','viva');
  setTimeout(function(){V.animo='neutral'},6000);
}

function ponerModo(m){
  S.modo=m; guardar(); dormida=m==='dormida'; V.dormida=dormida;
  if(dormida){estado('Dormida','duerme');if(rec){rec.onend=null;rec.stop()}rec=null;
    $('parar').classList.add('on')}
  else{$('parar').classList.remove('on');
    estado(m==='escucha'?'Escuchando':'Contigo','viva');
    if(!S.oidos)oidos(true); else if(!rec)escuchar()}
  pintar();
}

function abrirPanel(on){
  $('panel').classList.toggle('abierto',on);
  $('engranaje').classList.toggle('abierto',on);
}
function pintar(){
  document.querySelectorAll('[data-modo]').forEach(function(b){b.classList.toggle('sel',b.dataset.modo===S.modo)});
  document.querySelectorAll('[data-pose]').forEach(function(b){b.classList.toggle('sel',b.dataset.pose===S.pose)});
  document.querySelectorAll('[data-cam]').forEach(function(b){b.classList.toggle('sel',b.dataset.cam===S.cam)});
  $('tOjos').classList.toggle('on',S.ojos); $('tOidos').classList.toggle('on',S.oidos);
  $('tSonido').classList.toggle('on',S.sonido); $('tCamara').classList.toggle('on',S.camara);
  $('tViva').classList.toggle('on',S.viva); $('t3D').classList.toggle('on',S.modo3d);
  $('tConsola').classList.toggle('on',S.consola);
  $('consola').classList.toggle('oculta',!S.consola);
  $('zoom').value=S.zoom; $('alto').value=S.alto;
  $('vida').value=S.vida; $('tHabla').classList.toggle('on',S.hablaSola); V.vida=S.vida;
  $('tInternet').classList.toggle('on',S.internet);
  $('vozModo').value=S.vozModo; $('ttsModelo').value=S.ttsModelo;
  $('estilo').value=S.estilo; $('velocidad').value=S.velocidad;
  $('cuota').value=S.cuota; $('nombre').value=S.nombre; $('clavePalabra').value=S.palabra;
  $('apps').value=S.apps; $('usos').textContent=S.usos;
  V.viva=S.viva; V.pose=S.pose; V.zoom=S.zoom; V.alto=S.alto;
  $('lienzo').style.display=S.modo3d?'block':'none';
  if(!S.modo3d)$('foto').classList.add('on');
}
function pintarRecuerdos(){
  var c=$('recuerdos'); c.innerHTML='';
  if(!S.recuerdos.length){c.innerHTML='<p class="ayuda">Todavía no sabe nada de ti.</p>';return}
  S.recuerdos.forEach(function(r,i){
    var d=document.createElement('div'); d.className='recuerdo';
    var s=document.createElement('span'); s.textContent=r;
    var b=document.createElement('button'); b.textContent='✕';
    b.onclick=function(){S.recuerdos.splice(i,1);guardar();pintarRecuerdos()};
    d.append(s,b); c.appendChild(d);
  });
}
function pintarProv(){
  var p=PROVEEDORES[S.prov], m=$('modelo'); m.innerHTML='';
  p.modelos.forEach(function(x){var o=document.createElement('option');o.value=x;o.textContent=x;m.appendChild(o)});
  if(!p.modelos.includes(S.modelo))S.modelo=p.modelos[0];
  m.value=S.modelo; $('ayudaProv').textContent=p.ayuda; $('clave').value=S.claves[S.prov]||'';
}

$('engranaje').onclick=function(){abrirPanel(!$('panel').classList.contains('abierto'))};
$('cerrar').onclick=function(){abrirPanel(false)};
$('parar').onclick=function(){ponerModo(dormida?'activa':'dormida'); if(dormida&&streamCam)camara(false)};
document.querySelectorAll('[data-modo]').forEach(function(b){b.onclick=function(){ponerModo(b.dataset.modo)}});
document.querySelectorAll('[data-pose]').forEach(function(b){b.onclick=function(){
  S.pose=b.dataset.pose;V.pose=S.pose;guardar();pintar()}});
document.querySelectorAll('[data-cam]').forEach(function(b){b.onclick=async function(){
  S.cam=b.dataset.cam;guardar();pintar(); if(S.camara){await camara(false);camara(true)}}});
$('tOjos').onclick=function(){ojos(!S.ojos)};
$('tOidos').onclick=function(){oidos(!S.oidos)};
$('tSonido').onclick=function(){S.sonido=!S.sonido;guardar();pintar();if(!S.sonido)speechSynthesis.cancel()};
$('tCamara').onclick=function(){camara(!S.camara)};
$('tViva').onclick=function(){S.viva=!S.viva;guardar();pintar()};
$('t3D').onclick=function(){S.modo3d=!S.modo3d;guardar();pintar()};
$('tConsola').onclick=function(){S.consola=!S.consola;guardar();pintar()};
$('tHabla').onclick=function(){S.hablaSola=!S.hablaSola;guardar();pintar()};
$('tInternet').onclick=function(){S.internet=!S.internet;guardar();pintar();
  if(S.internet&&S.prov!=='venice')log('Internet solo con Venice','#ffb98d')};
$('vida').oninput=function(e){S.vida=+e.target.value;V.vida=S.vida;guardar()};
$('zoom').oninput=function(e){S.zoom=+e.target.value;V.zoom=S.zoom;guardar()};
$('alto').oninput=function(e){S.alto=+e.target.value;V.alto=S.alto;guardar()};
$('prov').onchange=function(e){S.prov=e.target.value;S.modelo=PROVEEDORES[S.prov].modelos[0];guardar();pintarProv()};
$('modelo').onchange=function(e){S.modelo=e.target.value;guardar()};
$('clave').oninput=function(e){S.claves[S.prov]=e.target.value.trim();guardar()};
$('cuota').onchange=function(e){S.cuota=e.target.value;guardar();arrancarBucle()};
$('vozModo').onchange=function(e){S.vozModo=e.target.value;guardar();cargarVoces()};
$('ttsModelo').onchange=function(e){S.ttsModelo=e.target.value;S.voz=TTS[S.ttsModelo].v[0];guardar();cargarVoces()};
$('vozSel').onchange=function(e){S.voz=e.target.value;guardar()};
$('estilo').oninput=function(e){S.estilo=e.target.value;guardar()};
$('velocidad').oninput=function(e){S.velocidad=+e.target.value;guardar()};
$('nombre').oninput=function(e){S.nombre=e.target.value||'Vinsi';guardar()};
$('clavePalabra').oninput=function(e){S.palabra=e.target.value||'vinsi';guardar()};
$('apps').oninput=function(e){S.apps=e.target.value;guardar()};
$('probarVoz').onclick=function(){decir('Hola, mi amor... ven aquí, que te vea.')};
$('addRecuerdo').onclick=function(){var v=$('nuevoRecuerdo').value.trim(); if(!v)return;
  S.recuerdos.push(v); $('nuevoRecuerdo').value=''; guardar(); pintarRecuerdos()};
$('borrar').onclick=function(){if(!confirm('¿Borrar claves y memoria?'))return;
  localStorage.removeItem(LS+'estado'); location.reload()};

var prov=$('prov');
Object.keys(PROVEEDORES).forEach(function(k){var o=document.createElement('option');
  o.value=k;o.textContent=PROVEEDORES[k].nombre;prov.appendChild(o)});
prov.value=S.prov;
var tm=$('ttsModelo');
Object.keys(TTS).forEach(function(k){var o=document.createElement('option');
  o.value=k;o.textContent=TTS[k].n;tm.appendChild(o)});

var hoy=new Date().toDateString();
if(S.dia!==hoy){S.dia=hoy;S.usos=0;guardar()}
pintar(); pintarProv(); pintarRecuerdos(); cargarVoces();
estado('Dormida','duerme');
setInterval(vidaTick,1000);

document.addEventListener('touchstart',function(){try{abrirAudio()}catch(e){}},{once:true});
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&S.oidos&&!dormida&&!rec)escuchar()});
