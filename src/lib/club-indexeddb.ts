import type { ClubDatabaseState } from './club-service';

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

/**
 * Salva dados e anexos permanentes específicos de um associado no IndexedDB.
 * Fica indexado por `member_docs_${subCode}`, sendo imune a merges de sincronização geral.
 */
export async function saveMemberPermanentDataToIndexedDB(
  subCode: string,
  data: any
): Promise<boolean> {
  if (!subCode) return false;
  try {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, `member_docs_${subCode.trim()}`);

      req.onsuccess = () => resolve(true);
      req.onerror = (err) => {
        console.warn('[ClubIndexedDB] Erro ao salvar dados permanentes do associado:', err);
        resolve(false);
      };
    });
  } catch (error) {
    console.warn('[ClubIndexedDB] Exceção ao gravar dados permanentes do associado:', error);
    return false;
  }
}

/**
 * Recupera os dados e anexos permanentes específicos de um associado do IndexedDB.
 */
export async function loadMemberPermanentDataFromIndexedDB(
  subCode: string
): Promise<any | null> {
  if (!subCode) return null;
  try {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`member_docs_${subCode.trim()}`);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = (err) => {
        console.warn('[ClubIndexedDB] Erro ao ler dados permanentes do associado:', err);
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('[ClubIndexedDB] Exceção ao ler dados permanentes do associado:', error);
    return null;
  }
}

/**
 * Carrega todos os registros de dados e anexos permanentes armazenados no IndexedDB.
 */
export async function loadAllMemberPermanentDataFromIndexedDB(): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  try {
    const db = await openDatabase();
    if (!db) return result;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = (store as any).openCursor ? store.openCursor() : null;

      if (!req) {
        resolve(result);
        return;
      }

      req.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = String(cursor.key);
          if (key.startsWith('member_docs_')) {
            const subCode = key.replace('member_docs_', '');
            result.set(subCode, cursor.value);
          }
          cursor.continue();
        } else {
          resolve(result);
        }
      };

      req.onerror = () => {
        resolve(result);
      };
    });
  } catch {
    return result;
  }
}
