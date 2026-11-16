import { DatasetType, OnlineStorage } from '@tblabs/storage'

export const STORAGE_SERVER = 'https://stage.storage.specteam.pl/v5/'
/** OnlineStorage database directory on stage. */
export const STORAGE_DATABASE = 'Snapshots'
/** ObjectDataset inside the Snapshots database (app-owned items). */
export const STORAGE_DATASET = 'Mana'

export type RemoteSnapshot = {
  id: string
  dateLabel: string
  createdAt: string
  rows: unknown[]
}

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'ok'
  | 'auth-required'
  | 'error'

export type SyncState = {
  status: SyncStatus
  message: string
}

const storage = new OnlineStorage(STORAGE_SERVER, STORAGE_DATABASE)

export function getStorage(): OnlineStorage {
  return storage
}

export function isStorageAuthorized(): boolean {
  return storage.IsAuthorized
}

export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /anonymous|login|auth|password|does not exist|not authorized|unauthorized|privilege/i.test(
    message,
  )
}

function snapshotsDataset() {
  return storage.GetObjectDataset<RemoteSnapshot>(STORAGE_DATASET)
}

async function ensureDataset(): Promise<void> {
  const exists = await storage.DatasetExists(STORAGE_DATASET)
  if (exists) return
  await storage.CreateDataset(STORAGE_DATASET, {
    Type: DatasetType.Object,
    CreatedBy: storage.User?.Id || 'Mana',
    CreatedAt: new Date(),
  })
}

export async function loginToStorage(
  login: string,
  password: string,
): Promise<void> {
  await storage.Login(password, login.trim() || undefined)
}

export async function logoutFromStorage(): Promise<void> {
  storage.Logout()
}

/** Pull all snapshot objects from the remote ObjectDataset. */
export async function fetchRemoteSnapshots(): Promise<RemoteSnapshot[]> {
  await ensureDataset()
  const dataset = snapshotsDataset()
  const ids = await dataset.GetAllIds()
  const items = await Promise.all(
    ids.map(async (id) => {
      const item = await dataset.GetOne(id)
      return {
        id: typeof item?.id === 'string' ? item.id : id,
        dateLabel:
          typeof item?.dateLabel === 'string' ? item.dateLabel : id,
        createdAt:
          typeof item?.createdAt === 'string'
            ? item.createdAt
            : new Date().toISOString(),
        rows: Array.isArray(item?.rows) ? item.rows : [],
      } satisfies RemoteSnapshot
    }),
  )
  return items
}

/** Upsert/delete so remote ObjectDataset matches the given snapshots. */
export async function pushRemoteSnapshots(
  snapshots: RemoteSnapshot[],
): Promise<void> {
  await ensureDataset()
  const dataset = snapshotsDataset()
  const remoteIds = new Set(await dataset.GetAllIds())
  const localIds = new Set(snapshots.map((s) => s.id))

  for (const snapshot of snapshots) {
    const payload: RemoteSnapshot = {
      id: snapshot.id,
      dateLabel: snapshot.dateLabel,
      createdAt: snapshot.createdAt,
      rows: snapshot.rows,
    }
    if (remoteIds.has(snapshot.id)) {
      await dataset.Update(snapshot.id, payload)
    } else {
      await dataset.Add(snapshot.id, payload)
    }
  }

  for (const id of remoteIds) {
    if (!localIds.has(id)) {
      await dataset.Delete(id)
    }
  }
}

export function authCredentialHint(): string {
  return (
    `OnlineStorage.Login(password, login) for database "${STORAGE_DATABASE}" ` +
    `at ${STORAGE_SERVER} — provide a Snapshots DB user login + password.`
  )
}
