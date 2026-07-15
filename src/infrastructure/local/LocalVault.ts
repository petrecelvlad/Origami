import { FamilyType, ChampionRecord, LineageRecord } from '../../domain/types';

const DB_NAME = 'OrigamiVault';
const DB_VERSION = 2;
const STORE_NAME = 'lineages';

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types"],
 *   "agent_instructions": "Local-first persistence using IndexedDB. Stores ONE record per lineage (body shell + champion brains), per Charter invariants 1-2 - never a per-creature body snapshot. Enforces the generational safeguard to prevent older genomes from overwriting champions."
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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'lineageId' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    public async saveLineage(record: LineageRecord): Promise<void> {
        const db = await this.getDB();

        // --- SAFEGUARD: Prevent older generations from overwriting newer ones ---
        try {
            const existing = await new Promise<LineageRecord | null>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(record.lineageId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });

            if (existing && existing.generation > record.generation) {
                console.warn(`[LocalVault Safeguard] Aborted save for lineage ${record.lineageId}: incoming Gen ${record.generation} is older than stored Gen ${existing.generation}`);
                return;
            }
        } catch (e) {
            // If check fails, we proceed to save as a fallback to ensure we at least try to persist
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error("LocalVault saveLineage put error:", request.error);
                reject(request.error);
            };
        });
    }

    public async getLineage(lineageId: string): Promise<LineageRecord | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(lineageId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async getChampionByFamily(lineageId: string, family: FamilyType): Promise<ChampionRecord | null> {
        const record = await this.getLineage(lineageId);
        if (!record) return null;
        return record.champions.find(c => c.family === family) || null;
    }

    /**
     * The product currently focuses on one active lineage at a time; this
     * returns it. The schema tolerates multiple stored lineages (keyed by
     * lineageId) for whenever the product grows beyond one project.
     */
    public async getMostRecentLineage(): Promise<LineageRecord | null> {
        const all = await this.getAllLineages();
        if (all.length === 0) return null;
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        return all[0];
    }

    public async getAllLineages(): Promise<LineageRecord[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as LineageRecord[]);
            request.onerror = () => reject(request.error);
        });
    }
}

export const localVault = new LocalVault();
