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

export type ProviderName = 'dropbox_sign'

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
