import { Organism, Node, Muscle, NeuralGenome, GridCoord, CellType, BlueprintCell, Vec3 } from './types';
import { VectorOps } from './math';
import { GeneticOperator } from './genetics/GeneticOperator';

interface Neighbor {
    coord: GridCoord;
}

export class BlueprintService {
  private cells: Map<string, CellType> = new Map();
  private readonly GRID_SIZE = 10;
  private geneticOperator: GeneticOperator;

  constructor() {
    this.geneticOperator = new GeneticOperator();
    this.applySpider();
  }

  public clear() {
    this.cells.clear();
  }

  public getCells(): BlueprintCell[] {
    const res: BlueprintCell[] = [];
    this.cells.forEach((type, key) => {
        const [x, y, z] = key.split(',').map(Number);
        res.push({ x, y, z, type });
    });
    return res;
  }

  public loadCells(cells: BlueprintCell[]) {
    this.clear();
    for (const c of cells) {
        this._setCellInternal(c.x, c.y, c.z, c.type);
    }
  }

  public setCell(x: number, y: number, z: number, type: CellType | null, mirror: boolean = false) {
    this._setCellInternal(x, y, z, type);
    if (mirror && x !== 0) {
        this._setCellInternal(-x, y, z, type);
    }
  }

  private _setCellInternal(x: number, y: number, z: number, type: CellType | null) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (type) {
        // If we are placing a HEAD, remove any existing HEAD to ensure only one leader
        if (type === CellType.HEAD) {
            this.cells.forEach((val, k) => {
                if (val === CellType.HEAD) this.cells.set(k, CellType.BODY);
            });
        }
        this.cells.set(key, type);
    } else {
        this.cells.delete(key);
    }
  }

  public hasCell(x: number, y: number, z: number): boolean {
      return this.cells.has(`${x},${y},${z}`);
  }

  // --- HEURISTICS ---

  public generateSmallCritter() {
      this.clear();
      const rng = () => Math.random();
      const length = 4 + Math.floor(rng() * 3);
      const wideStance = rng() > 0.4;
      const legX = wideStance ? 2 : 1;
      
      // Body (Slippery)
      for(let z=0; z<length; z++) this.setCell(0, 1, z, CellType.BODY);
      
      const headZ = length - 1;
      this.setCell(0, 2, headZ, CellType.HEAD); // Explicit Head
      
      // Decorative Spine
      if (rng() > 0.5) this.setCell(0, 3, headZ, CellType.BODY);
      
      const frontLegZ = Math.max(0, headZ - 1);
      const backLegZ = 0;
      
      const addLeg = (z: number) => {
          this.setCell(legX, 0, z, CellType.FOOT); // Feet
          this.setCell(1, 1, z, CellType.BODY);
          if (legX === 2) this.setCell(1, 0, z, CellType.FOOT);
      };

      addLeg(backLegZ);
      addLeg(frontLegZ);

      for(let z=1; z < length - 1; z++) {
           if (rng() > 0.6) this.setCell(1, 1, z, CellType.BODY);
      }
      this.applyMirrorX();
      this.normalizeHeight();
  }

  public generateLargeBeast() {
    this.clear();
    const rng = () => Math.random();
    const range = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const bodyLength = range(5, 8);
    const bodyHeight = range(2, 4); 
    const zOffset = -Math.floor(bodyLength / 2);

    for (let z = 0; z < bodyLength; z++) {
        const absZ = z + zOffset;
        this.setCell(0, bodyHeight, absZ, CellType.BODY);
        if (rng() > 0.4) this.setCell(0, bodyHeight + 1, absZ, CellType.BODY);
        if (rng() > 0.4 && bodyHeight > 1) this.setCell(0, bodyHeight - 1, absZ, CellType.BODY);
    }

    const numLegPairs = range(2, 4); 
    const legSpacing = Math.floor(bodyLength / numLegPairs);

    for (let i = 0; i < numLegPairs; i++) {
        const zIndex = (i * legSpacing) + Math.floor(legSpacing/2);
        if (zIndex >= bodyLength) continue;
        
        const startZ = zIndex + zOffset;
        const startY = bodyHeight;
        const startX = 0;
        let cx = startX;
        let cy = startY;
        let cz = startZ;
        
        cx++;
        this.setCell(cx, cy, cz, CellType.BODY);

        let safety = 0;
        while (cy > 0 && safety++ < 10) {
            const moveDown = rng() > 0.3; 
            if (moveDown) cy--;
            else {
                if (rng() > 0.4) cx++; 
                else cz += (rng() > 0.5 ? 1 : -1); 
            }
            // If on ground, it's a foot
            const type = cy === 0 ? CellType.FOOT : CellType.BODY;
            this.setCell(cx, cy, cz, type);
        }

        if (cy === 0) {
            this.setCell(cx + 1, 0, cz, CellType.FOOT);
            this.setCell(cx - 1, 0, cz, CellType.FOOT);
        }
    }

    const headZ = (bodyLength - 1) + zOffset + 1;
    this.setCell(0, bodyHeight + 1, headZ, CellType.HEAD);
    this.setCell(0, bodyHeight, headZ, CellType.BODY);
    this.setCell(0, bodyHeight - 1, headZ, CellType.BODY);
    
    this.applyMirrorX();
    this.normalizeHeight();
  }

  public applySpider() {
      this.clear();
      // Bottom layer: 4 legs (Green/FOOT)
      this.setCell(-1, 0, -1, CellType.FOOT);
      this.setCell(1, 0, -1, CellType.FOOT);
      this.setCell(-1, 0, 1, CellType.FOOT);
      this.setCell(1, 0, 1, CellType.FOOT);

      // Middle layer: 3x3 body (Blue/BODY)
      for (let x = -1; x <= 1; x++) {
          for (let z = -1; z <= 1; z++) {
              this.setCell(x, 1, z, CellType.BODY);
          }
      }

      // Top layer: 1 head (Red/HEAD)
      this.setCell(0, 2, 0, CellType.HEAD);
      this.normalizeHeight();
  }

  public exportToJSON(): string {
      const cellsArr: any[] = [];
      let headPos = { x: 0, y: 0, z: 0 };
      let hasHead = false;

      // Find head first for reference
      this.cells.forEach((type, key) => {
          if (type === CellType.HEAD) {
              const [x, y, z] = key.split(',').map(Number);
              headPos = { x, y, z };
              hasHead = true;
          }
      });

      // If no head, use the first cell as reference or 0,0,0
      if (!hasHead && this.cells.size > 0) {
          // size > 0 guarantees the iterator yields a value.
          const firstKey = this.cells.keys().next().value!;
          const [x, y, z] = firstKey.split(',').map(Number);
          headPos = { x, y, z };
      }

      this.cells.forEach((type, key) => {
          const [x, y, z] = key.split(',').map(Number);
          cellsArr.push({
              x: x - headPos.x,
              y: y - headPos.y,
              z: z - headPos.z,
              type: type
          });
      });

      return JSON.stringify(cellsArr);
  }

  public importFromJSON(json: string) {
      try {
          const data = JSON.parse(json);
          if (!Array.isArray(data)) throw new Error("Invalid format: Expected array");
          
          this.clear();
          data.forEach((item: any) => {
              if (item.x !== undefined && item.y !== undefined && item.z !== undefined && item.type) {
                  const type = CellType[item.type as keyof typeof CellType] || item.type;
                  this.setCell(item.x, item.y, item.z, type);
              }
          });
          this.normalizeHeight();
      } catch (e) {
          console.error("Failed to import blueprint", e);
          throw e;
      }
  }

  public normalizeHeight() {
      if (this.cells.size === 0) return;
      
      let minY = Infinity;
      this.cells.forEach((_, key) => {
          const y = parseInt(key.split(',')[1]);
          if (y < minY) minY = y;
      });

      if (minY === 0) return;

      const newCells = new Map<string, CellType>();
      this.cells.forEach((type, key) => {
          const [x, y, z] = key.split(',').map(Number);
          newCells.set(`${x},${y - minY},${z}`, type);
      });
      this.cells = newCells;
  }

  public generateMonster() {
      this.clear();
      const rng = () => Math.random();
      const range = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

      const bodyHeight = range(2, 3);
      const legLength = range(4, 6);
      
      // 1. Central Core (Hollow/Cross Pillar for articulation)
      for (let y = 0; y <= bodyHeight; y++) {
          this.setCell(0, y, 0, CellType.BODY);
          // Only add cross reinforcement at the top and bottom of the core
          if (y === 0 || y === bodyHeight) {
              this.setCell(1, y, 0, CellType.BODY);
              this.setCell(-1, y, 0, CellType.BODY);
              this.setCell(0, y, 1, CellType.BODY);
              this.setCell(0, y, -1, CellType.BODY);
          }
      }

      // 2. Central Head (Highest)
      const headY = bodyHeight + 1;
      this.setCell(0, headY, 0, CellType.HEAD);

      // 3. Articulated Radial Legs
      const legPath: {x: number, y: number, z: number, type: CellType}[] = [];
      
      let curX = 1; 
      let curY = bodyHeight;
      let curZ = 0;

      for (let i = 0; i < legLength; i++) {
          // Heuristic: Alternating segments for "joints"
          const isJoint = i % 2 === 1;
          
          const down = rng() > 0.4 && curY > 0;
          if (down) curY--;
          else curX++;
          
          const isFoot = curY === 0;
          const type = isFoot ? CellType.FOOT : CellType.BODY;
          
          legPath.push({x: curX, y: curY, z: curZ, type});
          
          // Reinforcement: Only add "muscle" thickness on non-joint segments
          if (!isFoot && !isJoint && rng() > 0.6) {
              // Add vertical or horizontal reinforcement depending on orientation
              if (down) {
                  // Vertical segment reinforcement
                  legPath.push({x: curX + 1, y: curY, z: curZ, type: CellType.BODY});
              } else {
                  // Horizontal segment reinforcement
                  legPath.push({x: curX, y: curY + 1, z: curZ, type: CellType.BODY});
              }
          }

          // If it's a foot, make it a smaller stable base (3 cells instead of 5)
          if (isFoot) {
              legPath.push({x: curX + 1, y: 0, z: curZ, type: CellType.FOOT});
              legPath.push({x: curX, y: 0, z: curZ + 1, type: CellType.FOOT});
              break;
          }
      }
      
      // Ensure it reaches ground
      if (curY > 0) {
          while (curY > 0) {
              curY--;
              const type = curY === 0 ? CellType.FOOT : CellType.BODY;
              legPath.push({x: curX, y: curY, z: curZ, type});
          }
      }

      // Apply Radial Symmetry (4-way)
      legPath.forEach(p => {
          // 0 deg
          this.setCell(p.x, p.y, p.z, p.type);
          // 90 deg
          this.setCell(-p.z, p.y, p.x, p.type);
          // 180 deg
          this.setCell(-p.x, p.y, -p.z, p.type);
          // 270 deg
          this.setCell(p.z, p.y, -p.x, p.type);
      });

      this.normalizeHeight();
  }

  public applyOcto() {
      const data = [{"x":0,"y":-2,"z":2,"type":"FOOT"},{"x":-2,"y":-2,"z":2,"type":"FOOT"},{"x":-2,"y":-2,"z":0,"type":"FOOT"},{"x":-2,"y":-2,"z":-2,"type":"FOOT"},{"x":0,"y":-2,"z":-2,"type":"FOOT"},{"x":2,"y":-2,"z":-2,"type":"FOOT"},{"x":2,"y":-2,"z":0,"type":"FOOT"},{"x":2,"y":-2,"z":2,"type":"FOOT"},{"x":-2,"y":-1,"z":2,"type":"BODY"},{"x":-2,"y":-1,"z":0,"type":"BODY"},{"x":-2,"y":-1,"z":-2,"type":"BODY"},{"x":0,"y":-1,"z":-2,"type":"BODY"},{"x":2,"y":-1,"z":-2,"type":"BODY"},{"x":2,"y":-1,"z":0,"type":"BODY"},{"x":2,"y":-1,"z":2,"type":"BODY"},{"x":0,"y":-1,"z":2,"type":"BODY"},{"x":-1,"y":-1,"z":0,"type":"BODY"},{"x":0,"y":-1,"z":-1,"type":"BODY"},{"x":-1,"y":-1,"z":2,"type":"BODY"},{"x":1,"y":-1,"z":2,"type":"BODY"},{"x":2,"y":-1,"z":1,"type":"BODY"},{"x":2,"y":-1,"z":-1,"type":"BODY"},{"x":1,"y":-1,"z":-2,"type":"BODY"},{"x":-1,"y":-1,"z":-2,"type":"BODY"},{"x":-2,"y":-1,"z":-1,"type":"BODY"},{"x":-2,"y":-1,"z":1,"type":"BODY"},{"x":0,"y":-1,"z":1,"type":"BODY"},{"x":1,"y":-1,"z":0,"type":"BODY"},{"x":0,"y":0,"z":0,"type":"HEAD"},{"x":2,"y":0,"z":1,"type":"BODY"},{"x":1,"y":0,"z":2,"type":"BODY"},{"x":-1,"y":0,"z":2,"type":"BODY"},{"x":-2,"y":0,"z":1,"type":"BODY"},{"x":-2,"y":0,"z":-1,"type":"BODY"},{"x":-1,"y":0,"z":-2,"type":"BODY"},{"x":1,"y":0,"z":-2,"type":"BODY"},{"x":2,"y":0,"z":-1,"type":"BODY"},{"x":-1,"y":-1,"z":-1,"type":"BODY"},{"x":1,"y":-1,"z":-1,"type":"BODY"},{"x":1,"y":-1,"z":1,"type":"BODY"},{"x":-1,"y":-1,"z":1,"type":"BODY"}];
      this.clear();
      data.forEach(item => {
          const type = CellType[item.type as keyof typeof CellType];
          this.setCell(item.x, item.y, item.z, type);
      });
      this.normalizeHeight();
  }

  public applyMirrorX() {
      const newCells = new Map<string, CellType>();
      this.cells.forEach((type, key) => {
          const [x, y, z] = key.split(',').map(Number);
          newCells.set(key, type);
          
          const mx = -x;
          newCells.set(`${mx},${y},${z}`, type);
      });
      this.cells = newCells;
  }
  
  public importOrganism(org: Organism) {
      this.clear();

      let needsVoxelization = false;
      for (const node of org.nodes) {
          if (node.originalGridCoord) {
              // Use stored type if available, otherwise fallback
              const type = node.cellType || (node.isHead ? CellType.HEAD : (node.friction > 0.6 ? CellType.FOOT : CellType.BODY));
              this.setCell(node.originalGridCoord.x, node.originalGridCoord.y, node.originalGridCoord.z, type);
          } else {
              needsVoxelization = true;
          }
      }

      // Fallback: If no metadata (legacy creature), try to voxelize based on position
      if (needsVoxelization) {
          org.nodes.forEach(n => {
             // Simple quantization fallback
             const x = Math.round(n.pos.x);
             const y = Math.round(n.pos.y);
             const z = Math.round(n.pos.z);
             const type = n.isHead ? CellType.HEAD : (y < 0.2 ? CellType.FOOT : CellType.BODY);
             this.setCell(x, y, z, type);
          });
      }
  }

  // --- LATTICE (cell-grid -> world-space + adjacency) ---
  // Cartesian grid, orthogonal + face-diagonal neighbors. The only lattice
  // this project has ever used — folded in directly rather than kept behind
  // a strategy interface with one implementation.

  private gridToWorld(coord: GridCoord, scale: number): Vec3 {
      return {
          x: coord.x * scale,
          y: coord.y * scale + 0.5,
          z: coord.z * scale
      };
  }

  private getNeighbors(coord: GridCoord): Neighbor[] {
      const offsets = [
          {x:1, y:0, z:0}, {x:-1, y:0, z:0},
          {x:0, y:1, z:0}, {x:0, y:-1, z:0},
          {x:0, y:0, z:1}, {x:0, y:0, z:-1},
          {x:1, y:1, z:0}, {x:1, y:-1, z:0},
          {x:0, y:1, z:1}, {x:0, y:1, z:-1},
          {x:1, y:0, z:1}, {x:1, y:0, z:-1}
      ];
      return offsets.map(o => ({
          coord: { x: coord.x + o.x, y: coord.y + o.y, z: coord.z + o.z }
      }));
  }

  // --- EXPORT TO PHYSICS WITH BRAIN GRAFTING ---

  public generateOrganism(id: string, source?: { neuralGenome: NeuralGenome; generation?: number }): Organism {
      const nodes: Node[] = [];
      const muscles: Muscle[] = [];
      const coordToNodeId = new Map<string, string>();
      const createdMuscles = new Set<string>();

      const activeCells = this.getCells();
      if (activeCells.length === 0) {
          // Default start if empty
          this.setCell(0,0,0, CellType.FOOT);
          this.setCell(0,1,0, CellType.HEAD);
          activeCells.push({x:0,y:0,z:0, type: CellType.FOOT}, {x:0,y:1,z:0, type: CellType.HEAD});
      }

      // --- HEIGHT NORMALIZATION ---
      // Ensure the creature sits on the floor regardless of editor position
      let minY = Infinity;
      for(let i=0; i<activeCells.length; i++) {
          const w = this.gridToWorld(activeCells[i], 0.8);
          if(w.y < minY) minY = w.y;
      }
      const heightOffset = -minY + 0.1; // Slight float

      const scale = 0.8; 
      
      // 1. Generate Nodes
      activeCells.forEach((c) => {
          const nodeId = `n_${c.x}_${c.y}_${c.z}`;
          coordToNodeId.set(`${c.x},${c.y},${c.z}`, nodeId);

          const worldPos = this.gridToWorld(c, scale);
          worldPos.y += heightOffset;

          // SPECIALIZED BRICK PROPERTIES
          let mass = 1.0;
          let friction = 0.4; // Default slippery body
          let isHead = false;

          if (c.type === CellType.HEAD) {
              isHead = true;
              mass = 4.0; // INCREASED: Was 1.6
              friction = 0.4;
          } else if (c.type === CellType.FOOT) {
              mass = 4.0; // INCREASED: Was 1.6
              friction = 0.9; // Sticky
          } else {
              // BODY
              mass = 5.0; // INCREASED: Was 2.0
              friction = 0.1; // Very slippery to allow sliding
          }

          nodes.push({
              id: nodeId,
              pos: worldPos,
              oldPos: VectorOps.copy(worldPos),
              mass,
              friction,
              isHead,
              originalGridCoord: { x: c.x, y: c.y, z: c.z },
              cellType: c.type // Persist for restoration
          });
      });

      // 2. Identify Head (Fallback logic if user placed no head)
      let headNode = nodes.find(n => n.isHead);
      
      if (!headNode) {
          // Heuristic Fallback
          let maxZ = -Infinity;
          for(let i=0; i<nodes.length; i++) { if (nodes[i].pos.z > maxZ) maxZ = nodes[i].pos.z; }
          
          let candidates: Node[] = [];
          for(let i=0; i<nodes.length; i++) { if (Math.abs(nodes[i].pos.z - maxZ) < 0.1) candidates.push(nodes[i]); }
          
          let maxY = -Infinity;
          for(let i=0; i<candidates.length; i++) { if (candidates[i].pos.y > maxY) maxY = candidates[i].pos.y; }
          
          headNode = candidates.find(n => Math.abs(n.pos.y - maxY) < 0.1);
          
          if (headNode) {
              // @ts-ignore
              headNode.isHead = true;
          }
      }
      
      // Init Head Pos
      const initialHeadPos = headNode ? { ...headNode.pos } : { x: 0, y: 0, z: 0 };

      // 3. Connect Muscles using Strategy
      const addMuscle = (n1: string, n2: string, stiffness: number = 0.8) => {
          const k = n1 < n2 ? `${n1}-${n2}` : `${n2}-${n1}`;
          if (createdMuscles.has(k)) return;
          
          const node1 = nodes.find(n => n.id === n1);
          const node2 = nodes.find(n => n.id === n2);
          if (!node1 || !node2) return;

          const dist = VectorOps.distance(node1.pos, node2.pos);
          const muscleId = `m_${k}`;
          muscles.push({
              id: muscleId,
              nodeA: n1,
              nodeB: n2,
              baseLength: dist,
              stiffness: stiffness, 
              dnaIndex: muscles.length,
              phase: Math.random() * Math.PI * 2,
              freq: 1.0,
              amp: 0.0,
              currentLength: dist,
              targetLength: dist
          });
          createdMuscles.add(k);
      };

      activeCells.forEach(c => {
          const myId = coordToNodeId.get(`${c.x},${c.y},${c.z}`);
          if (!myId) return;

          const neighbors = this.getNeighbors(c);
          neighbors.forEach(n => {
              const nid = coordToNodeId.get(`${n.coord.x},${n.coord.y},${n.coord.z}`);
              if (nid) {
                  addMuscle(myId, nid, 1.0);
              }
          });
      });

      // 4. Brain Grafting
      let genome: NeuralGenome;
      
      if (source && source.neuralGenome) {
          // Resize the brain if muscle count changed
          const oldG = source.neuralGenome;
          const newMusclesCount = muscles.length;
          const newNodesCount = nodes.length;
          
          // Helper to resize array
          const resize = (arr: number[], size: number) => {
              const res = new Array(size).fill(0);
              for(let i=0; i<Math.min(arr.length, size); i++) res[i] = arr[i];
              // Fill rest with random
              for(let i=arr.length; i<size; i++) res[i] = (Math.random()*1.0)-0.5;
              return res;
          };

          genome = {
              ...oldG,
              synapseWeights: resize(oldG.synapseWeights, newMusclesCount * 2), // Rough heuristic
              reservoirWeights: [...oldG.reservoirWeights], // Fixed size usually
              outputWeights: resize(oldG.outputWeights, newMusclesCount * 20),
              gripWeights: resize(oldG.gripWeights || [], newNodesCount * 20),
              biases: resize(oldG.biases, newNodesCount)
          };

      } else {
          // New Brain
          genome = this.geneticOperator.createRandomGenome(muscles.length, nodes.length);
      }

      for(let i=0; i<muscles.length; i++) muscles[i].dnaIndex = i;

      // STRICT SOT: Pass through metadata. If we have it, generation MUST match.
      const resolvedGeneration = genome.meta?.lineageGeneration || source?.generation || 1;

      return {
          id,
          nodes,
          muscles,
          neuralGenome: genome,
          fitness: 0,
          odometer: 0,
          foodForBreeding: 0,
          visitedTiles: {},
          generation: resolvedGeneration,
          energy: 100,
          maxEnergy: 100,
          hungerTime: 0,
          isAlive: true,
          foodEaten: 0,
          visibleFood: [],
          timeAlive: 0,
          initialHeadPos,
          distanceTraveled: 0,
          headNode // Cache
      };
  }
}