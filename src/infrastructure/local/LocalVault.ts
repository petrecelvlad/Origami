import { Organism, FamilyType } from '../../domain/types';
import { Serializer } from '../../application/Serializer';

const DB_NAME = 'OrigamiVault';
const DB_VERSION = 1;
const STORE_NAME = 'champions';

export interface LocalVaultEntry {
    id: string; // e.g. slot_BRUTE
    family: FamilyType;
    generation: number;
    snapshot: any;
    updatedAt: number;
}

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types", "@application/Serializer"],
 *   "agent_instructions": "Local-first persistence using IndexedDB. Enforce the generational safeguard to prevent older genomes from overwriting champions."
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
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    public async saveChampion(org: Organism): Promise<void> {
        const db = await this.getDB();
        const family = org.family || FamilyType.APEX;
        const id = `slot_${family}`;
        const currentGen = org.neuralGenome?.meta?.lineageGeneration || org.generation || 1;

        // --- SAFEGUARD: Prevent older generations from overwriting newer ones ---
        try {
            const existing = await new Promise<LocalVaultEntry | null>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });

            if (existing && existing.generation > currentGen) {
                console.warn(`[LocalVault Safeguard] Aborted save for ${family}: Incoming Gen ${currentGen} is older than stored Gen ${existing.generation}`);
                return;
            }
        } catch (e) {
            // If check fails, we proceed to save as a fallback to ensure we at least try to persist
        }

        const entry: LocalVaultEntry = {
            id,
            family,
            generation: currentGen,
            snapshot: Serializer.serializeOrganism(org),
            updatedAt: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error("LocalVault saveChampion put error:", request.error);
                reject(request.error);
            };
        });
    }

    public async getChampionByFamily(family: FamilyType): Promise<Organism | null> {
        const db = await this.getDB();
        const id = `slot_${family}`;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                const entry = request.result as LocalVaultEntry | null;
                if (!entry) return resolve(null);
                
                const org = Serializer.deserializeOrganism(entry.snapshot);
                resolve(org);
            };

            request.onerror = () => reject(request.error);
        });
    }

    public async getBestLocalChampion(): Promise<LocalVaultEntry | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result as LocalVaultEntry[];
                if (results.length === 0) return resolve(null);
                
                results.sort((a, b) => b.generation - a.generation);
                const best = results[0];
                best.snapshot = Serializer.deserializeOrganism(best.snapshot);
                resolve(best);
            };

            request.onerror = () => reject(request.error);
        });
    }

    public async getAllLocalChampions(): Promise<LocalVaultEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result as LocalVaultEntry[];
                results.forEach(r => {
                    r.snapshot = Serializer.deserializeOrganism(r.snapshot);
                });
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async saveAllChampions(organisms: Organism[]): Promise<void> {
        const db = await this.getDB();
        
        // 1. Identify which organisms should be saved (Generation Safeguard)
        const toSave = await new Promise<Organism[]>((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const existingEntries = request.result as LocalVaultEntry[];
                const filtered = organisms.filter(org => {
                    const family = org.family || FamilyType.APEX;
                    const id = `slot_${family}`;
                    const currentGen = org.neuralGenome?.meta?.lineageGeneration || org.generation || 1;
                    
                    const existing = existingEntries.find(e => e.id === id);
                    if (existing) {
                        if (existing.generation > currentGen) {
                            console.warn(`[LocalVault Safeguard] Aborted bulk save for ${family}: Incoming Gen ${currentGen} <= Stored Gen ${existing.generation}`);
                            return false;
                        }
                    }
                    return true;
                });
                resolve(filtered);
            };
            request.onerror = () => resolve([]); // Fallback to saving nothing if read fails
        });

        if (toSave.length === 0) return;

        // 2. Save the identified organisms
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            toSave.forEach(org => {
                const family = org.family || FamilyType.APEX;
                const entry: LocalVaultEntry = {
                    id: `slot_${family}`,
                    family,
                    generation: org.neuralGenome?.meta?.lineageGeneration || org.generation || 1,
                    snapshot: Serializer.serializeOrganism(org),
                    updatedAt: Date.now()
                };
                store.put(entry);
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export const localVault = new LocalVault();
