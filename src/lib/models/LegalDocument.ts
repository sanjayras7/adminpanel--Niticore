import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface LegalDocumentAttributes {
  id: string
  document_type: string
  organization_id: string
  lead_id: string | null
  provider_name: string | null
  provider_envelope_id: string
  provider_status: string | null
  platform_status: 'Draft' | 'Sent' | 'Viewed' | 'Signed' | 'Declined' | 'Expired' | 'Voided'
  signer_names_json: string
  signer_emails_json: string
  sent_at: Date | null
  viewed_at: Date | null
  signed_at: Date | null
  declined_at: Date | null
  expired_at: Date | null
  voided_at: Date | null
  storage_key: string | null
  file_name: string | null
  file_type: string | null
  file_size_bytes: number | null
  created_by: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export type PlatformStatus = LegalDocumentAttributes['platform_status']

const VALID_STATUSES: PlatformStatus[] = ['Draft', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired', 'Voided']

const STATUS_FLOW: Record<PlatformStatus, PlatformStatus[]> = {
  Draft: ['Sent', 'Declined', 'Expired', 'Voided'],
  Sent: ['Viewed', 'Declined', 'Expired', 'Voided'],
  Viewed: ['Signed', 'Declined', 'Expired', 'Voided'],
  Signed: [],
  Declined: [],
  Expired: [],
  Voided: [],
}

export function isValidTransition(from: PlatformStatus, to: PlatformStatus): boolean {
  return STATUS_FLOW[from]?.includes(to) ?? false
}

export function isValidStatus(s: string): s is PlatformStatus {
  return (VALID_STATUSES as string[]).includes(s)
}

export class LegalDocument extends Model<LegalDocumentAttributes> implements LegalDocumentAttributes {
  declare id: string
  declare document_type: string
  declare organization_id: string
  declare lead_id: string | null
  declare provider_name: string | null
  declare provider_envelope_id: string
  declare provider_status: string | null
  declare platform_status: PlatformStatus
  declare signer_names_json: string
  declare signer_emails_json: string
  declare sent_at: Date | null
  declare viewed_at: Date | null
  declare signed_at: Date | null
  declare declined_at: Date | null
  declare expired_at: Date | null
  declare voided_at: Date | null
  declare storage_key: string | null
  declare file_name: string | null
  declare file_type: string | null
  declare file_size_bytes: number | null
  declare created_by: string
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

LegalDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    document_type: { type: DataTypes.STRING(50), allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    lead_id: { type: DataTypes.UUID, allowNull: true },
    provider_name: { type: DataTypes.STRING(100), allowNull: true },
    provider_envelope_id: { type: DataTypes.STRING(255), allowNull: false },
    provider_status: { type: DataTypes.STRING(100), allowNull: true },
    platform_status: {
      type: DataTypes.ENUM(...VALID_STATUSES),
      allowNull: false,
    },
    signer_names_json: { type: DataTypes.TEXT, allowNull: false },
    signer_emails_json: { type: DataTypes.TEXT, allowNull: false },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    viewed_at: { type: DataTypes.DATE, allowNull: true },
    signed_at: { type: DataTypes.DATE, allowNull: true },
    declined_at: { type: DataTypes.DATE, allowNull: true },
    expired_at: { type: DataTypes.DATE, allowNull: true },
    voided_at: { type: DataTypes.DATE, allowNull: true },
    storage_key: { type: DataTypes.STRING(500), allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: true },
    file_type: { type: DataTypes.STRING(100), allowNull: true },
    file_size_bytes: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'legal_documents',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
