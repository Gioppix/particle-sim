struct Uniforms {
   viewProjectionMatrix: mat4x4<f32>,
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
   @builtin(position) position: vec4<f32>,
   @location(0) color: vec4<f32>,
   @location(1) @interpolate(flat) size: f32,
   @location(2) uv: vec2<f32>,
}

@vertex
fn vertexMain(
   @location(0) position: vec3<f32>,
   @location(1) mass: f32,
   @location(2) hidden: u32,
   @builtin(vertex_index) vertexIndex: u32,
) -> VertexOutput {
   var output: VertexOutput;

   let vertices = array<vec2<f32>, 6>(
       vec2(-1.0, -1.0),
       vec2( 1.0, -1.0),
       vec2( 1.0,  1.0),
       vec2(-1.0, -1.0),
       vec2( 1.0,  1.0),
       vec2(-1.0,  1.0)
   );

   let particleSize = max(abs(pow(mass, 1.0/3.0))*0.01, 0.001);

   // Project the position first
   let projected = uniforms.viewProjectionMatrix * vec4(position, 1.0);

   // Add billboard offset in screen space
   let offset = vertices[vertexIndex] * particleSize;
   output.position = vec4(
       projected.xy + offset * projected.w,
       projected.z,
       projected.w
   );

   output.uv = vertices[vertexIndex];
   output.size = particleSize;

   if(hidden == 1) {
       output.color = vec4(0.0, 1.0, 0.0, 0.0);
   } else {
       output.color = vec4(mass, 0.0, 1.0 - mass, 1.0);
   }

   return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
   let dist = length(input.uv);
   if (dist > 1.0) {
       discard;
   }
   return input.color;
}
