struct Params {
    particleCount: u32,
}

struct Particle {
    position: vec3<f32>,
    hidden: u32,
    velocity: vec3<f32>,
    mass: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;


@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.particleCount || particles[index].hidden == 1) {
        return;
    }

    let pos = particles[index].position;
    let vel = particles[index].velocity;

    // Merge particles that collide, using conservation of momentum
    for (var i = 0u; i < params.particleCount; i++) {
        if (i != index) {
            let other_pos = particles[i].position;
            let dir = other_pos - pos;
            let dist = length(dir);

            let r1 = max(abs(pow(particles[index].mass, 1.0/3.0))*0.01, 0.001);
            let r2 = max(abs(pow(particles[i].mass, 1.0/3.0))*0.01, 0.001);

            if (dist < (r1+r2)*2 && abs(particles[index].mass) > abs(particles[i].mass)) {
                particles[index].velocity = (particles[index].velocity * particles[index].mass + particles[i].velocity * particles[i].mass) / (particles[index].mass + particles[i].mass);
                particles[index].mass += particles[i].mass * 0.2;
                particles[i].hidden = 1;
            }
        }
    }

    // Calculate gravity
    var force = vec3<f32>(0.0);
    for (var i = 0u; i < params.particleCount; i++) {
        if(particles[i].hidden == 1) { continue; }
        if (i != index) {
            let other_pos = particles[i].position;
            let dir = other_pos - pos;
            let dist = length(dir);

            force += normalize(dir) * (particles[index].mass * particles[i].mass) * (1.0 / (dist * dist));
        }
    }

    // force = vec3<f32>(0.0);
    force = force * 0.01;

    // Update data
    let new_vel = vel + force * 0.016 / particles[index].mass;
    let new_pos = pos + new_vel * 0.016;

    // Is this causing a race contidion? Might have to use 2 buffers and ping-pong
    particles[index].position = new_pos;
    particles[index].velocity = new_vel;
}
