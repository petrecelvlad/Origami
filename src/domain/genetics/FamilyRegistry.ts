import { FamilyType } from '../types';

export class FamilyRegistry {
    private static readonly SYNTHESIS_MAP: Record<string, FamilyType> = {
        [`${FamilyType.BRUTE}+${FamilyType.MONOLITH}`]: FamilyType.CHARGER,
        [`${FamilyType.MONOLITH}+${FamilyType.SCOUT}`]: FamilyType.NOMAD,
        [`${FamilyType.SCOUT}+${FamilyType.BRUTE}`]: FamilyType.HUNTER,
        [`${FamilyType.CHARGER}+${FamilyType.NOMAD}`]: FamilyType.GUARDIAN,
        [`${FamilyType.NOMAD}+${FamilyType.HUNTER}`]: FamilyType.PHANTOM,
        [`${FamilyType.HUNTER}+${FamilyType.CHARGER}`]: FamilyType.WARRIOR,
    };

    private static readonly TIER_2_FAMILIES = new Set([
        FamilyType.GUARDIAN,
        FamilyType.PHANTOM,
        FamilyType.WARRIOR
    ]);

    /**
     * Combines two families to determine the offspring's family.
     */
    static synthesize(p1: FamilyType, p2: FamilyType): FamilyType {
        if (p1 === p2) return p1;

        const parents = [p1, p2].sort();
        const key = parents.join('+');

        // Look up in primary synthesis map
        if (this.SYNTHESIS_MAP[key]) {
            return this.SYNTHESIS_MAP[key];
        }

        // Logic for Apex tier
        if (this.TIER_2_FAMILIES.has(p1) || this.TIER_2_FAMILIES.has(p2)) {
            return FamilyType.APEX;
        }

        // Default: return the first parent's family
        return p1;
    }

    /**
     * Calculates the "evolutionary depth" or Tier of a family.
     */
    static getTier(family: FamilyType): number {
        const tier0 = [FamilyType.BRUTE, FamilyType.MONOLITH, FamilyType.SCOUT];
        const tier1 = [FamilyType.CHARGER, FamilyType.NOMAD, FamilyType.HUNTER];
        const tier2 = [FamilyType.GUARDIAN, FamilyType.PHANTOM, FamilyType.WARRIOR];

        if (tier0.includes(family)) return 0;
        if (tier1.includes(family)) return 1;
        if (tier2.includes(family)) return 2;
        if (family === FamilyType.APEX) return 3;
        
        return 0;
    }
}
