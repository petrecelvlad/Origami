import { Node, Muscle } from '../types';

export interface ShapeData {
  nodes: Node[];
  muscles: Muscle[];
}

export interface IShapeBlueprint {
  readonly type: string;
  generate(): ShapeData;
}
