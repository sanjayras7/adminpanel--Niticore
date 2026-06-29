import {
  CreateSigningRequestParams,
  CreateSigningRequestResult,
  SendSigningRequestResult,
  GetSigningRequestStatusResult,
  PlatformSigningStatus,
  LegalDocumentUpdateFields,
  ESignProviderError,
  validateSignerEmail,
} from './types'

export abstract class ESignAdapter {
  protected abstract readonly providerName: string
  protected abstract readonly maxFileSizeBytes: number

  abstract createSigningRequest(params: CreateSigningRequestParams): Promise<CreateSigningRequestResult>
  abstract sendSigningRequest(envelopeId: string): Promise<SendSigningRequestResult>
  abstract getSigningRequestStatus(envelopeId: string): Promise<GetSigningRequestStatusResult>

  abstract mapProviderStatusToPlatform(providerStatus: string): PlatformSigningStatus
  abstract buildCreatePayload(params: CreateSigningRequestParams): Record<string, unknown>
  abstract parseCreateResponse(response: unknown): CreateSigningRequestResult
  abstract parseSendResponse(response: unknown): SendSigningRequestResult
  abstract parseStatusResponse(response: unknown): GetSigningRequestStatusResult

  protected validateCreateParams(params: CreateSigningRequestParams): void {
    if (!params.signers || params.signers.length === 0) {
      throw new ESignProviderError('At least one signer is required', false)
    }

    for (const signer of params.signers) {
      if (!signer.name || !signer.email) {
        throw new ESignProviderError('Each signer must have a name and email', false)
      }
      if (!validateSignerEmail(signer.email)) {
        throw new ESignProviderError(`Invalid signer email: ${signer.email}`, false)
      }
    }

    if (params.fileBytes && params.fileBytes.length > 0) {
      const totalBytes = params.fileBytes.reduce((sum, f) => sum + f.content.length, 0)
      if (totalBytes > this.maxFileSizeBytes) {
        throw new ESignProviderError(
          `Total file size ${totalBytes} exceeds provider limit of ${this.maxFileSizeBytes}`,
          false,
        )
      }
    }
  }

  protected async retryOnNetworkError<T>(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (attempt < retries && this.isNetworkError(err)) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
        throw err
      }
    }
    throw lastError
  }

  protected isNetworkError(err: unknown): boolean {
    if (err instanceof ESignProviderError) return false
    if (err instanceof TypeError) return true
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED'
    }
    return false
  }

  protected stubAuditLog(action: string, details: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'test') return
    console.debug(`[ESignAudit] ${action}`, details)
  }

  abstract buildLegalDocumentUpdate(result: CreateSigningRequestResult | SendSigningRequestResult | GetSigningRequestStatusResult): LegalDocumentUpdateFields
}
