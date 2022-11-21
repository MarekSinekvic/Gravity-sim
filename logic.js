canvcreate("background-color: black; background-size: cover;", 500, 500);
canv.width = window.innerWidth;
canv.height = window.innerHeight;
window.onresize = function () {
	canv.width = window.innerWidth;
	canv.height = window.innerHeight;
}

console.log("k - grid\nv - distance by points\ng - gravity body\nb - sizes without perspective\nSpace - pause");

function magnitudeVec(a) {
	return Math.sqrt(a.x * a.x + a.y * a.y);
}
function minusVec(a, b) { 
	return {
		x: b.x - a.x,
		y: b.y - a.y
	}; 
}
function plusVec(a, b) { 
	return {
		x: b.x + a.x,
		y: b.y + a.y
	}; 
}

var world = {
	GravityConstant: 6.67430151515 * Math.pow(10, -11),
	LightSpeed: 299792458,
	_StartViewScale: 1,
	ViewScale: 1,
	SimulationSpeed: 1,
	NotPhysicSimulationSpeed: 1,
	DeltaTime: 1,
	IsPaused: false,
	GridScale: 100,
	LimitBoundSize: 10000,
	BoundsCount: Math.pow(100,2),
	resetViewScale: function () {
		this.ViewScale = 0.5e-8;
	},
	timeSlow: function (v) {
		return 1 / Math.sqrt(1-Math.pow(v,2)/Math.pow(this.LightSpeed,2));
	}
};
world.ViewScale = world._StartViewScale;

var defaultViewScale = 0.5e-8;

var scaleMatrix = [
	[world.ViewScale, 0],
	[0, world.ViewScale]
];

class particle {
	constructor(Position, Start_Velocity, Mass, Radius, Color, trailLength = 0, trailColor = "red") {
		this.pos = Position;
		this.vel = Start_Velocity;
		this.clr = Color;
		this.mass = Mass;
		this.radius = Radius;

		this.isCanCollide = true;
		this.isFreezed = false;

		this.isInGroup = false;
		this.groupIndex = false;

		this.boundIndex = 0;
		this.inBoundObjIndex = 0;
	}
	draw() {
		var SchwarzschildRadius = 2 * world.GravityConstant * this.mass / (world.LightSpeed * world.LightSpeed);
		// ctx.moveTo(camera.toViewport(this.pos).x,camera.toViewport(this.pos).y);
		ctx.fillStyle = this.clr;
		ctx.strokeStyle = this.clr;
		ctx.arc(camera.toViewport(this.pos).x, camera.toViewport(this.pos).y, this.radius * world.ViewScale,0,360*Math.PI/180);
		if (input.keyboard.char == 'b')
			ctx.arc(camera.toViewport(this.pos).x, camera.toViewport(this.pos).y, 10,0,360*Math.PI/180);
	}
	attractTo(position, mass, radius, mod = 1, power = 2) {
		let delta = math.distance([position.x, position.y], [this.pos.x, this.pos.y]);
		// console.log(this.pos.x + ", " + this.pos.y + ": " + frame);
		if (delta[0] < this.radius + radius) {
			// this.vel.x += -delta[1] / delta[0] * (0.01*world.GravityConstant *mass / Math.pow(delta[0],2)) * world.NotPhysicSimulationSpeed * mod;
			// this.vel.y += -delta[2] / delta[0] * (0.01*world.GravityConstant *mass / Math.pow(delta[0],2)) * world.NotPhysicSimulationSpeed * mod;
			return;
		}
		if (delta[0] < 0.001) return;
		this.vel.x += delta[1] / delta[0] * (world.GravityConstant * ((mass) / Math.pow(delta[0],power))) * world.NotPhysicSimulationSpeed * mod;
		this.vel.y += delta[2] / delta[0] * (world.GravityConstant * ((mass) / Math.pow(delta[0],power))) * world.NotPhysicSimulationSpeed * mod;
	}
	onCollide(velocity, mass) {
		let averageVelocity = {
			x: (this.vel.x * this.mass + velocity.x * mass) / (mass+this.mass),
			y: (this.vel.y * this.mass + velocity.y * mass) / (mass+this.mass)
		};
		this.vel.x = averageVelocity.x;
		this.vel.y = averageVelocity.y;
		velocity.x = averageVelocity.x;
		velocity.y = averageVelocity.y;
		return averageVelocity;
	}
	isCollideWithAnybody(thisI) {
		const boundIndex = getBoundIndexByPosition(this.pos);
		let addBoundIndexes = [
			-boundsCountOnAxis-1,-boundsCountOnAxis,-boundsCountOnAxis+1,
			-1,0,+1,
			+boundsCountOnAxis-1,+boundsCountOnAxis,+boundsCountOnAxis+1,
		];
		let collides = [];
		
		for (let l = 0; l < addBoundIndexes.length; l++) {
			if (boundIndex + addBoundIndexes[l] < 0 || boundIndex + addBoundIndexes[l] > bounds.length-1) continue;
			for (let j = 0; j < bounds[boundIndex+addBoundIndexes[l]].objects.length; j++) {
				const index = bounds[boundIndex+addBoundIndexes[l]].objects[j];
				if (index == thisI) continue;
				const nObj = particles[index];
				// const dst = math.distance([this.pos.x, this.pos.y], [nObj.pos.x, nObj.pos.y]);
				const dst = Math.pow(particles[index].pos.x-this.pos.x,2)+Math.pow(particles[index].pos.y-this.pos.y,2);
				if (dst < (this.radius + nObj.radius)*(this.radius + nObj.radius) && this.isCanCollide) {
					collides.push(index);
				}
			}
		}
		return collides;
	}
	isCollideWith(j) {
		const dst = Math.pow(particles[j].pos.x-this.pos.x,2)+Math.pow(particles[j].pos.y-this.pos.y,2);
		if (dst < (this.radius + particles[j].radius)*(this.radius + particles[j].radius) && this.isCanCollide) {
			return true;
		}
		return false;
	}
	getCollidedBounds(thisI) { //By velocity vector
		const boundIndex = getBoundIndexByPosition(this.pos);
		let posInBound = { x: -getBoundPosition(boundIndex).x + this.pos.x - boundSize / 2, y: -getBoundPosition(boundIndex).y + this.pos.y - boundSize / 2 };
		let t = distanceToBoxBorder(posInBound, this.vel, boundSize/2);
		let tAll = t;
		let iter = 0;
		
		let newPos = {x:this.pos.x+this.vel.x*t,y:this.pos.y+this.vel.y*t};
		let newBoundIndex = boundIndex;
		
		let collidedBounds = [boundIndex];
			
		while (tAll < 1 && iter < 20) {
			t = distanceToBoxBorder(posInBound, this.vel, boundSize/2);
			newPos.x += this.vel.x * t;
			newPos.y += this.vel.y * t;
			// d.circle(camera.toViewport(newPos).x,camera.toViewport(newPos).y,3,"White","white");
			if ((newPos.x < -world.LimitBoundSize/2 || newPos.x > world.LimitBoundSize/2 || newPos.y < -world.LimitBoundSize/2 || this.pos.y+this.vel.y > world.LimitBoundSize/2))
				break;
			newBoundIndex = getBoundIndexByPosition(newPos);
			posInBound.x = -getBoundPosition(newBoundIndex).x + newPos.x - boundSize / 2;
			posInBound.y = -getBoundPosition(newBoundIndex).y + newPos.y - boundSize / 2;
			tAll += t;
			iter++;
			collidedBounds.push(newBoundIndex);
		}
		return collidedBounds;
	}
	simplify(other, ts) {
		// let newVelocity = {
		// 	x: (this.vel.x * this.mass + particles[other].vel.x * particles[other].mass) / (particles[other].mass + this.mass),
		// 	y: (this.vel.y * this.mass + particles[other].vel.y * particles[other].mass) / (particles[other].mass + this.mass)
		// };
		// let newMass = this.mass + particles[other].mass;
		// let newPos = {
		// 	x: (this.mass>particles[other].mass ? this.pos.x : particles[other].pos.x),
		// 	y: (this.mass>particles[other].mass ? this.pos.y : particles[other].pos.y)
		// };
		// let newRadius = (this.radius + particles[other].radius)/1.2;
		// let newColor = this.clr;
		
		// killParticle(other);
		// if (ts > other) ts-=1;
		// killParticle(ts);

		// particles.push(new particle(newPos, newVelocity, newMass, newRadius, newColor));
		// let boundIndex = getBoundIndexByPosition(newPos);
		// bounds[boundIndex].objects.push(particles.length-1);
	}
}
class Bound {
	constructor(min,max,Index=0,objects = []) {
		this.min = min;
		this.max = max;
		this.objects = objects;
		
		this.color = "gray";
		this.lineWidth = 0.05;
		
		this.index = Index;
	}
	debugDraw() {
		let minLocal = camera.toViewport(this.min);
		let maxLocal = camera.toViewport(this.max);
		d.rect(minLocal.x,minLocal.y,maxLocal.x-minLocal.x,maxLocal.y-minLocal.y,this.color,this.color,this.lineWidth*world.ViewScale,false);
	}
}
class GroupOfParticles {
	constructor(StartPosition = {x:0,y:0},StartVelocity = {x:0,y:0},Mass = 1) {
		this.position = StartPosition;
		this.velocity = StartVelocity;
		this.mass = Mass;

		this.objects = [];
	}
	attractTo(position, mass, mod = 1, power = 2) {
		let delta = math.distance([position.x, position.y], [this.pos.x, this.pos.y]);
		this.velocity.x += delta[1] / delta[0] * (world.GravityConstant * ((mass) / Math.pow(delta[0],power))) * world.NotPhysicSimulationSpeed * mod;
		this.velocity.y += delta[2] / delta[0] * (world.GravityConstant * ((mass) / Math.pow(delta[0],power))) * world.NotPhysicSimulationSpeed * mod;
	}
}

var ui = {
	hoveredParticle: null,
	hoveredParticleIndex: null,
	vectorsLengthModifier: 4,
	isBlocked: false,
	groupSelection: {
		hoveredParticles: null,
		isSelecting: false,
		start: new v2(),
		end: new v2()
	},
	isGridVisible: false,
	infoReceiving: function (gravityDirection) {
		if (this.hoveredParticle != null) {
			const p = this.hoveredParticle;

			const gravityRadius = Math.sqrt(world.GravityConstant * p.mass / 0.001);

			const info = [
				"Index in array: " + this.hoveredParticleIndex,
				"Radius = " + p.radius + " m",
				"Mass = " + p.mass + " kg",
				"Density = " + p.mass / (Math.PI * (p.radius * p.radius)) + " kg/m^2",
				"",
				"Blue vector = Velocity direction",
				"Green vector = Direction of gravity force",
				"Dark green circle = area where force > 0.001"
			];
			const font = 16 + "px sans-serif";
			let i = 0;

			const infoHeight = parseFloat(font.split(' ')[0]) * info.length;
			info.forEach(txt => {
				d.txt(txt, camera.toViewport({
					x: p.pos.x + p.radius,
					y: p.pos.y
				}).x + 2, -infoHeight / 2 + camera.toViewport(p.pos).y + i * parseFloat(font.split(' ')[0]), font, "white");
				i++;
			});
			d.ray(camera.toViewport(p.pos).x, camera.toViewport(p.pos).y, math.normalize(p.vel), p.radius * 2 * world.ViewScale * this.vectorsLengthModifier, "blue", 2.2);

			d.ray(camera.toViewport(p.pos).x, camera.toViewport(p.pos).y, math.normalize(gravityDirection), p.radius * 2 * world.ViewScale * this.vectorsLengthModifier, "green", 2.2);
		
			d.circle(camera.toViewport(p.pos).x,camera.toViewport(p.pos).y, gravityRadius * world.ViewScale, "rgba(0,100,0,0.4)","rgba(0,100,0,0.4)", 2, false);
			d.line(camera.toViewport(p.pos).x,camera.toViewport(p.pos).y,camera.toViewport(p.pos).x+gravityRadius * world.ViewScale,camera.toViewport(p.pos).y, "rgba(0,100,0,0.4)",2);
			d.txt(gravityRadius/9.461e15+" ly (e+15)",camera.toViewport(p.pos).x+gravityRadius/2*world.ViewScale,camera.toViewport(p.pos).y,font,"white");
		}
	},
	groupInfoReceiving: function () {
		let genMass = 0;
		let min = new v2(Infinity,Infinity);
		let max = new v2(-Infinity, -Infinity);
		let velocities = new v2();
		let midPoint = new v2();
		for (let i = 0; i < ui.groupSelection.hoveredParticles.length; i++) {
			const particle = ui.groupSelection.hoveredParticles[i];
			genMass += particle.mass;
			if (min.x > particle.pos.x)
				min.x = particle.pos.x;
			if (min.y > particle.pos.y)
				min.y = particle.pos.y;
			if (max.x < particle.pos.x)
				max.x = particle.pos.x;
			if (max.y < particle.pos.y)
				max.y = particle.pos.y;
			velocities.x += particle.vel.x;
			velocities.y += particle.vel.y;
			midPoint = midPoint.plusV(particle.pos);
			d.circle(camera.toViewport(particle.pos).x, camera.toViewport(particle.pos).y, particle.radius * world.ViewScale, "rgb(0,100,0)", "rgb(0,100,0)", 2, false);
		}
		midPoint = midPoint.divide(ui.groupSelection.hoveredParticles.length);
		const info = [
			"Particles count: " + ui.groupSelection.hoveredParticles.length,
			"General mass: 10^" + Math.log10(genMass).toFixed(4) + " kg",
			"",
			"Dark green circle = area where force > 0.001"
		];
		// const font = Math.min(max.x - min.x, max.y - min.y) * world.ViewScale / 10 + "px sans-serif";
		const font = 11 + "px sans-serif";
		const infoHeight = parseFloat(font.split(' ')[0]) * info.length;
		const gravityRadius = Math.sqrt(world.GravityConstant * genMass / 0.001);
		let i = 0;
		info.forEach(txt => {
			// d.txt(txt, camera.toViewport(min).x + 2, Math.min(max.x - min.x, max.y - min.y) * world.ViewScale / 10 + camera.toViewport(min).y + i * parseFloat(font.split(' ')[0]), font, "white");
			d.txt(txt, camera.toViewport(min).x + 2, 3+Number(parseFloat(font.split(' ')[0]))+camera.toViewport(min).y + i * parseFloat(font.split(' ')[0]), font, "white");
			i++;
		});
		max = new v2(max.x-min.x,max.y-min.y);
		d.rect(camera.toViewport(min).x, camera.toViewport(min).y, max.x*world.ViewScale, max.y*world.ViewScale, "black", "green", 2, false);
		let center = new v2(min.x + max.x / 2, min.y + max.y / 2);
		d.ray(camera.toViewport(center).x,camera.toViewport(center).y,math.normalize(velocities),world.ViewScale * this.vectorsLengthModifier,"blue",2.2);
		
		d.circle(camera.toViewport(midPoint).x, camera.toViewport(midPoint).y, gravityRadius * world.ViewScale, "rgba(0,100,0,0.4)", "rgba(0,100,0,0.4)", 2, false);
			d.line(camera.toViewport(midPoint).x,camera.toViewport(midPoint).y,camera.toViewport(midPoint).x+gravityRadius * world.ViewScale,camera.toViewport(midPoint).y, "rgba(0,100,0,0.4)",2);
		d.txt(gravityRadius/9.461e15+" ly (e+15)",camera.toViewport(midPoint).x+gravityRadius/2*world.ViewScale,camera.toViewport(midPoint).y,font,"white");
	},
	getGravityDirection: function (oparticle, startDirection) {
		var delta = math.distance([oparticle.pos.x, oparticle.pos.y], [this.hoveredParticle.pos.x, this.hoveredParticle.pos.y]);
		startDirection.x += delta[1] / delta[0] * (world.GravityConstant * ((oparticle.mass) / (delta[0] * delta[0])));
		startDirection.y += delta[2] / delta[0] * (world.GravityConstant * ((oparticle.mass) / (delta[0] * delta[0])));
		return startDirection;
	},
	isOnObject: function (particle, x, y) {
		let distance = math.distance([x, y], [particle.pos.x, particle.pos.y])[0];
		let radius = (particle.radius * world.ViewScale > 10) ? particle.radius * world.ViewScale : 10;
		if (distance * world.ViewScale < radius)
			return true;
		return false;
	},
	isObjectInAABB: function (particle, start, end) {
		let rightStart = new v2(Math.min(start.x,end.x),Math.min(start.y,end.y));
		let rightEnd = new v2(Math.max(start.x, end.x), Math.max(start.y, end.y));
		if (particle.pos.x < rightStart.x || particle.pos.x > rightEnd.x) return false;
		if (particle.pos.y < rightStart.y || particle.pos.y > rightEnd.y) return false;
		return true;
	},
	hoverOnParticle(index) {
		this.hoveredParticle = particles[index];
		this.hoveredParticleIndex = index;
	},
	generalCycle: function () {
		if (!this.isBlocked) {
			var isMouseHoveredOnObject = false;
			//if (this.hoveredParticle != null)
			var gravityDirection = {
				x: 0,
				y: 0
			};
			if (input.mouse.click == 3 && !ui.groupSelection.isSelecting) {
				ui.groupSelection.isSelecting = true;
				ui.groupSelection.start = new v2(input.mouse.position.x,input.mouse.position.y);
			}
			if (input.mouse.click == 3 && ui.groupSelection.isSelecting) {
				ui.groupSelection.end = new v2(input.mouse.position.x,input.mouse.position.y);
			}
			let particlesGroup = [];
			for (let i = 0; i < particles.length; i++) {
				const particle = particles[i];

				if (this.hoveredParticle != null && particle != this.hoveredParticle)
					gravityDirection = this.getGravityDirection(particle, gravityDirection);

				if (ui.groupSelection.isSelecting && ui.isObjectInAABB(particle, new v2(camera.toWorld(ui.groupSelection.start)), new v2(camera.toWorld(ui.groupSelection.end)))) {
					particlesGroup.push(particle);
				}
			
				if (this.isOnObject(particle, camera.toWorld({
					x: input.mouse.x,
					y: input.mouse.y
				}).x, camera.toWorld({
					x: input.mouse.x,
					y: input.mouse.y
				}).y)) {
					this.isMouseHoveredOnObject = true;
					if (input.mouse.isMouseDown(3)) {
						this.hoveredParticle = particle;
						this.hoveredParticleIndex = i;
					}
					d.circle(camera.toViewport(particle.pos).x, camera.toViewport(particle.pos).y, ((particle.radius + 3.5) * world.ViewScale > 10) ? (particle.radius + 3.5) * world.ViewScale : 10, "black", "green", 2, false);
				}
			}
			if (input.mouse.click == 0) {
				if (ui.groupSelection.isSelecting) {
					ui.groupSelection.hoveredParticles = particlesGroup;
					ui.groupSelection.isSelecting = false;
				}
			}
			this.infoReceiving(gravityDirection);
			if ((input.mouse.isMouseDown(3)) && !isMouseHoveredOnObject) {
				this.hoveredParticle = null;
				this.hoveredParticleIndex = null;
				ui.groupSelection.hoveredParticles = null;
			}
			if (this.hoveredParticle != null)
				d.circle(camera.toViewport(this.hoveredParticle.pos).x, camera.toViewport(this.hoveredParticle.pos).y, (this.hoveredParticle.radius + 3.5) * world.ViewScale, "black", "green", 2, false);
			if (ui.groupSelection.isSelecting) {
				let sizes = new v2(ui.groupSelection.end.x - ui.groupSelection.start.x, ui.groupSelection.end.y - ui.groupSelection.start.y);
				d.rect(ui.groupSelection.start.x, ui.groupSelection.start.y, sizes.x, sizes.y, "black", "green", 2, false);
			}
			if (ui.groupSelection.hoveredParticles != null) {
				this.groupInfoReceiving();
			}
		}
	},
	grid: function (scale = 10) {
		let rightViewScale = Math.max(world.ViewScale,1/scale);
		for (let y = -canv.height/2; y < (canv.height / scale)/rightViewScale+canv.height/2; y++) {
			d.line(0, (y*scale+camera.offset.y%scale)*rightViewScale+canv.height/2, canv.width, (y*scale+camera.offset.y%scale)*rightViewScale+canv.height/2, "rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)", 1, false);
		}
		for (let x = -canv.width/2; x < (canv.width / scale)/rightViewScale+canv.width/2; x++) {
			d.line((x*scale+camera.offset.x%scale)*rightViewScale+canv.width/2, 0, (x*scale+camera.offset.x%scale)*rightViewScale+canv.width/2, canv.height, "rgba(255,255,255,0.1)", "rgba(255,255,255,0.1)", 1, false);
		}
	},
	toggleGrid: function () {
		let toggleState = false;
		return function (key = 'k') {
			if (input.keyboard.char != key && toggleState)
				toggleState = false;
			if (input.keyboard.char == key && !toggleState) {
				toggleState = true;
				ui.isGridVisible = !ui.isGridVisible;
			}
		}
	}
};
var camera = {
	offset: {
		x: 0,
		y: 0
	},
	zoomSpeed: 0.1,

	isCameraDragWork: false,
	cameraDragStartPos: {
		x: 0,
		y: 0
	},
	_attachParticleIndex: -1,
	offsetUpdate: function () {
		if (input.mouse.click == 2 && !this.isCameraDragWork) {
			this.cameraDragStartPos = {
				x: input.mouse.x,
				y: input.mouse.y
			};
			this.isCameraDragWork = true;
		}
		if (this.isCameraDragWork) {
			var delta = {
				x: (input.mouse.x - this.cameraDragStartPos.x) / world.ViewScale,
				y: (input.mouse.y - this.cameraDragStartPos.y) / world.ViewScale
			};
			this.cameraDragStartPos = {
				x: input.mouse.x,
				y: input.mouse.y
			};
			this.offset.x += delta.x;
			this.offset.y += delta.y;
		}
		if (input.mouse.click == 0)
			this.isCameraDragWork = false;
		if (this._attachParticleIndex != -1) {
			let size = (canv.width < canv.height) ? canv.width : canv.height;
			// camera.offset.x = -particles[this._attachParticleIndex].pos.x - canv.width / 2 / world.ViewScale;
			// camera.offset.y = -particles[this._attachParticleIndex].pos.y - canv.height / 2 / world.ViewScale;
			camera.offset.x = camera.toViewport(particles[this._attachParticleIndex].pos).x;
			camera.offset.y = camera.toViewport(particles[this._attachParticleIndex].pos).y;
		}
	},
	toParticle(i, viewScaling = true) {
		let size = (canv.width < canv.height) ? canv.width : canv.height;
		if (viewScaling)
			world.ViewScale = size / particles[0].radius
		camera.offset.x = -particles[i].pos.x + canv.width / 2 / world.ViewScale;
		camera.offset.y = -particles[i].pos.y + canv.height / 2 / world.ViewScale;
	},
	attachParticle(i, viewScaling = false) {
		this._attachParticleIndex = i;
	},
	unAttachParticle() {
		this._attachParticleIndex = -1;
	},

	toViewport(position) {
		return {
			x: (position.x + this.offset.x) * world.ViewScale + canv.width / 2,
			y: (position.y + this.offset.y) * world.ViewScale + canv.height / 2
		};
	},
	toWorld(position) {
		return {
			x: (position.x - canv.width / 2) / world.ViewScale - camera.offset.x,
			y: (position.y - canv.height / 2) / world.ViewScale - camera.offset.y
		};
	},

	recordedData: [],
	recordFrame: 0,
	isRecording: false,
	isReplayRecorded: false,
	record() {
		this.recordedData[this.recordFrame]=[];
		for (let particleI = 0; particleI < particles.length; particleI++) {
			this.recordedData[this.recordFrame].push({
				id:particleI,
				pos:{x:particles[particleI].pos.x,y:particles[particleI].pos.y},
				vel:{x:particles[particleI].vel.x,y:particles[particleI].vel.y},
				radius:particles[particleI].radius,
				color:particles[particleI].clr});
		}
		this.recordFrame++;
	},
	replayFrame: 0,
	recordStartframe: 0,
	replaySpeed: 1,
	replayRecorded() {
		this.isRecording = false;
		ctx.font = "Arial " + 13 * world.ViewScale + "px";
		ctx.fillStyle = "rgba(255,255,255,0.4)"
		for (let i = 0; i < this.recordedData[this.replayFrame].length; i++) {
			const frameData = this.recordedData[this.replayFrame][i];
			d.circle(this.toViewport(frameData.pos).x,this.toViewport(frameData.pos).y,frameData.radius*world.ViewScale,frameData.color,frameData.color);
			// d.txt(frameData.id,this.toViewport(frameData.pos).x+5,this.toViewport(frameData.pos).y);
			d.ray(this.toViewport(frameData.pos).x,this.toViewport(frameData.pos).y,frameData.vel,math.magnitude(frameData.vel)*world.ViewScale);
		}
		for (let i = 0; i < debugSimpifies.length; i++) {
			if (this.replayFrame > debugSimpifies[i].frame-this.recordStartframe) {
				d.txt(i,this.toViewport(debugSimpifies[i].pos).x,this.toViewport(debugSimpifies[i].pos).y);
			}
		}
		if (input.keyboard.char == 'w')
			this.replayFrame+=Math.floor(this.replaySpeed);
		if (input.keyboard.char == 's')
			this.replayFrame+=-Math.floor(this.replaySpeed);
		if (this.replayFrame > this.recordedData.length-1) this.replayFrame = this.recordedData.length-1;
		if (this.replayFrame < 0) this.replayFrame = 0;
	},
	startRecord() {
		this.recordStartframe = frame;
		this.isRecording = true;
	},
	startReplay() {
		this.isReplayRecorded = true;
		this.isRecording = false;
	}
};
var debugSimpifies = [];

var particles = [];
var bounds = [];
var groupsOfParticles = [];

let debugLines = [];

let boundsCountOnAxis = Math.sqrt(world.BoundsCount);
let boundSize = world.LimitBoundSize / boundsCountOnAxis;
let i = 0;
for (let y = 0; y < boundsCountOnAxis; y++) {
	for (let x = 0; x < boundsCountOnAxis; x++) {
		bounds.push(new Bound({ x: boundSize * x-world.LimitBoundSize/2, y: boundSize * y-world.LimitBoundSize/2 }, { x: boundSize * (x+1)-world.LimitBoundSize/2, y: boundSize * (y+1)-world.LimitBoundSize/2 },i));
		i++;
	}
}
function getBoundIndexByPosition(position) {
	return Math.floor((position.x+world.LimitBoundSize/2)/boundSize)+Math.floor((position.y+world.LimitBoundSize/2)/boundSize)*(boundsCountOnAxis);
}
function getBoundPosition(index) {
	return {
		x: (index%boundsCountOnAxis)*boundSize-world.LimitBoundSize/2,
		y: Math.floor(index/boundsCountOnAxis)*boundSize-world.LimitBoundSize/2
	};
}

function distanceToBoxBorder(position,direction,boxSize) {
	let t11 = (boxSize - position.x) / direction.x;
	let t12 = (-boxSize - position.x) / direction.x;
	let t21 = (boxSize - position.y) / direction.y;
	let t22 = (-boxSize - position.y) / direction.y;
	if (isNaN(t11)) t11 = Infinity;
	if (isNaN(t12)) t12 = Infinity;
	if (isNaN(t21)) t21 = Infinity;
	if (isNaN(t22)) t22 = Infinity;
	return Math.min(Math.max(t11,t12),Math.max(t21,t22));
}

function getAllParticlesVelocity() {
	let v = {x:0,y:0};
	for (let i = 0; i < particles.length; i++) {
		v.x += particles[i].vel.x;
		v.y += particles[i].vel.y;
	}
	return { x: v.x / particles.length, y:v.y / particles.length};
}

//TODO1 Make groups of particles for attract
//TODO2 Make groups of particles for collision detection (optional)
//TODO3 Make record of particles position
//TODO4 Make ui for recording and show record

//TODO5 Bug: after some time, particles disappear
//TODO6 Bug: particles in group slow down when attract to other particle

var radiusModifier = 1;
var averagingRadiusModifier = 0.2;
var averageRadiusTarget = 1392000000 * radiusModifier;
var particlesToDelete = [];

// particles.push(new particle({
// 	x: 0, y: 0 //-((1006)*10e12/(2*10e13))
// }, {
// 	x: -30, y: 0 //Math.sqrt(world.GravityConstant * 10e12 / ((1006)))/3.15
// }, 0.01, 50, "rgb(242,161,62)"));

particles.push(new particle({
	x: 0, y: 0
}, {
	x: 0, y: 0
}, 10e12, 50, "rgb(242,161,62)"));
for (let i = 0; i < 1; i++) {
	for (let j = 0; j < 400; j++) {
		let randomAngle = Math.random() * 360;
		let rCloud = 1606 + i * 0;
		let rLocal = rCloud + (-1+Math.random()*2)*400;
		let m = 5e11;
		let v = -Math.sqrt(world.GravityConstant * particles[0].mass / rLocal) * 3.0;


		let dir = Math.round(Math.random()) * 2 - 1;
		dir = 1;

		particles.push(new particle({
			x: math.cos(randomAngle)*rLocal,
			y: math.sin(randomAngle)*rLocal
		}, {
			x: math.cos(randomAngle+90)*v*dir,
			y: math.sin(randomAngle+90)*v*dir
		}, m, 8, "gray", 0, "red"))
	}
}
for (let i = 0; i < 0; i++) {
	let m = 10e10;

	let vp = Math.random()*2*Math.PI;
	let p = Math.random()*4000;

	let va = Math.random()*2*Math.PI;
	let v = 5+Math.random();
	particles.push(new particle({x:Math.cos(vp)*p,y:Math.sin(vp)*p},{x:Math.cos(va)*v,y:Math.sin(va)*v},m,8,"gray",0,"red"));
}

document.addEventListener("wheel", (e)=>{
	world.ViewScale += camera.zoomSpeed * (world.ViewScale / world._StartViewScale) * -(e.deltaY / 100);
	if (world.ViewScale < 0)
		world.ViewScale = 0;
});

function killParticle(x) {
	particles.splice(x, 1);
	bounds[particles[x].boundIndex].objects.splice(particles[x].inBoundObjIndex,1);
}

var background = {
	_stars: [],
	init: function (particlesCount) {
		for (let i = 0; i < particlesCount; i++) {
			this._stars.push({
				x: Math.floor(Math.random() * canv.width),
				y: Math.floor(Math.random() * canv.height),
				radius: 0.5,
				clr: inRgb(231, 157, 0, 0.5)
			});
		}
	},
	draw: function () {
		for (let i = 0; i < this._stars.length; i++) {
			d.circle(this._stars[i].x, this._stars[i].y, this._stars[i].radius, this._stars[i].clr);
		}
	}
};
background.init(200);

var gridToggleFunction = ui.toggleGrid();

var lastRender = new Date();

var createParticlesTrigger = false;

var frame = 0;
var averageFpsCounter = 0;
var averageFpsFrame = 0;
var FPS = 0;

let momentGravityBodyIndex = 0;
let isHaveMomentBody = false;

let isLineDrawing = false;
let lineDrawingStartPosistion;


function momentBody() {
	if (input.keyboard.char == "g" && !isHaveMomentBody) {
		isHaveMomentBody = true;
		particles.push(new particle(camera.toWorld(input.mouse.position), {x:0,y:0},10e12, 2, "Gray"));
		momentGravityBodyIndex = particles.length-1;
		particles[momentGravityBodyIndex].isCanCollide = false;
	}
	if (input.keyboard.char == "g" && isHaveMomentBody) {
		particles[momentGravityBodyIndex].pos = camera.toWorld(input.mouse.position);
		particles[momentGravityBodyIndex].vel = { x: 0, y: 0 };
		ui.isBlocked = true;
	}
	if (input.keyboard.char == "" && isHaveMomentBody) {
		isHaveMomentBody = false;
		particles.splice(momentGravityBodyIndex,1);
	}
}
function pauseLineDrawing() {
		if (!isLineDrawing && input.keyboard.char == 'v') {
			isLineDrawing = true;
			lineDrawingStartPosistion = input.mouse.position;
		}
		if (isLineDrawing) {
			d.line(lineDrawingStartPosistion.x,lineDrawingStartPosistion.y,input.mouse.position.x,input.mouse.position.y,"white");
			d.txt(magnitudeVec(minusVec(camera.toWorld(lineDrawingStartPosistion),camera.toWorld(input.mouse.position))).toString(),(input.mouse.position.x+lineDrawingStartPosistion.x)/2,(input.mouse.position.y+lineDrawingStartPosistion.y)/2);
		}
		if (isLineDrawing && input.keyboard.char == '') {
			isLineDrawing = false;
		}
}

let particlesCounter = particles.length;

// ui.hoverOnParticle(1);
function render() {
	world.DeltaTime = new Date() - lastRender;
	lastRender = new Date();
	camera.offsetUpdate();

	// if (frame % 20 != 0) {
	// 	frame+=1;
	// 	requestAnimationFrame(render);
	// 	return;
	// }

	if (input.keyboard.isKeyDown(32)) {
		world.IsPaused = !world.IsPaused;
	}
	if (input.keyboard.code == 96) {
		camera.toParticle(0);
	}
	if (input.mouse.click == 1 && !createParticlesTrigger) {
		var cloudRadius = 1;
		var cloudVelocityLimit = 0.005;
		for (var i = 0; i < 1; i++) {
			let pos = {
				x: camera.toWorld(input.mouse).x + (-1 + Math.random() * 2) * cloudRadius,
				y: camera.toWorld(input.mouse).y + (-1 + Math.random() * 2) * cloudRadius
			};
			let dir = math.normalize({
				x: -1 + Math.random() * 2,
				y: -1 + Math.random() * 2
			});
			let vel = {
				x: dir.x * cloudVelocityLimit,
				y: dir.y * cloudVelocityLimit
			};
			let r = 5;
			particles.push(new particle(pos, vel, 10e12, r, inRgb(Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255))));
		}
	}
	momentBody();
	(input.mouse.click == 0) ? createParticlesTrigger = false : createParticlesTrigger = true;

	ctx.clearRect(0, 0, canv.width, canv.height);

	// d.txt((debugV/Math.max(frame,1)).toFixed(4).toString(),0,100,"18px Arial","white");
	if (!camera.isReplayRecorded) {
		for (let s = 0; s < world.SimulationSpeed; s++) {	
			let collisions = [];
			for (let i = 0; i < particles.length && !world.IsPaused; i++) {
				if (particles[i].isFreezed) continue;				
				let trueVel = {x:particles[i].vel.x*world.NotPhysicSimulationSpeed,y:particles[i].vel.y*world.NotPhysicSimulationSpeed};
				
				let thisCollisions = particles[i].isCollideWithAnybody(i);
				// for (let j = 0; j < thisCollisions.length; j++) {
				// 	collisions.push(thisCollisions[j]);
				// }
				collisions.push(thisCollisions);

				for (let j = 0; j < particles.length; j++) {
					if (particles[j].isFreezed) continue;
					if (i==j) continue;
					particles[i].attractTo(particles[j].pos,particles[j].mass,particles[j].radius);
				}
			}
			// ctx.stroke();
			for (let i = 0; i < bounds.length; i++) {
				bounds[i].objects = [];
				bounds[i].lineWidth = 0.01;
				bounds[i].color = "gray";
			}
			for (let i = 0; i < collisions.length; i++) {
				for (let j = 0; j < collisions[i].length; j++) {
					let nParticle = particles[collisions[i][j]];
					if (nParticle.isFreezed) continue;
					particles[i].onCollide(nParticle.vel,nParticle.mass);
				}
			}
			for (var i = 0; i < particles.length; i++) {
				if (particles[i].isFreezed) continue;

				if (!world.IsPaused) {
					particles[i].pos.x += particles[i].vel.x * world.NotPhysicSimulationSpeed;
					particles[i].pos.y += particles[i].vel.y * world.NotPhysicSimulationSpeed;
				}
				
				if (particles[i].pos.x < -world.LimitBoundSize/2 || particles[i].pos.x > world.LimitBoundSize/2 ||
					particles[i].pos.y < -world.LimitBoundSize/2 || particles[i].pos.y > world.LimitBoundSize/2) {
					// particles[i].isFreezed = true;
					// particlesCounter--;
				} else {
					let boundIndex = getBoundIndexByPosition(particles[i].pos);
					if (boundIndex > 0 && boundIndex < bounds.length && particles[i].isCanCollide) {
						bounds[boundIndex].color = "red";
						bounds[boundIndex].lineWidth += particles[i].radius*0.9;
						bounds[boundIndex].objects.push(i);
						particles[i].inBoundObjIndex = bounds[boundIndex].objects.length-1;
						particles[i].boundIndex = boundIndex;
					}
				}

				// d.ray(camera.toViewport(particles[i].pos).x,camera.toViewport(particles[i].pos).y,particles[i].vel,math.magnitude(particles[i].vel)*world.ViewScale);
				
			}
		}
		for (let i = 0; i < particles.length; i++) {
			ctx.beginPath();
			particles[i].draw();
			ctx.fill();
		}
		
		for (let i = 0; i < debugLines.length; i++) {
			d.ray(camera.toViewport(debugLines[i].pos).x,camera.toViewport(debugLines[i].pos).y,debugLines[i].vel,10,debugLines[i].color);
		}
	} else {
		camera.replayRecorded();
	}
	if (input.keyboard.char == 'c') {
		d.txt(bounds[getBoundIndexByPosition(camera.toWorld(input.mouse.position))].objects,input.mouse.position.x,input.mouse.position.y);
	}
	for (let i = 0; i < bounds.length && input.keyboard.char == 'f'; i++) {
		bounds[i].debugDraw();
	}
	gridToggleFunction();
	if (ui.isGridVisible)
		ui.grid(world.GridScale);
	// background.draw();
	pauseLineDrawing();

	let min = camera.toViewport({ x: -world.LimitBoundSize/2, y: -world.LimitBoundSize/2 });
	let max = camera.toViewport({ x: world.LimitBoundSize/2, y: world.LimitBoundSize/2 });
	d.rect(min.x,min.y,max.x-min.x,max.y-min.y,"white","white",0.1,false);
	
	if (camera.isRecording) {
		camera.record();
	}

	ui.generalCycle();
	d.txt("Paticles count: " + particlesCounter, 0, 16, "16px Arial", "white");
	d.txt("FPS: " + FPS.toFixed(2), 0, 32, "16px Arial", "white");
	d.txt("Frame: " + frame, 0, 48, "16px Arial", "white");
	averageFpsCounter += (1000 / world.DeltaTime);
	let n = 2;
	if (averageFpsFrame++ >= n) {
		FPS = averageFpsCounter / (n+1);
		averageFpsCounter = 0;
		averageFpsFrame = 0;
	}
	frame++;
	debug = requestAnimationFrame(render);
};
render(1);
document.oncontextmenu = function () {
	return false;
}
window.document.hasFocus = new function () { return true;}