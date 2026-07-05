import { IShapeBlueprint, ShapeData } from './IShapeBlueprint';
import { Node, Muscle, ShapeType, CellType } from '../types';
import { VectorOps } from '../math';

export class CubeBlueprint implements IShapeBlueprint {
  readonly type = ShapeType.CUBE;

  generate(): ShapeData {
    const nodes: Node[] = [];
    const size = 0.8;
    const startY = 0.5;

    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          const px = (x - 0.5) * size;
          const py = startY + y * size;
          const pz = (z - 0.5) * size;

          const isFoot = y === 0;
          const mass = isFoot ? 4.0 : 10.0;
          const friction = isFoot ? 0.95 : 0.2;

          const node = this.createNode(`n${x}${y}${z}`, px, py, pz, mass, friction);
          node.cellType = isFoot ? CellType.FOOT : CellType.BODY;
          node.originalGridCoord = { x, y, z };

          nodes.push(node);
        }
      }
    }
    const muscles = this.connectDistanceThreshold(nodes, size * 1.8);
    return { nodes, muscles };
  }

  private createNode(id: string, x: number, y: number, z: number, mass: number, friction: number): Node {
    return {
      id,
      pos: { x, y, z },
      oldPos: { x, y, z },
      mass,
      friction,
      isHead: false,
      isFixed: false,
      isGripping: false,
      gripSignal: 0,
      gripStamina: 1.0,
      currentStress: 0,
      activation: 0,
      originalGridCoord: undefined,
      cellType: CellType.BODY,
      gripCooldown: 0
    };
  }

  private connectDistanceThreshold(nodes: Node[], threshold: number): Muscle[] {
    const muscles: Muscle[] = [];
    let mCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = VectorOps.distance(nodes[i].pos, nodes[j].pos);
        if (dist <= threshold) {
          muscles.push({
            id: `m${mCount++}`,
            nodeA: nodes[i].id,
            nodeB: nodes[j].id,
            baseLength: dist,
            stiffness: 1.0,
            dnaIndex: 0,
            phase: Math.random() * Math.PI * 2,
            freq: 1.0,
            amp: 0.0,
            currentLength: dist,
            targetLength: dist,
            nodeRefA: undefined,
            nodeRefB: undefined
          });
        }
      }
    }
    return muscles;
  }
}
