const $=id=>document.getElementById(id);
const V=window.V;
const lim=(v,a,b)=>Math.max(a,Math.min(b,v));
function fotoOn(){ $('foto').classList.add('on'); $('carga').classList.add('oculta'); }
setTimeout(()=>{ if(!window.__3d) fotoOn(); }, 12000);

try{
  const THREE=await import('three');
  const { GLTFLoader }=await import('three/addons/loaders/GLTFLoader.js');
  const { VRMLoaderPlugin, VRMUtils }=await import('@pixiv/three-vrm');

  const lienzo=$('lienzo');
  const render=new THREE.WebGLRenderer({canvas:lienzo,alpha:true,antialias:true});
  render.setPixelRatio(Math.min(devicePixelRatio,2));
  render.setSize(innerWidth,innerHeight,false);
  render.outputColorSpace=THREE.SRGBColorSpace;
  const escena=new THREE.Scene();
  const camara=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.1,20);
  escena.add(new THREE.HemisphereLight(0xffd9c0,0x241a30,1.6));
  const foco=new THREE.DirectionalLight(0xfff0e0,1.6); foco.position.set(1.4,2.4,2); escena.add(foco);
  const borde=new THREE.DirectionalLight(0xff8fb0,1.2); borde.position.set(-1.8,1.4,-1.6); escena.add(borde);

  const PALETAS=[[1,.8,.6],[.7,.85,1],[1,.7,.85],[.85,1,.8]];
  const NUBE=90, pos=new Float32Array(NUBE*3), col=new Float32Array(NUBE*3);
  for(let i=0;i<NUBE;i++){
    pos[i*3]=(Math.random()-.5)*4; pos[i*3+1]=Math.random()*2.4+.2; pos[i*3+2]=(Math.random()-.5)*2-1;
    col[i*3]=1; col[i*3+1]=.8; col[i*3+2]=.6;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const estrella=new THREE.PointsMaterial({size:.035,vertexColors:true,transparent:true,opacity:.9});
  const puntos=new THREE.Points(geo,estrella); escena.add(puntos);

  const MODELOS=[
   'https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/AvatarSample_B.vrm',
   'https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/AvatarSample_A.vrm',
   'https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/fem_vroid.vrm'];
  const loader=new GLTFLoader();
  loader.register(p=>new VRMLoaderPlugin(p));

  let vrm=null,b={},giro=0,giroObj=0,parpadeo=0,sigParpadeo=2,parpadeoDoble=0;
  $('carga').textContent='Cargando su cuerpo…';

  for(const url of MODELOS){
    try{
      const gltf=await Promise.race([loader.loadAsync(url),
        new Promise((_,no)=>setTimeout(()=>no(new Error('tarda')),18000))]);
      vrm=gltf.userData.vrm; if(!vrm)continue;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrm.scene.rotation.y=Math.PI;
      vrm.scene.traverse(o=>{o.frustumCulled=false});
      escena.add(vrm.scene);
      if(vrm.lookAt)vrm.lookAt.target=new THREE.Object3D();
      escena.add(vrm.lookAt.target);
      const g=n=>vrm.humanoid.getNormalizedBoneNode(n);
      b={cadera:g('hips'),columna:g('spine'),pecho:g('chest'),pechoAlto:g('upperChest'),
        cuello:g('neck'),cabeza:g('head'),
        lHombro:g('leftShoulder'),rHombro:g('rightShoulder'),
        lBrazo:g('leftUpperArm'),rBrazo:g('rightUpperArm'),
        lAnte:g('leftLowerArm'),rAnte:g('rightLowerArm'),
        lMano:g('leftHand'),rMano:g('rightHand'),
        lMuslo:g('leftUpperLeg'),rMuslo:g('rightUpperLeg'),
        lPantorrilla:g('leftLowerLeg'),rPantorrilla:g('rightLowerLeg'),
        lPie:g('leftFoot'),rPie:g('rightFoot'),
        lDedos:g('leftToes'),rDedos:g('rightToes')};
      const esc=(n,s)=>{ const x=g(n); if(x)x.scale.setScalar(s) };
      esc('head',1.34); esc('neck',1.08);
      ['leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg'].forEach(n=>esc(n,.86));
      ['leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm'].forEach(n=>esc(n,.9));
      vrm.scene.scale.setScalar(.95);
      window.__3d=true; $('foto').classList.remove('on'); $('carga').classList.add('oculta');
      break;
    }catch(e){}
  }
  if(!vrm) fotoOn();

  const DEDOS=[];
  ['left','right'].forEach(lado=>{
    ['Index','Middle','Ring','Little','Thumb'].forEach(d=>{
      const peso={Index:1,Middle:1.1,Ring:.9,Little:.75,Thumb:.55}[d];
      ['Proximal','Intermediate','Distal'].forEach((seg,i)=>{
        const n=vrm.humanoid.getNormalizedBoneNode(lado+d+seg);
        if(n)DEDOS.push({b:n,base:n.rotation.z||0,peso:peso*(i===2?.6:1)});
      });
    });
  });

  const PELOS=[];
  vrm.scene.traverse(o=>{
    if(o.isBone && /hair/i.test(o.name)) PELOS.push({b:o,rz:o.rotation.z,rx:o.rotation.x,z:0,x:0,vz:0,vx:0});
  });

  const dc=$('dibujo'), dx=dc.getContext('2d');
  let trazo=null;
  function ajustarDibujo(){ dc.width=innerWidth; dc.height=innerHeight }
  ajustarDibujo();
  function empezarTrazo(){
    dx.clearRect(0,0,dc.width,dc.height);
    const colores=['#ffb27a','#ff8fb0','#9fd8ff','#ffe6a8','#c6a8ff'];
    dx.strokeStyle=colores[Math.floor(Math.random()*colores.length)];
    dx.lineWidth=2.5; dx.lineCap='round'; dx.lineJoin='round';
    trazo={x:dc.width*(.2+Math.random()*.6),y:dc.height*(.2+Math.random()*.4),puntos:0};
  }
  function pintarTrazo(){
    if(!trazo)return;
    trazo.puntos++;
    dx.beginPath(); dx.moveTo(trazo.x,trazo.y);
    trazo.x+=Math.sin(trazo.puntos*.35)*4+(Math.random()-.5)*5;
    trazo.y+=Math.cos(trazo.puntos*.22)*3+(Math.random()-.5)*4;
    dx.lineTo(trazo.x,trazo.y); dx.stroke();
  }

  let gesto=null, finGesto=0, proxGesto=4;
  let panX=0, panObj=0, proxPan=5, cercaObj=0, cerca=0, proxCerca=9;
  let posX=0, caminando=false, destinoX=0, fasePaso=0, proxPaseo=6, reaccion=0, mirarAct=0;
  let vel=0, miradaX=0, miradaY=0, sigMirada=1, cabezaPrevia=0, peso=0;
  let sentada=0, saltando=0, saltoFase=0, tinte=0, paletaAct=-1;
  const rayo=new THREE.Raycaster(), puntero=new THREE.Vector2();
  const GESTOS=['saludo','pecho','pelo','abrir','senalar'];
  const teml=f=>Math.sin(f)*.5+Math.sin(f*2.37+1.1)*.32+Math.sin(f*4.13+.4)*.18;

  function objetivo(t,viva,amp){
    const sw=Math.sin(t*.7)*.05*viva;
    const r={lBrazoZ:1.26+sw, rBrazoZ:-1.26-sw,
      lBrazoX:.12+amp*.1, rBrazoX:.12+amp*.1, lBrazoY:.18, rBrazoY:-.18,
      lAnteY:-.38, rAnteY:.38, lAnteZ:0, rAnteZ:0,
      lManoY:.1, rManoY:-.1, lManoZ:.06, rManoZ:-.06,
      lHombroZ:.06, rHombroZ:-.06, dedos:.36};
    if(gesto==='arriba'){ r.lBrazoZ=-.55; r.rBrazoZ=.55; r.lBrazoX=.14; r.rBrazoX=.14;
      r.lAnteY=-.12; r.rAnteY=.12; r.dedos=.06; }
    else if(gesto==='saludo'){
      const ola=Math.sin(t*7.5)*.2;
      r.rBrazoZ=.22+ola; r.rBrazoX=.3; r.rAnteY=.7; r.rAnteZ=-.3;
      r.rHombroZ=-.26; r.rManoZ=-.2; r.dedos=.04;
    } else if(gesto==='pecho'){
      r.lBrazoZ=.66; r.rBrazoZ=-.66; r.lBrazoX=.55; r.rBrazoX=.55;
      r.lAnteY=-1.5; r.rAnteY=1.5; r.lManoZ=.22; r.rManoZ=-.22; r.dedos=.55;
    } else if(gesto==='pelo'){
      r.lBrazoZ=-.12; r.lBrazoX=.65; r.lAnteY=-1.65; r.lAnteZ=.4; r.lManoZ=.26; r.dedos=.42;
    } else if(gesto==='abrir'){
      r.lBrazoZ=.45; r.rBrazoZ=-.45; r.lBrazoX=.85; r.rBrazoX=.85;
      r.lAnteY=-.6; r.rAnteY=.6; r.dedos=.08;
    } else if(gesto==='senalar'){
      r.rBrazoZ=.05; r.rBrazoX=.9; r.rAnteY=.35; r.rHombroZ=-.3; r.dedos=.05;
      r.lBrazoZ=1.3; r.lAnteY=-.3;
    } else if(gesto==='dibujar'){
      r.rBrazoZ=.1; r.rBrazoX=1.15; r.rAnteY=.55; r.rHombroZ=-.32; r.rManoZ=-.25;
      r.lBrazoZ=.95; r.lBrazoX=.7; r.lAnteY=-.9; r.dedos=.3;
    }
    if(V.pose==='manos'){ r.lBrazoZ=.8; r.rBrazoZ=-.8;
      r.lAnteY=-1.32; r.rAnteY=1.32; r.lBrazoX=.42; r.rBrazoX=.42; r.dedos=.5; }
    if(amp>.15){ r.lAnteY-=amp*.5; r.rAnteY+=amp*.5; r.dedos+=amp*.22; }
    return r;
  }

  const reloj=new THREE.Clock();
  (function bucle(){
    requestAnimationFrame(bucle);
    const dt=Math.min(reloj.getDelta(),.05), t=reloj.elapsedTime;
    if(vrm){
      const viva=V.viva?1:.22, amp=V.voz||0;
      const sueno=V.sueno, acc=V.accion||'';

      if(acc==='acercarse') cercaObj=1;
      else if(acc==='alejarse') cercaObj=0;
      else if(acc==='girar') giroObj=(Math.random()*2-1)*.8;
      else if(acc==='jugar'){ saltando=1; if(Math.random()<.02) giroObj=(Math.random()*2-1)*1 }
      else if(acc==='gesto' && !gesto){ gesto=GESTOS[Math.floor(Math.random()*GESTOS.length)]; finGesto=t+1.8 }
      else if(acc==='estirarse' && !gesto){ gesto='arriba'; finGesto=t+2.6 }
      else if(acc==='dibujar' && !gesto){ gesto='dibujar'; finGesto=t+6.5; empezarTrazo() }
      else if(acc==='decorar'){ tinte=1; }
      else if(acc==='sentarse') sentada=1;

      if(acc==='dibujar') pintarTrazo();
      sentada+=( (acc==='sentarse'||acc==='dibujar'?1:0) - sentada)*.05;
      saltando+=((acc==='jugar'?1:0)-saltando)*.05;
      if(paletaAct!==V.paleta){
        paletaAct=V.paleta;
        const pal=PALETAS[paletaAct%PALETAS.length];
        for(let i=0;i<NUBE;i++){
          col[i*3]=pal[0]*(.7+Math.random()*.3);
          col[i*3+1]=pal[1]*(.7+Math.random()*.3);
          col[i*3+2]=pal[2]*(.7+Math.random()*.3);
        }
        geo.attributes.color.needsUpdate=true;
      }

      proxPaseo-=dt;
      if((acc==='pasear'||(!acc && proxPaseo<=0)) && !caminando && !sueno && viva>0.5 && !V.hablando && sentada<.4){
        destinoX=(Math.random()*2-1)*0.75; caminando=true;
      }
      if(caminando){
        const dxd=destinoX-posX, dist=Math.abs(dxd);
        vel+=((Math.min(0.34,0.05+dist*1.05))-vel)*.04;
        posX+=Math.sign(dxd)*Math.min(dist,vel*dt);
        fasePaso+=dt*(2.1+vel*10);
        if(dist<0.05){ caminando=false; proxPaseo=(4+Math.random()*7)*(1.5-(V.vida||55)/100) }
      } else { vel*=0.9; fasePaso+=dt*vel*10*.5 }

      const p=Math.min(1,vel*2.4);
      const s=teml(fasePaso), s2=teml(fasePaso+Math.PI);
      const nz=(Math.sin(t*7.3)+Math.sin(t*11.7))*.5;
      peso+=((s>0?1:-1)-peso)*.06;
      saltoFase+=dt*(saltando?7:0);

      if(b.lMuslo){
        b.lMuslo.rotation.x=lim(s*.24*p+nz*.01-sentada*.9,-.9,.62);
        b.rMuslo.rotation.x=lim(s2*.24*p-nz*.01-sentada*.9,-.9,.62);
        if(b.lPantorrilla){
          b.lPantorrilla.rotation.x=lim(Math.max(0,Math.sin(fasePaso+.62))*.7*p+sentada*1.5+nz*.02,0,2.2);
          b.rPantorrilla.rotation.x=lim(Math.max(0,Math.sin(fasePaso+Math.PI+.62))*.7*p+sentada*1.5-nz*.02,0,2.2);
        }
        if(b.lPie){
          b.lPie.rotation.x=lim((Math.max(0,s)*.24-Math.max(0,-s)*.15)*p+saltando*.2,-.45,.55);
          b.rPie.rotation.x=lim((Math.max(0,s2)*.24-Math.max(0,-s2)*.15)*p+saltando*.2,-.45,.55);
        }
        if(b.lDedos){
          b.lDedos.rotation.x=lim(-Math.max(0,-s)*.34*p,-.55,0);
          b.rDedos.rotation.x=lim(-Math.max(0,-s2)*.34*p,-.55,0);
        }
        if(b.cadera){
          b.cadera.rotation.y=s*.1*p;
          b.cadera.rotation.z=Math.sin(t*.45)*.03*viva+peso*.05*p;
          b.cadera.rotation.x=lim(Math.abs(s)*.025*p+sentada*.12,0,.2);
        }
        if(b.columna) b.columna.rotation.y=-s*.045*p;
        if(b.pecho) b.pecho.rotation.y=-s*.06*p;
        if(b.pechoAlto) b.pechoAlto.rotation.y=-s*.045*p;
      }

      if(!gesto){ proxGesto-=dt;
        if(proxGesto<=0 && !V.hablando && !V.dormida && !sueno && viva>0.5){
          var lista=(V.animo==='cariñosa')?['pecho','pecho','pelo','saludo']:GESTOS;
          gesto=lista[Math.floor(Math.random()*lista.length)];
          finGesto=t+1.6+Math.random()*1.6;
        }
      } else if(t>finGesto){ gesto=null; proxGesto=3+Math.random()*6 }

      const o=objetivo(t,viva,amp);
      if(caminando){
        const atraso=Math.sin(fasePaso-.42);
        o.lBrazoX-=atraso*.2*p; o.rBrazoX+=atraso*.2*p;
        o.lAnteY-=Math.max(0,atraso)*.3*p; o.rAnteY+=Math.max(0,atraso)*.3*p;
      }
      if(saltando>.1){ o.lBrazoZ-=.25*saltando; o.rBrazoZ+=.25*saltando; o.dedos+=.2*saltando }
      const k=1-Math.pow(0.002,dt);
      if(b.lBrazo){
        b.lBrazo.rotation.z+=(o.lBrazoZ-b.lBrazo.rotation.z)*k;
        b.rBrazo.rotation.z+=(o.rBrazoZ-b.rBrazo.rotation.z)*k;
        b.lBrazo.rotation.x+=(o.lBrazoX-b.lBrazo.rotation.x)*k;
        b.rBrazo.rotation.x+=(o.rBrazoX-b.rBrazo.rotation.x)*k;
        b.lBrazo.rotation.y+=(o.lBrazoY-b.lBrazo.rotation.y)*k;
        b.rBrazo.rotation.y+=(o.rBrazoY-b.rBrazo.rotation.y)*k;
        if(b.lHombro){
          b.lHombro.rotation.z+=(o.lHombroZ-b.lHombro.rotation.z)*k;
          b.rHombro.rotation.z+=(o.rHombroZ-b.rHombro.rotation.z)*k;
        }
        if(b.lAnte){
          b.lAnte.rotation.y=lim(b.lAnte.rotation.y+(o.lAnteY-b.lAnte.rotation.y)*k,-2.4,0.05);
          b.rAnte.rotation.y=lim(b.rAnte.rotation.y+(o.rAnteY-b.rAnte.rotation.y)*k,-0.05,2.4);
          b.lAnte.rotation.z+=(o.lAnteZ-b.lAnte.rotation.z)*k;
          b.rAnte.rotation.z+=(o.rAnteZ-b.rAnte.rotation.z)*k;
        }
        if(b.lMano){
          b.lMano.rotation.y+=(o.lManoY-b.lMano.rotation.y)*k;
          b.rMano.rotation.y+=(o.rManoY-b.rMano.rotation.y)*k;
          b.lMano.rotation.z=lim(b.lMano.rotation.z+(o.lManoZ-b.lMano.rotation.z)*k,-.7,.7);
          b.rMano.rotation.z=lim(b.rMano.rotation.z+(o.rManoZ-b.rMano.rotation.z)*k,-.7,.7);
        }
      }
      DEDOS.forEach(d=>{
        const meta=d.base+o.dedos*.42*d.peso;
        d.b.rotation.z+=(meta-d.b.rotation.z)*k*.5;
      });

      const lento=sueno?.35:1;
      if(b.pecho) b.pecho.rotation.x=Math.sin(t*1.25*lento)*.03*viva*(sueno?.5:1)+amp*.05+(caminando?.03:0);
      if(b.pechoAlto) b.pechoAlto.rotation.x=Math.sin(t*1.25*lento+.4)*.02*viva;
      if(b.columna) b.columna.rotation.x=Math.sin(t*1.25*lento+.8)*.015*viva;
      if(b.cadera){
        b.cadera.position.x=Math.sin(t*.55)*.013*viva;
        b.cadera.position.y=Math.abs(s)*.012*p-sentada*.32+Math.abs(Math.sin(saltoFase))*.1*saltando;
      }
      if(b.cabeza){
        const yaw=Math.sin(t*.45)*.18*viva+Math.sin(t*1.7)*.02+(acc==='mirarte'?0:-miradaX*.14);
        b.cabeza.rotation.y+=(yaw-b.cabeza.rotation.y)*.05;
        const pit=Math.sin(t*.7)*.05*viva-amp*.03+(sueno?.2:0)+(reaccion>0?.18*reaccion:0)
          +(acc==='bostezar'?-.16:0)-miradaY*.09+(acc==='dibujar'?.22:0);
        b.cabeza.rotation.x=lim(b.cabeza.rotation.x+(pit-b.cabeza.rotation.x)*.05,-.6,.7);
        const rol=Math.sin(t*.33)*.05*viva+(V.animo==='cariñosa'?.08:0)-s*.025*p;
        b.cabeza.rotation.z+=(rol-b.cabeza.rotation.z)*.05;
      }
      if(b.cuello&&b.cabeza){
        b.cuello.rotation.y=b.cabeza.rotation.y*.32;
        b.cuello.rotation.x=lim(b.cabeza.rotation.x*.3,-.35,.4);
      }

      const velCabeza=(b.cabeza?b.cabeza.rotation.y:0)-cabezaPrevia;
      cabezaPrevia=b.cabeza?b.cabeza.rotation.y:0;
      PELOS.forEach(h=>{
        const empuje=-velCabeza*9-s*p*.6;
        h.vz+=(-h.z*70-h.vz*8+empuje)*dt; h.z+=h.vz*dt;
        h.vx+=(-h.x*70-h.vx*8+(caminando?s*.5:0)-Math.sin(saltoFase)*saltando*.6)*dt; h.x+=h.vx*dt;
        h.b.rotation.z=h.rz+lim(h.z,-.32,.32);
        h.b.rotation.x=h.rx+lim(h.x,-.28,.28);
      });

      sigMirada-=dt;
      if(sigMirada<=0){ miradaX=(Math.random()*2-1)*.6; miradaY=(Math.random()*2-1)*.35; sigMirada=.5+Math.random()*1.6 }
      if(vrm.lookAt&&vrm.lookAt.target){
        vrm.lookAt.target.position.set(
          camara.position.x+miradaX*.5, camara.position.y+miradaY*.35-.15, camara.position.z);
      }

      sigParpadeo-=dt;
      if(sigParpadeo<=0){
        parpadeo=1;
        if(Math.random()<.35)parpadeoDoble=.16;
        sigParpadeo=1.8+Math.random()*4;
      }
      parpadeo=Math.max(0,parpadeo-dt*6);
      if(parpadeoDoble>0){ parpadeoDoble-=dt; if(parpadeoDoble<=0)parpadeo=1 }

      const em=vrm.expressionManager;
      if(em){
        em.setValue('blink',parpadeo);
        em.setValue('aa',V.hablando?Math.min(1,amp*1.6):0);
        em.setValue('happy',Math.max(V.animo==='feliz'?.6:0,reaccion*.8,saltando*.4));
        em.setValue('relaxed',(V.dormida||sueno||V.animo==='cansada'||acc==='bostezar')?.6:0);
        em.setValue('surprised',V.animo==='sorpresa'?.6:0);
      }
      giro+=(giroObj-giro)*.05;
      reaccion=Math.max(0,reaccion-dt*.8);
      vrm.scene.position.x=posX;
      vrm.scene.position.y=Math.abs(Math.sin(saltoFase))*.09*saltando;
      mirarAct+=((caminando?Math.sign(destinoX-posX)*.4:0)-mirarAct)*.045;
      vrm.scene.rotation.y=Math.PI+giro+mirarAct;

      puntos.rotation.y=t*.05;
      puntos.position.y=Math.sin(t*.4)*.05;
      estrella.opacity=.55+(tinte>0?.4:0);
      tinte=Math.max(0,tinte-dt*.15);

      vrm.update(dt);
    }
    proxPan-=dt; if(proxPan<=0){panObj=(Math.random()-.5)*.45; proxPan=7+Math.random()*10}
    proxCerca-=dt; if(proxCerca<=0){cercaObj=Math.random()<.45?1:0; proxCerca=10+Math.random()*12}
    panX+=(panObj-panX)*.015; cerca+=(cercaObj-cerca)*.015;
    const base=(V.pose==='cerca'?1.15:1.55);
    const z=(base-cerca*.18)/(V.zoom||1.5);
    camara.position.set(panX+posX*.35,1.16+(V.alto||.15),z);
    camara.lookAt(posX*.25,1.1+(V.alto||.15),0);
    render.render(escena,camara);
  })();

  addEventListener('resize',()=>{
    camara.aspect=innerWidth/innerHeight; camara.updateProjectionMatrix();
    render.setSize(innerWidth,innerHeight,false);
    ajustarDibujo();
  });
  let arrX=null;
  lienzo.addEventListener('touchstart',e=>{arrX=e.touches[0].clientX});
  lienzo.addEventListener('touchmove',e=>{
    if(arrX===null)return;
    giroObj=Math.max(-.7,Math.min(.7,giroObj+(e.touches[0].clientX-arrX)*.006));
    arrX=e.touches[0].clientX;
  },{passive:true});
  lienzo.addEventListener('touchend',()=>{arrX=null});

  let tapX=0, tapY=0;
  lienzo.addEventListener('pointerdown',e=>{tapX=e.clientX;tapY=e.clientY});
  lienzo.addEventListener('pointerup',e=>{
    if(!vrm)return;
    if(Math.abs(e.clientX-tapX)>12||Math.abs(e.clientY-tapY)>12)return;
    const r=lienzo.getBoundingClientRect();
    puntero.x=((e.clientX-r.left)/r.width)*2-1;
    puntero.y=-((e.clientY-r.top)/r.height)*2+1;
    rayo.setFromCamera(puntero,camara);
    const hits=rayo.intersectObject(vrm.scene,true);
    if(!hits.length)return;
    reaccion=1;
    if(window.tocar)window.tocar(hits[0].point.y>1.32?'cabeza':'cuerpo');
  });
}catch(e){
  fotoOn();
  console.log('3D fuera:',e);
}
