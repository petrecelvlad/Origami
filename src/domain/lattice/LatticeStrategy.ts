import { GridCoord, ShapeType, Vec3 } from '../types';

export interface Neighbor {
    coord: GridCoord;
    distanceWeight: number; // 1.0 for standard, others for diagonals
}

export interface ILatticeStrategy {
    gridToWorld(coord: GridCoord, scale: number): Vec3;
    getNeighbors(coord: GridCoord): Neighbor[];
    getVerticalNeighbors(coord: GridCoord): Neighbor[];
}

export class CubeLatticeStrategy implements ILatticeStrategy {
    gridToWorld(coord: GridCoord, scale: number): Vec3 {
        // Simple Cartesian
        return {
            x: coord.x * scale,
            y: coord.y * scale + 0.5,
            z: coord.z * scale
        };
    }

    getNeighbors(coord: GridCoord): Neighbor[] {
        const offsets = [
            {x:1, y:0, z:0}, {x:-1, y:0, z:0},
            {x:0, y:1, z:0}, {x:0, y:-1, z:0},
            {x:0, y:0, z:1}, {x:0, y:0, z:-1}
        ];
        const diags = [
            {x:1, y:1, z:0}, {x:1, y:-1, z:0},
            {x:0, y:1, z:1}, {x:0, y:1, z:-1},
            {x:1, y:0, z:1}, {x:1, y:0, z:-1}
        ];
        
        const neighbors: Neighbor[] = [];
        
        for(let i=0; i<offsets.length; i++) {
            const o = offsets[i];
            neighbors.push({
                coord: { x: coord.x + o.x, y: coord.y + o.y, z: coord.z + o.z },
                distanceWeight: 1.0
            });
        }

        for(let i=0; i<diags.length; i++) {
            const o = diags[i];
            neighbors.push({
                coord: { x: coord.x + o.x, y: coord.y + o.y, z: coord.z + o.z },
                distanceWeight: 1.0
            });
        }

        return neighbors;
    }

    getVerticalNeighbors(coord: GridCoord): Neighbor[] {
        return [
            { coord: { x: coord.x, y: coord.y + 1, z: coord.z }, distanceWeight: 1.0 },
            { coord: { x: coord.x, y: coord.y - 1, z: coord.z }, distanceWeight: 1.0 }
        ];
    }
}

export class LatticeFactory {
    static getStrategy(type: ShapeType): ILatticeStrategy {
        // Default to Cube for everything
        return new CubeLatticeStrategy();
    }
}