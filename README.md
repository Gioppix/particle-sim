# WebGPU Particle Simulator

A GPU-accelerated N-body particle simulation using WebGPU.
Simulates gravity and collisions between thousands of particles in real-time.

## Features

- N-body gravitational simulation with 1000s of particles
- Particle collisions and merging with conservation of momentum
- GPU-accelerated computation using WebGPU compute shaders
- Interactive 3D camera controls
- Billboarded particle rendering with size and color based on mass

## Technical Details

- WebGPU for GPU compute and graphics
- WGSL shaders for particle physics and rendering
- Compute shader handles particle updates in parallel
- Point sprite rendering with geometry generated in vertex shader

## Try it

Requires a browser with WebGPU support (e.g. Chrome).

## Controls

- Click and drag to rotate view
- Mouse wheel to zoom

## Demo

https://github.com/user-attachments/assets/7173b9d7-3346-4eb8-8d48-4668707d7702
