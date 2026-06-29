import { ESignAdapter } from './ESignAdapter'
import {
  CreateSigningRequestParams,
  CreateSigningRequestResult,
  SendSigningRequestResult,
  GetSigningRequestStatusResult,
  VoidSigningRequestResult,
  SignedDocument,
  PlatformSigningStatus,
  LegalDocumentUpdateFields,
  ProviderName,
  EnvelopeNotFoundError,
  EnvelopeAlreadyCompletedError,
  DocumentNotReadyError,
  DocumentNotAvailableError,
} from './types'
import { v4 as uuidv4 } from 'uuid'

interface MockEnvelopeState {
  envelopeId: string
  title: string
  signers: Array<{ name: string; email: string; order: number }>
  status: PlatformSigningStatus
  providerStatus: string
  sentAt?: string
  signedAt?: string
  declinedAt?: string
  expiredAt?: string
  voidedAt?: string
  documentContent: Buffer | null
}

export class MockESignProvider extends ESignAdapter {
  protected readonly providerName = 'mock' as ProviderName
  protected readonly maxFileSizeBytes = 100 * 1024 * 1024

  private envelopes: Map<string, MockEnvelopeState> = new Map()

  async createSigningRequest(params: CreateSigningRequestParams): Promise<CreateSigningRequestResult> {
    this.validateCreateParams(params)

    const envelopeId = `mock_${uuidv4().slice(0, 8)}`
    const signers = params.signers
      .filter((s) => s.role !== 'cc')
      .map((s, idx) => ({
        name: s.name,
        email: s.email,
        order: s.order || idx + 1,
      }))

    this.envelopes.set(envelopeId, {
      envelopeId,
      title: params.title,
      signers,
      status: 'awaiting_signature',
      providerStatus: 'awaiting_signature',
      documentContent: params.fileBytes && params.fileBytes.length > 0
        ? Buffer.concat(params.fileBytes.map((f) => f.content))
        : Buffer.from('Mock PDF content for ' + params.title),
    })

    return {
      envelopeId,
      providerName: 'mock',
      status: 'sent',
      signUrl: `https://mock.esign/sign/${envelopeId}`,
    }
  }

  async sendSigningRequest(envelopeId: string): Promise<SendSigningRequestResult> {
    if (!envelopeId) {
      throw new Error('envelopeId is required')
    }

    const envelope = this.envelopes.get(envelopeId)
    if (!envelope) {
      throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
    }

    envelope.status = 'awaiting_signature'
    envelope.providerStatus = 'awaiting_signature'
    envelope.sentAt = new Date().toISOString()

    return {
      envelopeId,
      providerName: 'mock',
      status: 'sent',
      sentAt: envelope.sentAt,
    }
  }

  async getSigningRequestStatus(envelopeId: string): Promise<GetSigningRequestStatusResult> {
    if (!envelopeId) {
      throw new Error('envelopeId is required')
    }

    const envelope = this.envelopes.get(envelopeId)
    if (!envelope) {
      throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
    }

    return {
      envelopeId,
      providerName: 'mock',
      providerStatus: envelope.providerStatus,
      platformStatus: envelope.status,
      signers: envelope.signers.map((s) => ({
        email: s.email,
        status: envelope.status === 'signed' ? 'signed' : 'awaiting',
        signedAt: envelope.signedAt,
      })),
    }
  }

  async voidSigningRequest(envelopeId: string, _reason?: string): Promise<VoidSigningRequestResult> {
    if (!envelopeId) {
      throw new Error('envelopeId is required')
    }

    const envelope = this.envelopes.get(envelopeId)
    if (!envelope) {
      throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
    }

    if (envelope.status === 'voided') {
      return {
        envelopeId,
        providerName: 'mock',
        providerStatus: 'voided',
        platformStatus: 'voided',
        voidedAt: envelope.voidedAt || new Date().toISOString(),
      }
    }

    if (envelope.status === 'signed') {
      throw new EnvelopeAlreadyCompletedError(
        `Envelope ${envelopeId} is already signed and cannot be voided`,
      )
    }

    envelope.status = 'voided'
    envelope.providerStatus = 'voided'
    envelope.voidedAt = new Date().toISOString()

    return {
      envelopeId,
      providerName: 'mock',
      providerStatus: 'voided',
      platformStatus: 'voided',
      voidedAt: envelope.voidedAt,
    }
  }

  async downloadSignedDocument(envelopeId: string): Promise<SignedDocument> {
    if (!envelopeId) {
      throw new Error('envelopeId is required')
    }

    const envelope = this.envelopes.get(envelopeId)
    if (!envelope) {
      throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
    }

    if (envelope.status !== 'signed') {
      if (envelope.status === 'voided' || envelope.status === 'expired' || envelope.status === 'declined') {
        throw new DocumentNotAvailableError(
          `Document for envelope ${envelopeId} is not available (status: ${envelope.status})`,
        )
      }
      throw new DocumentNotReadyError(
        `Document for envelope ${envelopeId} is not ready (status: ${envelope.status})`,
      )
    }

    const content = envelope.documentContent || Buffer.from('Mock signed PDF content')

    return {
      envelopeId,
      fileName: `${envelopeId}.pdf`,
      fileType: 'application/pdf',
      fileSizeBytes: content.length,
      content,
    }
  }

  mapProviderStatusToPlatform(providerStatus: string): PlatformSigningStatus {
    switch (providerStatus) {
      case 'awaiting_signature':
        return 'awaiting_signature'
      case 'signed':
        return 'signed'
      case 'declined':
        return 'declined'
      case 'expired':
        return 'expired'
      case 'voided':
        return 'voided'
      default:
        return 'draft'
    }
  }

  buildCreatePayload(params: CreateSigningRequestParams): Record<string, unknown> {
    return {
      title: params.title,
      signers: params.signers.map((s) => ({ name: s.name, email: s.email })),
    }
  }

  parseCreateResponse(response: unknown): CreateSigningRequestResult {
    const data = response as Record<string, unknown>
    return {
      envelopeId: (data.envelopeId as string) || '',
      providerName: 'mock',
      status: 'sent',
    }
  }

  parseSendResponse(response: unknown): SendSigningRequestResult {
    const data = response as Record<string, unknown>
    return {
      envelopeId: (data.envelopeId as string) || '',
      providerName: 'mock',
      status: 'sent',
      sentAt: new Date().toISOString(),
    }
  }

  parseStatusResponse(response: unknown): GetSigningRequestStatusResult {
    const data = response as Record<string, unknown>
    return {
      envelopeId: (data.envelopeId as string) || '',
      providerName: 'mock',
      providerStatus: (data.providerStatus as string) || 'unknown',
      platformStatus: 'draft',
      signers: [],
    }
  }

  parseVoidResponse(response: unknown, envelopeId: string): VoidSigningRequestResult {
    return {
      envelopeId,
      providerName: 'mock',
      providerStatus: 'voided',
      platformStatus: 'voided',
      voidedAt: new Date().toISOString(),
    }
  }

  buildLegalDocumentUpdate(
    result: CreateSigningRequestResult | SendSigningRequestResult | GetSigningRequestStatusResult | VoidSigningRequestResult,
  ): LegalDocumentUpdateFields {
    const platformStatus: PlatformSigningStatus =
      'platformStatus' in result
        ? result.platformStatus
        : result.status === 'sent'
          ? 'awaiting_signature'
          : 'draft'

    const base: LegalDocumentUpdateFields = {
      provider_envelope_id: result.envelopeId,
      provider_status: 'providerStatus' in result ? result.providerStatus : '',
      platform_status: platformStatus,
    }

    if ('sentAt' in result && result.sentAt) {
      return { ...base, sent_at: new Date(result.sentAt) }
    }

    if ('voidedAt' in result && result.voidedAt) {
      return { ...base, voided_at: new Date(result.voidedAt) }
    }

    return base
  }

  simulateSigning(envelopeId: string): void {
    const envelope = this.envelopes.get(envelopeId)
    if (!envelope) {
      throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
    }
    envelope.status = 'signed'
    envelope.providerStatus = 'signed'
    envelope.signedAt = new Date().toISOString()
  }

  getEnvelopeState(envelopeId: string): MockEnvelopeState | undefined {
    return this.envelopes.get(envelopeId)
  }
}
