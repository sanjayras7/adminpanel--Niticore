import { ESignAdapter } from './ESignAdapter'
import {
  CreateSigningRequestParams,
  CreateSigningRequestResult,
  SendSigningRequestResult,
  GetSigningRequestStatusResult,
  PlatformSigningStatus,
  LegalDocumentUpdateFields,
  ESignProviderError,
  ProviderName,
} from './types'

interface DropboxSignSignatureRequestResponse {
  signature_request?: {
    signature_request_id: string
    status: string
    signing_url?: string
    signatures?: Array<{
      signer_email_address: string
      status_code: string
      signed_at: number | null
    }>
    is_complete?: boolean
    error?: string
    test_mode?: boolean
  }
  error?: {
    error_msg: string
    error_name: string
  }
}

export class DropboxSignAdapter extends ESignAdapter {
  protected readonly providerName = 'dropbox_sign' as ProviderName
  protected readonly maxFileSizeBytes = 20 * 1024 * 1024
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey?: string) {
    super()
    this.apiKey = apiKey || process.env.HELLOSIGN_API_KEY || ''
    this.baseUrl = 'https://api.hellosign.com/v3'
  }

  async createSigningRequest(params: CreateSigningRequestParams): Promise<CreateSigningRequestResult> {
    this.validateCreateParams(params)

    this.stubAuditLog('esign.create_signing_request.initiated', { title: params.title, signerCount: params.signers.length })

    const payload = this.buildCreatePayload(params)

    try {
      const response = await this.retryOnNetworkError(() => this.callApi('/signature_request/create_embedded', payload))

      if (!response) {
        throw new ESignProviderError('Empty response from Dropbox Sign create API', false)
      }

      const result = this.parseCreateResponse(response)

      this.stubAuditLog('esign.create_signing_request.completed', {
        envelopeId: result.envelopeId,
        status: result.status,
      })

      return result
    } catch (err) {
      if (err instanceof ESignProviderError) {
        this.stubAuditLog('esign.create_signing_request.failed', {
          title: params.title,
          error: err.message,
        })
        throw err
      }

      const error = err instanceof Error ? err : new Error(String(err))
      this.stubAuditLog('esign.create_signing_request.failed', {
        title: params.title,
        error: error.message,
      })

      throw new ESignProviderError(
        `Dropbox Sign create request failed: ${error.message}`,
        this.isNetworkError(err),
        error.message,
      )
    }
  }

  async sendSigningRequest(envelopeId: string): Promise<SendSigningRequestResult> {
    if (!envelopeId) {
      throw new ESignProviderError('envelopeId is required', false)
    }

    this.stubAuditLog('esign.send_signing_request.initiated', { envelopeId })

    try {
      const payload = { signature_request_id: envelopeId }
      const response = await this.retryOnNetworkError(() => this.callApi('/signature_request/send', payload))

      if (!response) {
        throw new ESignProviderError('Empty response from Dropbox Sign send API', false)
      }

      const result = this.parseSendResponse(response)

      this.stubAuditLog('esign.send_signing_request.completed', {
        envelopeId: result.envelopeId,
        status: result.status,
      })

      return result
    } catch (err) {
      if (err instanceof ESignProviderError) {
        this.stubAuditLog('esign.send_signing_request.failed', {
          envelopeId,
          error: err.message,
        })
        throw err
      }

      const error = err instanceof Error ? err : new Error(String(err))
      this.stubAuditLog('esign.send_signing_request.failed', {
        envelopeId,
        error: error.message,
      })

      throw new ESignProviderError(
        `Dropbox Sign send request failed: ${error.message}`,
        this.isNetworkError(err),
        error.message,
      )
    }
  }

  async getSigningRequestStatus(envelopeId: string): Promise<GetSigningRequestStatusResult> {
    if (!envelopeId) {
      throw new ESignProviderError('envelopeId is required', false)
    }

    try {
      const response = await this.retryOnNetworkError(() =>
        this.callApi(`/signature_request/${envelopeId}`, undefined, 'GET'),
      )

      if (!response) {
        throw new ESignProviderError('Empty response from Dropbox Sign status API', false)
      }

      return this.parseStatusResponse(response)
    } catch (err) {
      if (err instanceof ESignProviderError) throw err

      const error = err instanceof Error ? err : new Error(String(err))
      throw new ESignProviderError(
        `Dropbox Sign status request failed: ${error.message}`,
        this.isNetworkError(err),
        error.message,
      )
    }
  }

  mapProviderStatusToPlatform(providerStatus: string): PlatformSigningStatus {
    switch (providerStatus) {
      case 'awaiting_signature':
      case 'awaiting_approval':
        return 'awaiting_signature'
      case 'signed':
        return 'signed'
      case 'declined':
        return 'declined'
      case 'expired':
        return 'expired'
      case 'voided':
        return 'voided'
      case 'errored':
        return 'error'
      case 'sent':
        return 'draft'
      default:
        return 'draft'
    }
  }

  buildCreatePayload(params: CreateSigningRequestParams): Record<string, unknown> {
    const signers = params.signers
      .filter((s) => s.role !== 'cc')
      .map((s, idx) => ({
        name: s.name,
        email_address: s.email,
        order: s.order || idx + 1,
      }))

    const ccAddresses = [
      ...(params.signers.filter((s) => s.role === 'cc').map((s) => s.email)),
      ...(params.ccEmailAddresses || []),
    ]

    const payload: Record<string, unknown> = {
      title: params.title,
      subject: params.title,
      message: params.message || 'Please sign this document',
      signers,
      test_mode: 1,
    }

    if (ccAddresses.length > 0) {
      payload.cc_email_addresses = ccAddresses
    }

    if (params.expiresInDays) {
      payload.expires_in = params.expiresInDays
    }

    if (params.clientId) {
      payload.client_id = params.clientId
    }

    if (params.fileUrls && params.fileUrls.length > 0) {
      payload.file_urls = params.fileUrls
    } else if (params.fileBytes && params.fileBytes.length > 0) {
      payload.files = params.fileBytes.map((f) => ({
        name: f.filename,
        content: f.content.toString('base64'),
      }))
    }

    return payload
  }

  parseCreateResponse(response: unknown): CreateSigningRequestResult {
    const data = response as DropboxSignSignatureRequestResponse

    if (data.error) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        status: 'error',
        errorMessage: data.error.error_msg || data.error.error_name || 'Unknown Dropbox Sign error',
      }
    }

    const sr = data.signature_request
    if (!sr || !sr.signature_request_id) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        status: 'error',
        errorMessage: 'Invalid response: missing signature_request_id',
      }
    }

    const providerStatus = sr.status || 'draft'
    const platformStatus = this.mapProviderStatusToPlatform(providerStatus)
    const envelopeStatus = platformStatus === 'awaiting_signature' ? 'sent' : platformStatus === 'error' ? 'error' : 'pending_send'

    return {
      envelopeId: sr.signature_request_id,
      providerName: 'dropbox_sign',
      status: envelopeStatus as 'pending_send' | 'sent' | 'error',
      signUrl: sr.signing_url,
      errorMessage: sr.error || undefined,
    }
  }

  parseSendResponse(response: unknown): SendSigningRequestResult {
    const data = response as DropboxSignSignatureRequestResponse

    if (data.error) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        status: 'error',
        sentAt: new Date().toISOString(),
        errorMessage: data.error.error_msg || data.error.error_name || 'Unknown Dropbox Sign error',
      }
    }

    const sr = data.signature_request
    if (!sr || !sr.signature_request_id) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        status: 'error',
        sentAt: new Date().toISOString(),
        errorMessage: 'Invalid response: missing signature_request_id',
      }
    }

    return {
      envelopeId: sr.signature_request_id,
      providerName: 'dropbox_sign',
      status: sr.status === 'errored' ? 'error' : 'sent',
      sentAt: new Date().toISOString(),
      errorMessage: sr.error || undefined,
    }
  }

  parseStatusResponse(response: unknown): GetSigningRequestStatusResult {
    const data = response as DropboxSignSignatureRequestResponse

    if (data.error) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        providerStatus: 'error',
        platformStatus: 'error',
        signers: [],
      }
    }

    const sr = data.signature_request
    if (!sr || !sr.signature_request_id) {
      return {
        envelopeId: '',
        providerName: 'dropbox_sign',
        providerStatus: 'unknown',
        platformStatus: 'error',
        signers: [],
      }
    }

    const signers = (sr.signatures || []).map((s) => ({
      email: s.signer_email_address,
      status: s.status_code,
      signedAt: s.signed_at ? new Date(s.signed_at * 1000).toISOString() : undefined,
    }))

    return {
      envelopeId: sr.signature_request_id,
      providerName: 'dropbox_sign',
      providerStatus: sr.status || 'unknown',
      platformStatus: this.mapProviderStatusToPlatform(sr.status || 'unknown'),
      signers,
    }
  }

  buildLegalDocumentUpdate(
    result: CreateSigningRequestResult | SendSigningRequestResult | GetSigningRequestStatusResult,
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

    return base
  }

  private async callApi(
    path: string,
    body?: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST',
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new ESignProviderError('HELLOSIGN_API_KEY is not configured', false)
    }

    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
      Accept: 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body && method === 'POST') {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    options.signal = controller.signal

    try {
      const response = await fetch(url, options)

      if (!response.ok) {
        let errorBody: string | undefined
        try {
          errorBody = await response.text()
        } catch {
          errorBody = undefined
        }

        if (response.status === 429) {
          throw new ESignProviderError('Rate limited by Dropbox Sign API', true, `HTTP 429: ${errorBody || 'rate limit'}`)
        }

        if (response.status === 401) {
          throw new ESignProviderError('Invalid Dropbox Sign API key', false, 'HTTP 401')
        }

        throw new ESignProviderError(
          `Dropbox Sign API returned ${response.status}`,
          response.status >= 500,
          errorBody,
        )
      }

      return await response.json()
    } catch (err) {
      if (err instanceof ESignProviderError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ESignProviderError('Dropbox Sign API request timed out', true, 'timeout')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
