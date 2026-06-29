export interface SignerInfo {
  name: string
  email: string
  role?: 'signer' | 'cc'
  order?: number
}

export interface CreateSigningRequestParams {
  title: string
  message?: string
  signers: SignerInfo[]
  fileUrls?: string[]
  fileBytes?: Array<{ filename: string; content: Buffer }>
  ccEmailAddresses?: string[]
  expiresInDays?: number
  clientId?: string
}

export interface CreateSigningRequestResult {
  envelopeId: string
  providerName: ProviderName
  status: 'pending_send' | 'sent' | 'error'
  signUrl?: string
  errorMessage?: string
}

export interface SendSigningRequestResult {
  envelopeId: string
  providerName: ProviderName
  status: 'sent' | 'error'
  sentAt: string
  errorMessage?: string
}

export interface GetSigningRequestStatusResult {
  envelopeId: string
  providerName: ProviderName
  providerStatus: string
  platformStatus: PlatformSigningStatus
  signers: Array<{ email: string; status: string; signedAt?: string }>
}

export type PlatformSigningStatus =
  | 'draft'
  | 'awaiting_signature'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'voided'
  | 'error'

export type ProviderName = 'dropbox_sign' | 'mock'

export interface VoidSigningRequestResult {
  envelopeId: string
  providerName: ProviderName
  providerStatus: string
  platformStatus: PlatformSigningStatus
  voidedAt: string
}

export interface SignedDocument {
  envelopeId: string
  fileName: string
  fileType: string
  fileSizeBytes: number
  content: Buffer
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = 'AdapterError'
  }
}

export class EnvelopeNotFoundError extends AdapterError {
  constructor(message = 'Envelope not found') {
    super(message, 'ENVELOPE_NOT_FOUND', false)
    this.name = 'EnvelopeNotFoundError'
  }
}

export class EnvelopeAlreadyCompletedError extends AdapterError {
  constructor(message = 'Envelope is already completed and cannot be voided') {
    super(message, 'ENVELOPE_ALREADY_COMPLETED', false)
    this.name = 'EnvelopeAlreadyCompletedError'
  }
}

export class DocumentNotReadyError extends AdapterError {
  constructor(message = 'Document is not ready for download') {
    super(message, 'DOCUMENT_NOT_READY', false)
    this.name = 'DocumentNotReadyError'
  }
}

export class DocumentNotAvailableError extends AdapterError {
  constructor(message = 'Document is not available for download') {
    super(message, 'DOCUMENT_NOT_AVAILABLE', false)
    this.name = 'DocumentNotAvailableError'
  }
}

export interface LegalDocumentUpdateFields {
  provider_envelope_id: string
  provider_status: string
  platform_status: PlatformSigningStatus
  sent_at?: Date | null
  viewed_at?: Date | null
  signed_at?: Date | null
  declined_at?: Date | null
  expired_at?: Date | null
  voided_at?: Date | null
}

export class ESignProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly providerError?: string,
  ) {
    super(message)
    this.name = 'ESignProviderError'
  }
}

export function validateSignerEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
