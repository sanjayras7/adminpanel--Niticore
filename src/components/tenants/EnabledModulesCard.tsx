'use client'

import { useState, useCallback } from 'react'
import { toggleTenantModule, type TenantModule } from '@/lib/frontend/api'

interface Props {
  organizationId: string
  modules: TenantModule[]
  canToggle: boolean
  userId?: string | null
  error?: string
}

function Switch({
  checked,
  disabled,
  loading,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  loading: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#10b981' : '#d1d5db',
        opacity: loading ? 0.6 : 1,
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

export default function EnabledModulesCard({
  organizationId,
  modules: initialModules,
  canToggle,
  userId,
  error: initialError,
}: Props) {
  const [modules, setModules] = useState<TenantModule[]>(initialModules)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const handleToggle = useCallback(
    async (configId: string, currentEnabled: boolean) => {
      setTogglingId(configId)
      setToggleError(null)

      const prevModules = modules.map((m) => ({
        ...m,
        subModules: m.subModules.map((sm) => ({ ...sm })),
      }))

      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          subModules: m.subModules.map((sm) =>
            sm.configId === configId ? { ...sm, enabled: !currentEnabled } : sm,
          ),
        })),
      )

      try {
        await toggleTenantModule(organizationId, configId, !currentEnabled, userId)
      } catch {
        setModules(prevModules)
        setToggleError('Failed to update module. Please try again.')
      } finally {
        setTogglingId(null)
      }
    },
    [organizationId, userId, modules],
  )

  if (initialError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
          Enabled Modules
        </h2>
        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
          {initialError}
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
          Enabled Modules
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>No modules configured</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
          Enabled Modules
        </h2>
        {!canToggle && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Read-only</span>
        )}
      </div>

      {toggleError && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: '6px', color: '#dc2626', fontSize: '12px', marginBottom: '12px' }}>
          {toggleError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {modules.map((mod) => (
          <div key={mod.moduleId}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '8px' }}>
              {mod.moduleName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {mod.subModules.map((sm) => (
                <div
                  key={sm.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: sm.enabled ? '#f0fdf4' : '#f9fafb',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: sm.enabled ? '#10b981' : '#d1d5db',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#374151' }}>{sm.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {sm.configId ? (
                      <Switch
                        checked={sm.enabled}
                        disabled={!canToggle}
                        loading={togglingId === sm.configId}
                        onChange={() => handleToggle(sm.configId!, sm.enabled)}
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                        Not configured
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
