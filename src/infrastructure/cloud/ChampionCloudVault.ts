import { FamilyType, Organism } from '../../domain/types';
import { Serializer } from '../../application/Serializer';
import { isAdminBuild } from '../../config';

const CLOUD_API_BASE = 'https://origami-champions-api.contact-youos.workers.dev';

export interface CloudVaultEntry {
    family: FamilyType;
    generation: number;
    fitness: number;
    snapshot: any;
    updatedAt: number;
}

interface ChampionRow {
    family: string;
    generation: number;
    fitness: number;
    payload: string;
    updated_at: number;
}

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types", "@application/Serializer"],
 *   "agent_instructions": "Cloud mirror of LocalVault, sourced from the origami-champions-api Worker. getAllCloudChampions is safe in any build. pushChampion/pushAllChampions are gated on isAdminBuild (VITE_ADMIN_BUILD, set via a gitignored .env.local for local admin use only) — Vite dead-code-eliminates that branch (and the in-memory token it holds) from any build where the flag isn't set at build time, so the public deploy never ships write capability or a token. Do not remove the isAdminBuild guard."
 * }
 */
export class ChampionCloudVault {
    private devToken: string | null = null;

    public async getAllCloudChampions(): Promise<CloudVaultEntry[]> {
        const response = await fetch(`${CLOUD_API_BASE}/champions`);
        if (!response.ok) {
            throw new Error(`Cloud vault fetch failed: ${response.status}`);
        }
        const rows: ChampionRow[] = await response.json();
        return rows.map(row => ({
            family: row.family as FamilyType,
            generation: row.generation,
            fitness: row.fitness,
            snapshot: JSON.parse(row.payload),
            updatedAt: row.updated_at
        }));
    }

    public async pushChampion(org: Organism): Promise<{ family: string; generation: number } | null> {
        if (!isAdminBuild) {
            throw new Error('Cloud push is only available in the admin build.');
        }
        if (!org.family) {
            throw new Error('Cannot push a champion with no family assigned.');
        }

        if (!this.devToken) {
            this.devToken = window.prompt('Cloudflare API_TOKEN (kept in memory for this tab only):');
            if (!this.devToken) return null;
        }

        const generation = org.neuralGenome?.meta?.lineageGeneration ?? org.generation ?? 1;
        const response = await fetch(`${CLOUD_API_BASE}/champions/${org.family}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.devToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                generation,
                fitness: org.fitness ?? 0,
                payload: Serializer.serializeOrganism(org)
            })
        });

        if (response.status === 401) {
            this.devToken = null;
            throw new Error('Cloud push rejected: bad token.');
        }
        if (!response.ok) {
            throw new Error(`Cloud push failed for ${org.family}: ${response.status}`);
        }
        return response.json();
    }

    public async pushAllChampions(orgs: Organism[]): Promise<{ pushed: string[]; skipped: string[] }> {
        const pushed: string[] = [];
        const skipped: string[] = [];
        for (const org of orgs) {
            const result = await this.pushChampion(org);
            if (result) {
                pushed.push(result.family);
            } else if (org.family) {
                skipped.push(org.family);
            }
        }
        return { pushed, skipped };
    }
}

export const championCloudVault = new ChampionCloudVault();
