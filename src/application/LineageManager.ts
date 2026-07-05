import { Organism, FamilyType } from '../domain/types';
import { AtomicNormalizer } from '../domain/AtomicNormalizer';

export class LineageManager {
  private currentLineageId: string = '';
  private currentProjectName: string = 'Unnamed Project';
  private generationCount: number = 1;
  private familyChampions: Map<FamilyType, Organism> = new Map();

  public initialize(projectName: string, initialGeneration: number = 1) {
    this.currentLineageId = `lin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentProjectName = projectName;
    this.generationCount = initialGeneration;
    this.familyChampions.clear();
  }

  public adopt(organism: Organism) {
    const meta = organism.neuralGenome?.meta;
    if (meta) {
      this.currentLineageId = meta.lineageId;
      this.currentProjectName = meta.projectName;
      this.generationCount = meta.lineageGeneration;
    } else {
      this.currentLineageId = `lin_${Date.now()}`;
      this.currentProjectName = "Legacy Subject";
      this.generationCount = organism.generation || 1;
    }
  }

  public incrementGeneration() {
    this.generationCount++;
  }

  public get generation(): number { return this.generationCount; }
  public get lineageId(): string { return this.currentLineageId; }
  public get projectName(): string { return this.currentProjectName; }

  public setChampion(family: FamilyType, organism: Organism) {
    this.familyChampions.set(family, AtomicNormalizer.sanitize(organism));
  }

  public getChampion(family: FamilyType): Organism | undefined {
    return this.familyChampions.get(family);
  }

  public clearChampions() {
    this.familyChampions.clear();
  }

  public getAllChampions(): Organism[] {
    return Array.from(this.familyChampions.values());
  }

  public bulkLoadChampions(champions: Organism[]) {
    champions.forEach(champ => {
      if (champ.family) {
        this.familyChampions.set(champ.family as FamilyType, AtomicNormalizer.sanitize(champ));
      }
    });
  }
}
