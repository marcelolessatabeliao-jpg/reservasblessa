import type { ClubDatabaseState } from './club-types';

const DB_NAME = 'BalnearioLessaClubDB';
const DB_VERSION = 1;
const STORE_NAME = 'club_state_store';
const KEY_FULL_STATE = 'full_club_state';

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target?.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target?.result as IDBDatabase);
    };

    request.onerror = (err) => {
      console.warn('[ClubIndexedDB] Falha ao abrir IndexedDB:', err);
      resolve(null);
    };
  });
}

/**
 * Salva o estado completo no IndexedDB sem limitações de cota de 5MB.
 * Permite guardar gigabytes de fotos, anexos, comprovantes e histórico com segurança permanente.
 */
export async function saveStateToIndexedDB(state: ClubDatabaseState): Promise<boolean> {
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, KEY_FULL_STATE);

      req.onsuccess = () => resolve(true);
      req.onerror = (err) => {
        console.warn('[ClubIndexedDB] Erro ao salvar estado no IndexedDB:', err);
        resolve(false);
      };
    });
  } catch (error) {
    console.warn('[ClubIndexedDB] Exceção ao gravar no IndexedDB:', error);
    return false;
  }
}

/**
 * Carrega o estado completo do IndexedDB com todas as fotos e mídias intactas.
 */
export async function loadStateFromIndexedDB(): Promise<ClubDatabaseState | null> {
  try {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_FULL_STATE);

      req.onsuccess = () => {
        resolve((req.result as ClubDatabaseState) || null);
      };
      req.onerror = (err) => {
        console.warn('[ClubIndexedDB] Erro ao ler estado do IndexedDB:', err);
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('[ClubIndexedDB] Exceção ao ler do IndexedDB:', error);
    return null;
  }
}
