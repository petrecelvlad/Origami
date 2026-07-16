import { ChampionRecord, LineageRecord } from '../../domain/types';
import { isAdminBuild } from '../../config';

const CLOUD_API_BASE = 'https://origami-champions-api.contact-youos.workers.dev';

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types"],
 *   "agent_instructions": "Cloud mirror of LocalVault, sourced from the origami-champions-api Worker. The body-shell blueprint lives once per lineage; each family champion is pushed as its own row (owner request, 2026-07-16) via POST /lineages/:id/champions/:family - never nested body/food/physics state (Charter invariants 1-2). getAllCloudLineages is safe in any build; the worker reassembles champions into each lineage's `champions` array server-side, so this file's shape never has to change. pushLineage/pushChampion are gated on isAdminBuild (VITE_ADMIN_BUILD, set via a gitignored .env.local for local admin use only). This module must only ever be reached via a dynamic import() inside an `if (isAdminBuild)` branch (see VaultPanel.tsx) - a static import bundles this file (including the token prompt and Bearer-auth construction) into every build regardless of the flag, since Vite/Rollup does not dead-code-eliminate through a runtime-conditional JSX render. The dynamic import is what actually keeps this file out of the public build's fetched code. Do not remove the isAdminBuild guard, and do not convert the import back to static."
 * }
 */
export class ChampionCloudVault {
    private devToken: string | null = null;

    public async getAllCloudLineages(): Promise<LineageRecord[]> {
        const response = await fetch(`${CLOUD_API_BASE}/lineages`);
        if (!response.ok) {
            throw new Error(`Cloud vault fetch failed: ${response.status}`);
        }
        return response.json();
    }

    private async getToken(): Promise<string | null> {
        if (!isAdminBuild) {
            throw new Error('Cloud push is only available in the admin build.');
        }
        if (!this.devToken) {
            this.devToken = window.prompt('Cloudflare API_TOKEN (kept in memory for this tab only):');
        }
        return this.devToken;
    }

    public async pushLineage(record: LineageRecord): Promise<{ lineageId: string; generation: number } | null> {
        const token = await this.getToken();
        if (!token) return null;

        // Shell only - champions are pushed as their own rows via pushChampion.
        const { champions, ...shell } = record;

        const response = await fetch(`${CLOUD_API_BASE}/lineages/${record.lineageId}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName: record.projectName,
                generation: record.generation,
                payload: shell
            })
        });

        if (response.status === 401) {
            this.devToken = null;
            throw new Error('Cloud push rejected: bad token.');
        }
        if (!response.ok) {
            throw new Error(`Cloud push failed for lineage ${record.lineageId}: ${response.status}`);
        }
        return response.json();
    }

    public async pushChampion(lineageId: string, champion: ChampionRecord): Promise<{ family: string; generation: number } | null> {
        const token = await this.getToken();
        if (!token) return null;

        const response = await fetch(`${CLOUD_API_BASE}/lineages/${lineageId}/champions/${champion.family}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                generation: champion.generation,
                fitness: champion.fitness,
                payload: champion
            })
        });

        if (response.status === 401) {
            this.devToken = null;
            throw new Error('Cloud push rejected: bad token.');
        }
        if (response.status === 409) {
            return null; // Stored generation is already newer - not an error, just a no-op.
        }
        if (!response.ok) {
            throw new Error(`Cloud push failed for ${lineageId}/${champion.family}: ${response.status}`);
        }
        return response.json();
    }

    /** Pushes the lineage shell, then every champion as its own row. */
    public async pushLineageWithChampions(record: LineageRecord): Promise<{ pushed: string[]; skipped: string[] }> {
        const shellResult = await this.pushLineage(record);
        if (!shellResult) return { pushed: [], skipped: record.champions.map(c => c.family) };

        const pushed: string[] = [];
        const skipped: string[] = [];
        for (const champion of record.champions) {
            const result = await this.pushChampion(record.lineageId, champion);
            if (result) pushed.push(champion.family);
            else skipped.push(champion.family);
        }
        return { pushed, skipped };
    }
}

export const championCloudVault = new ChampionCloudVault();
