import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124.0/build/three.module.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/controls/OrbitControls.js'
import { Rhino3dmLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124.0/examples/jsm/loaders/3DMLoader.js'
import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/rhino3dm.module.js'
import { RhinoCompute } from 'https://cdn.jsdelivr.net/npm/compute-rhino3d@0.13.0-beta/compute.rhino3d.module.js'
import * as THREE from '../build/three.module.js';

// reference the definition
const definitionName = 'test.gh'

// listen for slider change events
const grow_slider = document.getElementById( 'grow' )
grow_slider.addEventListener( 'input', onSliderChange, false )
const seed_slider = document.getElementById( 'seed' )
seed_slider.addEventListener( 'input', onSliderChange, false )

const downloadButton = document.getElementById("downloadButton")
downloadButton.onclick = download

// set up loader for converting the results to threejs
const loader = new Rhino3dmLoader()
loader.setLibraryPath( 'https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/' )


// create a few variables to store a reference to the rhino3dm library and to the loaded definition
let rhino, definition, doc


rhino3dm().then(async m => {
    rhino = m

    // local 
    //RhinoCompute.url = 'http://localhost:8081/' // Rhino.Compute server url

    // remote
    RhinoCompute.url = 'https://macad2021.compute.rhino3d.com/'
    RhinoCompute.apiKey = getApiKey() // needed when calling a remote RhinoCompute server

    // source a .gh/.ghx file in the same directory
    let url = definitionName
    let res = await fetch(url)
    let buffer = await res.arrayBuffer()
    definition = new Uint8Array(buffer)

    init()
    compute()
    animate()
})

async function compute() {

    // collect data

    // get slider values
    let grow = document.getElementById('grow').valueAsNumber
    let seed = document.getElementById('seed').valueAsNumber

    // format data
    let param1 = new RhinoCompute.Grasshopper.DataTree('RH_IN:grow')
    param1.append([0], [grow])
    let param2 = new RhinoCompute.Grasshopper.DataTree('RH_IN:seed')
    param2.append([0], [seed])

    // Add all params to an array
    let trees = []
    trees.push(param1)
    trees.push(param2)

    // Call RhinoCompute
    const res = await RhinoCompute.Grasshopper.evaluateDefinition(definition, trees)

    console.log(res) 

    collectResults(res.values)

}

function collectResults(values) {

    // clear doc
    if( doc !== undefined)
        doc.delete()

    // clear objects from scene
    scene.traverse(child => {
        if (!child.isLight) {
            scene.remove(child)
        }
    })

    console.log(values)
    doc = new rhino.File3dm()

    for ( let i = 0; i < values.length; i ++ ) {

        const list = values[i].InnerTree['{ 0; }']

        for( let j = 0; j < list.length; j ++) {

            const data = JSON.parse(values[i].InnerTree['{ 0; }'][j].data)
            const rhinoObject = rhino.CommonObject.decode(data)
            doc.objects().add(rhinoObject, null)

        }

    }

    const buffer = new Uint8Array(doc.toByteArray()).buffer
    loader.parse( buffer, function ( object ) 
    {
        scene.add( object )
        // hide spinner
        document.getElementById('loader').style.display = 'none'

        // enable download button
        downloadButton.disabled = false
    })


}

function onSliderChange() {

    // show spinner
    document.getElementById('loader').style.display = 'block'

    // disable download button
    downloadButton.disabled = true

    compute()

}

function getApiKey() {
    let auth = null
    auth = localStorage['compute_api_key']
    if (auth == null) {
        auth = window.prompt('RhinoCompute Server API Key')
        if (auth != null) {
            localStorage.setItem('compute_api_key', auth)
        }
    }
    return auth
}

// download button handler
function download () {
    let buffer = doc.toByteArray()
    saveByteArray("testmr.3dm", buffer)
}

function saveByteArray ( fileName, byte ) {
    let blob = new Blob([byte], {type: "application/octect-stream"})
    let link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = fileName
    link.click()
}

// BOILERPLATE //
// declare variables to store scene, camera, and renderer
let scene, camera, renderer

let container, stats;
const params = {
    projection: 'normal',
    autoRotate: true,
    reflectivity: 1.0,
    background: false,
    exposure: 1.0,
    gemColor: 'Green'
};
let camera, scene, renderer;
let gemBackMaterial, gemFrontMaterial;
let hdrCubeRenderTarget;

const objects = [];

init();
animate();

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.set( 0.0, - 10, 20 * 3.5 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );

    renderer = new THREE.WebGLRenderer( { antialias: true } );

    gemBackMaterial = new THREE.MeshPhysicalMaterial( {
        map: null,
        color: 0x0000ff,
        metalness: 1,
        roughness: 0,
        opacity: 0.5,
        side: THREE.BackSide,
        transparent: true,
        envMapIntensity: 5,
        premultipliedAlpha: true
        // TODO: Add custom blend mode that modulates background color by this materials color.
    } );

    gemFrontMaterial = new THREE.MeshPhysicalMaterial( {
        map: null,
        color: 0x0000ff,
        metalness: 0,
        roughness: 0,
        opacity: 0.25,
        side: THREE.FrontSide,
        transparent: true,
        envMapIntensity: 10,
        premultipliedAlpha: true
    } );

    const manager = new THREE.LoadingManager();
    manager.onProgress = function ( item, loaded, total ) {

        console.log( item, loaded, total );

    };

    const loader = new OBJLoader( manager );
    loader.load( 'models/obj/emerald.obj', function ( object ) {

        object.traverse( function ( child ) {

            if ( child instanceof THREE.Mesh ) {

                child.material = gemBackMaterial;
                const second = child.clone();
                second.material = gemFrontMaterial;

                const parent = new THREE.Group();
                parent.add( second );
                parent.add( child );
                scene.add( parent );

                objects.push( parent );

            }

        } );


    } );

    new RGBELoader()
        .setDataType( THREE.UnsignedByteType )
        .setPath( 'textures/equirectangular/' )
        .load( 'royal_esplanade_1k.hdr', function ( hdrEquirect ) {

            hdrCubeRenderTarget = pmremGenerator.fromEquirectangular( hdrEquirect );
            pmremGenerator.dispose();

            gemFrontMaterial.envMap = gemBackMaterial.envMap = hdrCubeRenderTarget.texture;
            gemFrontMaterial.needsUpdate = gemBackMaterial.needsUpdate = true;

            hdrEquirect.dispose();

        } );

    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    pmremGenerator.compileEquirectangularShader();

    // Lights

    scene.add( new THREE.AmbientLight( 0x222222 ) );

    const pointLight1 = new THREE.PointLight( 0xffffff );
    pointLight1.position.set( 150, 10, 0 );
    pointLight1.castShadow = false;
    scene.add( pointLight1 );

    const pointLight2 = new THREE.PointLight( 0xffffff );
    pointLight2.position.set( - 150, 0, 0 );
    scene.add( pointLight2 );

    const pointLight3 = new THREE.PointLight( 0xffffff );
    pointLight3.position.set( 0, - 10, - 150 );
    scene.add( pointLight3 );

    const pointLight4 = new THREE.PointLight( 0xffffff );
    pointLight4.position.set( 0, 0, 150 );
    scene.add( pointLight4 );

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    renderer.outputEncoding = THREE.sRGBEncoding;

    stats = new Stats();
    container.appendChild( stats.dom );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 20;
    controls.maxDistance = 200;

    window.addEventListener( 'resize', onWindowResize );

    const gui = new GUI();

    gui.add( params, 'reflectivity', 0, 1 );
    gui.add( params, 'exposure', 0.1, 2 );
    gui.add( params, 'autoRotate' );
    gui.add( params, 'gemColor', [ 'Blue', 'Green', 'Red', 'White', 'Black' ] );
    gui.open();

}

function init() {

    // create a scene and a camera
    scene = new THREE.Scene()
    scene.background = new THREE.Color(1,1,1)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = - 50
    

    // create the renderer and add it to the html
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    // add some controls to orbit the camera
    const controls = new OrbitControls(camera, renderer.domElement)

    // add a directional light
    const directionalLight = new THREE.DirectionalLight( 0xffffff )
    directionalLight.intensity = 2
    scene.add( directionalLight )

    const ambientLight = new THREE.AmbientLight()
    scene.add( ambientLight )

}

// function to continuously render the scene
function animate() {

    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}