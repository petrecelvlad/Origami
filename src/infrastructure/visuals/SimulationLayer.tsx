import React, { useRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Organism } from '../../domain/types';
import { CreatureView } from './CreatureView';
import { FoodView } from './FoodView';
import { GlobalCreatureView } from './GlobalCreatureView';
import { Vector3 } from 'three';
// FIX: Use 'import type' to prevent bundling three-stdlib logic twice
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface SimulationLayerProps {
  population: Organism[];
  showBestOnly: boolean;
  trackedLeaderId?: string | null;
  visionRadius: number;
  interactionRadius: number;
  showVision: boolean;
  showMouth: boolean;
}

// COMPONENT: StableLeaderTracker
// Logic: Syncs the leaderRef to the trackedLeaderId provided by the parent.
const StableLeaderTracker: React.FC<{ 
    population: Organism[], 
    trackedLeaderId?: string | null,
    leaderRef: MutableRefObject<Organism | null> 
}> = ({ population, trackedLeaderId, leaderRef }) => {
    
    useFrame(() => {
        if (!population.length) return;
        
        // Find the organism that the parent says we should track
        const leader = population.find(o => o.id === trackedLeaderId);
        
        if (leader) {
            leaderRef.current = leader;
        } else if (!leaderRef.current || !leaderRef.current.isAlive) {
            // Fallback if tracked leader is missing or dead
            const fallback = population.find(o => o.isAlive) || population[0];
            leaderRef.current = fallback;
        }
    });
    return null;
};

// COMPONENT: CameraDirector
const CameraDirector: React.FC<{ leaderRef: MutableRefObject<Organism | null> }> = ({ leaderRef }) => {
    const { camera } = useThree();
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const targetRef = useRef(new Vector3(0, 0, 0));

    useFrame(() => {
        const leader = leaderRef.current;
        if (!leader) return;

        // Calculate Target Position
        let cx = 0, cy = 0, cz = 0;
        let validNodes = 0;
        
        for (const n of leader.nodes) {
            // Guard against exploded nodes messing up the camera center
            if (Number.isFinite(n.pos.x) && Number.isFinite(n.pos.y) && Number.isFinite(n.pos.z)) {
                // If y > 50, it's exploded. Ignore this node.
                if (n.pos.y > 50) continue; 
                
                cx += n.pos.x;
                cy += n.pos.y;
                cz += n.pos.z;
                validNodes++;
            }
        }
        
        if (validNodes === 0) return; // Don't move if creature is voided

        const center = new Vector3(cx/validNodes, cy/validNodes, cz/validNodes);

        // SNAP CHECK: Detect huge jumps (e.g. Generation Reset from z=5000 to z=0)
        // If distance is massive, snap instantly to avoid the "flying across map" glitch.
        if (targetRef.current.distanceTo(center) > 50) {
            // Calculate current offset relative to the old target
            const currentTarget = controlsRef.current ? controlsRef.current.target : targetRef.current;
            const offset = camera.position.clone().sub(currentTarget);
            
            // Teleport target
            targetRef.current.copy(center);
            
            // Teleport camera
            if (controlsRef.current) {
                controlsRef.current.target.copy(center);
                camera.position.copy(center).add(offset);
                controlsRef.current.update();
            }
        } else {
            // Standard Smooth Follow
            targetRef.current.lerp(center, 0.15);
            
            if (controlsRef.current) {
                const offset = camera.position.clone().sub(controlsRef.current.target);
                controlsRef.current.target.copy(targetRef.current);
                camera.position.copy(targetRef.current).add(offset);
                controlsRef.current.update();
            }
        }
    });

    return (
        // @ts-ignore: maxPolarAngle exists on underlying OrbitControls but prop types might be strict
        <OrbitControls ref={controlsRef} makeDefault maxPolarAngle={Math.PI / 2 - 0.1} />
    );
};

export const SimulationLayer: React.FC<SimulationLayerProps> = ({ 
    population, showBestOnly, trackedLeaderId, visionRadius, interactionRadius, showVision, showMouth 
}) => {
  const leaderRef = useRef<Organism | null>(null);

  return (
    <group>
        <StableLeaderTracker population={population} trackedLeaderId={trackedLeaderId} leaderRef={leaderRef} />
        <CameraDirector leaderRef={leaderRef} />
        
        <GlobalCreatureView 
            population={population} 
            leaderRef={leaderRef}
            showBestOnly={showBestOnly}
            visionRadius={visionRadius}
            interactionRadius={interactionRadius}
            showVision={showVision}
            showMouth={showMouth}
        />

        <FoodView leaderRef={leaderRef} visionRadius={visionRadius} />
    </group>
  );
};