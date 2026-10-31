const $=id=>document.getElementById(id);
const V=window.V;
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
  const camara=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,20);
  escena.add(new THREE.HemisphereLight(0xffd9c0,0x241a30,1.6));
  const foco=new THREE.DirectionalLight(0xfff0e0,1.6); foco.position.set(1.4,2.4,2); escena.add(foco);
  const borde=new THREE.DirectionalLight(0xff8fb0,1.2); borde.position.set(-1.8,1.4,-1.6); escena.add(borde);

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
      b={pecho:g('chest'),cabeza:g('head'),cadera:g('hips'),cuello:g('neck'),
        columna:g('spine'),lHombro:g('leftShoulder'),rHombro:g('rightShoulder'),
        lBrazo:g('leftUpperArm'),rBrazo:g('rightUpperArm'),
        lAnte:g('leftLowerArm'),rAnte:g('rightLowerArm'),
        lMano:g('leftHand'),rMano:g('rightHand'),
        lMuslo:g('leftUpperLeg'),rMuslo:g('rightUpperLeg'),
        lPantorrilla:g('leftLowerLeg'),rPantorrilla:g('rightLowerLeg'),
        lPie:g('leftFoot'),rPie:g('rightFoot')};
      window.__3d=true; $('foto').classList.remove('on'); $('carga').classList.add('oculta');
      break;
    }catch(e){}
  }
  if(!vrm) fotoOn();

  /* dedos: relajados */
  const DEDOS=[];
  ['left','right'].forEach(lado=>{
    ['Index','Middle','Ring','Little','Thumb'].forEach(d=>{
      ['Proximal','Intermediate','Distal'].forEach(seg=>{
        const n=vrm.humanoid.getNormalizedBoneNode((lado+d+seg));
        if(n)DEDOS.push({b:n,base:n.rotation.z||0,rigidez:seg==='Distal'?.5:1});
      });
    });
  });

  /* pelo: muelle */
  const PELOS=[];
  vrm.scene.traverse(o=>{
    if(o.isBone && /hair/i.test(o.name)) PELOS.push({b:o,rz:o.rotation.z,rx:o.rotation.x,z:0,x:0,vz:0,vx:0});
  });

  let gesto=null, finGesto=0, proxGesto=5;
  let panX=0, panObj=0, proxPan=5, cercaObj=0, cerca=0, proxCerca=9;
  let posX=0, caminando=false, destinoX=0, fasePaso=0, proxPaseo=6, reaccion=0, mirarAct=0;
  let vel=0, miradaX=0, miradaY=0, sigMirada=1, cabezaPrevia=0, suavizado=1;
  const rayo=new THREE.Raycaster(), puntero=new THREE.Vector2();
  const GESTOS=['saludo','pecho','pelo','abrir'];

  function objetivo(t,viva,amp){
    const sw=Math.sin(t*.55)*.045*viva;
    const r={lBrazoZ:1.24+sw, rBrazoZ:-1.24-sw,
      lBrazoX:.12+amp*.1, rBrazoX:.12+amp*.1, lBrazoY:.16, rBrazoY:-.16,
      lAnteY:-.34, rAnteY:.34, lAnteZ:0, rAnteZ:0,
      lHombroZ:.05, rHombroZ:-.05, dedos:.35};
    if(gesto==='arriba'){ r.lBrazoZ=-.62; r.rBrazoZ=.62; r.lBrazoX=.14; r.rBrazoX=.14;
      r.lAnteY=-.14; r.rAnteY=.14; r.dedos=.1; }
    else if(gesto==='saludo'){
      const ola=Math.sin(t*6.5)*.2;
      r.rBrazoZ=.3+ola; r.rBrazoX=.28; r.rAnteY=.62; r.rAnteZ=-.35;
      r.rHombroZ=-.22; r.dedos=.08;
    } else if(gesto==='pecho'){
      r.lBrazoZ=.72; r.rBrazoZ=-.72; r.lBrazoX=.5; r.rBrazoX=.5;
      r.lAnteY=-1.45; r.rAnteY=1.45; r.dedos=.5;
    } else if(gesto==='pelo'){
      r.lBrazoZ=-.2; r.lBrazoX=.6; r.lAnteY=-1.6; r.lAnteZ=.45; r.dedos=.45;
    } else if(gesto==='abrir'){
      r.lBrazoZ=.5; r.rBrazoZ=-.5; r.lBrazoX=.75; r.rBrazoX=.75;
      r.lAnteY=-.65; r.rAnteY=.65; r.dedos=.12;
    }
    if(V.pose==='manos'){ r.lBrazoZ=.82; r.rBrazoZ=-.82;
      r.lAnteY=-1.35; r.rAnteY=1.35; r.lBrazoX=.4; r.rBrazoX=.4; r.dedos=.5; }
    if(amp>.15){ r.lAnteY-=amp*.55; r.rAnteY+=amp*.55; r.dedos+=amp*.2; }
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
      else if(acc==='girar') giroObj=(Math.random()*2-1)*.6;
      else if(acc==='gesto' && !gesto){ gesto=GESTOS[Math.floor(Math.random()*GESTOS.length)]; finGesto=t+2.2 }
      else if(acc==='estirarse' && !gesto){ gesto='arriba'; finGesto=t+2.8 }

      proxPaseo-=dt;
      if((acc==='pasear'||(!acc && proxPaseo<=0)) && !caminando && !sueno && viva>0.5 && !V.hablando){
        destinoX=(Math.random()*2-1)*0.85; caminando=true;
      }
      if(caminando){
        const dx=destinoX-posX, dist=Math.abs(dx);
        vel+=((Math.min(0.46,0.08+dist*1.15))-vel)*.06;
        posX+=Math.sign(dx)*Math.min(dist,vel*dt);
        fasePaso+=dt*(2.4+vel*11);
        if(dist<0.05){ caminando=false; proxPaseo=(5+Math.random()*8)*(1.5-(V.vida||55)/100) }
      } else { vel*=0.93; fasePaso+=dt*vel*11*0.5 }

      const ampPaso=Math.min(1,vel*2.6);
      if(b.lMuslo){
        const s=Math.sin(fasePaso), s2=Math.sin(fasePaso+Math.PI);
        b.lMuslo.rotation.x=s*.34*ampPaso;
        b.rMuslo.rotation.x=s2*.34*ampPaso;
        if(b.lPantorrilla){
          b.lPantorrilla.rotation.x=Math.max(0,-s)*.6*ampPaso;
          b.rPantorrilla.rotation.x=Math.max(0,-s2)*.6*ampPaso;
        }
        if(b.lPie){
          b.lPie.rotation.x=(Math.max(0,s)*.22-Math.max(0,-s)*.1)*ampPaso;
          b.rPie.rotation.x=(Math.max(0,s2)*.22-Math.max(0,-s2)*.1)*ampPaso;
        }
        if(b.cadera) b.cadera.rotation.y=s*.1*ampPaso;
        if(b.pecho) b.pecho.rotation.y=-s*.09*ampPaso;
      }

      if(!gesto){ proxGesto-=dt;
        if(proxGesto<=0 && !V.hablando && !V.dormida && !sueno && viva>0.5){
          var lista=(V.animo==='cariñosa')?['pecho','pecho','pelo','saludo']:GESTOS;
          gesto=lista[Math.floor(Math.random()*lista.length)];
          finGesto=t+2+Math.random()*2;
        }
      } else if(t>finGesto){ gesto=null; proxGesto=4+Math.random()*7 }

      const o=objetivo(t,viva,amp);
      if(caminando){ o.lBrazoX-=Math.sin(fasePaso)*.24*ampPaso; o.rBrazoX+=Math.sin(fasePaso)*.24*ampPaso }
      const k=1-Math.pow(0.001,dt*suavizado);
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
          b.lAnte.rotation.y+=(o.lAnteY-b.lAnte.rotation.y)*k;
          b.rAnte.rotation.y+=(o.rAnteY-b.rAnte.rotation.y)*k;
          b.lAnte.rotation.z+=(o.lAnteZ-b.lAnte.rotation.z)*k;
          b.rAnte.rotation.z+=(o.rAnteZ-b.rAnte.rotation.z)*k;
        }
      }
      DEDOS.forEach(d=>{
        const meta=d.b.rotation.z>d.base? d.base-o.dedos*.35*d.rigidez : d.base+o.dedos*.35*d.rigidez;
        d.b.rotation.z+=(meta-d.b.rotation.z)*k*.6;
      });

      const lento=sueno?.35:1;
      if(b.pecho) b.pecho.rotation.x=Math.sin(t*1.05*lento)*.028*viva*(sueno?.5:1)+amp*.05+(caminando?.04:0);
      if(b.cadera){
        b.cadera.position.x=Math.sin(t*.45)*.012*viva;
        b.cadera.position.y=Math.abs(Math.sin(fasePaso))*.014*ampPaso;
        b.cadera.rotation.z=Math.sin(t*.45)*.035*viva;
      }
      if(b.cabeza){
        const objetivoYaw=Math.sin(t*.37)*.16*viva+Math.sin(t*1.5)*.018+(acc==='mirarte'?0:-miradaX*.15);
        b.cabeza.rotation.y+=(objetivoYaw-b.cabeza.rotation.y)*.05;
        b.cabeza.rotation.x+=(Math.sin(t*.58)*.05*viva-amp*.035+(sueno?.2:0)+(reaccion>0?.18*reaccion:0)+(acc==='bostezar'?-.16:0)-miradaY*.1-b.cabeza.rotation.x)*.05;
        b.cabeza.rotation.z+=((Math.sin(t*.28)*.045*viva)+(V.animo==='cariñosa'?.07:0)-Math.sin(fasePaso)*.02*ampPaso-b.cabeza.rotation.z)*.05;
      }
      if(b.cuello&&b.cabeza){
        b.cuello.rotation.y=b.cabeza.rotation.y*.35;
        b.cuello.rotation.x=b.cabeza.rotation.x*.3;
      }

      const velCabeza=(b.cabeza?b.cabeza.rotation.y:0)-cabezaPrevia;
      cabezaPrevia=b.cabeza?b.cabeza.rotation.y:0;
      PELOS.forEach(p=>{
        const empuje=-velCabeza*9-Math.sin(fasePaso)*ampPaso*.6;
        p.vz+=(-p.z*70-p.vz*8+empuje)*dt;
        p.z+=p.vz*dt;
        p.vx+=(-p.x*70-p.vx*8+(caminando?Math.sin(fasePaso)*.5:0))*dt;
        p.x+=p.vx*dt;
        p.b.rotation.z=p.rz+Math.max(-.35,Math.min(.35,p.z));
        p.b.rotation.x=p.rx+Math.max(-.3,Math.min(.3,p.x));
      });

      sigMirada-=dt;
      if(sigMirada<=0){ miradaX=(Math.random()*2-1)*.5; miradaY=(Math.random()*2-1)*.3; sigMirada=.7+Math.random()*2.2 }
      if(vrm.lookAt&&vrm.lookAt.target){
        vrm.lookAt.target.position.set(
          camara.position.x+miradaX*.5, camara.position.y+miradaY*.35-.15, camara.position.z);
      }

      sigParpadeo-=dt;
      if(sigParpadeo<=0){
        parpadeo=1;
        if(Math.random()<.3)parpadeoDoble=.16;
        sigParpadeo=2.4+Math.random()*5;
      }
      parpadeo=Math.max(0,parpadeo-dt*6);
      if(parpadeoDoble>0){ parpadeoDoble-=dt; if(parpadeoDoble<=0)parpadeo=1 }

      const em=vrm.expressionManager;
      if(em){
        em.setValue('blink',parpadeo);
        em.setValue('aa',V.hablando?Math.min(1,amp*1.6):0);
        em.setValue('happy',Math.max(V.animo==='feliz'?.55:0,reaccion*.8));
        em.setValue('relaxed',(V.dormida||sueno||V.animo==='cansada'||acc==='bostezar')?.6:0);
        em.setValue('surprised',V.animo==='sorpresa'?.6:0);
      }
      giro+=(giroObj-giro)*.05;
      reaccion=Math.max(0,reaccion-dt*.8);
      vrm.scene.position.x=posX;
      mirarAct+=((caminando?Math.sign(destinoX-posX)*.42:0)-mirarAct)*.045;
      vrm.scene.rotation.y=Math.PI+giro+mirarAct;
      vrm.update(dt);
    }
    proxPan-=dt; if(proxPan<=0){panObj=(Math.random()-.5)*.5; proxPan=7+Math.random()*10}
    proxCerca-=dt; if(proxCerca<=0){cercaObj=Math.random()<.45?1:0; proxCerca=10+Math.random()*12}
    panX+=(panObj-panX)*.015; cerca+=(cercaObj-cerca)*.015;
    const z=((V.pose==='cerca'?1.9:2.55)-cerca*.4)/(V.zoom||1.15);
    camara.position.set(panX+posX*.4,1.42+(V.alto||.15),z);
    camara.lookAt(posX*.3,1.36+(V.alto||.15),0);
    render.render(escena,camara);
  })();

  addEventListener('resize',()=>{
    camara.aspect=innerWidth/innerHeight; camara.updateProjectionMatrix();
    render.setSize(innerWidth,innerHeight,false);
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
