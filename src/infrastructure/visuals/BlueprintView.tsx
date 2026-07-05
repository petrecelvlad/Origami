import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { GridCoord, ShapeType, CellType, BlueprintCell } from '../../domain/types';
import { 
  Color, Matrix4, BoxGeometry, 
  MeshStandardMaterial, InstancedMesh 
} from 'three';
import { EditorTool } from '../../App';

// COLORS
const COL_BODY = new Color('#3b82f6'); // Blue
const COL_HEAD = new Color('#ef4444'); // Red
const COL_FOOT = new Color('#22c55e'); // Green

export const BlueprintView: React.FC<{
    cells: BlueprintCell[]; 
    onCellClick: (x: number, y: number, z: number, isRight: boolean) => void;
    currentType: ShapeType;
    editorTool: EditorTool;
    brushType: CellType;
}> = ({ cells, onCellClick, currentType, editorTool, brushType }) => {

  const { camera, raycaster, pointer, scene } = useThree();
  const [hoverCoord, setHoverCoord] = useState<GridCoord | null>(null);

  // INSTANCING REFS
  const meshRef = useRef<InstancedMesh>(null);
  const tempMat = useMemo(() => new Matrix4(), []);
  
  const boxGeo = useMemo(() => new BoxGeometry(0.8, 0.8, 0.8), []);

  // Materials
  const hoverMaterial = useMemo(() => new MeshStandardMaterial({ 
      color: '#ffffff', transparent: true, opacity: 0.6 
  }), []);
  const eraseMaterial = useMemo(() => new MeshStandardMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 }), []);

  // UPDATE INSTANCES
  useEffect(() => {
      if (!meshRef.current) return;
      
      meshRef.current.count = cells.length;
      
      cells.forEach((c, i) => {
          tempMat.identity();
          // Offset by 0.4 so bottom of 0.8 cube sits at Y=0
          tempMat.setPosition(c.x, c.y + 0.4, c.z);
          
          meshRef.current!.setMatrixAt(i, tempMat);

          // SET COLOR BASED ON CELL TYPE
          if (c.type === CellType.HEAD) meshRef.current!.setColorAt(i, COL_HEAD);
          else if (c.type === CellType.FOOT) meshRef.current!.setColorAt(i, COL_FOOT);
          else meshRef.current!.setColorAt(i, COL_BODY);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      
      if (meshRef.current.geometry) {
          meshRef.current.computeBoundingSphere();
      }
      
  }, [cells, currentType, tempMat]);

  // Handle ghost color update
  useEffect(() => {
      if (editorTool === 'ERASE') return;
      if (brushType === CellType.HEAD) hoverMaterial.color.set(COL_HEAD);
      else if (brushType === CellType.FOOT) hoverMaterial.color.set(COL_FOOT);
      else hoverMaterial.color.set(COL_BODY);
  }, [brushType, hoverMaterial, editorTool]);

  // --- EVENTS ON MESH ---

  const handleMeshMove = (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (editorTool === 'VIEW') return;

      const instanceId = e.instanceId;
      if (instanceId === undefined) return;
      
      const c = cells[instanceId];
      if (!c) return;

      if (editorTool === 'ERASE') {
          setHoverCoord(c);
      } 
      else if (editorTool === 'BUILD') {
         // Standard Cube Logic (Normals)
         if (e.face) {
             const n = e.face.normal;
             setHoverCoord({
                 x: c.x + Math.round(n.x),
                 y: c.y + Math.round(n.y),
                 z: c.z + Math.round(n.z)
             });
         }
      }
  };

  const handleMeshClick = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (editorTool === 'VIEW') return;
      
      const instanceId = e.instanceId;
      if (instanceId === undefined) return;
      
      if (editorTool === 'ERASE') {
          const c = cells[instanceId];
          if (c) onCellClick(c.x, c.y, c.z, true);
      }
      else if (editorTool === 'BUILD') {
          if (hoverCoord) {
              onCellClick(hoverCoord.x, hoverCoord.y, hoverCoord.z, false);
          }
      }
  };

  const handleFloorMove = (e: ThreeEvent<PointerEvent>) => {
      if (editorTool !== 'BUILD') {
          if (editorTool !== 'ERASE') setHoverCoord(null);
          return;
      }
      e.stopPropagation();
      
      const hitPoint = e.point;
      
      setHoverCoord({
          x: Math.round(hitPoint.x),
          y: 0,
          z: Math.round(hitPoint.z)
      });
  };

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
       if (editorTool !== 'BUILD') return;
       e.stopPropagation();
       if (hoverCoord) {
           onCellClick(hoverCoord.x, hoverCoord.y, hoverCoord.z, false);
       }
  };
  
  const handleMiss = () => {
     setHoverCoord(null);
  };

  return (
    <group onPointerMissed={handleMiss}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />

      <instancedMesh 
          ref={meshRef} 
          args={[undefined, undefined, 2000]} 
          onPointerMove={handleMeshMove}
          onClick={handleMeshClick}
          onContextMenu={handleMeshClick}
      >
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </instancedMesh>

      {hoverCoord && (
         <group>
             <mesh 
                position={[hoverCoord.x, hoverCoord.y + 0.4, hoverCoord.z]} 
                geometry={boxGeo} 
                material={editorTool === 'ERASE' ? eraseMaterial : hoverMaterial} 
                raycast={() => null}
             />
         </group>
      )}

      <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -0.01, 0]} 
          name="base_plane" 
          visible={false}
          onPointerMove={handleFloorMove}
          onClick={handleFloorClick}
      >
          <planeGeometry args={[100, 100]} />
      </mesh>
      
      <gridHelper args={[40, 40, 0x444444, 0x222222]} position={[0, -0.01, 0]} />
    </group>
  );
};