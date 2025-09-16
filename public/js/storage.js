// Storage utilities for IndexedDB
export const storage = {
    dbName: 'RecorderDB',
    storeName: 'recordings',
    db: null,

    // Initialize IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('downloaded', 'downloaded');
                    store.createIndex('sessionId', 'sessionId');
                }
            };
        });
    },

    async saveRecording(blob, type, sessionId) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const recording = {
            id,
            blob,
            type,
            timestamp: Date.now(),
            downloaded: false,
            sessionId
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(recording);
            
            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getRecording(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async markDownloaded(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            
            request.onsuccess = () => {
                const recording = request.result;
                recording.downloaded = true;
                store.put(recording);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    async deleteRecording(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async cleanupSession(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const sessionIndex = store.index('sessionId');
            const request = sessionIndex.openCursor(IDBKeyRange.only(sessionId));
            
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    if (!cursor.value.downloaded) {
                        store.delete(cursor.key);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    async listSessionRecordings(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const sessionIndex = store.index('sessionId');
            const request = sessionIndex.getAll(IDBKeyRange.only(sessionId));
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};
