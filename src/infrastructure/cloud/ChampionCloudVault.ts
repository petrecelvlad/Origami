import { LineageRecord } from '../../domain/types';
import { isAdminBuild } from '../../config';

const CLOUD_API_BASE = 'https://origami-champions-api.contact-youos.workers.dev';

interface LineageRow {
    lineage_id: string;
    project_name: string;
    generation: number;
    payload: string;
    updated_at: number;
}

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types"],
 *   "agent_instructions": "Cloud mirror of LocalVault, sourced from the origami-champions-api Worker. Stores ONE record per lineage (body shell + champion brains), per Charter invariants 1-2. getAllCloudLineages is safe in any build. pushLineage is gated on isAdminBuild (VITE_ADMIN_BUILD, set via a gitignored .env.local for local admin use only) - Vite dead-code-eliminates that branch (and the in-memory token it holds) from any build where the flag isn't set at build time, so the public deploy never ships write capability or a token. Do not remove the isAdminBuild guard."
 * }
 */
export class ChampionCloudVault {
    private devToken: string | null = null;

    public async getAllCloudLineages(): Promise<LineageRecord[]> {
        const response = await fetch(`${CLOUD_API_BASE}/lineages`);
        if (!response.ok) {
            throw new Error(`Cloud vault fetch failed: ${response.status}`);
        }
        const rows: LineageRow[] = await response.json();
        return rows.map(row => JSON.parse(row.payload) as LineageRecord);
    }

    public async pushLineage(record: LineageRecord): Promise<{ lineageId: string; generation: number } | null> {
        if (!isAdminBuild) {
            throw new Error('Cloud push is only available in the admin build.');
        }

        if (!this.devToken) {
            this.devToken = window.prompt('Cloudflare API_TOKEN (kept in memory for this tab only):');
            if (!this.devToken) return null;
        }

        const response = await fetch(`${CLOUD_API_BASE}/lineages/${record.lineageId}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.devToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectName: record.projectName,
                generation: record.generation,
                payload: record
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
}

export const championCloudVault = new ChampionCloudVault();
