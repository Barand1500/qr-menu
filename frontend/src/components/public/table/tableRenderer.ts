import * as T from 'three';
import { imageUrl } from '@/lib/api';

export type TableVariant = 'welcome' | 'menu' | 'detail';
export interface TableItem {
  id: number;
  imageUrl?: string | null;
  name?: string;
  meta?: string;
}
export interface TableRenderer {
  update: (items: TableItem[]) => void;
  turn: (angle: number) => void;
  dispose: () => void;
}
interface Callbacks {
  lost: () => void;
}

/** Optional photographic plate presentation. No food model, idle animation or camera tracking. */
export function createTableRenderer(host: HTMLDivElement, callbacks: Callbacks): TableRenderer {
  const view = host.ownerDocument.defaultView!;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 7.8, 3.2);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight('#ffffff', '#aaa18c', 2.8));
  const light = new T.DirectionalLight('#ffffff', 3);
  light.position.set(-3, 7, 5);
  scene.add(light);
  const group = new T.Group();
  scene.add(group);
  const profile = [
    [0, 0.12],
    [0.9, 0.12],
    [1.12, 0.14],
    [1.32, 0.23],
    [1.54, 0.27],
    [1.63, 0.24],
    [1.63, 0.18],
    [1.4, 0.12],
    [0.8, 0.04],
    [0, 0.04],
  ];
  const plateGeometry = new T.LatheGeometry(
    profile.map(([x, y]) => new T.Vector2(x, y)),
    96
  );
  const plateMaterial = new T.MeshStandardMaterial({ color: '#fffdf5', roughness: 0.32 });
  group.add(new T.Mesh(plateGeometry, plateMaterial));
  const rimGeometry = new T.TorusGeometry(1.55, 0.009, 8, 96);
  const rimMaterial = new T.MeshStandardMaterial({ color: '#8b9779', roughness: 0.7 });
  const rim = new T.Mesh(rimGeometry, rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.275;
  group.add(rim);
  const photoGeometry = new T.CircleGeometry(1.15, 96);
  const photoMaterial = new T.MeshBasicMaterial({ color: '#eee9dc' });
  const food = new T.Mesh(photoGeometry, photoMaterial);
  food.rotation.x = -Math.PI / 2;
  food.position.y = 0.15;
  group.add(food);
  let disposed = false,
    source = '',
    texture: T.Texture | null = null,
    request = 0;
  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function resize() {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.set(0, camera.aspect < 1 ? 10 : 7.8, camera.aspect < 1 ? 4.1 : 3.2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  function lost(event: Event) {
    event.preventDefault();
    callbacks.lost();
  }
  renderer.domElement.addEventListener('webglcontextlost', lost);
  resize();
  return {
    update(items) {
      const item = items[0];
      if ((item?.imageUrl || '') === source) return;
      source = item?.imageUrl || '';
      const version = ++request;
      texture?.dispose();
      texture = null;
      photoMaterial.map = null;
      photoMaterial.color.set('#eee9dc');
      photoMaterial.needsUpdate = true;
      render();
      if (!source) return;
      new T.TextureLoader().load(
        source.startsWith('blob:') ? source : imageUrl(source),
        (loaded) => {
          if (disposed || version !== request) {
            loaded.dispose();
            return;
          }
          texture = loaded;
          loaded.colorSpace = T.SRGBColorSpace;
          const aspect = loaded.image.width / loaded.image.height;
          if (aspect > 1) {
            loaded.repeat.x = 1 / aspect;
            loaded.offset.x = (1 - loaded.repeat.x) / 2;
          } else {
            loaded.repeat.y = aspect;
            loaded.offset.y = (1 - aspect) / 2;
          }
          photoMaterial.map = loaded;
          photoMaterial.color.set('#ffffff');
          photoMaterial.needsUpdate = true;
          render();
        },
        undefined,
        () => {
          if (!disposed && version === request) callbacks.lost();
        }
      );
    },
    turn(angle) {
      group.rotation.y += angle;
      render();
    },
    dispose() {
      disposed = true;
      request++;
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      texture?.dispose();
      for (const resource of [
        plateGeometry,
        plateMaterial,
        rimGeometry,
        rimMaterial,
        photoGeometry,
        photoMaterial,
      ])
        resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
