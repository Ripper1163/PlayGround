import * as THREE from 'three';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
const waveEl = document.getElementById('wave');
const killsEl = document.getElementById('kills');
const zombiesEl = document.getElementById('zombies');
const healthTextEl = document.getElementById('healthText');
const healthFillEl = document.getElementById('healthFill');
const messageEl = document.getElementById('message');
const ammoEl = document.getElementById('ammo');
const weaponEl = document.getElementById('weapon');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a120d);
scene.fog = new THREE.Fog(0x0a120d, 14, 42);

const camera = new THREE.PerspectiveCamera(60, app.clientWidth / app.clientHeight, 0.1, 1000);
camera.position.set(0, 6.5, 10);

const clock = new THREE.Clock();

const player = {
  radius: 1.1,
  health: 100,
  maxHealth: 100,
  speed: 10,
  fireCooldown: 0,
  ammo: 30,
  reserveAmmo: 120,
  weapon: 'Rifle',
  pitch: -0.25,
  yaw: 0,
  dashing: 0,
  hitFlash: 0,
};

const state = {
  pointerActive: false,
  pointerX: 0,
  pointerY: 0,
  kills: 0,
  wave: 1,
  waveTimer: 2,
  zombies: [],
  bullets: [],
  blood: [],
  particles: [],
  nextId: 1,
  isGameOver: false,
};

const world = new THREE.Group();
scene.add(world);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(22, 22, 1.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x1d2d26, roughness: 0.9, metalness: 0.1 })
);
ground.position.y = -0.7;
ground.receiveShadow = true;
world.add(ground);

const road = new THREE.Mesh(
  new THREE.CylinderGeometry(17, 17, 0.3, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f352d, roughness: 0.8, metalness: 0.1 })
);
road.position.y = -0.05;
world.add(road);

for (let i = 0; i < 18; i += 1) {
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2 + Math.random() * 1.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x42594a, roughness: 0.9 })
  );
  const angle = (i / 18) * Math.PI * 2;
  const radius = 15 + Math.random() * 8;
  stone.position.set(Math.cos(angle) * radius, 0.6 + Math.random() * 0.8, Math.sin(angle) * radius);
  stone.castShadow = true;
  stone.receiveShadow = true;
  world.add(stone);
}

const sun = new THREE.DirectionalLight(0xdff5ff, 1.8);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const fill = new THREE.HemisphereLight(0x9fe4ff, 0x1a1f1e, 0.75);
scene.add(fill);

const playerBody = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x7dd0a2, roughness: 0.7, metalness: 0.1 });
const headMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d7be, roughness: 0.9 });

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.3, 4, 8), bodyMaterial);
torso.castShadow = true;
torso.position.y = 1.1;
playerBody.add(torso);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), headMaterial);
head.position.y = 2.25;
head.castShadow = true;
playerBody.add(head);

const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.18, 1.05),
  new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.5, metalness: 0.9 })
);
gun.position.set(0.54, 1.2, 0.9);
gun.rotation.x = 0.1;
gun.castShadow = true;
playerBody.add(gun);

scene.add(playerBody);
playerBody.position.set(0, 0, 0);

const muzzleFlash = new THREE.PointLight(0xffd77a, 0, 4, 2);
muzzleFlash.position.set(1.0, 1.25, 1.45);
playerBody.add(muzzleFlash);

function updateHUD() {
  waveEl.textContent = String(state.wave);
  killsEl.textContent = String(state.kills);
  zombiesEl.textContent = String(state.zombies.length);
  healthTextEl.textContent = `${Math.max(0, Math.round(player.health))}%`;
  healthFillEl.style.width = `${Math.max(0, player.health)}%`;
  ammoEl.textContent = `${player.ammo}/${player.reserveAmmo}`;
  weaponEl.textContent = player.weapon;
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add('visible');
  clearTimeout(showMessage.timeout);
  showMessage.timeout = setTimeout(() => messageEl.classList.remove('visible'), 700);
}

function spawnZombie() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 8;
  const pos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.25 + Math.random() * 0.08, 0.45, 0.42),
    roughness: 0.95,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.2, 4, 8), material);
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshStandardMaterial({ color: 0x94b692, roughness: 0.9 }));
  head.position.y = 2.15;
  head.castShadow = true;
  group.add(head);

  group.position.copy(pos);
  group.rotation.y = Math.PI - angle;
  scene.add(group);

  const zombie = {
    id: state.nextId++,
    mesh: group,
    health: 30 + state.wave * 6,
    speed: 1.5 + state.wave * 0.15 + Math.random() * 0.8,
    radius: 0.9,
    attackCooldown: 0,
  };

  state.zombies.push(zombie);
  updateHUD();
}

function spawnWave() {
  const count = Math.min(6 + state.wave * 2, 30);
  for (let i = 0; i < count; i += 1) spawnZombie();
  showMessage(`Wave ${state.wave}`);
  updateHUD();
}

function shoot() {
  if (state.isGameOver) return;
  if (player.fireCooldown > 0) return;
  if (player.ammo <= 0) {
    player.ammo = 0;
    showMessage('Reloading');
    setTimeout(() => {
      if (state.isGameOver) return;
      player.ammo = Math.min(30, player.reserveAmmo);
      player.reserveAmmo = Math.max(0, player.reserveAmmo - 30);
      updateHUD();
    }, 400);
    return;
  }

  player.ammo -= 1;
  player.fireCooldown = 0.18;
  muzzleFlash.intensity = 2.5;

  const origin = new THREE.Vector3(0, 1.4, 0);
  const direction = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), player.pitch);

  const ray = new THREE.Raycaster(origin, direction.normalize(), 0, 35);
  const hitTargets = state.zombies.map((z) => z.mesh);
  const hits = ray.intersectObjects(hitTargets, true);

  if (hits.length > 0) {
    const target = hits[0].object;
    const zombie = state.zombies.find((z) => z.mesh === target || z.mesh.children.includes(target) || z.mesh === target.parent || z.mesh === target.parent?.parent) || state.zombies[0];
    if (zombie) {
      zombie.health -= 20;
      const hit = new THREE.Vector3().copy(hits[0].point);
      spawnImpactParticles(hit, 0xff7a7a);
      if (zombie.health <= 0) {
        state.kills += 1;
        destroyZombie(zombie);
      }
    }
  } else {
    const end = origin.clone().add(direction.clone().multiplyScalar(18));
    spawnImpactParticles(end, 0xffe6a8);
  }

  updateHUD();
}

function spawnImpactParticles(position, color) {
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
    );
    particle.position.copy(position);
    scene.add(particle);
    state.particles.push({
      mesh: particle,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2),
      life: 0.5 + Math.random() * 0.5,
    });
  }
}

function destroyZombie(zombie) {
  const index = state.zombies.indexOf(zombie);
  if (index >= 0) state.zombies.splice(index, 1);
  scene.remove(zombie.mesh);
  updateHUD();

  if (state.zombies.length === 0) {
    state.wave += 1;
    state.waveTimer = 1.7;
    showMessage(`Wave ${state.wave}`);
  }
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  state.pointerX = x * 2 - 1;
  state.pointerY = y * 2 - 1;
  state.pointerActive = true;
}

function gameLoop() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  if (!state.isGameOver) {
    const move = new THREE.Vector3();
    const direction = new THREE.Vector3();

    if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
      move.copy(direction).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw).multiplyScalar(player.speed * delta);
      playerBody.position.add(move);
    }

    playerBody.position.x = THREE.MathUtils.clamp(playerBody.position.x, -12, 12);
    playerBody.position.z = THREE.MathUtils.clamp(playerBody.position.z, -12, 12);

    playerBody.rotation.y = player.yaw;
    playerBody.rotation.x = 0;

    if (state.pointerActive) {
      const targetYaw = Math.atan2(state.pointerX, 1) + Math.PI;
      player.yaw = THREE.MathUtils.lerp(player.yaw, targetYaw, 0.12);
      player.pitch = THREE.MathUtils.clamp(THREE.MathUtils.lerp(player.pitch, -0.25 + state.pointerY * 0.35, 0.12), -0.8, 0.5);
    }

    const aimVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    camera.position.x = playerBody.position.x + aimVector.x * 5.5;
    camera.position.z = playerBody.position.z + aimVector.z * 5.5;
    camera.position.y = 5.2 + player.pitch * 2.5;
    camera.lookAt(playerBody.position.x, 1.5, playerBody.position.z);

    if (player.fireCooldown > 0) player.fireCooldown -= delta;
    muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - delta * 20);

    for (const zombie of state.zombies) {
      const toPlayer = playerBody.position.clone().sub(zombie.mesh.position);
      const distance = toPlayer.length();
      if (distance > 0.01) {
        toPlayer.normalize();
        zombie.mesh.position.addScaledVector(toPlayer, zombie.speed * delta);
        zombie.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      }
      if (distance < 1.4) {
        zombie.attackCooldown -= delta;
        if (zombie.attackCooldown <= 0) {
          player.health -= 10;
          zombie.attackCooldown = 1.0;
          player.hitFlash = 0.5;
          if (player.health <= 0) {
            player.health = 0;
            state.isGameOver = true;
            showMessage('Game Over');
          }
        }
      }
    }

    for (const bullet of state.bullets) {
      bullet.life -= delta;
      bullet.mesh.position.addScaledVector(bullet.velocity, delta);
      if (bullet.life <= 0) {
        scene.remove(bullet.mesh);
      }
    }
    state.bullets = state.bullets.filter((bullet) => bullet.life > 0);

    for (const particle of state.particles) {
      particle.life -= delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.y -= 2.5 * delta;
      particle.mesh.scale.multiplyScalar(0.98);
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
      }
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    if (state.zombies.length === 0 && state.waveTimer > 0) {
      state.waveTimer -= delta;
      if (state.waveTimer <= 0) {
        spawnWave();
      }
    }

    const targetColor = player.hitFlash > 0 ? 0xff8f8f : 0x7dd0a2;
    torso.material.color.lerp(new THREE.Color(targetColor), 0.12);
    player.hitFlash = Math.max(0, player.hitFlash - delta);

    if (Math.sin(elapsed * 8) > 0.7) {
      ground.rotation.y += delta * 0.1;
    }

    playerBody.position.y = Math.sin(elapsed * 8) * 0.08;
  }

  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

const keys = {};
window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'Space') {
    event.preventDefault();
    shoot();
  }
  if (event.code === 'KeyR') {
    player.ammo = Math.min(30, player.reserveAmmo);
    player.reserveAmmo = Math.max(0, player.reserveAmmo - 30);
    updateHUD();
  }
});
window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});
window.addEventListener('pointerdown', (event) => {
  shoot();
  handlePointerMove(event);
});
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('resize', () => {
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight, false);
});

spawnWave();
updateHUD();
requestAnimationFrame(gameLoop);
