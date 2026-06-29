import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { StorageBackend, StorageFile, UploadOptions } from './StorageBackend'

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export class LocalStorageBackend implements StorageBackend {
  private readonly basePath: string

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'storage', 'documents')
  }

  async upload(storageKey: string, buffer: Buffer, options: UploadOptions): Promise<string> {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`)
    }

    const fullPath = path.join(this.basePath, storageKey)
    const dir = path.dirname(fullPath)

    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(fullPath, buffer)

    return storageKey
  }

  async download(storageKey: string): Promise<StorageFile> {
    const fullPath = path.join(this.basePath, storageKey)

    try {
      await fs.promises.access(fullPath, fs.constants.R_OK)
    } catch {
      throw new Error(`File not found: ${storageKey}`)
    }

    const stat = await fs.promises.stat(fullPath)
    const stream = fs.createReadStream(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const contentType = this.getContentType(ext)

    return { stream, contentType, contentLength: stat.size }
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = path.join(this.basePath, storageKey)

    try {
      await fs.promises.unlink(fullPath)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }

    const dir = path.dirname(fullPath)
    try {
      const remaining = await fs.promises.readdir(dir)
      if (remaining.length === 0) {
        await fs.promises.rmdir(dir)
      }
    } catch {
      // ignore cleanup failures
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, storageKey)
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  private getContentType(ext: string): string {
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
    }
    return mimeMap[ext] || 'application/octet-stream'
  }
}
