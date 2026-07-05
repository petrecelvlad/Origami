/**
 * @propolis
 * {
 *   "role": "VISUAL",
 *   "dependencies": ["@domain/types", "@domain/genetics", "@domain/blueprints"],
 *   "constraints": ["C-005", "C-006"],
 *   "agent_instructions": "The factory assembles phenotypes from blueprints. Head identification logic must remain consistent to ensure valid neural initialization."
 * }
 */
import { Organism, ShapeType, Node, Muscle, CellType } from './types';
import { GeneticOperator } from './genetics/GeneticOperator';
import { IShapeBlueprint } from './blueprints/IShapeBlueprint';
import { CubeBlueprint } from './blueprints/CubeBlueprint';
import { WormBlueprint } from './blueprints/WormBlueprint';

export class ShapeFactory {
  private static registry = new Map<ShapeType, IShapeBlueprint>([
    [ShapeType.CUBE, new CubeBlueprint()],
    [ShapeType.WORM, new WormBlueprint()],
  ]);

  static register(blueprint: IShapeBlueprint) {
    this.registry.set(blueprint.type as ShapeType, blueprint);
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Instantiate a new organism phenotype and initialize its neural genome.",
   *   "agent_instructions": "Ensure headNode cell type is assigned to allow proper sensory orientation."
   * }
   */
  static create(type: ShapeType, id: string): Organism {
    const blueprint = this.registry.get(type) || this.registry.get(ShapeType.CUBE)!;
    const { nodes, muscles } = blueprint.generate();

    // Initialize Neural Genome
    const operator = new GeneticOperator();
    const genome = operator.createRandomGenome(muscles.length, nodes.length);

    // Optimized loop instead of forEach
    for(let i=0; i<muscles.length; i++) {
        muscles[i].dnaIndex = i;
    }

    // Identify Head (Furthest Forward, then Highest Up)
    let maxZ = -Infinity;
    for(let i=0; i<nodes.length; i++) {
        if (nodes[i].pos.z > maxZ) maxZ = nodes[i].pos.z;
    }

    let candidates: Node[] = [];
    for(let i=0; i<nodes.length; i++) {
        if (Math.abs(nodes[i].pos.z - maxZ) < 0.1) candidates.push(nodes[i]);
    }

    let headNode: Node | undefined = undefined;
    let maxY = -Infinity;
    for(let i=0; i<candidates.length; i++) {
        if (candidates[i].pos.y > maxY) {
            maxY = candidates[i].pos.y;
            headNode = candidates[i];
        }
    }

    if (headNode) {
        // @ts-ignore
        headNode.isHead = true;
        headNode.cellType = CellType.HEAD;
    }
    
    const initialHeadPos = headNode ? { ...headNode.pos } : { x: 0, y: 0, z: 0 };

    return {
      id,
      shape: type, // Store shape type for editor consistency
      nodes,
      muscles,
      neuralGenome: genome,
      fitness: 0,
      odometer: 0,
      visitedTiles: {},
      generation: 1,
      // Metabolism Defaults
      energy: 100,
      maxEnergy: 100,
      hungerTime: 0,
      isAlive: true,
      foodEaten: 0,
      foodForBreeding: 0,
      totalFoodEaten: 0,
      visibleFood: [],
      // Metabolism Defaults
      timeAlive: 0,
      // Distance Metrics (Replaces Posture)
      initialHeadPos,
      distanceTraveled: 0,
      headNode // OPTIMIZATION
    };
  }
}
