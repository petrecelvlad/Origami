import { FamilyType, ChampionRecord, LineageRecord } from '../../domain/types';

const DB_NAME = 'OrigamiVault';
const DB_VERSION = 3;
const LINEAGE_STORE = 'lineages';
const CHAMPION_STORE = 'champions';

type StoredLineage = Omit<LineageRecord, 'champions'>;
interface StoredChampion extends ChampionRecord {
    id: string; // `${lineageId}::${family}` - the object store's keyPath
    lineageId: string;
}

function championKey(lineageId: string, family: FamilyType): string {
    return `${lineageId}::${family}`;
}

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types"],
 *   "agent_instructions": "Local-first persistence using IndexedDB. The body-shell blueprint lives once per lineage (`lineages` store); each family champion is its own row in `champions`, referencing its lineage by lineageId (owner request, 2026-07-16) - never a per-creature body snapshot (Charter invariants 1-2). saveLineage/getMostRecentLineage/getLineage reassemble the two stores into the LineageRecord shape the rest of the app expects, so callers never see the split. Enforces the generational safeguard per champion row."
 * }
 */
export class LocalVault {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(LINEAGE_STORE)) {
                    db.createObjectStore(LINEAGE_STORE, { keyPath: 'lineageId' });
                }
                if (!db.objectStoreNames.contains(CHAMPION_STORE)) {
                    const store = db.createObjectStore(CHAMPION_STORE, { keyPath: 'id' });
                    store.createIndex('lineageId', 'lineageId', { unique: false });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    private async getChampionsForLineage(lineageId: string): Promise<ChampionRecord[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAMPION_STORE], 'readonly');
            const index = transaction.objectStore(CHAMPION_STORE).index('lineageId');
            const request = index.getAll(lineageId);
            request.onsuccess = () => {
                const rows = request.result as StoredChampion[];
                resolve(rows.map(({ id, lineageId: _l, ...champion }) => champion));
            };
            request.onerror = () => reject(request.error);
        });
    }

    private async saveChampionRow(lineageId: string, champion: ChampionRecord): Promise<void> {
        const db = await this.getDB();
        const id = championKey(lineageId, champion.family);

        try {
            const existing = await new Promise<StoredChampion | null>((resolve, reject) => {
                const tx = db.transaction([CHAMPION_STORE], 'readonly');
                const req = tx.objectStore(CHAMPION_STORE).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
            if (existing && existing.generation > champion.generation) {
                console.warn(`[LocalVault Safeguard] Aborted save for ${lineageId}/${champion.family}: incoming Gen ${champion.generation} is older than stored Gen ${existing.generation}`);
                return;
            }
        } catch {
            // If the check fails, proceed to save as a fallback to ensure we at least try to persist.
        }

        const row: StoredChampion = { ...champion, id, lineageId };
        return new Promise((resolve, reject) => {
            const tx = db.transaction([CHAMPION_STORE], 'readwrite');
            const request = tx.objectStore(CHAMPION_STORE).put(row);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /** Saves the lineage shell, then each of its champions as its own row. */
    public async saveLineage(record: LineageRecord): Promise<void> {
        const db = await this.getDB();
        const { champions, ...shell } = record;

        try {
            const existingShell = await new Promise<StoredLineage | null>((resolve, reject) => {
                const tx = db.transaction([LINEAGE_STORE], 'readonly');
                const req = tx.objectStore(LINEAGE_STORE).get(record.lineageId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
            if (existingShell && existingShell.generation > record.generation) {
                console.warn(`[LocalVault Safeguard] Aborted save for lineage ${record.lineageId}: incoming Gen ${record.generation} is older than stored Gen ${existingShell.generation}`);
                return;
            }
        } catch {
            // If the check fails, proceed to save as a fallback to ensure we at least try to persist.
        }

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([LINEAGE_STORE], 'readwrite');
            const request = tx.objectStore(LINEAGE_STORE).put(shell);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        for (const champion of champions) {
            await this.saveChampionRow(record.lineageId, champion);
        }
    }

    public async getLineage(lineageId: string): Promise<LineageRecord | null> {
        const db = await this.getDB();
        const shell = await new Promise<StoredLineage | null>((resolve, reject) => {
            const transaction = db.transaction([LINEAGE_STORE], 'readonly');
            const request = transaction.objectStore(LINEAGE_STORE).get(lineageId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
        if (!shell) return null;

        const champions = await this.getChampionsForLineage(lineageId);
        return { ...shell, champions };
    }

    public async getChampionByFamily(lineageId: string, family: FamilyType): Promise<ChampionRecord | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CHAMPION_STORE], 'readonly');
            const request = transaction.objectStore(CHAMPION_STORE).get(championKey(lineageId, family));
            request.onsuccess = () => {
                const row = request.result as StoredChampion | undefined;
                if (!row) return resolve(null);
                const { id, lineageId: _l, ...champion } = row;
                resolve(champion);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * The product currently focuses on one active lineage at a time; this
     * returns it, fully assembled (shell + champions). The schema tolerates
     * multiple stored lineages (keyed by lineageId) for whenever the product
     * grows beyond one project.
     */
    public async getMostRecentLineage(): Promise<LineageRecord | null> {
        const shells = await this.getAllLineageShells();
        if (shells.length === 0) return null;
        shells.sort((a, b) => b.updatedAt - a.updatedAt);
        const latest = shells[0];
        const champions = await this.getChampionsForLineage(latest.lineageId);
        return { ...latest, champions };
    }

    private async getAllLineageShells(): Promise<StoredLineage[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([LINEAGE_STORE], 'readonly');
            const request = transaction.objectStore(LINEAGE_STORE).getAll();
            request.onsuccess = () => resolve(request.result as StoredLineage[]);
            request.onerror = () => reject(request.error);
        });
    }

    public async getAllLineages(): Promise<LineageRecord[]> {
        const shells = await this.getAllLineageShells();
        return Promise.all(shells.map(async shell => ({
            ...shell,
            champions: await this.getChampionsForLineage(shell.lineageId)
        })));
    }
}

export const localVault = new LocalVault();
