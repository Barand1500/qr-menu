import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { imageUrl } from '@/lib/api';

export type TableVariant = 'welcome' | 'menu' | 'detail';
export interface TableItem {
  id: number;
  imageUrl?: string | null;
  name?: string;
  meta?: string;
}
export interface TableRenderer {
  update: (items: TableItem[], seed: number, entering: boolean) => void;
  turn: (angle: number) => void;
  dispose: () => void;
}
interface Callbacks {
  activate: (id: number) => void;
  lost: () => void;
  project?: (points: { id: number; x: number; y: number; visible: boolean }[]) => void;
}

/** Real geometry for the setting; live product photographs remain faithful to the menu. */
export function createTableRenderer(
  host: HTMLDivElement,
  variant: TableVariant,
  callbacks: Callbacks
): TableRenderer {
  const view = host.ownerDocument.defaultView!;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const environmentRoom = new RoomEnvironment();
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentRoom, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  environmentRoom.dispose();
  pmrem.dispose();
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 80);
  const target = new T.Vector3();
  const pointer = new T.Vector2();
  const raycaster = new T.Raycaster();
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const light = new T.DirectionalLight('#fff0d8', 2.6);
  light.position.set(-4, 9, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -10;
  light.shadow.camera.right = 10;
  light.shadow.camera.top = 9;
  light.shadow.camera.bottom = -9;
  light.shadow.normalBias = 0.035;
  light.shadow.bias = -0.0001;
  scene.add(light, new T.HemisphereLight('#fff8ec', '#8c7860', 0.8));
  const fill = new T.DirectionalLight('#dce8f1', 1.2);
  fill.position.set(6, 5, -6);
  scene.add(fill);
  const world = new T.Group();
  scene.add(world);
  let disposed = false,
    lostContext = false,
    frame = 0,
    budget = 0,
    progress = 0,
    entry = 0,
    rotation = 0,
    wantedRotation = 0,
    angle = 0,
    wantedAngle = 0,
    entering = false,
    contentSignature = '';
  let lastFrame = 0;
  let plateRoot = new T.Group();
  world.add(plateRoot);
  let dishes: { id: number; group: T.Group; scale: number; position: T.Vector3 }[] = [];
  const resources = new Set<T.Texture>();
  const materials: T.Material[] = [];
  const geometries: T.BufferGeometry[] = [];
  const ownGeometry = <G extends T.BufferGeometry>(g: G) => {
    geometries.push(g);
    return g;
  };
  const mat = (p: T.MeshStandardMaterialParameters) => {
    const m = new T.MeshStandardMaterial(p);
    materials.push(m);
    return m;
  };
  const ceramic = mat({ color: '#f6f0df', roughness: 0.26, metalness: 0.04 });
  const ceramicEdge = mat({ color: '#617568', roughness: 0.38, metalness: 0.12 });
  const steel = mat({ color: '#c5bfb5', metalness: 1, roughness: 0.24 });
  const weaveCanvas = host.ownerDocument.createElement('canvas');
  weaveCanvas.width = weaveCanvas.height = 128;
  const weave = weaveCanvas.getContext('2d')!;
  weave.fillStyle = '#b6ae94';
  weave.fillRect(0, 0, 128, 128);
  for (let n = 0; n < 128; n += 2) {
    weave.fillStyle = n % 4 ? '#c1baa1' : '#afa58a';
    weave.fillRect(n, 0, 1, 128);
    weave.fillRect(0, n, 128, 1);
  }
  const weaveTexture = new T.CanvasTexture(weaveCanvas);
  weaveTexture.wrapS = weaveTexture.wrapT = T.RepeatWrapping;
  weaveTexture.repeat.set(8, 26);
  resources.add(weaveTexture);
  const linen = mat({
    color: '#d4cfb9',
    map: weaveTexture,
    bumpMap: weaveTexture,
    bumpScale: 0.012,
    roughness: 1,
  });
  const darkWood = mat({ color: '#392d25', roughness: 0.68 });
  function mesh(
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: T.Object3D = world
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function woodTexture() {
    const canvas = host.ownerDocument.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#b29a7b';
    c.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y++) {
      const tone = 106 + Math.round(12 * Math.sin(y * 0.33) + 7 * Math.sin(y * 1.42));
      c.strokeStyle = `rgba(${tone},${tone - 27},${tone - 48},.18)`;
      c.lineWidth = y % 19 === 0 ? 1.5 : 0.6;
      c.beginPath();
      for (let x = 0; x <= 1024; x += 16) {
        const yy = y + Math.sin(x * 0.006 + y * 0.02) * 3 + Math.sin(x * 0.014 + y * 0.17) * 0.8;
        x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
      }
      c.stroke();
    }
    const tx = new T.CanvasTexture(canvas);
    tx.colorSpace = T.SRGBColorSpace;
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    tx.repeat.set(3, 2);
    resources.add(tx);
    return tx;
  }
  const woodMap = woodTexture();
  const oak = mat({
    color: '#897560',
    map: woodMap,
    bumpMap: woodMap,
    bumpScale: 0.018,
    roughness: 0.69,
  });
  const table = mesh(
    ownGeometry(new T.CylinderGeometry(6.4, 6.4, 0.26, 96)),
    oak,
    variant === 'welcome' ? 2 : 0,
    -0.17,
    0
  );
  table.scale.set(1.25, 1, 0.85);
  const shadow = new T.ShadowMaterial({ color: '#35432f', opacity: 0.12 });
  materials.push(shadow);
  const floor = mesh(ownGeometry(new T.PlaneGeometry(60, 60)), shadow, 0, -1.1, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  const clothGeometry = ownGeometry(new T.PlaneGeometry(2.1, 9.5, 20, 60));
  clothGeometry.rotateX(-Math.PI / 2);
  const clothPositions = clothGeometry.getAttribute('position');
  for (let i = 0; i < clothPositions.count; i++) {
    clothPositions.setY(
      i,
      0.012 +
        Math.sin(clothPositions.getX(i) * 22 + clothPositions.getZ(i) * 0.9) * 0.003 +
        Math.sin(clothPositions.getZ(i) * 2) * 0.005
    );
  }
  clothGeometry.computeVertexNormals();
  const cloth = mesh(clothGeometry, linen, variant === 'welcome' ? 3.4 : 3.9, 0, -0.2);
  cloth.rotation.y = 0.14;
  const plateProfile = [
    [0, -0.06],
    [0.7, -0.06],
    [0.92, -0.035],
    [1.19, 0.06],
    [1.25, 0.12],
    [1.23, 0.17],
    [1.12, 0.17],
    [0.91, 0.037],
    [0, 0.037],
  ].map(([x, y]) => new T.Vector2(x, y));
  const plateGeometry = ownGeometry(new T.LatheGeometry(plateProfile, 80));
  const rimGeometry = ownGeometry(new T.TorusGeometry(1.205, 0.012, 8, 96));
  const diskGeometry = ownGeometry(new T.CircleGeometry(0.91, 80));
  function placeSetting(x: number, z: number, size = 1, turn = 0) {
    const g = new T.Group();
    g.position.set(x, 0.04, z);
    g.rotation.y = turn;
    g.scale.setScalar(size);
    world.add(g);
    const napkin = mesh(ownGeometry(new T.BoxGeometry(0.48, 0.06, 1.65)), linen, 1.68, 0.02, 0, g);
    napkin.rotation.y = 0.04;
    const forkHandle = mesh(
      ownGeometry(new T.CapsuleGeometry(0.045, 1.32, 4, 10)),
      steel,
      -1.55,
      0.04,
      0.15,
      g
    );
    forkHandle.rotation.x = Math.PI / 2;
    const forkHead = mesh(
      ownGeometry(new T.SphereGeometry(1, 20, 12)),
      steel,
      -1.55,
      0.04,
      -0.65,
      g
    );
    forkHead.scale.set(0.14, 0.024, 0.23);
    for (let n = 0; n < 4; n++)
      mesh(
        ownGeometry(new T.BoxGeometry(0.035, 0.04, 0.28)),
        steel,
        -1.66 + n * 0.073,
        0.04,
        -1.02,
        g
      );
    const knifeHandle = mesh(
      ownGeometry(new T.CapsuleGeometry(0.055, 1.1, 4, 12)),
      steel,
      1.55,
      0.09,
      0.17,
      g
    );
    knifeHandle.rotation.x = Math.PI / 2;
    const blade = mesh(ownGeometry(new T.SphereGeometry(1, 24, 16)), steel, 1.59, 0.09, -0.65, g);
    blade.scale.set(0.095, 0.025, 0.58);
    const ring = mesh(
      ownGeometry(new T.TorusGeometry(0.26, 0.025, 8, 40)),
      steel,
      1.67,
      0.07,
      0.1,
      g
    );
    ring.rotation.x = -Math.PI / 2;
  }
  placeSetting(
    variant === 'welcome' ? 2.5 : 0,
    0.35,
    variant === 'welcome' ? 1.3 : variant === 'detail' ? 1.5 : 1.2,
    variant === 'welcome' ? -0.12 : 0.08
  );
  function tumbler(x: number, z: number) {
    const glass = new T.MeshPhysicalMaterial({
      color: '#c9e0d7',
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      metalness: 0.12,
      side: T.DoubleSide,
    });
    materials.push(glass);
    const points = [
      [0.28, 0],
      [0.31, 0.03],
      [0.35, 1],
      [0.37, 1],
      [0.33, 0.03],
      [0.28, 0],
    ].map(([a, b]) => new T.Vector2(a, b));
    const cup = mesh(ownGeometry(new T.LatheGeometry(points, 48)), glass, x, 0.025, z);
    cup.castShadow = false;
    const edge = mesh(ownGeometry(new T.TorusGeometry(0.36, 0.012, 8, 48)), steel, x, 1.03, z);
    edge.rotation.x = Math.PI / 2;
    edge.castShadow = false;
  }
  tumbler(variant === 'welcome' ? 4.6 : 2.1, -2.05);
  tumbler(variant === 'welcome' ? -0.5 : -3.5, -3.2);
  function mill(x: number, z: number, size: number) {
    const profile = [
      [0.18, 0],
      [0.26, 0.07],
      [0.22, 0.17],
      [0.16, 0.35],
      [0.13, 0.72],
      [0.18, 0.95],
      [0.28, 1.08],
      [0.3, 1.24],
      [0.2, 1.4],
      [0, 1.43],
    ].map(([a, b]) => new T.Vector2(a, b));
    const m = mesh(ownGeometry(new T.LatheGeometry(profile, 40)), darkWood, x, 0, z);
    m.scale.setScalar(size);
    mesh(ownGeometry(new T.SphereGeometry(0.04, 12, 10)), steel, x, 1.47 * size, z);
  }
  mill(variant === 'welcome' ? -0.5 : -4.5, variant === 'welcome' ? -1.3 : -3.5, 1);
  mill(variant === 'welcome' ? -0.9 : -5, variant === 'welcome' ? -1.5 : -3.8, 0.8);
  // A sparse sculptural olive branch, modelled with geometry rather than a stock image.
  const leafMat = mat({ color: '#52684b', roughness: 0.9 });
  const branch = new T.Group();
  branch.position.set(variant === 'welcome' ? 5 : -4.5, 0.05, 2.4);
  branch.rotation.y = -0.7;
  world.add(branch);
  const stem = mesh(
    ownGeometry(new T.CylinderGeometry(0.013, 0.02, 2.3, 8)),
    darkWood,
    0,
    0.05,
    0,
    branch
  );
  stem.rotation.z = Math.PI / 2;
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(
      ownGeometry(new T.SphereGeometry(1, 14, 8)),
      leafMat,
      -1 + i * 0.24,
      0.09,
      (i % 2 ? 1 : -1) * 0.16,
      branch
    );
    leaf.scale.set(0.25, 0.025, 0.09);
    leaf.rotation.y = (i % 2 ? 1 : -1) * 0.55;
  }
  const textures = new Map<string, T.Texture>();
  const photoMaterials: T.Material[] = [];
  const loader = new T.TextureLoader();
  function wake(count = 65) {
    if (disposed || lostContext) return;
    if (reduced.matches) count = 1;
    budget = Math.max(budget, count);
    if (!frame && !host.ownerDocument.hidden) frame = view.requestAnimationFrame(draw);
  }
  function photo(url: string) {
    const cached = textures.get(url);
    if (cached) return cached;
    const tx = loader.load(
      url.startsWith('blob:') ? url : imageUrl(url),
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = T.SRGBColorSpace;
        const image = loaded.image as HTMLImageElement;
        const ratio = (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
        const factor = Math.min(1, 1024 / Math.max(image.width, image.height));
        if (factor < 1) {
          const canvas = host.ownerDocument.createElement('canvas');
          canvas.width = Math.round(image.width * factor);
          canvas.height = Math.round(image.height * factor);
          canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
          (loaded as T.Texture<HTMLImageElement | HTMLCanvasElement>).image = canvas;
          loaded.needsUpdate = true;
        }
        if (ratio > 1) {
          loaded.repeat.x = 1 / ratio;
          loaded.offset.x = (1 - loaded.repeat.x) / 2;
        } else {
          loaded.repeat.y = ratio;
          loaded.offset.y = (1 - ratio) / 2;
        }
        loaded.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        wake(3);
      },
      undefined,
      () => {
        if (!disposed) {
          callbacks.lost();
          wake(2);
        }
      }
    );
    tx.colorSpace = T.SRGBColorSpace;
    textures.set(url, tx);
    resources.add(tx);
    return tx;
  }
  function update(items: TableItem[], seed: number, isEntering: boolean) {
    if (disposed) return;
    entering = isEntering;
    const signature = JSON.stringify([items.map((item) => [item.id, item.imageUrl]), seed]);
    if (signature === contentSignature) {
      wake(70);
      return;
    }
    contentSignature = signature;
    world.remove(plateRoot);
    photoMaterials.splice(0).forEach((m) => m.dispose());
    plateRoot = new T.Group();
    world.add(plateRoot);
    dishes = [];
    const keep = new Set(items.map((item) => item.imageUrl));
    for (const [url, texture] of textures) {
      if (textures.size <= 8) break;
      if (!keep.has(url)) {
        texture.dispose();
        resources.delete(texture);
        textures.delete(url);
      }
    }
    const layouts =
      variant === 'welcome'
        ? [[2.5, 0.35, 1.3]]
        : variant === 'detail'
          ? [[0, 0.35, 1.5]]
          : [
              [0, 0.45, 1.25],
              [-3.2, -2.1, 0.8],
              [3.2, -2.2, 0.8],
            ];
    items.slice(0, layouts.length).forEach((item, i) => {
      const [x, z, s] = layouts[i];
      const g = new T.Group();
      g.position.set(x, 0.04, z);
      g.scale.setScalar(s);
      plateRoot.add(g);
      mesh(plateGeometry, ceramic, 0, 0, 0, g);
      const rim = mesh(rimGeometry, ceramicEdge, 0, 0.155, 0, g);
      rim.rotation.x = Math.PI / 2;
      if (item.imageUrl) {
        const material = new T.MeshBasicMaterial({ map: photo(item.imageUrl), toneMapped: false });
        photoMaterials.push(material);
        const face = mesh(diskGeometry, material, 0, 0.041, 0, g);
        face.rotation.x = -Math.PI / 2;
        face.castShadow = false;
      }
      g.traverse((o) => {
        o.userData.productId = item.id;
      });
      dishes.push({ id: item.id, group: g, scale: s, position: new T.Vector3(x, 0.04, z) });
    });
    wantedAngle = Math.sin(seed * 1.7) * 0.1;
    entering = isEntering;
    entry = 0;
    renderer.shadowMap.needsUpdate = true;
    wake(100);
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    wake(10);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let dragging = false,
    downX = 0,
    downY = 0,
    initialRotation = 0,
    moved = false;
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    initialRotation = wantedRotation;
    moved = false;
    dragging = variant === 'detail';
    if (dragging) renderer.domElement.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
    if (dragging) wantedRotation = initialRotation + (e.clientX - downX) * 0.009;
    wake(35);
  };
  const up = (e: PointerEvent) => {
    if (dragging) {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
      return;
    }
    if (moved) return;
    const r = host.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(plateRoot, true)[0];
    if (hit?.object.userData.productId != null) callbacks.activate(hit.object.userData.productId);
  };
  const leave = () => {
    if (!dragging) {
      pointer.set(0, 0);
      wake(30);
    }
  };
  const lost = (e: Event) => {
    e.preventDefault();
    lostContext = true;
    view.cancelAnimationFrame(frame);
    frame = 0;
    callbacks.lost();
  };
  const cancelPointer = () => {
    dragging = false;
  };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancelPointer);
  renderer.domElement.addEventListener('pointerleave', leave);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const visibility = () => {
    if (host.ownerDocument.hidden) {
      view.cancelAnimationFrame(frame);
      frame = 0;
    } else wake(20);
  };
  host.ownerDocument.addEventListener('visibilitychange', visibility);
  function draw(time: number) {
    frame = 0;
    if (disposed || lostContext || host.ownerDocument.hidden) return;
    const delta = lastFrame ? Math.min(120, Math.max(1, time - lastFrame)) : 16.67;
    lastFrame = time;
    const ease = reduced.matches ? 1 : 1 - Math.exp(-delta / 180);
    progress = T.MathUtils.lerp(progress, entering ? 1 : 0, ease);
    entry = T.MathUtils.lerp(entry, 1, ease);
    angle = T.MathUtils.lerp(angle, wantedAngle, ease);
    rotation = T.MathUtils.lerp(
      rotation,
      wantedRotation,
      reduced.matches ? 1 : 1 - Math.exp(-delta / 100)
    );
    const parallax = reduced.matches ? 0 : 0.11;
    if (variant === 'welcome') {
      camera.position.set(0.5 + pointer.x * parallax, 9.8 - progress * 2.3, 11.5 - progress * 2);
      target.set(1.2 + progress * 0.7, 0, 0.2);
    } else if (variant === 'detail') {
      camera.position.set(
        Math.sin(angle) * 9 + pointer.x * parallax,
        8.7 + (1 - entry) * 1.3,
        9.2 + (1 - entry) * 2
      );
      target.set(0, 0, 0.35);
    } else {
      camera.position.set(Math.sin(angle) * 10 + pointer.x * parallax, 10.1, 10.2);
      target.set(0, 0, -0.3);
    }
    camera.lookAt(target);
    dishes.forEach((d, i) => {
      d.group.position.copy(d.position);
      d.group.position.y += (1 - entry) * (0.5 + i * 0.14);
      d.group.rotation.y = variant === 'detail' ? rotation : angle;
    });
    renderer.shadowMap.needsUpdate = budget > 5;
    renderer.render(scene, camera);
    const rect = host.getBoundingClientRect();
    callbacks.project?.(
      dishes.map((d) => {
        const point = d.position
          .clone()
          .add(new T.Vector3(0, 0.05, 1.55 * d.scale))
          .project(camera);
        return {
          id: d.id,
          x: (point.x * 0.5 + 0.5) * rect.width,
          y: (-point.y * 0.5 + 0.5) * rect.height,
          visible: Math.abs(point.x) < 1 && Math.abs(point.y) < 1,
        };
      })
    );
    budget -= delta / 16.67;
    if (budget > 0) frame = view.requestAnimationFrame(draw);
  }
  resize();
  wake(100);
  return {
    update,
    turn: (amount) => {
      wantedRotation += amount;
      wake(45);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      view.cancelAnimationFrame(frame);
      observer.disconnect();
      host.ownerDocument.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancelPointer);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      photoMaterials.forEach((m) => m.dispose());
      resources.forEach((t) => t.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
