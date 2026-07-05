import { IShapeBlueprint, ShapeData } from './IShapeBlueprint';
import { Node, Muscle, ShapeType, CellType } from '../types';
import { VectorOps } from '../math';

export class WormBlueprint implements IShapeBlueprint {
  readonly type = ShapeType.WORM;

  generate(): ShapeData {
    const nodes: Node[] = [];
    const size = 0.8;
    const segments = 4;
    const bellyFriction = 0.5;
    const footFriction = 0.98;
    const m = 4.0;
    const mTop = 12.0;
    const spacing = size;

    for (let i = 0; i < segments; i++) {
      const offset = i * spacing;

      const footA = this.createNode(`n${i}_a`, -0.5, 0, offset, m, footFriction);
      footA.cellType = CellType.FOOT;
      footA.originalGridCoord = { x: -1, y: 0, z: i };

      const footB = this.createNode(`n${i}_b`, 0.5, 0, offset, m, footFriction);
      footB.cellType = CellType.FOOT;
      footB.originalGridCoord = { x: 1, y: 0, z: i };

      const top = this.createNode(`n${i}_top`, 0, 1 * size, offset + 0.5 * size, mTop, bellyFriction);
      top.cellType = CellType.BODY;
      top.originalGridCoord = { x: 0, y: 1, z: i + 0.5 };

      nodes.push(footA, footB, top);
    }
    return { nodes, muscles: this.connectDistanceThreshold(nodes, size * 1.5) };
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
