import { Organism, ChampionRecord, LineageRecord, FamilyType } from '../domain/types';
import { GeneticOperator, FAMILY_COLORS } from '../domain/genetics/GeneticOperator';
import { BlueprintService } from '../domain/BlueprintService';

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types", "@domain/BlueprintService", "@domain/genetics/GeneticOperator"],
 *   "constraints": ["Charter invariants 1-2: a stored champion is a brain plus identity; bodies are never persisted per creature"],
 *   "agent_instructions": "Converts between stored records (ChampionRecord/LineageRecord) and live organisms. Construction from blueprint IS deserialization — do not reintroduce full-organism snapshots."
 * }
 */
export class Serializer {
    private static genetics = new GeneticOperator();

    /**
     * Capture a live organism's evolving state: brain + identity, nothing else.
     * The genome is deep-copied so the record never aliases live arrays.
     */
    public static serializeChampion(org: Organism): ChampionRecord {
        return {
            family: (org.family ?? FamilyType.BRUTE) as FamilyType,
            generation: org.neuralGenome?.meta?.lineageGeneration ?? org.generation ?? 1,
            fitness: org.fitness ?? 0,
            genome: Serializer.genetics.cloneGenome(org.neuralGenome)
        };
    }

    /**
     * Rebuild a live organism from stored records: the lineage's body shell
     * (blueprint DNA) + one champion brain. Every creature built this way
     * spawns from the identical shell in the identical pose.
     */
    public static buildOrganism(lineage: Pick<LineageRecord, 'blueprint'>, champion: ChampionRecord): Organism {
        const blueprint = new BlueprintService();
        blueprint.loadCells(lineage.blueprint);

        const org = blueprint.generateOrganism(`champ_${champion.family}_${Date.now()}`, {
            neuralGenome: Serializer.genetics.cloneGenome(champion.genome),
            generation: champion.generation
        });
        org.family = champion.family;
        org.color = FAMILY_COLORS[champion.family];
        org.fitness = champion.fitness;
        return org;
    }

    /**
     * The single entry point for restoring a saved project (vault or file):
     * builds the template organism EvolutionService.setTemplateAndReset needs,
     * from the lineage's best-fitness champion, plus the full champion pool
     * to reseed every other family.
     */
    public static buildTemplateFromLineage(record: LineageRecord): { template: Organism; champions: ChampionRecord[] } {
        if (!record.champions || record.champions.length === 0) {
            throw new Error(`Lineage "${record.projectName}" has no stored champions to restore from.`);
        }
        const best = [...record.champions].sort((a, b) => b.fitness - a.fitness)[0];
        const template = Serializer.buildOrganism(record, best);
        template.neuralGenome.meta = {
            lineageId: record.lineageId,
            projectName: record.projectName,
            lineageGeneration: record.generation,
            originDate: new Date().toISOString()
        };
        return { template, champions: record.champions };
    }
}
