const API_BASE = '/api/v1/internal'

export interface ApiError {
  error: string
  message: string
  cloned_version_id?: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
  return res.json() as Promise<T>
}

function buildHeaders(userId?: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userId) h['x-internal-user-id'] = userId
  return h
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}

export interface SingleResponse<T> {
  data: T
}

export interface FrameworkItem {
  id: string
  name: string
  description: string | null
  classification_id: string | null
  version_count: number
  created_at: string
  updated_at: string
}

export interface FrameworkDetail extends FrameworkItem {
  versions: VersionSummary[]
}

export interface VersionSummary {
  id: string
  framework_id: string
  version_label: string
  description: string | null
  status: string
  effective_date: string | null
  created_at: string
  updated_at: string
}

export interface ClauseItem {
  id: string
  framework_section_id: string
  clause_code: string
  clause_text: string
  sort_order: number
}

export interface SectionNode {
  id: string
  framework_version_id: string
  parent_section_id: string | null
  section_code: string
  title: string
  description: string | null
  sort_order: number
  clauses: ClauseItem[]
  child_sections: SectionNode[]
}

export interface VersionDetail {
  id: string
  framework_id: string
  version_label: string
  description: string | null
  status: string
  effective_date: string | null
  sections: SectionNode[]
  created_at: string
  updated_at: string
  cloned_from_version_id?: string
}

export async function listFrameworks(params?: { search?: string; page?: number; page_size?: number }, userId?: string): Promise<PaginatedResponse<FrameworkItem>> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  const res = await fetch(`${API_BASE}/frameworks${qs ? '?' + qs : ''}`, { headers: buildHeaders(userId) })
  return handleResponse<PaginatedResponse<FrameworkItem>>(res)
}

export async function getFramework(id: string, userId?: string): Promise<SingleResponse<FrameworkDetail>> {
  const res = await fetch(`${API_BASE}/frameworks/${id}`, { headers: buildHeaders(userId) })
  return handleResponse<SingleResponse<FrameworkDetail>>(res)
}

export async function createFramework(body: { name: string; description?: string; classification_id?: string }, userId?: string): Promise<SingleResponse<FrameworkItem>> {
  const res = await fetch(`${API_BASE}/frameworks`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<FrameworkItem>>(res)
}

export async function updateFramework(id: string, body: { name?: string; description?: string; classification_id?: string }, userId?: string): Promise<SingleResponse<FrameworkItem>> {
  const res = await fetch(`${API_BASE}/frameworks/${id}`, {
    method: 'PUT',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<FrameworkItem>>(res)
}

export async function deleteFramework(id: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/frameworks/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}

export async function listVersions(frameworkId: string, userId?: string): Promise<PaginatedResponse<VersionSummary>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions`, { headers: buildHeaders(userId) })
  return handleResponse<PaginatedResponse<VersionSummary>>(res)
}

export async function createVersion(frameworkId: string, body: { version_label: string; description?: string; effective_date?: string }, userId?: string): Promise<SingleResponse<VersionSummary>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<VersionSummary>>(res)
}

export async function getVersion(frameworkId: string, versionId: string, userId?: string): Promise<SingleResponse<VersionDetail>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}`, { headers: buildHeaders(userId) })
  return handleResponse<SingleResponse<VersionDetail>>(res)
}

export async function updateVersion(frameworkId: string, versionId: string, body: { version_label?: string; description?: string; effective_date?: string | null }, userId?: string): Promise<SingleResponse<Record<string, unknown>>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}`, {
    method: 'PUT',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<Record<string, unknown>>>(res)
}

export async function deleteVersion(frameworkId: string, versionId: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}

export async function publishVersion(frameworkId: string, versionId: string, userId?: string): Promise<SingleResponse<Record<string, unknown>>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/publish`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify({}),
  })
  return handleResponse<SingleResponse<Record<string, unknown>>>(res)
}

export async function createSection(frameworkId: string, versionId: string, body: { section_code: string; title: string; description?: string; parent_section_id?: string; sort_order?: number }, userId?: string): Promise<SingleResponse<SectionNode>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<SectionNode>>(res)
}

export async function updateSection(frameworkId: string, versionId: string, sectionId: string, body: { section_code?: string; title?: string; description?: string; sort_order?: number }, userId?: string): Promise<SingleResponse<SectionNode>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections/${sectionId}`, {
    method: 'PUT',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<SectionNode>>(res)
}

export async function deleteSection(frameworkId: string, versionId: string, sectionId: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections/${sectionId}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}

export async function createClause(frameworkId: string, versionId: string, sectionId: string, body: { clause_code: string; clause_text: string; sort_order?: number }, userId?: string): Promise<SingleResponse<ClauseItem>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections/${sectionId}/clauses`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<ClauseItem>>(res)
}

export async function updateClause(frameworkId: string, versionId: string, sectionId: string, clauseId: string, body: { clause_code?: string; clause_text?: string; sort_order?: number }, userId?: string): Promise<SingleResponse<ClauseItem>> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections/${sectionId}/clauses/${clauseId}`, {
    method: 'PUT',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<ClauseItem>>(res)
}

export async function deleteClause(frameworkId: string, versionId: string, sectionId: string, clauseId: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/frameworks/${frameworkId}/versions/${versionId}/sections/${sectionId}/clauses/${clauseId}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}

export async function getWizardPrefill(leadId: string, userId?: string): Promise<import('@/lib/wizard/types').WizardPrefillResponse> {
  const res = await fetch(`${API_BASE}/wizard/prefill?leadId=${encodeURIComponent(leadId)}`, {
    headers: buildHeaders(userId),
  })
  const body = await handleResponse<{ data: import('@/lib/wizard/types').WizardPrefillResponse }>(res)
  return body.data
}

export interface ControlItem {
  id: string
  control_code: string
  title: string
  description: string | null
  version_count: number
  created_at: string
  updated_at: string
}

export interface ControlDetail extends ControlItem {
  versions: VersionSummary[]
}

export async function listControls(params?: { search?: string; page?: number; page_size?: number }, userId?: string): Promise<PaginatedResponse<ControlItem>> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.page) sp.set('page', String(params.page))
  if (params?.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  const res = await fetch(`${API_BASE}/controls${qs ? '?' + qs : ''}`, { headers: buildHeaders(userId) })
  return handleResponse<PaginatedResponse<ControlItem>>(res)
}

export async function getControl(id: string, userId?: string): Promise<SingleResponse<ControlDetail>> {
  const res = await fetch(`${API_BASE}/controls/${id}`, { headers: buildHeaders(userId) })
  return handleResponse<SingleResponse<ControlDetail>>(res)
}

export interface ControlFrameworkMappingItem {
  id: string
  control_id: string
  framework_clause_id: string
  created_at: string
  updated_at: string
}

export async function listControlFrameworkMappings(params: { control_id?: string; framework_clause_id?: string; page?: number; page_size?: number }, userId?: string): Promise<PaginatedResponse<ControlFrameworkMappingItem>> {
  const sp = new URLSearchParams()
  if (params.control_id) sp.set('control_id', params.control_id)
  if (params.framework_clause_id) sp.set('framework_clause_id', params.framework_clause_id)
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  const res = await fetch(`${API_BASE}/control-framework-mappings${qs ? '?' + qs : ''}`, { headers: buildHeaders(userId) })
  return handleResponse<PaginatedResponse<ControlFrameworkMappingItem>>(res)
}

export async function createControlFrameworkMapping(body: { control_id: string; framework_clause_id: string }, userId?: string): Promise<SingleResponse<ControlFrameworkMappingItem>> {
  const res = await fetch(`${API_BASE}/control-framework-mappings`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<ControlFrameworkMappingItem>>(res)
}

export async function deleteControlFrameworkMapping(id: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/control-framework-mappings/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}

export interface ControlRiskMappingItem {
  id: string
  control_id: string
  risk_id: string
  created_at: string
  updated_at: string
}

export async function listControlRiskMappings(params: { control_id?: string; risk_id?: string; page?: number; page_size?: number }, userId?: string): Promise<PaginatedResponse<ControlRiskMappingItem>> {
  const sp = new URLSearchParams()
  if (params.control_id) sp.set('control_id', params.control_id)
  if (params.risk_id) sp.set('risk_id', params.risk_id)
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const qs = sp.toString()
  const res = await fetch(`${API_BASE}/control-risk-mappings${qs ? '?' + qs : ''}`, { headers: buildHeaders(userId) })
  return handleResponse<PaginatedResponse<ControlRiskMappingItem>>(res)
}

export async function createControlRiskMapping(body: { control_id: string; risk_id: string }, userId?: string): Promise<SingleResponse<ControlRiskMappingItem>> {
  const res = await fetch(`${API_BASE}/control-risk-mappings`, {
    method: 'POST',
    headers: buildHeaders(userId),
    body: JSON.stringify(body),
  })
  return handleResponse<SingleResponse<ControlRiskMappingItem>>(res)
}

export async function deleteControlRiskMapping(id: string, userId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/control-risk-mappings/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(userId),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown', message: 'Request failed' }))
    throw body as ApiError
  }
}