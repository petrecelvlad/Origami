import React, { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Organism } from '../../domain/types';
import { 
  InstancedMesh, Object3D, Color, IcosahedronGeometry, MeshStandardMaterial,
  InstancedBufferAttribute, Vector3
} from 'three';

interface FoodViewProps {
    leaderRef: MutableRefObject<Organism | null>;
    visionRadius: number;
}

export const FoodView: React.FC<FoodViewProps> = ({ leaderRef, visionRadius }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);
    const headPos = useMemo(() => new Vector3(), []);
    const foodPos = useMemo(() => new Vector3(), []);
    
    // Custom attribute for alpha
    const alphaArray = useMemo(() => new Float32Array(1000), []); // Buffer for 1000 items
    const alphaAttr = useMemo(() => {
        const attr = new InstancedBufferAttribute(alphaArray, 1);
        attr.setUsage(35048); // DynamicDrawUsage (THREE.DynamicDrawUsage)
        return attr;
    }, [alphaArray]);
    
    // COLORS
    const colDefault = useMemo(() => new Color('#22c55e'), []); // Green (Outside Vision)
    const colSeen = useMemo(() => new Color('#3b82f6'), []);    // Blue (Inside Vision)
    const colTarget = useMemo(() => new Color('#ec4899'), []);  // Pink (Locked Target)
    
    // Geometry/Material
    const geo = useMemo(() => {
        const g = new IcosahedronGeometry(0.15, 0);
        g.setAttribute('instanceAlpha', alphaAttr);
        return g;
    }, [alphaAttr]);

    const mat = useMemo(() => {
        const m = new MeshStandardMaterial({ 
            color: '#ffffff', // Use white base for instance color
            emissive: '#ffffff',
            emissiveIntensity: 0.2,
            roughness: 0.2,
            transparent: true // Enable transparency
        });

        m.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                attribute float instanceAlpha;
                varying float vInstanceAlpha;`
            ).replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vInstanceAlpha = instanceAlpha;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                varying float vInstanceAlpha;`
            ).replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                diffuseColor.a *= vInstanceAlpha;`
            );
        };

        return m;
    }, []);

    useFrame((state) => {
        if (!meshRef.current) return;

        // Use the centralized leader
        const leader = leaderRef.current;

        if (!leader || !leader.visibleFood) {
            meshRef.current.count = 0;
            return;
        }

        const foodItems = leader.visibleFood;
        meshRef.current.count = foodItems.length;

        // Get head position for distance calculation
        if (leader.headNode) {
            headPos.set(leader.headNode.pos.x, leader.headNode.pos.y, leader.headNode.pos.z);
        } else {
            headPos.set(0, 0, 0);
        }

        // Use clock from state instead of Date.now()
        const time = state.clock.elapsedTime;

        // Update Instances
        for (let i = 0; i < foodItems.length; i++) {
            const item = foodItems[i];
            
            // NaN Guard for food position
            if (!isFinite(item.pos.x) || !isFinite(item.pos.y) || !isFinite(item.pos.z)) {
                tempObj.scale.setScalar(0);
                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
                alphaArray[i] = 0;
                continue;
            }

            foodPos.set(item.pos.x, item.pos.y, item.pos.z);
            
            // Position
            tempObj.position.copy(foodPos);
            
            // Animation: Spin
            tempObj.rotation.y += 0.02;
            tempObj.rotation.z += 0.01;

            // Scale: Shrink if consumed, else pulse
            if (item.consumed) {
                tempObj.scale.setScalar(0); 
                alphaArray[i] = 0;
            } else {
                const pulse = 1.0 + Math.sin(time * 3 + i) * 0.1;
                tempObj.scale.setScalar(pulse);

                // Transparency Logic: Distance-based
                // NaN Guard for head position and vision radius
                if (!isFinite(headPos.x) || !isFinite(visionRadius) || visionRadius <= 0) {
                    alphaArray[i] = 0;
                } else {
                    const dist = headPos.distanceTo(foodPos);
                    // 100% opacity at dist=0, ~1% at dist=visionRadius
                    let alpha = 1.0 - (dist / visionRadius) * 0.99;
                    alpha = Math.max(0, Math.min(1, alpha));
                    
                    // If it's outside vision, it's 0 alpha
                    if (dist > visionRadius) alpha = 0;
                    
                    alphaArray[i] = alpha;
                }
            }

            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
            
            // COLOR LOGIC
            // If focused by brain, Pink. If seen, Blue. If hidden, Green.
            if (item.targeted) {
                meshRef.current.setColorAt(i, colTarget);
            } else if (item.seen) {
                meshRef.current.setColorAt(i, colSeen);
            } else {
                meshRef.current.setColorAt(i, colDefault);
            }
        }
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        alphaAttr.needsUpdate = true;
    });

    return (
        <instancedMesh 
            ref={meshRef} 
            args={[geo, mat, 100]} // Max 100 food items buffer
            frustumCulled={false}
        />
    );
};