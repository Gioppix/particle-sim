import { mat4, vec3 } from 'wgpu-matrix';

import renderShader from './renderShader.wgsl?raw';
import computeShader from './computeShader.wgsl?raw';

export async function init(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) throw 'No GPU Adapter';
	const device = await adapter.requestDevice();

	const context = canvas.getContext('webgpu')!;
	const format = navigator.gpu.getPreferredCanvasFormat();

	window.addEventListener('resize', resizeCanvas);

	function resizeCanvas() {
		const devicePixelRatio = window.devicePixelRatio || 1;

		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
		canvas.width = window.innerWidth * devicePixelRatio;
		canvas.height = window.innerHeight * devicePixelRatio;
	}
	resizeCanvas();

	context.configure({
		device,
		format,
		alphaMode: 'premultiplied'
	});

	// Camera state
	const camera = {
		position: vec3.create(5, 0, 0),
		target: vec3.create(0, 0, 0),
		rotation: { x: 0, y: 0 },
		zoom: 5,
		dragging: false,
		lastMouseX: 0,
		lastMouseY: 0
	};

	// Camera controls
	canvas.addEventListener('mousedown', (e) => {
		camera.dragging = true;
		camera.lastMouseX = e.clientX;
		camera.lastMouseY = e.clientY;
	});

	canvas.addEventListener('mouseup', () => {
		camera.dragging = false;
	});

	canvas.addEventListener('mousemove', (e) => {
		if (camera.dragging) {
			const deltaX = e.clientX - camera.lastMouseX;
			const deltaY = e.clientY - camera.lastMouseY;

			camera.rotation.y += deltaX * 0.01;
			camera.rotation.x += deltaY * 0.01;

			camera.position[1] = camera.rotation.y;

			camera.lastMouseX = e.clientX;
			camera.lastMouseY = e.clientY;
		}
	});

	canvas.addEventListener('wheel', (e) => {
		camera.zoom += e.deltaY * 0.001;
		camera.zoom = Math.max(1, Math.min(20, camera.zoom));
		e.preventDefault();
	});

	// Update the updateViewProjectionMatrix function:
	function updateViewProjectionMatrix() {
		const viewMatrix = mat4.lookAt(
			camera.position,
			camera.target,
			vec3.create(0, 1, 0) // Up vec
		);
		const projMatrix = mat4.perspective(
			Math.PI / 4, // 45 degrees FOV
			canvas.width / canvas.height,
			0.1,
			100.0
		);
		const viewProjectionMatrix = mat4.multiply(projMatrix, viewMatrix);
		device.queue.writeBuffer(uniformBuffer, 0, viewProjectionMatrix);
	}

	// Uniform buffer for camera matrices
	const uniformBuffer = device.createBuffer({
		size: 4 * 4 * 4, // 4x4 matrix of f32
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	// Rest of the particle setup remains the same
	const particleCount = 2500;
	const particles = new Float32Array(particleCount * 8);
	const INITIAL_BOX_SIZE = 2;
	const INITIAL_MAX_SPEED_COMPONENT = 2;

	for (let i = 0; i < particleCount; i++) {
		const baseIndex = i * 8;
		particles[baseIndex + 0] = (Math.random() - 0.5) * INITIAL_BOX_SIZE * 2;
		particles[baseIndex + 1] = (Math.random() - 0.5) * INITIAL_BOX_SIZE * 2;
		particles[baseIndex + 2] = (Math.random() - 0.5) * INITIAL_BOX_SIZE * 2;
		particles[baseIndex + 3] = 0; // Boolean for hidden and padding
		particles[baseIndex + 4] = (Math.random() - 0.5) * INITIAL_MAX_SPEED_COMPONENT * 2;
		particles[baseIndex + 5] = (Math.random() - 0.5) * INITIAL_MAX_SPEED_COMPONENT * 2;
		particles[baseIndex + 6] = (Math.random() - 0.5) * INITIAL_MAX_SPEED_COMPONENT * 2;
		particles[baseIndex + 7] = (Math.random() - 0.5) * 0.1; // mass and padding
	}

	// Big heavy steady balls
	particles[7] = 1000;
	particles[4] = 0;
	particles[5] = 0;
	particles[6] = 0;

	particles[8 + 7] = 1000;
	particles[8 + 4] = 0;
	particles[8 + 5] = 0;
	particles[8 + 6] = 0;

	// Buffer for particles data
	const particleBuffer = device.createBuffer({
		size: particles.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true
	});
	new Float32Array(particleBuffer.getMappedRange()).set(particles);
	particleBuffer.unmap();

	// Compute to update the simulation
	const computePipeline = device.createComputePipeline({
		layout: 'auto',
		compute: {
			module: device.createShaderModule({ code: computeShader }),
			entryPoint: 'main'
		}
	});

	const renderPipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: {
			module: device.createShaderModule({ code: renderShader }),
			entryPoint: 'vertexMain',
			buffers: [
				{
					arrayStride: 32,
					stepMode: 'instance', // Add this line
					attributes: [
						{
							// Positions
							format: 'float32x3',
							offset: 0,
							shaderLocation: 0
						},
						{
							// Hidden
							format: 'float32',
							offset: 28,
							shaderLocation: 1
						},
						{
							// Mass
							format: 'uint32',
							offset: 3 * 4,
							shaderLocation: 2
						}
					]
				}
			]
		},
		fragment: {
			module: device.createShaderModule({ code: renderShader }),
			entryPoint: 'fragmentMain',
			targets: [
				{
					format,
					blend: {
						color: {
							srcFactor: 'src-alpha',
							dstFactor: 'one-minus-src-alpha'
						},
						alpha: {
							srcFactor: 'one',
							dstFactor: 'one-minus-src-alpha'
						}
					}
				}
			]
		},
		primitive: {
			topology: 'triangle-list'
		}
	});

	// Send parameters to computeShader
	const paramsBuffer = device.createBuffer({
		size: 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([particleCount]));

	const bindGroups = {
		compute: device.createBindGroup({
			layout: computePipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: { buffer: particleBuffer }
				},
				{
					binding: 1,
					resource: { buffer: paramsBuffer }
				}
			]
		}),
		render: device.createBindGroup({
			layout: renderPipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: { buffer: uniformBuffer }
				}
			]
		})
	};

	function frame() {
		// Update the camera
		updateViewProjectionMatrix();

		const commandEncoder = device.createCommandEncoder();

		// Update simulation
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, bindGroups.compute);
		computePass.dispatchWorkgroups(256);
		computePass.end();

		// Update graphics
		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(),
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		});
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, bindGroups.render);
		renderPass.setVertexBuffer(0, particleBuffer);
		renderPass.draw(6, particleCount, 0, 0); // 6 vertices for particle (2 triangles)
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);

		requestAnimationFrame(frame);
	}

	frame();
}
