import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface LegalDocumentAttributes {
  id: string
  document_type: 'nda' | 'contract'
  lead_id: string | null
  organization_id: string | null
  provider_name: string | null
  provider_envelope_id: string | null
  provider_status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'voided'
  platform_status: 'pending' | 'completed' | 'failed'
  signer_names_json: string[] | null
  signer_emails_json: string[] | null
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
  created_by: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class LegalDocument extends Model<LegalDocumentAttributes> implements LegalDocumentAttributes {
  declare id: string
  declare document_type: 'nda' | 'contract'
  declare lead_id: string | null
  declare organization_id: string | null
  declare provider_name: string | null
  declare provider_envelope_id: string | null
  declare provider_status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'voided'
  declare platform_status: 'pending' | 'completed' | 'failed'
  declare signer_names_json: string[] | null
  declare signer_emails_json: string[] | null
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
  declare created_by: string | null
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
    document_type: {
      type: DataTypes.ENUM('nda', 'contract'),
      allowNull: false,
    },
    lead_id: { type: DataTypes.UUID, allowNull: true },
    organization_id: { type: DataTypes.UUID, allowNull: true },
    provider_name: { type: DataTypes.STRING(255), allowNull: true },
    provider_envelope_id: { type: DataTypes.STRING(255), allowNull: true },
    provider_status: {
      type: DataTypes.ENUM('draft', 'sent', 'viewed', 'signed', 'declined', 'expired', 'voided'),
      allowNull: false,
      defaultValue: 'draft',
    },
    platform_status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    signer_names_json: { type: DataTypes.JSONB, allowNull: true },
    signer_emails_json: { type: DataTypes.JSONB, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    viewed_at: { type: DataTypes.DATE, allowNull: true },
    signed_at: { type: DataTypes.DATE, allowNull: true },
    declined_at: { type: DataTypes.DATE, allowNull: true },
    expired_at: { type: DataTypes.DATE, allowNull: true },
    voided_at: { type: DataTypes.DATE, allowNull: true },
    storage_key: { type: DataTypes.TEXT, allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: true },
    file_type: { type: DataTypes.STRING(100), allowNull: true },
    file_size_bytes: { type: DataTypes.BIGINT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
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
