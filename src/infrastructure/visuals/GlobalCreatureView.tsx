import React, { useRef, useMemo, MutableRefObject, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  Object3D, Color, Vector3, Group, InstancedMesh, Mesh, 
  SphereGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial 
} from 'three';
import { Organism, Node, Muscle } from '../../domain/types';

interface GlobalCreatureViewProps {
  population: Organism[];
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

export const GlobalCreatureView: React.FC<GlobalCreatureViewProps> = ({ 
    population, leaderRef, showBestOnly, visionRadius, interactionRadius, showVision, showMouth 
}) => {
  const nodesMeshRef = useRef<InstancedMesh>(null);
  const musclesMeshRef = useRef<InstancedMesh>(null);
  
  const visionRef = useRef<Mesh>(null);
  const mouthRef = useRef<Mesh>(null);

  const headPosCache = useMemo(() => new Vector3(), []);

  // To prevent constant reallocations, we pick a maximum buffer size for the InstancedMesh
  const MAX_NODES = 20000;
  const MAX_MUSCLES = 40000;

  useFrame(() => {
    if (!nodesMeshRef.current || !musclesMeshRef.current) return;

    let nodeInstanceCount = 0;
    let muscleInstanceCount = 0;
    let foundLeaderHead = false;

    // Build map for muscle resolution globally
    // We can do an inline dictionary or just map internally per organism
    const nodeIndexMap = new Map<string, number>();

    for (let orgIdx = 0; orgIdx < population.length; orgIdx++) {
        const organism = population[orgIdx];
        if (!organism.isAlive) continue;

        const isLeader = leaderRef.current?.id === organism.id;
        if (showBestOnly && !isLeader) continue;

        // Build local index map to resolve muscle A/B IDs to actual nodes quickly
        nodeIndexMap.clear();
        for (let i = 0; i < organism.nodes.length; i++) {
            nodeIndexMap.set(organism.nodes[i].id, i);
        }

        const orgBaseNodeIdx = nodeInstanceCount;
        const orgBaseMuscleIdx = muscleInstanceCount;

        // --- UPDATE NODES ---
        for (let i = 0; i < organism.nodes.length; i++) {
            const node = organism.nodes[i];
            const globalIdx = orgBaseNodeIdx + i;
            
            if (globalIdx >= MAX_NODES) break; // Safety bounding

            const isValid = isFinite(node.pos.x) && isFinite(node.pos.y) && isFinite(node.pos.z);
            
            if (isValid) {
                _tempObj.position.set(node.pos.x, node.pos.y, node.pos.z);
                _tempObj.scale.setScalar(1);
            } else {
                _tempObj.scale.setScalar(0);
                _tempObj.position.set(0,-1000,0);
            }

            _tempObj.rotation.set(0,0,0);
            _tempObj.updateMatrix();
            nodesMeshRef.current.setMatrixAt(globalIdx, _tempObj.matrix);

            if (node.isHead && isValid) {
                if (isLeader) {
                    headPosCache.copy(_tempObj.position); 
                    foundLeaderHead = true;
                }
                nodesMeshRef.current.setColorAt(globalIdx, COL_HEAD);
            } else {
                if (node.isGripping) {
                    nodesMeshRef.current.setColorAt(globalIdx, COL_GRIP);
                } else {
                    const act = node.activation || 0;
                    _color.copy(COL_WHITE).lerp(COL_YELLOW, Math.min(1, act)); // clamp
                    // In WebGPU mode, we just draw standard for now
                    nodesMeshRef.current.setColorAt(globalIdx, _color);
                }
            }
        }
        nodeInstanceCount += organism.nodes.length;

        // --- UPDATE MUSCLES ---
        for (let i = 0; i < organism.muscles.length; i++) {
            const m = organism.muscles[i];
            const globalIdx = orgBaseMuscleIdx + i;

            if (globalIdx >= MAX_MUSCLES) break; // Safety bounding

            const localIdxA = nodeIndexMap.get(m.nodeA);
            const localIdxB = nodeIndexMap.get(m.nodeB);

            if (localIdxA !== undefined && localIdxB !== undefined) {
                const nA = organism.nodes[localIdxA];
                const nB = organism.nodes[localIdxB];

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
                    musclesMeshRef.current.setMatrixAt(globalIdx, _tempObj.matrix);

                    // Family Color (Main visual indicator for bones)
                    _color.set(organism.color || '#ffffff');
                    musclesMeshRef.current.setColorAt(globalIdx, _color);
                } else {
                    _tempObj.scale.setScalar(0);
                    _tempObj.position.set(0,-1000,0);
                    _tempObj.updateMatrix();
                    musclesMeshRef.current.setMatrixAt(globalIdx, _tempObj.matrix);
                }
            } else {
                _tempObj.scale.setScalar(0);
                _tempObj.position.set(0,-1000,0);
                _tempObj.updateMatrix();
                musclesMeshRef.current.setMatrixAt(globalIdx, _tempObj.matrix);
            }
        }
        muscleInstanceCount += organism.muscles.length;
    }

    // Assign dynamic count to draw exactly what's needed
    nodesMeshRef.current.count = Math.min(nodeInstanceCount, MAX_NODES);
    musclesMeshRef.current.count = Math.min(muscleInstanceCount, MAX_MUSCLES);

    nodesMeshRef.current.instanceMatrix.needsUpdate = true;
    if (nodesMeshRef.current.instanceColor) nodesMeshRef.current.instanceColor.needsUpdate = true;
    
    musclesMeshRef.current.instanceMatrix.needsUpdate = true;
    if (musclesMeshRef.current.instanceColor) musclesMeshRef.current.instanceColor.needsUpdate = true;

    // Leader Vision Sphere Rendering
    if (foundLeaderHead) {
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

  return (
    <group>
        <instancedMesh 
            ref={nodesMeshRef} 
            args={[sharedNodeGeo, sharedNodeMat, MAX_NODES]} 
            castShadow 
            receiveShadow 
        />
        <instancedMesh 
            ref={musclesMeshRef} 
            args={[sharedMuscleGeo, sharedMuscleMat, MAX_MUSCLES]} 
            castShadow 
            receiveShadow 
        />

        <mesh ref={visionRef} geometry={sharedVisionGeo} material={sharedVisionMat} visible={false} />
        <mesh ref={mouthRef} geometry={sharedMouthGeo} material={sharedMouthMat} visible={false} />
    </group>
  );
};
