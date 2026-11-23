import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const assets=import.meta.glob('./cad/*.glb',{query:'?url',import:'default',eager:true});
const cache=new Map();
export function loadCad(key){
 if(!cache.has(key)){
   const url=assets['./cad/'+key+'.glb'];
   cache.set(key,new GLTFLoader().loadAsync(url).then(({scene})=>{
     scene.updateMatrixWorld(true);
     let result;
     scene.traverse(o=>{if(o.isMesh)result=o.geometry.clone().applyMatrix4(o.matrixWorld);});
     if(!result)throw Error('Pieza sin geometría');
     return result;
   }).catch(error=>{cache.delete(key);throw error;}));
 }
 return cache.get(key);
}

// Draw on demand so an idle engineering drawing uses no animation loop.
export function displayCad(container,geometry){
 const canvas=container.querySelector('canvas');
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x15333e);
 const room=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);
 const env=pmrem.fromScene(room,.03);scene.environment=env.texture;room.dispose();pmrem.dispose();
 const metal=new THREE.MeshStandardMaterial({color:0xb8cbd5,metalness:.76,roughness:.28,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,metal);scene.add(mesh);
 geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new THREE.Vector3());
 mesh.position.copy(geometry.boundingBox.getCenter(new THREE.Vector3())).multiplyScalar(-1);
 const edgesGeo=new THREE.EdgesGeometry(geometry,32),edgeMat=new THREE.LineBasicMaterial({color:0x416478,transparent:true,opacity:.42});
 const edges=new THREE.LineSegments(edgesGeo,edgeMat);mesh.add(edges);
 const keyLight=new THREE.DirectionalLight(0xfff1d7,3.1);keyLight.position.set(2,3,2);scene.add(keyLight);
 scene.add(new THREE.HemisphereLight(0xe6ffff,0x5b666f,1.55));
 const camera=new THREE.PerspectiveCamera(33,1,.0001,8);
 const controls=new OrbitControls(camera,canvas);controls.enablePan=false;
 const radius=size.length()/2;controls.minDistance=radius*.65;controls.maxDistance=radius*12;
 function render(){renderer.render(scene,camera);}
 function fit(){
   const w=canvas.clientWidth,h=canvas.clientHeight;
   if(!w||!h)return;
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
   const distance=radius*1.10/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(16.5))*Math.min(1,w/h)));
   camera.position.set(.64,.98,1.32).normalize().multiplyScalar(distance);controls.update();render();
 }
 controls.addEventListener('change',render);const ro=new ResizeObserver(fit);ro.observe(canvas);fit();
 const mm=n=>(1000*n).toLocaleString('es-PE',{maximumFractionDigits:2});
 container.querySelector('.cadDims').textContent='Envolvente X × Y × Z: '+[size.x,size.y,size.z].map(mm).join(' × ')+' mm';
 const b=container.querySelector('.cadOutline');b.onclick=()=>{edges.visible=!edges.visible;b.setAttribute('aria-pressed',String(edges.visible));render();};
 return ()=>{ro.disconnect();controls.dispose();metal.dispose();edgesGeo.dispose();edgeMat.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();};
}
