import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {loadCad} from './cad.js';

const V = (x=0, y=0, z=0) => new THREE.Vector3(x,y,z);
const tau = Math.PI * 2;
const partInfo = {
  tank: ['Recipiente de vidrio', 'Dimensiones exteriores del plano MM-01: 1,00 × 0,40 × 0,40 m. Los tabiques comunican los compartimentos.'],
  pump: ['Bomba y retorno', 'El suministro de corriente continua alimenta la bomba que recircula agua a través del tanque.'],
  rotor: ['Rotor de eje vertical', 'Las palas captan parte de la energía de la corriente y transmiten par al eje.'],
  shaft: ['Eje y rodamientos', 'El eje vertical transmite el giro; los apoyos mantienen la alineación del conjunto.'],
  gears: ['Transmisión', 'La relación de engranajes adapta el giro al generador. Al multiplicar la velocidad disminuye el par disponible.'],
  generator: ['Generador eléctrico', 'El giro genera una tensión que permite entregar corriente a la carga conectada.'],
  panel: ['Tablero de mando', 'El mando de marcha y paro habilita el ramal de alimentación de la bomba.'],
  base: ['Soporte y anclaje', 'La estructura mantiene el rotor en posición frente a las cargas de la corriente.']
};

function group(parent, position=[0,0,0], part) {
  const g = new THREE.Group(); g.position.set(...position);
  if (part) g.userData.part = part;
  parent.add(g); return g;
}
function standard(color, metalness=0, roughness=.5) {
  return new THREE.MeshStandardMaterial({color,metalness,roughness});
}
function mesh(parent, geometry, material, x=0,y=0,z=0) {
  const m = new THREE.Mesh(geometry, material);
  if(material.isMeshStandardMaterial&&!material.transparent){m.castShadow=true;m.receiveShadow=true;}
  m.position.set(x,y,z); parent.add(m); return m;
}
function block(p,dims,pos,mat) { return mesh(p,new THREE.BoxGeometry(...dims),mat,...pos); }
function housing(p,dims,pos,r,mat){return mesh(p,new RoundedBoxGeometry(...dims,2,r),mat,...pos);}
function cyl(p,r1,r2,height,pos,mat,n=32) { return mesh(p,new THREE.CylinderGeometry(r1,r2,height,n),mat,...pos); }
function rod(p,a,b,r,material,segments=14) {
  const direction=V(...b).sub(V(...a));const center=V(...a).addScaledVector(direction,.5);
  const m=cyl(p,r,r,direction.length(),center.toArray(),material,segments);
  m.quaternion.setFromUnitVectors(V(0,1,0), direction.normalize());return m;
}
function tube(p,points,r,mat) {
  return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>V(...v))),40,r,10,false),mat);
}
function outline(p, dims, pos, color, opacity=.65) {
  const geo=new THREE.BoxGeometry(...dims);const edges=new THREE.EdgesGeometry(geo);geo.dispose();
  const o=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color,transparent:true,opacity}));
  o.position.set(...pos);p.add(o);return o;
}
function line(p,points,color,opacity=1) {
  const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v=>V(...v))),new THREE.LineBasicMaterial({color,transparent:true,opacity}));
  p.add(m);return m;
}
function makeLabel(text,color='#bcdeeb') {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=76;
  const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;
  ctx.font='500 44px Consolas, monospace';ctx.fillText(text,256,40);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
  m.scale.set(.28,.042,1);return m;
}
function dimension(p,x1,x2,y,z,text) {
  const c=0x739ba7;line(p,[[x1,y,z],[x2,y,z]],c,.8);
  for(const x of [x1,x2]) line(p,[[x,y-.005,z-.01],[x,y+.005,z+.01]],c);
  const label=makeLabel(text);label.position.set((x1+x2)*.5,y-.001,z+.031);p.add(label);return label;
}
function makeGear(parent, radius, teeth, pos, material) {
  const shape=new THREE.Shape();
  for(let i=0;i<teeth*4;i++) {
    const a=tau*i/(teeth*4), r=radius*(i%4===1||i%4===2?1:.85);
    const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();
  const bore=new THREE.Path();bore.absarc(0,0,.0033,0,tau,true);shape.holes.push(bore);
  if(radius>.02)for(let i=0;i<3;i++){
    const a=tau*i/3,hole=new THREE.Path();hole.absarc(radius*.45*Math.cos(a),radius*.45*Math.sin(a),radius*.135,0,tau,true);shape.holes.push(hole);
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:.0055,bevelEnabled:true,bevelSize:.00035,bevelThickness:.0003,bevelSegments:1,curveSegments:7});g.rotateX(-Math.PI/2);
  const gear=mesh(parent,g,material,...pos); return gear;
}
// A symmetric hydrofoil sweeps a vertical or helical path about the same rotor axis.
function foil(radius,height,phase,twist) {
  const chord=.025, side=22,levels=twist?36:24, ring=[];
  for(let i=0;i<=side;i++) {
    const s=(1-Math.cos(i*Math.PI/side))/2;
    const thickness=.65*(.2969*Math.sqrt(s)-.126*s-.3516*s*s+.2843*s**3-.1015*s**4);
    ring.push([chord*(s-.45),chord*thickness]);
  }
  const cross=[...ring,...ring.slice(1,-1).reverse().map(([x,y])=>[x,-y])];
  const verts=[],indices=[],colors=[],n=cross.length;
  for(let row=0;row<=levels;row++) {
    const a=phase+twist*(row/levels-.5);
    const band=(row===1||row===levels-1);
    for(const [t,r] of cross){
      verts.push((radius+r)*Math.cos(a)-t*Math.sin(a),height*(row/levels-.5),(radius+r)*Math.sin(a)+t*Math.cos(a));
      colors.push(...(band?[.26,.37,.36]:[1,1,1]));
    }
  }
  for(let j=0;j<levels;j++)for(let k=0;k<n;k++){
    const a=j*n+k,b=j*n+(k+1)%n;indices.push(a,b,a+n,b,b+n,a+n);
  }
  for(let k=1;k<n-1;k++)indices.push(0,k+1,k,levels*n,levels*n+k,levels*n+k+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function makeRotor(parent,type,surface,mats,cadSupport) {
  const r=.06,h=.15;
  if(type==='savonius') {
    for(let i=0;i<2;i++) {
      const scoop=new THREE.Shape(), rad=.030;
      scoop.moveTo(rad,0);scoop.absarc(0,0,rad,0,Math.PI,false);scoop.lineTo(-rad+.0012,0);
      scoop.absarc(0,0,rad-.0012,Math.PI,0,true);scoop.closePath();
      const sheet=new THREE.ExtrudeGeometry(scoop,{depth:h,bevelEnabled:false,curveSegments:24});
      sheet.rotateX(-Math.PI/2);sheet.translate(0,-h/2,0);
      sheet.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(sheet.attributes.position.count*3).fill(1),3));
      const blade=mesh(parent,sheet,surface,(i===0?1:-1)*.030,0,0);blade.rotation.y=i*Math.PI;
    }
    for(const y of [-h/2,h/2])cyl(parent,r*1.08,r*1.08,.003,[0,y,0],mats.orange,48);
  } else {
    const twist=type==='gorlov'?1.55:0;
    for(let j=0;j<3;j++) {
      const a=tau*j/3;
      mesh(parent,foil(r,h,a,twist),surface);
      if(cadSupport && type==='darrieus')continue;
      for(const sign of [-1,1]) {
        const angle=a+sign*twist*.45, y=sign*h*.45;
        const arm=block(parent,[r,.0035,.007],[r*.5*Math.cos(angle),y,r*.5*Math.sin(angle)],mats.orange);
        arm.rotation.y=-angle;
        cyl(parent,.0028,.0028,.006,[r*Math.cos(angle),y,r*Math.sin(angle)],mats.bright,8);
      }
    }
    for(const y of [-h*.45,h*.45]){
      if(cadSupport && type==='darrieus'){
        const part=mesh(parent,cadSupport.clone(),mats.orange,0,y,0);part.rotation.y=-Math.PI/2;
      }else cyl(parent,.009,.011,.007,[0,y,0],mats.orange);
    }
  }
  cyl(parent,.003,.003,.18,[0,0,0],mats.bright);
}
function makeFlow(parent,sea) {
  const count=sea?165:115, positions=new Float32Array(count*6),seeds=[];
  // Deterministic seed positions keep the flow stable when switching views.
  for(let i=0;i<count;i++)seeds.push([(i*.618034)%1,(i*.754878+.1)%1,(i*.56984+.25)%1]);
  const g=new THREE.BufferGeometry(),att=new THREE.BufferAttribute(positions,3);g.setAttribute('position',att);
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:sea?0x70e8d9:0x79fff2,transparent:true,opacity:sea?.39:.54,depthWrite:false}));m.frustumCulled=false;parent.add(m);m.renderOrder=4;
  return {object:m, step(time) {
    seeds.forEach(([u,v,w],i)=>{
      const x=-.48+((u+time*(.82+v*.27))%1)*.95;
      const z=(v-.5)*(sea?.95:.36);
      const y=sea?-.10+w*.37:.065+w*.245;
      const wiggle=.004*Math.sin(x*17+v*54+time*3);
      const j=i*6;positions[j]=x;positions[j+1]=y+wiggle;positions[j+2]=z;
      positions[j+3]=x+.008+v*.013;positions[j+4]=y+wiggle*.91;positions[j+5]=z;
    });att.needsUpdate=true;
  }};
}

// Printed instrument markings stay attached to the real face as the camera turns.
function decal(parent,width,height,pos,paint){
  const c=document.createElement('canvas');c.width=768;c.height=Math.max(64,Math.round(c.width*height/width));
  const context=c.getContext('2d');paint(context,c.width,c.height);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const label=mesh(parent,new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}),...pos);
  label.renderOrder=6;return label;
}
function waterSkin(parent,level){
  const uniforms={uTime:{value:0}};
  const mat=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`
      varying vec3 vPos;
      uniform float uTime;
      void main(){
        vec3 p=position;
        float h=.0015*sin(p.x*35.+p.z*18.-uTime*3.)+.0007*sin(p.z*59.-p.x*16.+uTime*1.6);
        p.y+=h;
        vec4 world=modelMatrix*vec4(p,1.);
        vPos=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      varying vec3 vPos;
      uniform float uTime;
      void main(){
        vec2 p=vPos.xz;
        float a=p.x*35.+p.y*18.-uTime*3.,b=p.y*59.-p.x*16.+uTime*1.6;
        vec3 normal=normalize(vec3(-.0525*cos(a)+.0112*cos(b),1.,-.027*cos(a)-.0413*cos(b)));
        vec3 view=normalize(cameraPosition-vPos);
        float grazing=pow(1.-clamp(dot(view,normal),0.,1.),3.);
        vec3 reflection=reflect(-view,normal);
        float light=exp(-18.*abs(reflection.x*.6+reflection.z*.8+.83))*smoothstep(.08,.5,reflection.y);
        float crests=pow(.5+.5*sin(p.x*94.+3.*sin(p.y*26.+p.x*8.)+.9*sin(p.y*71.-uTime)-uTime*4.),13.);
        float ripple=crests*(.35+.65*(.5+.5*sin(p.y*21.+p.x*14.)));
        vec3 color=mix(vec3(.010,.19,.216),vec3(.48,.88,.91),clamp(light+.27*grazing+.46*ripple,0.,1.));
        gl_FragColor=vec4(color,.16+.28*light+.2*ripple+.13*grazing);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const skin=new THREE.PlaneGeometry(.993,.393,88,36);skin.rotateX(-Math.PI/2);
  const obj=mesh(parent,skin,mat,0,level,0);obj.renderOrder=3;
  return uniforms.uTime;
}
function marineAtmosphere(parent){
  // Shafts fade through suspended sediment. Their farthest edges lie behind the rig.
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
  for(let j=0;j<256;j++)for(let i=0;i<256;i++){
    const x=i/255,y=j/255,k=4*(j*256+i);
    const ridge=(1-Math.cos(x*tau))*.5;
    const intensity=Math.pow(ridge,3)*Math.pow(1-y,1.6)*(1+.18*Math.sin(x*31));
    pixels.data[k]=152;pixels.data[k+1]=238;pixels.data[k+2]=224;pixels.data[k+3]=Math.round(intensity*32);
  }
  ctx.putImageData(pixels,0,0);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const light=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  for(let i=0;i<9;i++){
    const a=i*2.4,dist=.45+.185*((i*.68)%1);
    const panel=mesh(parent,new THREE.PlaneGeometry(.045+.045*((i*.45)%1),.80),light,Math.cos(a)*dist,.29,Math.sin(a)*dist);
    panel.rotation.y=-a+Math.PI/2;panel.rotation.z=-.26;
  }
  const pts=[];
  for(let i=0;i<170;i++)pts.push(((i*.61803)%1-.5)*1.7,(i*.3287)%1*.52-.02,((i*.7589)%1-.5)*1.45);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xb4e6dc,size:.0009,transparent:true,opacity:.4,depthWrite:false}));
  parent.add(dust);return dust;
}
function seabedTexture(){
  const size=256,c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d'),pix=ctx.createImageData(size,size);
  let seed=921;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const u=tau*x/size,v=tau*y/size;
    const dune=Math.sin(5*v+1.1*Math.sin(2*u+v)+.6*Math.cos(3*u));
    const glint=Math.pow(Math.max(0,1-Math.abs(Math.sin(3*u+4*v+.6*Math.sin(4*u)))*4),3);
    const l=12*dune+6*Math.sin(3*u-2*v)+glint*13+(seed/4294967296-.5)*28;
    const k=(y*size+x)*4;
    pix.data[k]=105+l;pix.data[k+1]=143+l;pix.data[k+2]=130+l;pix.data[k+3]=255;
  }
  ctx.putImageData(pix,0,0);
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(14,14);
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
export function createScene(canvas,onSelect=()=>{}) {
  let renderer;
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  } catch { return fallback(canvas,onSelect); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene(), lab=new THREE.Group(), sea=new THREE.Group();scene.add(lab,sea);
  scene.background=new THREE.Color(0x0b2630);scene.fog=new THREE.FogExp2(0x0b2630,.46);
  const room=new RoomEnvironment(), pm=new THREE.PMREMGenerator(renderer);
  const env=pm.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.8;pm.dispose();room.dispose();
  const camera=new THREE.PerspectiveCamera(34,1,.008,28);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=true;
  controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.15;controls.minDistance=.14;controls.maxDistance=3.6;
  const hemi=new THREE.HemisphereLight(0xdaf3ff,0x123238,1.45);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xfff3db,3.15);key.position.set(-.68,2.1,.64);scene.add(key);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-.8,right:.8,top:.72,bottom:-.68,near:.1,far:4.8});key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias=.00065;key.shadow.bias=-.00016;
  const rim=new THREE.DirectionalLight(0x86dbe8,2.3);rim.position.set(.9,.62,-1);scene.add(rim);
  const mats={
    base:standard(0x243842,.55,.40),black:standard(0x131e23,.30,.39),bright:standard(0xc5d2d5,.80,.23),
    orange:standard(0xf39443,.44,.33),brass:standard(0xb68242,.65,.32),blue:standard(0x1c7987,.45,.35),
    glass:new THREE.MeshBasicMaterial({color:0xb3e4e8,transparent:true,opacity:.026,side:THREE.FrontSide,depthWrite:false}),
    water:new THREE.MeshBasicMaterial({color:0x13949b,transparent:true,opacity:.079,side:THREE.FrontSide,depthWrite:false}),
    rubber:standard(0x11292c,.06,.76),ledOn:new THREE.MeshBasicMaterial({color:0x5ef6b1})
  };
  const bladeMat=new THREE.MeshPhysicalMaterial({color:0xd9e1e3,metalness:.76,roughness:.26,clearcoat:.28,clearcoatRoughness:.22,vertexColors:true,side:THREE.DoubleSide});
  const red=standard(0xc54b39,.12,.38);
  const parts={lab:{},sea:{}};
  const addPart=(mode,p,name,pos)=>{const n=group(p,pos,name);parts[mode][name]=n;return n;};
  const runX=.037, waterHeight=.316, rotorY=.231;
  const tank=addPart('lab',lab,'tank',[0,0,0]);
  // Reference geometry MM-01, dimensions in metres; split lies 700 mm from right end.
  const labBase=addPart('lab',lab,'base',[0,0,0]);
  housing(labBase,[1.046,.033,.444],[0,-.014,0],.006,mats.base);
  housing(labBase,[1.017,.007,.419],[0,.004,0],.002,mats.rubber);
  decal(labBase,.204,.020,[-.355,-.014,.2224],(ctx,w,h)=>{
    ctx.fillStyle='#12272e';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#7cceba';ctx.fillRect(0,0,w*.028,h);
    ctx.font='bold '+h*.63+'px Arial';ctx.textBaseline='middle';ctx.fillStyle='#d8e5e2';ctx.fillText('UNAJ  /  MAREA 3D',w*.055,h*.52);
  });
  for(const x of [-.44,.44])for(const z of [-.16,.16]){
    cyl(labBase,.022,.025,.012,[x,-.035,z],mats.rubber);
    cyl(labBase,.011,.011,.005,[x,-.029,z],mats.bright,18);
  }
  for(const z of [-.2,.2]) {
    const side=block(tank,[1,.4,.004],[0,.2,z],mats.glass);side.renderOrder=2;
    outline(tank,[1,.4,.004],[0,.2,z],0x94d7d7,.70);
    block(tank,[1,.0022,.0043],[0,.4,z],mats.glass);
  }
  for(const x of [-.5,.5]) {
    block(tank,[.004,.4,.4],[x,.2,0],mats.glass).renderOrder=2;
    outline(tank,[.004,.4,.4],[x,.2,0],0xb3dde1,.7);
  }
  for(const [y,height] of [[.045,.09],[.3125,.175]]) {
    block(tank,[.004,height,.392],[-.2,y,0],mats.glass);
    outline(tank,[.004,height,.392],[-.2,y,0],0x8fbdca,.68);
  }
  const volume=block(tank,[.994,waterHeight,.394],[0,waterHeight/2,0],mats.water);volume.renderOrder=1;
  outline(tank,[.994,.0005,.394],[0,waterHeight,0],0x82ddd7,.62);
  const waterTime=waterSkin(tank,waterHeight+.0003);
  // Depth ruler on the near edge is small enough to leave the rotor unobstructed.
  for(let i=0;i<=20;i++){
    const y=.018+i*.018;const l=i%5===0?.021:.010;
    line(tank,[[-.477,y,.2025],[-.477+l,y,.2025]],0xbae4e1,i%5===0?.75:.44);
  }
  const pump=addPart('lab',lab,'pump',[-.354,.068,-.045]);
  housing(pump,[.115,.056,.087],[0,0,0],.009,mats.blue);
  block(pump,[.126,.009,.108],[0,-.032,0],mats.black);
  for(let i=0;i<5;i++)block(pump,[.004,.066,.092],[-.048+i*.018,.002,0],mats.black);
  rod(pump,[.046,0,0],[.083,0,0],.033,mats.blue);
  tube(pump,[[.066,.014,.015],[.074,.05,.024],[.1,.066,.031],[.147,.067,.033],[.211,.07,.036]],.012,mats.bright);
  rod(pump,[.194,.07,.036],[.216,.07,.036],.017,mats.blue);
  tube(lab,[[.43,.065,-.13],[.447,.088,-.13],[.448,.36,-.148],[.444,.419,-.17],[.36,.43,-.177],[-.31,.43,-.177],[-.36,.39,-.15],[-.365,.11,-.066]],.009,mats.rubber).userData.part='pump';
  const bridge=group(lab,[runX,.402,0],'shaft');
  for(const x of [-.075,.075])block(bridge,[.016,.016,.427],[x,0,0],mats.bright);
  for(const z of [-.181,.181]){
    block(bridge,[.178,.009,.028],[0,.012,z],mats.base);
    for(const x of [-.075,.075])cyl(bridge,.005,.005,.004,[x,.019,z],mats.orange,6);
  }
  block(bridge,[.173,.012,.083],[.022,.01,0],mats.base);
  const shaft=addPart('lab',lab,'shaft',[runX,0,0]);
  cyl(shaft,.003,.003,.306,[0,.300,0],mats.bright);
  for(const y of [.383,.420]) {cyl(shaft,.014,.014,.011,[0,y,0],mats.blue);cyl(shaft,.008,.008,.015,[0,y,0],mats.bright);}
  const rotorLab=addPart('lab',lab,'rotor',[runX,rotorY,0]);
  const gears=addPart('lab',lab,'gears',[runX,.431,0]);const gearMeshes=[];
  const pan=housing(gears,[.188,.005,.081],[.049,-.006,0],.002,mats.base);
  for(const z of [-.033,.033]) block(gears,[.176,.005,.003],[.049,-.002,z],mats.bright);
  for(const x of [-.033,.130])for(const z of [-.032,.032])cyl(gears,.0028,.0028,.002,[x,-.001,z],mats.brass,6);
  // A transparent acrylic transmission guard keeps the moving pairs visible.
  const guard=group(gears,[.049,.019,0]);
  const guardMat=new THREE.MeshBasicMaterial({color:0xc0e9ee,transparent:true,opacity:.08,depthWrite:false});
  const cap=housing(guard,[.183,.051,.081],[0,0,0],.004,guardMat);cap.renderOrder=4;
  for(const z of [-.039,.039])line(guard,[[-.086,-.021,z],[-.086,.021,z],[.086,.021,z],[.086,-.021,z]],0x8db6c0,.55);
  for(let i=0;i<3;i++) {
    const x=i*.04, y=i*.011;
    gearMeshes.push(makeGear(gears,.029,20,[x,y,0],mats.brass));
    gearMeshes.push(makeGear(gears,.0145,10,[x+.04,y,0],mats.bright));
    cyl(gears,.0036,.0036,.03,[x,y,0],mats.black);
  }
  const generator=addPart('lab',lab,'generator',[runX+.12,.465,0]);
  cyl(generator,.024,.024,.029,[0,-.004,0],mats.black);
  cyl(generator,.028,.028,.063,[0,.035,0],mats.blue);
  for(let i=0;i<8;i++){const a=i*tau/8;block(generator,[.004,.047,.005],[.026*Math.cos(a),.036,.026*Math.sin(a)],mats.bright);}
  cyl(generator,.027,.025,.008,[0,.07,0],mats.bright);
  for(const y of [.004,.061])cyl(generator,.029,.029,.003,[0,y,0],mats.black);
  for(const side of [-1,1]){
    cyl(generator,.005,.005,.007,[side*.013,.077,0],mats.brass,6);
    tube(generator,[[side*.013,.08,0],[side*.023,.084,0],[side*.030,.072,-.016]],.0018,side===1?red:mats.rubber);
  }
  for(let i=0;i<4;i++){const a=tau*i/4+.3;cyl(generator,.0022,.0022,.002,[.021*Math.cos(a),.075,.021*Math.sin(a)],mats.base,6);}
  const panel=addPart('lab',lab,'panel',[.38,.403,.034]);
  for(const x of [.334,.425])block(lab,[.012,.012,.272],[x,.400,-.078],mats.bright);
  for(const x of [.334,.425])block(lab,[.016,.057,.006],[x,.3805,-.205],mats.base);
  block(panel,[.125,.017,.115],[0,0,0],mats.base);
  housing(panel,[.115,.061,.074],[0,.035,0],.004,mats.bright);
  block(panel,[.103,.052,.004],[0,.035,.038],mats.base);
  for(const [x,m] of [[-.033,red],[-.008,mats.ledOn]]) {
    rod(panel,[x,.029,.039],[x,.029,.048],.008,m);
  }
  block(panel,[.035,.015,.004],[.029,.044,.041],mats.black);
  const panelScreen=decal(panel,.031,.012,[.029,.044,.0433],(ctx,w,h)=>{
    ctx.fillStyle='#163c41';ctx.fillRect(0,0,w,h);ctx.fillStyle='#92e2bb';ctx.font='bold '+h*.72+'px Consolas';ctx.textBaseline='middle';ctx.fillText('12 V CC',w*.06,h*.54);
  });
  for(const x of [-.049,.049])for(const y of [.013,.057])rod(panel,[x,y,.038],[x,y,.041],.0015,mats.bright,6);
  tube(lab,[[.174,.528,.008],[.21,.526,.016],[.256,.455,.037],[.333,.437,.035]],.0027,mats.orange).userData.part='generator';
  const deck=mesh(lab,new THREE.PlaneGeometry(50,50),standard(0x142b34,.18,.70),0,-.041,0);deck.rotation.x=-Math.PI/2;deck.castShadow=false;
  const grid=new THREE.GridHelper(6,60,0x325766,0x2c5059);grid.position.y=-.0406;grid.material.transparent=true;grid.material.opacity=.23;lab.add(grid);
  dimension(lab,-.5,.5,-.029,.267,'1,00 m');
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d');const grad=sc.createRadialGradient(64,64,4,64,64,61);
  grad.addColorStop(0,'rgba(0,0,0,.9)');grad.addColorStop(.63,'rgba(0,0,0,.48)');grad.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=grad;sc.fillRect(0,0,128,128);
  const shadow=mesh(lab,new THREE.PlaneGeometry(1.66,.85),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),.015,-.037,0);shadow.rotation.x=-Math.PI/2;
  const marineRig=group(sea,[0,0,0]);
  const marineBase=addPart('sea',marineRig,'base',[0,0,0]);
  housing(marineBase,[.23,.013,.19],[0,-.025,0],.003,mats.base);
  for(const x of [-.094,.094])for(const z of [-.072,.072]){
    cyl(marineBase,.013,.021,.024,[x,-.028,z],mats.orange);
    rod(marineBase,[x,-.018,z],[x*.38,.068,z*.30],.004,mats.bright);
    cyl(marineBase,.007,.007,.005,[x,-.015,z],mats.bright,6);
    cyl(marineBase,.003,.003,.005,[x,-.0105,z],mats.brass,8);
  }
  for(const x of [-.092,.092]){
    rod(marineBase,[x,-.017,0],[x,.206,0],.0045,mats.bright);
    for(const y of [.007,.189])cyl(marineBase,.006,.006,.008,[x,y,0],mats.blue);
    rod(marineBase,[x,.205,0],[0,.219,0],.005,mats.orange);
    rod(marineBase,[x,.03,0],[0,.044,0],.005,mats.orange);
  }
  const rotorSea=addPart('sea',marineRig,'rotor',[0,.13,0]);
  const sShaft=addPart('sea',marineRig,'shaft',[0,.135,0]);cyl(sShaft,.003,.003,.189,[0,0,0],mats.bright);
  const sGen=addPart('sea',marineRig,'generator',[0,.221,0]);cyl(sGen,.019,.023,.038,[0,.012,0],mats.blue);cyl(sGen,.020,.018,.009,[0,.035,0],mats.bright);
  for(let i=0;i<8;i++){
    const a=i*tau/8;
    rod(sGen,[.020*Math.cos(a),-.004,.020*Math.sin(a)],[.017*Math.cos(a),.030,.017*Math.sin(a)],.0014,mats.bright,8);
  }
  cyl(sGen,.025,.025,.004,[0,-.006,0],mats.orange);
  cyl(sShaft,.011,.008,.012,[0,-.084,0],mats.blue);
  tube(marineBase,[[.010,.231,-.014],[.063,.219,-.012],[.092,.181,-.007],[.101,-.019,-.014],[.22,-.036,-.064],[.37,-.033,-.07]],.0027,mats.rubber);
  const bedGeo=new THREE.PlaneGeometry(4,4,68,68);bedGeo.rotateX(-Math.PI/2);
  const pa=bedGeo.attributes.position,col=[];const sand=new THREE.Color();
  for(let i=0;i<pa.count;i++){
    const x=pa.getX(i),z=pa.getZ(i),h=.004*Math.sin(27*x+z*19)+.0016*Math.cos(z*65+x*5);
    pa.setY(i,h-.042);sand.setRGB(.43+h*4,.66+h*5,.67+h*6);col.push(sand.r,sand.g,sand.b);
  }
  bedGeo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));bedGeo.computeVertexNormals();
  const bedMap=seabedTexture();
  const bed=mesh(sea,bedGeo,new THREE.MeshStandardMaterial({map:bedMap,vertexColors:true,roughness:.98,bumpMap:bedMap,bumpScale:.0012}));bed.castShadow=false;
  const rockMat=standard(0x617772,.03,.94),rockG=new THREE.IcosahedronGeometry(1,1);
  const rockCloud=new THREE.InstancedMesh(rockG,rockMat,89),dummy=new THREE.Object3D();
  for(let i=0;i<89;i++){
    const angle=i*2.39996,dist=.19+.9*((i*.718)%1),size=.006+.018*((i*.613)%1)**2;
    dummy.position.set(Math.cos(angle)*dist,-.039,Math.sin(angle)*dist);dummy.rotation.set(i*1.27,i*.51,i*.38);dummy.scale.set(size*1.55,size*.58,size);dummy.updateMatrix();rockCloud.setMatrixAt(i,dummy.matrix);
    rockCloud.setColorAt(i,new THREE.Color().setHSL(.38+.09*((i*.47)%1),.11,.49+.24*((i*.73)%1)));
  }sea.add(rockCloud);
  rockCloud.receiveShadow=true;rockCloud.castShadow=true;
  const kelpMat=standard(0x416348,.06,.78); kelpMat.side=THREE.DoubleSide;
  const leaves=[],leafIndices=[];
  for(let i=0;i<100;i++){
    const angle=i*2.39996,dist=.23+.68*((i*.73)%1),height=.014+.045*((i*.191)%1),x=Math.cos(angle)*dist,z=Math.sin(angle)*dist;
    for(let j=0;j<5;j++){
      const base=leaves.length/3,turn=j*tau/5+angle;
      for(let k=0;k<=5;k++){
        const t=k/5,half=.0027*(.17+Math.sin(t*Math.PI))*(1-t*.7);
        const px=x+Math.cos(turn)*.009*t+.017*t*t,pz=z+Math.sin(turn)*.012*t+.003*Math.sin(t*6+turn)*t;
        const cy=-.042+height*t*(.70+j*.07);
        leaves.push(px+half*Math.sin(turn),cy,pz-half*Math.cos(turn),px-half*Math.sin(turn),cy,pz+half*Math.cos(turn));
        if(k<5){const o=base+k*2;leafIndices.push(o,o+1,o+2,o+1,o+3,o+2);}
      }
    }
  }
  const grass=new THREE.BufferGeometry();grass.setAttribute('position',new THREE.Float32BufferAttribute(leaves,3));grass.setIndex(leafIndices);grass.computeVertexNormals();mesh(sea,grass,kelpMat);
  const motes=marineAtmosphere(sea);
  // A one-metre staff provides a fixed physical reference as the marine rotor grows.
  const staff=group(sea,[-.151,-.037,.036]);
  for(let n=0;n<10;n++)cyl(staff,.002,.002,.1,[0,.05+n*.1,0],n%2?mats.bright:mats.orange,8);
  const staffLabel=makeLabel('1 m');staffLabel.scale.set(.062,.014,1);sea.add(staffLabel);
  let seaLabel=dimension(sea,-.06,.06,-.034,.116,'Ø 0,12 m');
  const flows={lab:makeFlow(lab,false),sea:makeFlow(sea,true)};
  let state={mode:'lab',material:'aluminio',turbine:'darrieus',speed:.35,scale:1,flow:true,exploded:false,running:true};
  let phase=0,rotation=0,explode=0,prev=performance.now(),framing=null,disposed=false,frameId=0,currentView='iso';
  const desiredTarget=V(),desiredPos=V();
  function aim(center,direction,distance,smooth) {
    desiredTarget.copy(center);desiredPos.copy(center).addScaledVector(direction.normalize(),distance);
    if(smooth)framing=true;else{controls.target.copy(desiredTarget);camera.position.copy(desiredPos);controls.update();framing=false;}
  }
  function setView(view='iso',smooth=true) {
    currentView=['iso','front','top','rotor'].includes(view)?view:'iso';
    const seaMode=state.mode==='sea',aspect=camera.aspect||1;
    let center=seaMode?V(0,state.exploded?.135:.098,0):V(0,state.exploded?.301:.225,0);
    let direction=seaMode?V(.63,.30,1.05):V(.56,.50,1.15);
    let distance=seaMode?.69:1.49,span=seaMode?.55:2.03;
    if(currentView==='front'){direction=V(.001,.065,1);distance=seaMode?.58:1.20;span=seaMode?.5:1.91;}
    if(currentView==='top'){direction=V(.001,1,.153);distance=seaMode?.52:1.02;span=seaMode?.53:1.97;}
    if(currentView==='rotor'){
      center=seaMode?V(0,.132+.032*explode,0):V(runX,rotorY+.036*explode,0);
      direction=V(.57,.20,1);distance=.38;span=.33;
    }
    aim(center,direction,Math.max(distance,span/aspect)*(state.exploded&&currentView!=='rotor'?1.18:1),smooth);
  }
  function reset(smooth=false){setView('iso',smooth);}
  let cadSupport;
  loadCad('soporte').then(geometry=>{
    if(disposed)return;cadSupport=geometry;rebuildBlade(state.turbine);
  }).catch(()=>{});
  function rebuildBlade(type) {
    for(const g of [rotorLab,rotorSea]) {
      for(const child of [...g.children]) {g.remove(child);child.geometry.dispose();}
      makeRotor(g,type,bladeMat,mats,g===rotorLab?cadSupport:null);
    }
  }
  function update(patch) {
    const old=state;state={...old,...patch};
    lab.visible=state.mode==='lab';sea.visible=!lab.visible;
    const waterColor=lab.visible?0x102d39:0x083b4a;
    scene.fog.color.setHex(waterColor);scene.background.setHex(waterColor);
    scene.fog.density=lab.visible?.32:1.19;
    key.color.setHex(lab.visible?0xfff3df:0xccf3e1);
    hemi.color.setHex(lab.visible?0xdaf3ff:0xa7e0e4);
    hemi.intensity=lab.visible?1.45:.95;
    rim.intensity=lab.visible?2.1:2.7;
    mats.ledOn.color.setHex(state.running?0x50edac:0x25463d);
    panelScreen.material.opacity=state.running?1:.55;
    if(old.turbine!==state.turbine||!rotorLab.children.length)rebuildBlade(state.turbine);
    const color={aluminio:0xe1e7e9,acero:0x94a7bf,petg:0xe98642}[state.material]??0xd6e5e7;
    bladeMat.color.setHex(color);bladeMat.metalness=state.material==='petg'?.02:state.material==='acero'?.93:.79;bladeMat.roughness=state.material==='petg'?.38:state.material==='acero'?.19:.24;
    if(!lab.visible&&state.material!=='petg')bladeMat.color.multiplyScalar(.83);
    flows.lab.object.visible=flows.sea.object.visible=!!state.flow;
    if(old.scale!==state.scale||old.mode!==state.mode){
      const physicalScale=Math.max(.1,Number(state.scale)||1);
      staff.scale.y=1/physicalScale;
      staffLabel.position.copy(staff.position).add(V(0,staff.scale.y+.012,0));
      staffLabel.visible=staff.scale.y<.36;
      const oldMap=seaLabel.material.map,newLabel=makeLabel('Ø '+Number(.12*state.scale).toLocaleString('es-PE',{maximumFractionDigits:2})+' m');
      seaLabel.material.map=newLabel.material.map;seaLabel.material.needsUpdate=true;oldMap.dispose();newLabel.material.dispose();
    }
    if(old.mode!==state.mode||old.exploded!==state.exploded)reset(true);
  }
  function focus(name, notify=true) {
    const nm=String(name||'').toLowerCase();
    const key=Object.keys(partInfo).find(k=>k===nm||partInfo[k][0].toLowerCase()===nm)??(/turbin|pala|rotor/.test(nm)?'rotor':/gen/.test(nm)?'generator':/bomba/.test(nm)?'pump':/transmi|engran/.test(nm)?'gears':/tablero/.test(nm)?'panel':/soporte/.test(nm)?'base':/vidrio|tanque/.test(nm)?'tank':null);
    const target=parts[state.mode]?.[key];if(!target)return;
    const center=new THREE.Box3().setFromObject(target).getCenter(V());
    const direction=camera.position.clone().sub(controls.target).normalize();
    const distance=key==='tank'?1.14:key==='base'?.41:state.mode==='lab'?.53:.35;
    aim(center,direction,Math.max(distance,distance/camera.aspect),true);
    if(notify)onSelect(...partInfo[key]);
  }
  const componentOffsets={
    lab:{tank:[-.43,.25,.20],base:[-.35,-.012,.22],pump:[.01,.024,0],rotor:[.03,0,.035],shaft:[0,.36,0],gears:[.055,.016,0],generator:[0,.035,0],panel:[0,.036,.038]},
    sea:{base:[.077,-.015,.06],rotor:[.036,0,.026],shaft:[0,.071,0],generator:[0,.019,0]}
  };
  const pin=V();
  function projectPart(key){
    const obj=parts[state.mode][key],offset=componentOffsets[state.mode][key];
    if(!obj||!offset)return {x:0,y:0,visible:false};
    pin.fromArray(offset);obj.localToWorld(pin);pin.project(camera);
    return {x:(pin.x+1)/2,y:(1-pin.y)/2,visible:Math.abs(pin.x)<=1&&Math.abs(pin.y)<=1&&Math.abs(pin.z)<=1};
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart=null;
  function pick(e) {
    if(!pointerStart||Math.hypot(pointerStart.x-e.clientX,pointerStart.y-e.clientY)>5)return;
    const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    const hits=ray.intersectObjects(Object.values(parts[state.mode]),true);
    let key=null;
    for(const h of hits){let obj=h.object;while(obj&&!obj.userData.part)obj=obj.parent;
      if(!obj)continue;
      if(obj.userData.part==='tank'){key??='tank';continue;}key=obj.userData.part;break;
    }
    if(key)onSelect(...partInfo[key]);
  }
  function begin(e){framing=false;pointerStart={x:e.clientX,y:e.clientY};}
  function stopFrame(){framing=false;}
  canvas.addEventListener('pointerdown',begin);canvas.addEventListener('pointerup',pick);canvas.addEventListener('wheel',stopFrame,{passive:true});
  function resize() {
    const width=canvas.clientWidth||640,height=canvas.clientHeight||410;
    const prevAspect=camera.aspect;camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    if(Math.abs(prevAspect-camera.aspect)>.16)setView(currentView,false);
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function tick(now) {
    if(disposed)return;frameId=requestAnimationFrame(tick);
    if(document.hidden||canvas.clientWidth===0){prev=now;return;}
    const dt=Math.min(.06,(now-prev)/1000);prev=now;
    if(state.running){phase+=dt*Math.max(0,state.speed)*.85;rotation+=dt*Math.max(0,state.speed)*6;}
    waterTime.value=phase;
    motes.position.x=.013*Math.sin(phase*.47);
    explode=THREE.MathUtils.damp(explode,state.exploded?1:0,6,dt);
    rotorLab.rotation.y=rotorSea.rotation.y=rotation;
    for(let i=0;i<gearMeshes.length;i++){
      // Counter-rotating wheel pairs; the pinion and next driving wheel share a shaft.
      gearMeshes[i].rotation.y=rotation*((-2)**Math.ceil(i/2))+(i%2?Math.PI/10:0);
      gearMeshes[i].position.y=Math.floor(i/2)*(.011+.023*explode);
    }
    rotorLab.position.y=rotorY+.036*explode;shaft.position.y=.056*explode;gears.position.y=.431+.114*explode;generator.position.y=.465+.17*explode;
    bridge.position.y=.402+.089*explode;
    guard.position.set(.049,.019+.084*explode,-.059*explode);
    rotorSea.position.y=.13+.032*explode;sGen.position.y=.221+.092*explode;
    if(state.flow)flows[state.mode].step(phase);
    if(framing){const a=1-Math.exp(-7*dt);camera.position.lerp(desiredPos,a);controls.target.lerp(desiredTarget,a);if(camera.position.distanceToSquared(desiredPos)<.00001)framing=false;}
    controls.update(); renderer.render(scene,camera);
  }
  update(state);resize();reset();frameId=requestAnimationFrame(tick);
  function capture(){renderer.render(scene,camera);return canvas.toDataURL('image/jpeg',.85);}
  return {update,reset:()=>reset(true),setView,focus,projectPart,capture,dispose(){
    disposed=true;cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();
    canvas.removeEventListener('pointerdown',begin);canvas.removeEventListener('pointerup',pick);canvas.removeEventListener('wheel',stopFrame);
    const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
    for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}key.shadow.map?.dispose();env.dispose();renderer.dispose();
  }};
}



// A projected 3D diagram preserves interaction on computers without a WebGL2 driver.
function fallback(canvas,onSelect){
  let ctx=canvas.getContext('2d');
  if(!ctx){
    const replacement=document.createElement('canvas');
    replacement.id=canvas.id;replacement.className=canvas.className;replacement.style.cssText=canvas.style.cssText;
    replacement.setAttribute('aria-label','Modelo tridimensional en vista simplificada');
    canvas.replaceWith(replacement);canvas=replacement;ctx=canvas.getContext('2d');
  }
  let state={mode:'lab',turbine:'darrieus',material:'aluminio',scale:1,speed:.35,flow:true,exploded:false,running:true};
  let yaw=.47,pitch=.38,zoom=1,phase=0,pointer=null,previous=0,id,hover=[];
  const angle=(e)=>{if(!pointer)return;yaw=pointer.yaw+(e.clientX-pointer.x)*.008;pitch=Math.max(.1,Math.min(1.25,pointer.pitch+(e.clientY-pointer.y)*.007));};
  const begin=e=>{pointer={x:e.clientX,y:e.clientY,yaw,pitch};canvas.setPointerCapture?.(e.pointerId);};
  const end=e=>{if(!pointer)return;
    if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<5){
      const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const found=hover.reduce((prev,item)=>Math.hypot(item.pos[0]-x,item.pos[1]-y)<Math.hypot(prev.pos[0]-x,prev.pos[1]-y)?item:prev,{pos:[1e6,1e6]});
      if(found.part&&Math.hypot(found.pos[0]-x,found.pos[1]-y)<70)onSelect(...partInfo[found.part]);
    }
    pointer=null;
  };
  const wheel=e=>{e.preventDefault();zoom=Math.max(.5,Math.min(3.5,zoom*Math.exp(-e.deltaY*.001)));};
  canvas.addEventListener('pointerdown',begin);canvas.addEventListener('pointermove',angle);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('wheel',wheel,{passive:false});
  function render(time){
    id=requestAnimationFrame(render);
    if(time-previous<32||document.hidden)return;
    const dt=Math.min(.09,(time-previous)/1000);previous=time;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const ratio=Math.min(devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#0b2630';ctx.fillRect(0,0,w,h);
    const sea=state.mode==='sea',k=Math.min(w*(sea?2.8:.82),h*(sea?2.8:1.4))*zoom;
    const ybase=sea?.11:.22;
    function project([x,y,z]){
      const depth=x*Math.sin(yaw)+z*Math.cos(yaw);
      return [w*.5+k*(x*Math.cos(yaw)-z*Math.sin(yaw)),h*.52+k*(depth*Math.sin(pitch)-(y-ybase)*Math.cos(pitch))];
    }
    function path(points,fill,stroke='#69a6af',width=1){
      ctx.beginPath();points.forEach((pt,i)=>{const a=project(pt);if(i===0)ctx.moveTo(...a);else ctx.lineTo(...a);});
      if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
    }
    function box(x,y,z,dx,dy,dz,fill,stroke){
      const x0=x-dx/2,x1=x+dx/2,y0=y-dy/2,y1=y+dy/2,z0=z-dz/2,z1=z+dz/2;
      for(const zs of [z0,z1])path([[x0,y0,zs],[x1,y0,zs],[x1,y1,zs],[x0,y1,zs]],fill,stroke);
      for(const xs of [x0,x1])path([[xs,y0,z0],[xs,y0,z1],[xs,y1,z1],[xs,y1,z0]],fill,stroke);
      path([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],fill,stroke);
    }
    hover=[];const hit=(part,pt)=>hover.push({part,pos:project(pt)});
    if(state.running)phase+=dt*state.speed*5;
    if(!sea){
      box(0,0,0,1,.013,.4,'#173f4a','#567783');
      box(0,.157,0,.992,.315,.392,'rgba(36,177,180,.075)','#37737b');
      box(-.2,.31,0,.003,.18,.39,'rgba(97,213,218,.08)','#5e9099');
      box(-.2,.046,0,.003,.09,.39,'rgba(97,213,218,.08)','#5e9099');
      box(-.35,.08,-.05,.13,.072,.08,'#246c72','#73aeb3');hit('pump',[-.35,.08,-.05]);
      path([[.43,.06,-.13],[.45,.4,-.13],[-.34,.42,-.13],[-.35,.09,-.05]],null,'#829a9a',3);
      box(0,.2,0,1,.4,.4,'rgba(215,249,255,.018)','#87b0ba');hit('tank',[-.42,.26,.20]);
      box(0,.40,0,.17,.015,.41,'#425765','#72a2ad');
      box(.355,.423,.04,.115,.06,.07,'#43929a','#9fc3c7');hit('panel',[.355,.423,.04]);
    }else{
      for(let x=-1;x<=1;x+=.1)path([[x,-.035,-1],[x,-.035,1]],null,'#173943');
      for(let z=-1;z<=1;z+=.1)path([[-1,-.035,z],[1,-.035,z]],null,'#173943');
      box(0,-.008,0,.25,.012,.17,'#2d5663','#54838b');hit('base',[0,-.008,0]);
      for(const x of [-.09,.09])path([[x,0,0],[x,.216,0],[0,.227,0]],null,'#a4c9c9',3);
    }
    const yc=(sea?.129:.236)+(state.exploded?.027:0),top=(sea?.226:.44)+(state.exploded?.09:0);
    path([[0,yc-.085,0],[0,top,0]],null,'#cbe1dc',2);hit('shaft',[0,yc+.09,0]);
    const color={aluminio:'#c4d8dc',acero:'#8e9aa8',petg:'#f79957'}[state.material]||'#c4d8dc';
    for(let j=0;j<(state.turbine==='savonius'?2:3);j++){
      const a=phase+j*tau/(state.turbine==='savonius'?2:3);
      const points=[];for(let y=0;y<=16;y++){
        const f=y/16,theta=a+(state.turbine==='gorlov'?(f-.5)*1.55:0);
        for(const off of [-.014,.014]){
          points.push([.06*Math.cos(theta)-off*Math.sin(theta),yc+(f-.5)*.15,.06*Math.sin(theta)+off*Math.cos(theta)]);
        }
      }
      if(state.turbine==='savonius'){
        for(let l=0;l<12;l++){
          const coords=[l,l+1].map(n=>[.025*Math.cos(a)+.034*Math.cos(a+n*Math.PI/12),.025*Math.sin(a)+.034*Math.sin(a+n*Math.PI/12)]);
          const [s,t]=coords;path([[s[0],yc-.075,s[1]],[t[0],yc-.075,t[1]],[t[0],yc+.075,t[1]],[s[0],yc+.075,s[1]]],color,color);
        }
      }else for(let l=0;l<16;l++)path([points[l*2],points[l*2+1],points[l*2+3],points[l*2+2]],color,color);
      for(let end of [0,1])path([[0,yc+(end-.5)*.14,0],points[end?32:0]],null,'#ec9e59',2);
    }
    hit('rotor',[0,yc,0]);
    const gx=sea?0:.12;box(gx,top+.036,0,.047,.071,.047,'#197e84','#86bbc0');hit('generator',[gx,top+.036,0]);
    if(!sea){box(.062,top,0,.14,.013,.05,'#b68b57','#d9b87d');hit('gears',[.062,top,0]);}
    if(state.flow)for(let i=0;i<50;i++){
      const x=((i*.618+phase*.16)%1-.5)*(sea?.45:.93),y=(i*.735%1)*(sea?.2:.26)+.028,z=(i*.53%1-.5)*(sea?.45:.36);
      path([[x,y,z],[x+.009,y,z]],null,'rgba(117,234,230,.6)');
    }
    ctx.font='11px system-ui';ctx.fillStyle='#bfe2e5';ctx.fillText('Vista 3D simplificada',12,h-9);
  }
  id=requestAnimationFrame(render);
  function setView(view){
    yaw=view==='front'||view==='top'?0:.47;pitch=view==='front'?.08:view==='top'?1.48:.38;zoom=view==='rotor'?1.75:1;
  }
  function projectPart(part){
    const mark=hover.find(p=>p.part===part);
    if(!mark)return {x:0,y:0,visible:false};
    const x=mark.pos[0]/canvas.clientWidth,y=mark.pos[1]/canvas.clientHeight;
    return {x,y,visible:x>=0&&x<=1&&y>=0&&y<=1};
  }
  return {update(patch){state={...state,...patch};},setView,projectPart,capture:()=>canvas.toDataURL('image/jpeg',.85),reset(){setView('iso');},focus(part){if(partInfo[part]){onSelect(...partInfo[part]);zoom=1.25;}},dispose(){cancelAnimationFrame(id);canvas.removeEventListener('pointerdown',begin);canvas.removeEventListener('pointermove',angle);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);canvas.removeEventListener('wheel',wheel);}};
}


