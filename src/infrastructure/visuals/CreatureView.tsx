import React, { useRef, useMemo, MutableRefObject, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  Object3D, Color, Vector3, Group, InstancedMesh, Mesh, 
  SphereGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial 
} from 'three';
import { Organism, Node, Muscle } from '../../domain/types';

interface CreatureViewProps {
  organism: Organism;
  leaderRef: MutableRefObject<Organism | null>;
  showBestOnly: boolean;
  visionRadius: number;
  interactionRadius: number; 
  showVision: boolean;
  showMouth: boolean;
}

// --- SHARED RESOURCES (FLYWEIGHT PATTERN) ---
const sharedNodeGeo = new SphereGeometry(0.08, 6, 6); 
const sharedMuscleGeo = new CylinderGeometry(0.03, 0.03, 1, 4); 
const sharedVisionGeo = new SphereGeometry(1, 16, 16); 
const sharedMouthGeo = new SphereGeometry(1, 16, 16);

const sharedNodeMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const sharedMuscleMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const sharedVisionMat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.05, wireframe: true });
const sharedMouthMat = new MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.1, wireframe: true });

// CACHED OBJECTS
const _tempObj = new Object3D();
const _color = new Color();
const _vecA = new Vector3();
const _vecB = new Vector3();
const _mid = new Vector3();

// COLORS
const COL_RED = new Color(0xff3333);
const COL_BLUE = new Color(0x3333ff);
const COL_WHITE = new Color(0xffffff);
const COL_YELLOW = new Color(0xffff00);
const COL_HEAD = new Color(0x1a1a1a);
const COL_DEAD = new Color(0x52525b);
const COL_GRIP = new Color(0x22c55e);

export const CreatureView: React.FC<CreatureViewProps> = ({ 
    organism, leaderRef, showBestOnly, visionRadius, interactionRadius, showVision, showMouth 
}) => {
  // HOOKS MUST RUN UNCONDITIONALLY TO SATISFY REACT RULES
  const groupRef = useRef<Group>(null);
  
  // Instanced Meshes
  const nodesMeshRef = useRef<InstancedMesh>(null);
  const musclesMeshRef = useRef<InstancedMesh>(null);
  
  // Singular items
  const visionRef = useRef<Mesh>(null);
  const mouthRef = useRef<Mesh>(null);

  const headPosCache = useMemo(() => new Vector3(), []);

  useEffect(() => {
      if (nodesMeshRef.current) nodesMeshRef.current.count = organism.nodes.length;
      if (musclesMeshRef.current) musclesMeshRef.current.count = organism.muscles.length;
  }, [organism.nodes.length, organism.muscles.length]);

  const nodeIndexMap = useMemo(() => {
      const map = new Map<string, number>();
      organism.nodes.forEach((n, i) => map.set(n.id, i));
      return map;
  }, [organism.nodes]);


  useFrame((state) => {
    // 1. DEAD BODY CHECK (Inside Loop)
    if (!organism.isAlive) {
        if (groupRef.current) groupRef.current.visible = false;
        return;
    }

    if (!groupRef.current) return;

    if (showBestOnly) {
        const isLeader = leaderRef.current?.id === organism.id;
        groupRef.current.visible = isLeader;
    } else {
        groupRef.current.visible = true;
    }
    
    if (!groupRef.current.visible) return;

    let foundHead = false;

    // --- UPDATE NODES ---
    if (nodesMeshRef.current) {
        for (let i = 0; i < organism.nodes.length; i++) {
            const node = organism.nodes[i];
            
            // NAN VISUAL GUARD:
            // If the physics engine blew up this node, hide it by setting scale to 0.
            // This prevents the "stretched lines across the screen" artifact.
            const isValid = isFinite(node.pos.x) && isFinite(node.pos.y) && isFinite(node.pos.z);
            
            if (isValid) {
                _tempObj.position.set(node.pos.x, node.pos.y, node.pos.z);
                _tempObj.scale.setScalar(1);
            } else {
                _tempObj.scale.setScalar(0);
                _tempObj.position.set(0,-1000,0); // Send to void
            }

            _tempObj.rotation.set(0,0,0);
            _tempObj.updateMatrix();
            nodesMeshRef.current.setMatrixAt(i, _tempObj.matrix);

            if (node.isHead && isValid) {
                headPosCache.copy(_tempObj.position); 
                foundHead = true;
                nodesMeshRef.current.setColorAt(i, COL_HEAD);
            } else {
                if (node.isGripping) {
                    nodesMeshRef.current.setColorAt(i, COL_GRIP);
                } else {
                    const act = node.activation || 0;
                    _color.copy(COL_WHITE).lerp(COL_YELLOW, act);
                    const signal = node.gripSignal || 0;
                    if (signal > 0.1) {
                         _color.lerp(COL_GRIP, signal * 0.6); 
                    }
                    nodesMeshRef.current.setColorAt(i, _color);
                }
            }
        }
        nodesMeshRef.current.instanceMatrix.needsUpdate = true;
        if (nodesMeshRef.current.instanceColor) nodesMeshRef.current.instanceColor.needsUpdate = true;
    }

    // --- UPDATE MUSCLES ---
    if (musclesMeshRef.current) {
        for (let i = 0; i < organism.muscles.length; i++) {
            const m = organism.muscles[i];
            const idxA = nodeIndexMap.get(m.nodeA);
            const idxB = nodeIndexMap.get(m.nodeB);

            if (idxA !== undefined && idxB !== undefined) {
                const nA = organism.nodes[idxA];
                const nB = organism.nodes[idxB];

                // Check Validity of both ends
                const validA = isFinite(nA.pos.x);
                const validB = isFinite(nB.pos.x);

                if (validA && validB) {
                    _vecA.set(nA.pos.x, nA.pos.y, nA.pos.z);
                    _vecB.set(nB.pos.x, nB.pos.y, nB.pos.z);

                    _mid.copy(_vecA).add(_vecB).multiplyScalar(0.5);
                    const len = _vecA.distanceTo(_vecB);

                    _tempObj.position.copy(_mid);
                    _tempObj.lookAt(_vecB);
                    _tempObj.rotateX(Math.PI / 2); 
                    _tempObj.scale.set(1, len, 1);
                    _tempObj.updateMatrix();
                    musclesMeshRef.current.setMatrixAt(i, _tempObj.matrix);

                    // Family Color (Main visual indicator for bones)
                    _color.set(organism.color || '#ffffff');
                    musclesMeshRef.current.setColorAt(i, _color);
                } else {
                    // Hide invalid muscle
                    _tempObj.scale.setScalar(0);
                    _tempObj.position.set(0,-1000,0);
                    _tempObj.updateMatrix();
                    musclesMeshRef.current.setMatrixAt(i, _tempObj.matrix);
                }
            }
        }
        musclesMeshRef.current.instanceMatrix.needsUpdate = true;
        if (musclesMeshRef.current.instanceColor) musclesMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (foundHead) {
        if (visionRef.current) {
            visionRef.current.position.copy(headPosCache);
            visionRef.current.scale.setScalar(visionRadius);
            visionRef.current.visible = showVision;
        }
        if (mouthRef.current) {
            mouthRef.current.position.copy(headPosCache);
            mouthRef.current.scale.setScalar(interactionRadius); 
            mouthRef.current.visible = showMouth;
        }
    } else {
        if (visionRef.current) visionRef.current.visible = false;
        if (mouthRef.current) mouthRef.current.visible = false;
    }
  });

  // RETURN NULL IF DEAD (Visual cleanup)
  if (!organism.isAlive) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={visionRef} geometry={sharedVisionGeo} material={sharedVisionMat} />
      <mesh ref={mouthRef} geometry={sharedMouthGeo} material={sharedMouthMat} />
      
      <instancedMesh 
        ref={nodesMeshRef} 
        args={[sharedNodeGeo, sharedNodeMat, organism.nodes.length]}
        frustumCulled={false}
      />
      
      <instancedMesh 
        ref={musclesMeshRef} 
        args={[sharedMuscleGeo, sharedMuscleMat, organism.muscles.length]}
        frustumCulled={false}
      />
    </group>
  );
};