import { Readable } from 'stream'

export interface UploadOptions {
  fileName: string
  contentType?: string
}

export interface StorageFile {
  stream: Readable
  contentType: string
  contentLength: number
}

export interface StorageBackend {
  upload(filePath: string, buffer: Buffer, options: UploadOptions): Promise<string>
  download(storageKey: string): Promise<StorageFile>
  delete(storageKey: string): Promise<void>
  exists(storageKey: string): Promise<boolean>
}
