import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import modelFile from '../public/models/house1.glb';
import backImage from '../public/hdr/night.exr';

// Loading screen elements
const loadingBarFill = document.querySelector('.loading-bar-fill');
const loadingScreen = document.getElementById('loading-screen');
let hdriLoaded = false;
let modelLoaded = false;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc); // Set a background color

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 600, 2450); // Adjust camera position
camera.lookAt(0, -100, 10); // Look at scene origin

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true; // Enable shadow mapping

// Camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Enable smooth camera movements
controls.dampingFactor = 0.25;
controls.enableZoom = true;

// Pixel ratio (for performance)
const pixelRatio = window.devicePixelRatio;
renderer.setPixelRatio(Math.min(pixelRatio, 2)); // Limit pixel ratio for performance

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); // Adjust intensity to balance with directional light
hemiLight.position.set(0, 400, -100);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(30, 600, 200);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048; // Shadow map width (higher resolution)
dirLight.shadow.mapSize.height = 2048; // Shadow map height (higher resolution)
dirLight.shadow.camera.near = 0.5; // Near plane of the shadow camera
dirLight.shadow.camera.far = 1500; // Far plane of the shadow camera
dirLight.shadow.camera.top = 800; // Vertical top extent of the shadow camera
dirLight.shadow.camera.bottom = -800; // Vertical bottom extent of the shadow camera
dirLight.shadow.camera.left = -800; // Horizontal left extent of the shadow camera
dirLight.shadow.camera.right = 800; // Horizontal right extent of the shadow camera
scene.add(dirLight);

//scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) ); for debugging shadow camera

// Load HDRI (EXR) environment map, polyhaven.com is where this one is from
const exrloader = new EXRLoader();
exrloader.load(backImage, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;

    hdriLoaded = true;

    if (hdriLoaded && modelLoaded) {
      loadingScreen.style.display = 'none';
    }
    console.log("EXR loaded successfully")
}, onProgress, onError);

// Load 3D model
let mixer;
const loader = new GLTFLoader();
loader.load(modelFile, (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true; // Enable shadow casting
            child.receiveShadow = false; // Enable shadow receiving
        }
    });

    model.scale.set(1, 1, 1); // Adjust scale if necessary
    model.position.set(0, -100, 100); // Adjust position if necessary
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
    });

    // On-success, log to console and make visible if both HDR and model are loaded
    console.log('Model loaded successfully');
    modelLoaded = true; // Flag model as loaded

    if (hdriLoaded && modelLoaded) {
      loadingScreen.style.display = 'none';
    }

}, onProgress, onError);

const gridWidth = 2000;

// ground
const mesh = new THREE.Mesh( new THREE.PlaneGeometry( gridWidth, gridWidth ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
mesh.rotation.x = - Math.PI / 2;
mesh.receiveShadow = true;
scene.add(mesh);

const grid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

const navLinks = ['GitHub', 'Connect', 'Music'];
const navGroup = new THREE.Group();

const fontLoader = new FontLoader();

import('./fonts/RobotoMediumRegular.json').then((fontData) => {
    const font = fontLoader.parse(fontData);
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  
    navLinks.forEach((link, index) => {
      const textGeometry = new TextGeometry(link, {
        font: font,
        size: 50, // Adjust size as needed
        depth: 10, // Extrude thickness
        curveSegments: 12,
        bevelEnabled: false,
      });
  
      // Calculate text width to center it relative to the grid
      textGeometry.computeBoundingBox();
      const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
      const gridCenterX = 0; // Assuming a value for gridCenterX; adjust as needed
      const textPositionX = gridCenterX - textWidth / 2 + index * 350 - 350;
  
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(textPositionX, -200, 1000); // Adjust Y and Z positions as needed
      textMesh.name = link; // Set name for raycasting
  
      // Hit area for raycasting (larger invisible plane)
      const hitAreaGeometry = new THREE.PlaneGeometry(200, 200);
      const hitAreaMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }); // color: 0xff0000 for debugging, transparent: true, opacity: 0
      const hitAreaMesh = new THREE.Mesh(hitAreaGeometry, hitAreaMaterial);
      hitAreaMesh.position.copy(textMesh.position); // Align hit area with text mesh
      hitAreaMesh.position.x += 95;
      hitAreaMesh.name = link + '_hit';
      navGroup.add(hitAreaMesh);
  
      navGroup.add(textMesh);
    });
  
    scene.add(navGroup);
});

// Raycaster for detecting clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // mouse.y = mouse.y + 0.1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(navGroup.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        openNavLink(clickedObject.name);
    }
}

function openNavLink(item) {
    item = item.replace('_hit', ''); // Remove '_hit' from the name

    let target_url = '';
    
    switch (item) {
        case 'GitHub':
            target_url = 'https://github.com/shooby-d';
            break;
        case 'Connect':
            target_url = 'https://www.linkedin.com/in/david-shubov/';
            break;
        case 'Music':
            resumeAudioContext();
            return;
        default:
            console.log('Invalid link');
            break;
    }

    window.open(target_url, '_self');
}

// Different browsers have different needs
window.addEventListener('click', onClick);
window.addEventListener('touchstart', onClick);

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('Warriyo - Mortals (feat. Laura Brehm) [NCS Release].ogg', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.15);
    sound.play();
});

// Function to resume AudioContext and play sound
function resumeAudioContext() {
    if (listener.context.state === 'suspended') {
        listener.context.resume().then(() => {
            sound.play();
        });
    } else {
        sound.play();
    }

    if (listener.context.state === 'running') {
        listener.context.suspend();
    }
}

// Animation loop
const clock = new THREE.Clock();

const animate = () => {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }

    renderer.render(scene, camera);
};

animate();

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Helper functions for loaders and error handling
function onProgress(xhr) {
  if (xhr.lengthComputable) {
    const percentComplete = (xhr.loaded / xhr.total) * 100;
    loadingBarFill.style.width = percentComplete + '%';
  }
}

function onError(error) {
    console.error('An error happened', error);
}
