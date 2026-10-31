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

  let vrm=null,b={},giro=0,giroObj=0,parpadeo=0,sigParpadeo=2;
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
      const g=n=>vrm.humanoid.getNormalizedBoneNode(n);
      b={pecho:g('chest'),cabeza:g('head'),cadera:g('hips'),cuello:g('neck'),
        lBrazo:g('leftUpperArm'),rBrazo:g('rightUpperArm'),
        lAnte:g('leftLowerArm'),rAnte:g('rightLowerArm'),
        lMano:g('leftHand'),rMano:g('rightHand'),
        lMuslo:g('leftUpperLeg'),rMuslo:g('rightUpperLeg'),
        lPantorrilla:g('leftLowerLeg'),rPantorrilla:g('rightLowerLeg')};
      window.__3d=true; $('foto').classList.remove('on'); $('carga').classList.add('oculta');
      break;
    }catch(e){}
  }
  if(!vrm) fotoOn();

  let gesto=null, finGesto=0, proxGesto=5;
  let panX=0, panObj=0, proxPan=5, cercaObj=0, cerca=0, proxCerca=9;
  let posX=0, caminando=false, destinoX=0, fasePaso=0, proxPaseo=6, reaccion=0;
  const rayo=new THREE.Raycaster(), puntero=new THREE.Vector2();
  const GESTOS=['saludo','pecho','pelo','abrir'];

  function objetivo(t,viva,amp){
    const sw=Math.sin(t*.7)*.05*viva;
    const r={lBrazoZ:1.22+sw, rBrazoZ:-1.22-sw,
      lBrazoX:.08+amp*.1, rBrazoX:.08+amp*.1, lBrazoY:.12, rBrazoY:-.12,
      lAnteY:-.22, rAnteY:.22, lAnteZ:0, rAnteZ:0};
    if(gesto==='saludo'){
      const ola=Math.sin(t*7)*.22;
      r.rBrazoZ=.35+ola; r.rBrazoX=.25; r.rAnteY=.55; r.rAnteZ=-.4;
    } else if(gesto==='pecho'){
      r.lBrazoZ=.75; r.rBrazoZ=-.75; r.lBrazoX=.45; r.rBrazoX=.45;
      r.lAnteY=-1.5; r.rAnteY=1.5;
    } else if(gesto==='pelo'){
      r.lBrazoZ=-.25; r.lBrazoX=.55; r.lAnteY=-1.7; r.lAnteZ=.5;
    } else if(gesto==='abrir'){
      r.lBrazoZ=.55; r.rBrazoZ=-.55; r.lBrazoX=.7; r.rBrazoX=.7;
      r.lAnteY=-.7; r.rAnteY=.7;
    }
    if(V.pose==='manos'){ r.lBrazoZ=.85; r.rBrazoZ=-.85;
      r.lAnteY=-1.4; r.rAnteY=1.4; r.lBrazoX=.35; r.rBrazoX=.35; }
    if(amp>.15){ r.lAnteY-=amp*.6; r.rAnteY+=amp*.6; }
    return r;
  }

  const reloj=new THREE.Clock();
  (function bucle(){
    requestAnimationFrame(bucle);
    const dt=Math.min(reloj.getDelta(),.05), t=reloj.elapsedTime;
    if(vrm){
      const viva=V.viva?1:.22, amp=V.voz||0;
      const sueno=V.sueno, e=V.energia||70;

      proxPaseo-=dt;
      if(!caminando && proxPaseo<=0 && !sueno && viva>0.5 && !V.hablando){
        destinoX=(Math.random()*2-1)*0.85; caminando=true;
      }
      if(caminando){
        const dx=destinoX-posX;
        if(Math.abs(dx)<0.07){ caminando=false; proxPaseo=(5+Math.random()*8)*(1.5-(V.vida||55)/100) }
        else posX+=Math.sign(dx)*Math.min(Math.abs(dx),0.42*dt);
        fasePaso+=dt*7.5;
      } else fasePaso*=0.9;
      const ampPaso=caminando?1:0;
      if(b.lMuslo){
        b.lMuslo.rotation.x=Math.sin(fasePaso)*.45*ampPaso;
        b.rMuslo.rotation.x=-Math.sin(fasePaso)*.45*ampPaso;
        if(b.lPantorrilla){
          b.lPantorrilla.rotation.x=Math.max(0,-Math.sin(fasePaso))*.55*ampPaso;
          b.rPantorrilla.rotation.x=Math.max(0,Math.sin(fasePaso))*.55*ampPaso;
        }
      }

      if(!gesto){ proxGesto-=dt;
        if(proxGesto<=0 && !V.hablando && !V.dormida && !sueno && viva>0.5){
          var lista=(V.animo==='cariñosa')?['pecho','pecho','pelo','saludo']:GESTOS;
          gesto=lista[Math.floor(Math.random()*lista.length)];
          finGesto=t+2+Math.random()*1.8;
        }
      } else if(t>finGesto){ gesto=null; proxGesto=4+Math.random()*7 }

      const o=objetivo(t,viva,amp);
      if(caminando){ o.lBrazoX-=Math.sin(fasePaso)*.35; o.rBrazoX+=Math.sin(fasePaso)*.35 }
      const k=.09;
      if(b.lBrazo){
        b.lBrazo.rotation.z+=(o.lBrazoZ-b.lBrazo.rotation.z)*k;
        b.rBrazo.rotation.z+=(o.rBrazoZ-b.rBrazo.rotation.z)*k;
        b.lBrazo.rotation.x+=(o.lBrazoX-b.lBrazo.rotation.x)*k;
        b.rBrazo.rotation.x+=(o.rBrazoX-b.rBrazo.rotation.x)*k;
        b.lBrazo.rotation.y+=(o.lBrazoY-b.lBrazo.rotation.y)*k;
        b.rBrazo.rotation.y+=(o.rBrazoY-b.rBrazo.rotation.y)*k;
        if(b.lAnte){
          b.lAnte.rotation.y+=(o.lAnteY-b.lAnte.rotation.y)*k;
          b.rAnte.rotation.y+=(o.rAnteY-b.rAnte.rotation.y)*k;
          b.lAnte.rotation.z+=(o.lAnteZ-b.lAnte.rotation.z)*k;
          b.rAnte.rotation.z+=(o.rAnteZ-b.rAnte.rotation.z)*k;
        }
      }
      const lento=sueno?.35:1;
      if(b.pecho) b.pecho.rotation.x=Math.sin(t*1.15*lento)*.03*viva*(sueno?.5:1)+amp*.05;
      if(b.cadera){ b.cadera.position.x=Math.sin(t*.5)*.014*viva;
        b.cadera.rotation.z=Math.sin(t*.5)*.04*viva; }
      if(b.cabeza){
        b.cabeza.rotation.y=Math.sin(t*.4)*.18*viva+Math.sin(t*1.6)*.02;
        b.cabeza.rotation.x=Math.sin(t*.62)*.055*viva-amp*.04;
        b.cabeza.rotation.z=Math.sin(t*.3)*.055*viva;
        if(sueno) b.cabeza.rotation.x+=.22;
        if(V.animo==='cariñosa') b.cabeza.rotation.z+=.08;
        if(reaccion>0) b.cabeza.rotation.x+=.2*reaccion;
      }
      sigParpadeo-=dt;
      if(sigParpadeo<=0){parpadeo=1;sigParpadeo=2.2+Math.random()*4.5}
      parpadeo=Math.max(0,parpadeo-dt*5.5);
      const em=vrm.expressionManager;
      if(em){
        em.setValue('blink',parpadeo);
        em.setValue('aa',V.hablando?Math.min(1,amp*1.6):0);
        em.setValue('happy',Math.max(V.animo==='feliz'?.55:0,reaccion*.8));
        em.setValue('relaxed',(V.dormida||sueno||V.animo==='cansada')?.6:0);
        em.setValue('surprised',V.animo==='sorpresa'?.6:0);
      }
      giro+=(giroObj-giro)*.08;
      reaccion=Math.max(0,reaccion-dt*.8);
      vrm.scene.position.x=posX;
      const mirar=caminando?Math.sign(destinoX-posX)*.5:0;
      vrm.scene.rotation.y=Math.PI+giro+mirar;
      vrm.update(dt);
    }
    proxPan-=dt; if(proxPan<=0){panObj=(Math.random()-.5)*.55; proxPan=6+Math.random()*9}
    proxCerca-=dt; if(proxCerca<=0){cercaObj=Math.random()<.45?1:0; proxCerca=10+Math.random()*12}
    panX+=(panObj-panX)*.02; cerca+=(cercaObj-cerca)*.02;
    const z=((V.pose==='cerca'?1.9:2.55)-cerca*.4)/(V.zoom||1.15);
    camara.position.set(panX+posX*.45,1.42+(V.alto||.15),z);
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
