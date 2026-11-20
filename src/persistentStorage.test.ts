import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistentStorage } from './persistentStorage';

// モジュールが「1回のページ読み込みにつき1回」の状態を持つため、試験ごとに読み直す。
beforeEach(() => vi.resetModules());

async function loadRequester() {
  return import('./persistentStorage');
}

function storageOf({ persisted = false, persistResult = true, persistedError, persistError }:
{
  persisted?: boolean;
  persistResult?: boolean;
  persistedError?: Error;
  persistError?: Error;
} = {}): PersistentStorage {
  return {
    persisted: persistedError ? vi.fn(async () => { throw persistedError; }) : vi.fn(async () => persisted),
    persist: persistError ? vi.fn(async () => { throw persistError; }) : vi.fn(async () => persistResult),
  };
}

describe('persistent storage request', () => {
  it('asks once after the first successful save and never again', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    const storage = storageOf();
    await requestPersistentStorageOnce(storage);
    await requestPersistentStorageOnce(storage);
    await requestPersistentStorageOnce(storage);
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('checks the current state before asking', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    const storage = storageOf({ persisted: true });
    await requestPersistentStorageOnce(storage);
    expect(storage.persisted).toHaveBeenCalledTimes(1);
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('does nothing when the browser does not support persistence', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    // jsdomはnavigator.storageを実装していないので、未指定の既定値もここを通る。
    await expect(requestPersistentStorageOnce()).resolves.toBeUndefined();
    const withoutPersist = { persisted: vi.fn(async () => false) } as unknown as PersistentStorage;
    await expect(requestPersistentStorageOnce(withoutPersist)).resolves.toBeUndefined();
    expect(withoutPersist.persisted).not.toHaveBeenCalled();
  });

  it('shows nothing and does not throw when denied', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    const storage = storageOf({ persistResult: false });
    await expect(requestPersistentStorageOnce(storage)).resolves.toBeUndefined();
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('shows nothing and does not throw when the request fails', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    for (const storage of [
      storageOf({ persistedError: new Error('persisted() failed') }),
      storageOf({ persistError: new Error('persist() failed') }),
    ]) {
      await expect(requestPersistentStorageOnce(storage)).resolves.toBeUndefined();
    }
  });

  it('asks only once even when saves succeed in quick succession', async () => {
    const { requestPersistentStorageOnce } = await loadRequester();
    const storage = storageOf();
    await Promise.all([requestPersistentStorageOnce(storage), requestPersistentStorageOnce(storage)]);
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });
});
