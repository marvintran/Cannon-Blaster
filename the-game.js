/*
 * Marvin Tran
 * 7792638
 * COMP 3490 Fall 2017
 * Semester Course Project - Cannon Blaster
 */

// WebWorkers for Physijs
Physijs.scripts.worker = "js/physijs_worker.js";
Physijs.scripts.ammo = "ammo.js"
//Physijs.scripts.worker = 'physijs_worker.js';
//Physijs.scripts.ammo = 'Cannon Blaster/js/ammo.js';

// ========== Global Variables ==========//

// Game Controls
	// the number of pieces each wall will split into when calculating the voronoi fracture
	// more vertices means more wall fragments which means drops in performance
	var numVertices = 10;

	// number of starting walls
	var numWalls = 5;

	// make sun move across the sky? 0 = No, 1 = Yes
	// disabling sun movement helps with performance
	var moveTheSun = 1;

	// the length of each game, which also turns out to be
	// the time it takes for the sun to move across the sky
	// to change the time, take the number of seconds desired and multiply it by 1000
	var time = 180000;// 3 minutes

// other global variables, coordinates, clock etc. 
var camera, scene, renderer, light;
var cameraControls;
var cannon, ground;
var clock = new THREE.Clock();
var keyboard = new KeyboardState();

// initial cannon rotations
var xCannon = 0;
var yCannon = 0;
var zCannon = -2.05;

// iniial cannonball coordinates
var xBall = -1910;
var yBall = 1010;
var zBall = 0;

// initial velocities
var xVelocity = 750;
var yVelocity = -125;
var zVelocity = 0;

// arrays for breakable walls and cannonballs
var walls = [];
var cannonballs = [];

// keeping track of the total amount of points received
var numPoints = 0;

// Since we're such talented programmers, we include some exception handeling in case we break something
// a try and catch accolished this as it often does
// The sequence below includes initialization, filling up the scene, adding this to the DOM, and animating (updating what appears)
try {
  initScene();
	drawBattlefield();
	keyboardCommands();
	addToDOM();
	animate();
} catch(error) {
    console.log( "You did something bordering on utter madness. Error was:" );
    console.log( error );
}

// ========== Scene Setup ==========//

function initScene()
{	
	var canvasWidth = window.innerWidth;
	var canvasHeight = window.innerHeight;
	var canvasRatio = canvasWidth / canvasHeight;

	// Set up a renderer. This will allow WebGL to make your scene appear
	renderer = new THREE.WebGLRenderer( { antialias: true } );

	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0xAAAAAA, 1.0 );

	// Enable Shadows in the Renderer
	renderer.shadowMap.enabled = true;
	//renderer.shadowMap.type = THREE.BasicShadowMap;// shadow edges are crisp/sharp
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;// make shadows edges soft

	// Scene
	scene = new Physijs.Scene;
	scene.setGravity(new THREE.Vector3( 0, -300, 0 ));
	
	// Camera
	camera = new THREE.PerspectiveCamera( 45, canvasRatio, 1, 20000 );

	cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
	camera.position.set( -2095, 1145, 0);

	// Lights
  scene.add( new THREE.AmbientLight( 0x222222 ) );

	// the Sun in the sky
	light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.castShadow = true;
	light.position.set( -3000, 2000, -2000 );
	light.shadowCameraLeft = -3000;
	light.shadowCameraRight = 3000;
	scene.add( light );
	
	// if we do not want the sun to move across the sky
	// position it directly in the center behind the cannon
	if( moveTheSun == 0 )
	{
		light.position.set( -3000, 2000, 0 );
		countdownTime();
	}

	// else, make the sun move across the sky from East to West
	if( moveTheSun == 1 )
	{
		var sunStart = { z: -2000 };
		var sunEnd = { z: 2000 };
		var moveSun = new TWEEN.Tween( sunStart ).to( sunEnd, time );

		countdownTime();

		moveSun.onUpdate(function(){
			light.position.set( -3000, 2000, sunStart.z );
		});
		
		moveSun.start();
	}

  // A simple grid floor, the variables hint at the plane that this lies within
  // Later on we might install new flooring.
  var gridXZ = new THREE.GridHelper(4000, 100, new THREE.Color(0xCCCCCC), new THREE.Color(0x888888));
  //scene.add(gridXZ);

  // Visualize the Axes - Useful for debugging, can turn this off if desired
  var axes = new THREE.AxisHelper(3000);
  axes.position.y = 1;
  //scene.add(axes);

	// support resizing the window to the new window dimensions
	window.addEventListener('resize', onWindowResize, false);
	
}// initScene()

function countdownTime()
{
	var timeStart = { z: time/1000 };
	var timeEnd = { z: 0 };
	var countdown = new TWEEN.Tween( timeStart ).to( timeEnd, time );

	countdown.onUpdate(function(){
		document.getElementById( "time" ).innerHTML = "Time Remaining: " + Math.floor( timeStart.z ) + " seconds";	
	});

	countdown.onComplete(function(){
		document.getElementById( "time" ).innerHTML = "Time Remaining: Game Over";					
	});

	countdown.start();	

}// countdownTime()

function drawBattlefield()
{
	var cliff, wall;
	var groundMaterial, cliffMaterial;

	//-------- Materials --------//
		// Loader
		var loader = new THREE.TextureLoader();
		
		// Materials
		// grass and rocks images taken from Physijs' examples
		// https://github.com/chandlerprall/Physijs/tree/master/examples/images
		groundMaterial = Physijs.createMaterial(
			new THREE.MeshLambertMaterial({ map: loader.load( 'images/grass.png' ) }),
			.8, // high friction
			.5 // medium restitution (bounciness)
		);
		groundMaterial.wrapS = groundMaterial.wrapT = THREE.RepeatWrapping;

		cliffMaterial = Physijs.createMaterial(
			new THREE.MeshLambertMaterial({ map: loader.load( 'images/rocks.jpg' ) }),
			.8, // high friction     // the cliff probably doesn't need any of these settings
			.5 // medium restitution (bounciness)
		);
		cliffMaterial.wrapS = cliffMaterial.wrapT = THREE.RepeatWrapping;

	//-------- Geometries --------//
		// the playfield where objects spawn
		ground = new Physijs.BoxMesh(
			new THREE.BoxGeometry( 1750, 20, 1750 ), groundMaterial, 0 );
		ground.position.set( 0, 10, 0 );
		ground.receiveShadow = true;
		scene.add( ground );

		// the cliff that the cannon sits atop
		cliff = new Physijs.BoxMesh(
			new THREE.BoxGeometry( 100, 1000, 1000 ), cliffMaterial, 0 );
		cliff.position.set( -2000, 500, 0 );
		cliff.castShadow = true;
		cliff.receiveShadow = true;
		scene.add( cliff );
		
		// the cannon
		createCannon( xCannon, yCannon, zCannon );

		// the glass walls
		for( i = 0; i < numWalls; i++ )
			createWall();

}// drawBattlefield()

function createCannon( xRotation, yRotation, zRotation )
{
	var cannonMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );

	cannon = new Physijs.BoxMesh(
		new THREE.CylinderGeometry( 16, 16, 75, 128 ), cannonMaterial, 0 );
	
	// from: https://github.com/chandlerprall/Physijs/wiki/Updating-an-object's-position-&-rotation
	// you must set that object's __dirtyPosition or __dirtyRotation flag to true,
	// otherwise it will be overwritten from the last known values in the simulation.

	// even though __dirtyRotation is set to true, I could not rotate the cannon with WASD.
	// I had to remove the cannon from the scene and redraw it with the new rotation
	cannon.__dirtyRotation = true;
	cannon.position.set( -1975, 1024, 0 );
	cannon.castShadow = true;
	cannon.receiveShadow = true;
	
	cannon.rotation.x = xRotation;
	cannon.rotation.y = yRotation;
	cannon.rotation.z = zRotation;

	scene.add( cannon );

}// createCannon()

function createCannonball()
{
	// the cannonball color was taken from the convex break example shown in class
	// the colour was used for the cannon as well
	// https://threejs.org/examples/webgl_physics_convex_break.html
	var cannonballMaterial = Physijs.createMaterial(
		new THREE.MeshPhongMaterial( { color: 0x202020 } ),
		.6, // high friction
		.8 // high restitution (bounciness)
	);

	// since everything was scaled so big, the ball had to have a lot of mass, 
	// in order to knock the walls down (set to 100000)
	cannonball = new Physijs.SphereMesh(
		new THREE.SphereGeometry( 12.5, 32, 32 ), cannonballMaterial, 100000 );

	cannonball.castShadow = true;
	cannonball.receiveShadow = true;
	scene.add( cannonball );

	// add the cannonball to an array and run through the array,
	// every time we render the scene ( found in function render() ). 
	// this way we can check to see if the cannonball has fallen below a certain y value
	// and remove it to reduce strain on resources
	cannonballs.push( cannonball );

	// from: https://github.com/chandlerprall/Physijs/wiki/Updating-an-object's-position-&-rotation
	// you must set that object's __dirtyPosition or __dirtyRotation flag to true,
	// otherwise it will be overwritten from the last known values in the simulation.
	cannonball.__dirtyPosition = true;
	cannonball.position.set( xBall, yBall, zBall );

	// set direction of cannonball shot
	cannonball.setLinearVelocity(new THREE.Vector3( xVelocity, yVelocity, zVelocity ));

}// createCannonball()

function createWall()
{
	// Material
	// random color generator taken from:
	// https://www.sitepoint.com/generating-random-color-values/
	var hue = 'rgb(' + (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ')';
	var wallMaterial = Physijs.createMaterial(
		new THREE.MeshLambertMaterial( {
			color: hue,
			opacity: 0.3,
			transparent: true
		} ),
		.6, // high friction
		.3 // low restitution (bounciness)
	);

	wall = new Physijs.BoxMesh(
		new THREE.BoxGeometry( 20, 100, 50 ), wallMaterial );

	var lowX = -865;
	var highX = 865;
	var lowZ = -850;
	var highZ = 850;
	
	// formula taken for randInt function from:
	// https://github.com/mrdoob/three.js/blob/master/src/math/Math.js
	var randomX = lowX + Math.floor( Math.random() * ( highX - lowX + 1 ) );
	var randomZ = lowZ + Math.floor( Math.random() * ( highZ - lowZ + 1 ) );

	// make breakable walls spawn at random places
	wall.position.set( randomX, 71, randomZ );
	wall.castShadow = true;
	wall.receiveShadow = true;

	scene.add( wall );
	walls.push( wall );

	// if this wall collides with a cannonball, or another piece of a wall
	// remove the wall from the scene, then create a new wall in the same place with voronoi fractures
	wall.addEventListener( 'collision', function( other_object, linear_velocity, angular_velocity ) {
		// from: https://github.com/chandlerprall/Physijs/wiki/Collisions
    // `this` is the mesh with the event listener
    // other_object is the object `this` collided with
		// linear_velocity and angular_velocity are Vector3 objects which represent the velocity of the collision

		// if this wall collides with anything but the ground, remove it and create a new wall with fractures
		if( other_object != ground )
		{

			for( var i = 0; i < walls.length; i++ )
				if( walls[i] == this )
				{
					scene.remove( walls[i] );
					walls.splice( i, 1 );
				}

			// increment the number of points since something knocked down a wall
			// (either a cannonball or other wall pieces)
			numPoints++;
			document.getElementById("points").innerHTML = "Points: " + numPoints;

			// 'this' wall positions, to know where to place the new wall with fractures
			var thisWallX = this.position.x;
			var thisWallY = this.position.y;
			var thisWallZ = this.position.z;

			// we also pass 'this' wallMaterial
			// so that the new wall with fractures will have the same color as the old one
			createVoronoiFracture( thisWallX, thisWallY, thisWallZ, wallMaterial );
		}
	});

}// createWall()

// ========== Voronoi Fracture ==========//

// this organization of creating vertices, creating voronoi diagram, creating shapes and then creating geometries
// was largely inspired by: https://github.com/nayrrod/voronoi-fracture/blob/master/src/index.js#L68
function createVoronoiFracture( thisWallX, thisWallY, thisWallZ, wallMaterial )
{
	// create a set of 2D vertices to be used to compute the voronoi diagram
	var sites = createVertices( numVertices );

	// create a VoronoiDiagram using: https://github.com/gorhill/Javascript-Voronoi
	var voronoiDiagram = createVoronoiDiagram( sites );

	// using the voronoiDiagram, create an array of shapes to be used in ExtrudeGeometry
	var shapesArray = createShapes( voronoiDiagram );

	// use the array of shapes and create threejs ExtrudeGeometries
	var geometries = createGeometries( shapesArray, thisWallX, thisWallY, thisWallZ, wallMaterial );

}// createVoronoiFracture()

function createVertices( numVertices )
{
	var verticesArray = [];
	var randomX, randomY, aVertice;
	
	for( var i = 0; i < numVertices; i++ )
	{
		// dimensions of the wall are used and scaled using Math.random()
		// to generate random x and y vertices
		randomX = Math.floor(Math.random() * 20);
		randomY = Math.floor(Math.random() * 100);

		aVertice = {
			x: randomX, 
			y: randomY
		}

		verticesArray.push( aVertice )
	}

	return verticesArray;

}// createVertices()

function createVoronoiDiagram( sites )
{
	var voronoi = new Voronoi();

	// xl is x-left, xr is x-right, yt is y-top, and yb is y-bottom
	var bbox = { xl: 0, xr: 50, yt: 0, yb: 100 }

	var diagram = voronoi.compute( sites, bbox );

	return diagram;

}// createVoronoiDiagram()

function createShapes( voronoiDiagram )
{
	var shape = new THREE.Shape();
	var shapes = [];

	// from the README.md at: https://github.com/gorhill/Javascript-Voronoi
	// An array of Voronoi.Cell objects making up the Voronoi diagram.
	// A Voronoi.Cell object might have an empty array of halfedges,
	// meaning no Voronoi cell could be computed for a particular cell.
	var cellArray = voronoiDiagram.cells;
	var currentCell;
	var startPoint, endPoint;

	// each cell contains all the edges used to make the cell,
	// so go through each cell and map out the shape to be used in the ExtrudeGeometry
	for( var i = 0; i < cellArray.length; i++ )
	{
		shape = new THREE.Shape();
		currentCell = cellArray[i];
		
		startPoint = currentCell.halfedges[0].getStartpoint();
		shape.moveTo(startPoint.x, startPoint.y);
		for ( var j = 0; j < currentCell.halfedges.length; j++ )
		{
			endPoint = currentCell.halfedges[j].getEndpoint();	
			shape.lineTo( endPoint.x, endPoint.y );
		}
		shapes.push( shape );
	}
	
	return shapes;

}// createShapes()

function createGeometries( shapesArray, thisWallX, thisWallY, thisWallZ, wallMaterial )
{
	var extrudeSettings = {
		steps: 1,
		amount: 20,
		bevelEnabled: false,
		bevelThickness: 0,
		bevelSize: 0,
		bevelSegments: 0
	};

	var currentShape;
	var wallPieces = [];

	// now that we have the outlines of each shape, make a geometry for them all
	for( var i = 0; i < shapesArray.length; i++ )
	{
		currentShape = shapesArray[i];
		var geometry = new THREE.ExtrudeGeometry( currentShape, extrudeSettings );
		var wallPiece = new Physijs.ConvexMesh( geometry, wallMaterial ) ;

		wallPiece.castShadow = true;
		wallPiece.receiveShadow = true;
		wallPiece.position.set( thisWallX+10, 21, thisWallZ-25 );
		wallPiece.rotation.y = -Math.PI / 2;

		wallPieces.push( wallPiece );
		scene.add( wallPiece );
	}

	// now that all wall pieces are in the scene,
	// make them slowly fade away to reduce strain on resources
	deleteWallPieces( wallPieces, wallMaterial );

}// createGeometries()

// slowly fade out the wall pieces, then remove them
function deleteWallPieces( wallPieces, wallMaterial )
{
	var currWallPiece;
	
	var startOpacity = { z: 0.3 };
	var endOpacity = { z: 0.0 };
	var time = 5000;
	var fadeOutPieces = new TWEEN.Tween( startOpacity ).to( endOpacity, time );

	fadeOutPieces.onUpdate(function(){
		wallMaterial.opacity = startOpacity.z;
	});

	// after the fading out tween has completed, remove all the pieces
	// and create a new wall
	fadeOutPieces.onComplete(function(){
		for( var i = 0; i < wallPieces.length; i++ )
		{
			currWallPiece = wallPieces[i];
			scene.remove( currWallPiece );
		}
		createWall();
	});

	// give the pieces some time to fall down first, 15 seconds
	fadeOutPieces.delay( 15000 );
	fadeOutPieces.start();
}// deleteWallPieces()

//========== Animating the scene, other functions and commands ==========//

function keyboardCommands()
{
	document.body.onkeydown = function(e){

		// wasd keys move the cannon and consequently,
		// the location of where the cannonball starts
		// and also xyz velocities for setLinearVelocity

		// w key to move the canon upwards and the cannonball start upwards
		if( e.keyCode == 87 )
		{
			// cannon rotation
			if( zCannon + 0.01 < -1.80 )
				zCannon = zCannon + 0.01;
			
			// rotation is funny with physijs, rotating a geometry already in the scene doesn't work properly
			// instead, just remove the cannon and redraw it again with the new rotation
			scene.remove( cannon );
			createCannon( xCannon, yCannon, zCannon );
			
			// cannonball starting position
			if( yBall + .08 < 1030 )
				yBall = yBall + 1;

			// cannonball yVelocity
			if( yVelocity + 7.5 < 100 )
				yVelocity = yVelocity + 7.5;	
		}

		// s key to move the canon downwards and the cannonball start downwards
		if( e.keyCode == 83 )
		{
			// cannon rotation
			if( zCannon - 0.01 > -2.30 )
				zCannon = zCannon - 0.01;
			scene.remove( cannon );
			createCannon( xCannon, yCannon, zCannon );
			
			// cannonball starting position
			if( yBall - .08 > 990 )
				yBall = yBall - 1;

			// cannonball yVelocity
			if( yVelocity - 7.5 > -350 )
				yVelocity = yVelocity - 7.5;
		}

		// a key to move the canon to the left and the cannonball start left
		if( e.keyCode == 65 )
		{
			// cannon rotation
			if( yCannon + 0.01 < .60 )
				yCannon = yCannon + 0.01;
			scene.remove( cannon );
			createCannon( xCannon, yCannon, zCannon );

			// cannonball starting position
			if( zBall - .5 > -30 )
				zBall = zBall - .5;

			// cannonball zVelocity
			if( zVelocity - 8 > -504 )
				zVelocity = zVelocity - 8;
		}

		// d key to move the canon to the right and the cannonball start right
		if( e.keyCode == 68 )
		{
			// cannon rotation
			if( yCannon - 0.01 > -.60 )
				yCannon = yCannon - 0.01;
			scene.remove ( cannon );
			createCannon( xCannon, yCannon, zCannon );

			// cannonball starting position
			if( zBall + .5 < 30 )
				zBall = zBall + .5;

			// cannonball zVelocity
			if( zVelocity + 8 < 504 )
				zVelocity = zVelocity + 8;
		}

		// r and s changes power of shot

		// r changes the power of the shot, to make it go further (I think)
		if( e.keyCode == 82 )
		{
			if( xVelocity + 10 < 1150 )
				xVelocity = xVelocity + 10;
		}

		// f changes the power of the shot, to make it weaker (I think)
		if( e.keyCode == 70 )
		{
			if( xVelocity - 10 > 350 )
				xVelocity = xVelocity - 10;
		}

		// v recenters the camera on the cannon
		// for some reason, this changes the arrow keys to rotate,
		// instead of moving the camera in that direction
		if( e.keyCode == 86 )
		{
			camera.position.set( -2095, 1145, 0 );
			cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
		}

		// p key creates an additional wall
		if( e.keyCode == 80 )
			createWall();
	}

	document.body.onkeyup = function(e)
	{
		// spacebar shoots a cannonball
		if( e.keyCode == 32 )
			createCannonball();
	}

}// keyboardCommands()

// support resizing the window to the new window dimensions and have the cannon centered
function onWindowResize()
{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

// We want our document object model (a javascript / HTML construct) to include our canvas
// These allow for easy integration of webGL and HTML
function addToDOM()
{
  var canvas = document.getElementById( "canvas" );
  canvas.appendChild( renderer.domElement );
}

// This is a browser callback for repainting
// Since you might change view, or move things
// We cant to update what appears
function animate()
{
  window.requestAnimationFrame( animate );
	render();
	TWEEN.update();
}

// getDelta comes from THREE.js - this tells how much time passed since this was last called
// This might be useful if time is needed to make things appear smooth, in any animation, or calculation
// The following function stores this, and also renders the scene based on the defined scene and camera
function render()
{
	var delta = clock.getDelta();
	cameraControls.update( delta );
	renderer.render( scene, camera );
	scene.simulate();// add physics

	// delete cannonballs after they fall below the ground to reduce strain on resources
	for( var i = 0; i < cannonballs.length; i++ )
		if( cannonballs[i].position.y < -500 )
		{
			scene.remove( cannonballs[i] );
			cannonballs.splice( i, 1 );
		}
};
