import { ESignAdapter } from './ESignAdapter'
import {
  AdapterError,
  CreateSigningRequestParams,
  CreateSigningRequestResult,
  SendSigningRequestResult,
  GetSigningRequestStatusResult,
  VoidSigningRequestResult,
  SignedDocument,
  PlatformSigningStatus,
  LegalDocumentUpdateFields,
  ESignProviderError,
  ProviderName,
  EnvelopeNotFoundError,
  EnvelopeAlreadyCompletedError,
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

  async voidSigningRequest(envelopeId: string, reason?: string): Promise<VoidSigningRequestResult> {
    if (!envelopeId) {
      throw new ESignProviderError('envelopeId is required', false)
    }

    this.stubAuditLog('esign.void_signing_request.initiated', { envelopeId, reason })

    try {
      const response = await this.retryOnNetworkError(() =>
        this.callApi(`/signature_request/cancel/${envelopeId}`, { signature_request_id: envelopeId }),
      )

      if (!response) {
        throw new ESignProviderError('Empty response from Dropbox Sign void API', false)
      }

      const result = this.parseVoidResponse(response, envelopeId)

      this.stubAuditLog('esign.void_signing_request.completed', {
        envelopeId: result.envelopeId,
        status: result.platformStatus,
      })

      return result
    } catch (err) {
      if (err instanceof EnvelopeAlreadyCompletedError || err instanceof EnvelopeNotFoundError) {
        throw err
      }

      if (err instanceof ESignProviderError) {
        this.stubAuditLog('esign.void_signing_request.failed', {
          envelopeId,
          error: err.message,
        })
        throw err
      }

      const error = err instanceof Error ? err : new Error(String(err))
      this.stubAuditLog('esign.void_signing_request.failed', {
        envelopeId,
        error: error.message,
      })

      throw new ESignProviderError(
        `Dropbox Sign void request failed: ${error.message}`,
        this.isNetworkError(err),
        error.message,
      )
    }
  }

  async downloadSignedDocument(envelopeId: string): Promise<SignedDocument> {
    if (!envelopeId) {
      throw new ESignProviderError('envelopeId is required', false)
    }

    this.stubAuditLog('esign.download_signed_document.initiated', { envelopeId })

    try {
      const fileResponse = await this.retryOnNetworkError(() =>
        this.callApiForDownload(`/signature_request/files/${envelopeId}?file_type=pdf`),
      )

      if (!fileResponse) {
        throw new ESignProviderError('Empty response from Dropbox Sign download API', false)
      }

      const fileName = fileResponse.fileName || `${envelopeId}.pdf`
      const fileType = fileResponse.contentType || 'application/pdf'
      const content = Buffer.from(fileResponse.data)

      this.stubAuditLog('esign.download_signed_document.completed', {
        envelopeId,
        fileName,
        fileSizeBytes: content.length,
      })

      return {
        envelopeId,
        fileName,
        fileType,
        fileSizeBytes: content.length,
        content,
      }
    } catch (err) {
      if (err instanceof AdapterError) {
        throw err
      }

      if (err instanceof ESignProviderError) {
        this.stubAuditLog('esign.download_signed_document.failed', {
          envelopeId,
          error: err.message,
        })
        throw err
      }

      const error = err instanceof Error ? err : new Error(String(err))
      this.stubAuditLog('esign.download_signed_document.failed', {
        envelopeId,
        error: error.message,
      })

      throw new ESignProviderError(
        `Dropbox Sign download request failed: ${error.message}`,
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

  parseVoidResponse(response: unknown, envelopeId: string): VoidSigningRequestResult {
    const data = response as DropboxSignSignatureRequestResponse

    if (data.error) {
      if (data.error.error_name === 'not_found') {
        throw new EnvelopeNotFoundError(`Envelope ${envelopeId} not found`)
      }

      return {
        envelopeId,
        providerName: 'dropbox_sign',
        providerStatus: 'error',
        platformStatus: 'error',
        voidedAt: new Date().toISOString(),
      }
    }

    const sr = data.signature_request
    if (!sr) {
      return {
        envelopeId,
        providerName: 'dropbox_sign',
        providerStatus: 'unknown',
        platformStatus: 'error',
        voidedAt: new Date().toISOString(),
      }
    }

    const providerStatus = sr.status || 'unknown'
    const platformStatus = this.mapProviderStatusToPlatform(providerStatus)

    if (platformStatus === 'signed') {
      throw new EnvelopeAlreadyCompletedError(
        `Envelope ${envelopeId} is already signed and cannot be voided`,
      )
    }

    return {
      envelopeId: sr.signature_request_id || envelopeId,
      providerName: 'dropbox_sign',
      providerStatus,
      platformStatus: platformStatus === 'voided' ? 'voided' : platformStatus,
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

        if (response.status === 404) {
          throw new EnvelopeNotFoundError(`Dropbox Sign resource not found: ${path}`)
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

  private async callApiForDownload(path: string): Promise<{ data: ArrayBuffer; contentType: string; fileName: string | null } | null> {
    if (!this.apiKey) {
      throw new ESignProviderError('HELLOSIGN_API_KEY is not configured', false)
    }

    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, { method: 'GET', headers, signal: controller.signal })

      if (!response.ok) {
        let errorBody: string | undefined
        try {
          errorBody = await response.text()
        } catch {
          errorBody = undefined
        }

        if (response.status === 401) {
          throw new ESignProviderError('Invalid Dropbox Sign API key', false, 'HTTP 401')
        }

        if (response.status === 404) {
          throw new EnvelopeNotFoundError(`Envelope ${path.split('/').pop()} not found`)
        }

        throw new ESignProviderError(
          `Dropbox Sign API returned ${response.status}`,
          response.status >= 500,
          errorBody,
        )
      }

      const contentType = response.headers.get('content-type') || 'application/pdf'
      const disposition = response.headers.get('content-disposition')
      let fileName: string | null = null
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        fileName = match ? match[1].replace(/['"]/g, '') : null
      }
      const data = await response.arrayBuffer()
      return { data, contentType, fileName }
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
