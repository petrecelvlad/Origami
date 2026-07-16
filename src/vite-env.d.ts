/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// --- TYPE AUGMENTATION FOR R3F ---
// Moved out of domain/types.ts (2026-07-16, Z8): JSX intrinsics are a
// UI/rendering-tooling concern, not a domain one — this file, not the
// zero-dependency domain layer, is their correct home (C-006).
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      instancedMesh: any;
      primitive: any;

      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;

      boxGeometry: any;
      planeGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      icosahedronGeometry: any;

      meshStandardMaterial: any;
      meshBasicMaterial: any;
      meshPhysicalMaterial: any;

      gridHelper: any;
      axesHelper: any;

      [elemName: string]: any;
    }
  }
}

