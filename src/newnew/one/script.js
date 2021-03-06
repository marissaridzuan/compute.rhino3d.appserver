import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124.0/build/three.module.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/controls/OrbitControls.js'
import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { Rhino3dmLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/loaders/3DMLoader.js'


/* eslint no-undef: "off", no-unused-vars: "off" */

const definition = 'orbs.gh'

const grow_slider = document.getElementById( 'grow' )
grow_slider.addEventListener('change', onSliderChange, false )
const seed_slider = document.getElementById( 'seed' )
seed_slider.addEventListener('change', onSliderChange, false )

// load the rhino3dm library
let rhino, doc
rhino3dm().then(async m => {
  console.log('Loaded rhino3dm.')
  rhino = m // global

  init()
  compute()
})


let _threeMesh, _threeMaterial

/**
 * Call appserver
 */
async function compute(){
  let t0 = performance.now()
  const timeComputeStart = t0

  // collect data from inputs
  let data = {}
  data.definition = definition  
  data.inputs = {
    'grow': grow_slider.valueAsNumber,
    'seed': seed_slider.valueAsNumber,
  }

  console.log(data.inputs)

  const request = {
    'method':'POST',
    'body': JSON.stringify(data),
    'headers': {'Content-Type': 'application/json'}
  }

  let headers = null

  try {
    const response = await fetch('/solve', request)

    if(!response.ok)
      throw new Error(response.statusText)
      
    headers = response.headers.get('server-timing')
    const responseJson = await response.json()

    // Request finished. Do processing here.
    let t1 = performance.now()
    const computeSolveTime = t1 - timeComputeStart
    t0 = t1


    document.getElementById('loader').style.display = 'none'

    let data = JSON.parse(responseJson.values[0].InnerTree['{ 0; }'][0].data)
    let mesh = rhino.CommonObject.decode(data)

      
    t1 = performance.now()
    const decodeMeshTime = t1 - t0
    t0 = t1

    if (!_threeMaterial) {
      _threeMaterial = new THREE.MeshNormalMaterial()
    }
    let threeMesh = meshToThreejs(mesh, _threeMaterial)

    mesh.delete()
    replaceCurrentMesh(threeMesh)

    t1 = performance.now()
    const rebuildSceneTime = t1 - t0

    console.group(`[call compute and rebuild scene] = ${Math.round(t1-timeComputeStart)} ms`)
    //console.log(`[call compute and rebuild scene] = ${Math.round(t1-timeComputeStart)} ms`)
    console.log(`  ${Math.round(computeSolveTime)} ms: appserver request`)
    let timings = headers.split(',')
    let sum = 0
    timings.forEach(element => {
      let name = element.split(';')[0].trim()
      let time = element.split('=')[1].trim()
      sum += Number(time)
      if (name === 'network') {
        console.log(`  .. ${time} ms: appserver<->compute network latency`)
      } else {
        console.log(`  .. ${time} ms: ${name}`)
      }
    })
    console.log(`  .. ${Math.round(computeSolveTime - sum)} ms: local<->appserver network latency`)
    console.log(`  ${Math.round(decodeMeshTime)} ms: decode json to rhino3dm mesh`)
    console.log(`  ${Math.round(rebuildSceneTime)} ms: create threejs mesh and insert in scene`)
    console.groupEnd()

  } catch(error) {
    console.error(error)
  }
  
}

/**
 * Called when a slider value changes in the UI. Collect all of the
 * slider values and call compute to solve for a new scene
 */
function onSliderChange () {
  // show spinner
  document.getElementById('loader').style.display = 'block'
  compute()
}

// BOILERPLATE //

var scene, camera, renderer, controls

function init () {
  // Rhino models are z-up, so set this as the default
  THREE.Object3D.DefaultUp = new THREE.Vector3( 0, 1, 0 );

  scene = new THREE.Scene()
  scene.background = new THREE.Color(1,1,1)
  camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 1, 1000 )

  renderer = new THREE.WebGLRenderer({antialias: true})
  renderer.setPixelRatio( window.devicePixelRatio )
  renderer.setSize( window.innerWidth, window.innerHeight )
  document.body.appendChild(renderer.domElement)

  controls = new OrbitControls( camera, renderer.domElement  )

  camera.position.z = 300

 // LIGHTS - DIRECTIONAL

  const directionalLight = new THREE.DirectionalLight( 0xffffff )
  directionalLight.position.set( 0, 0, 2 )
  directionalLight.castShadow = true
  directionalLight.intensity = 2
  scene.add( directionalLight )


  // LIGHTS - HEMISPHERE

  const hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.6 );
  hemiLight.color.setHSL( 0.6, 1, 0.6 );
  hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
  hemiLight.position.set( 0, 50, 0 );
  scene.add( hemiLight );
  
  
  // GROUND
  
  const groundGeo = new THREE.PlaneGeometry( 10000, 10000 );
  const groundMat = new THREE.MeshLambertMaterial( { color: 0xffffff } );
  // groundMat.color.setHSL( 0.095, 1, 0.75 );
  groundMat.color.setHSL(164, 6, 32);
  
  const ground = new THREE.Mesh( groundGeo, groundMat );
  ground.position.y = - 33;
  ground.rotation.x = - Math.PI / 2;
  ground.receiveShadow = true;
  scene.add( ground );
  


  window.addEventListener( 'resize', onWindowResize, false )

     // //load the model
      const loader = new Rhino3dmLoader()
      const model = 'studio-test.3dm'
      loader.setLibraryPath( 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/' )
      // //load the model
      loader.load( model, function ( object ) {
          // object.userdata.static = true
          //uncomment to hide spinner when model loads
          //document.getElementById('loader').remove()
          scene.add( object )
      } )

  animate()
}

var animate = function () {
  requestAnimationFrame( animate )
  controls.update()
  renderer.render( scene, camera )
}
  
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize( window.innerWidth, window.innerHeight )
  animate()
}

function replaceCurrentMesh (threeMesh) {
  if (_threeMesh) {
    scene.remove(_threeMesh)
    _threeMesh.geometry.dispose()
  }
  _threeMesh = threeMesh
  scene.add(_threeMesh)
}

function meshToThreejs (mesh, material) {
  let loader = new THREE.BufferGeometryLoader()
  var geometry = loader.parse(mesh.toThreejsJSON())
  return new THREE.Mesh(geometry, material)
}
