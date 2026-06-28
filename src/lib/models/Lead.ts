import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface LeadAttributes {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  work_email: string
  phone: string | null
  company_domain: string | null
  company_website: string | null
  country: string | null
  region: string | null
  company_size: string | null
  interested_modules_json: string[] | null
  interested_frameworks_json: string[] | null
  message: string | null
  source: string
  status: string
  assigned_owner_id: string | null
  nda_required: boolean
  demo_status: string | null
  contract_status: string | null
  converted_organization_id: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Lead extends Model<LeadAttributes> implements LeadAttributes {
  declare id: string
  declare company_name: string
  declare contact_first_name: string
  declare contact_last_name: string
  declare work_email: string
  declare phone: string | null
  declare company_domain: string | null
  declare company_website: string | null
  declare country: string | null
  declare region: string | null
  declare company_size: string | null
  declare interested_modules_json: string[] | null
  declare interested_frameworks_json: string[] | null
  declare message: string | null
  declare source: string
  declare status: string
  declare assigned_owner_id: string | null
  declare nda_required: boolean
  declare demo_status: string | null
  declare contract_status: string | null
  declare converted_organization_id: string | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Lead.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_name: { type: DataTypes.STRING(255), allowNull: false },
    contact_first_name: { type: DataTypes.STRING(255), allowNull: false },
    contact_last_name: { type: DataTypes.STRING(255), allowNull: false },
    work_email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    company_domain: { type: DataTypes.STRING(255), allowNull: true },
    company_website: { type: DataTypes.STRING(255), allowNull: true },
    country: { type: DataTypes.STRING(100), allowNull: true },
    region: { type: DataTypes.STRING(100), allowNull: true },
    company_size: { type: DataTypes.STRING(50), allowNull: true },
    interested_modules_json: { type: DataTypes.JSONB, allowNull: true },
    interested_frameworks_json: { type: DataTypes.JSONB, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    source: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Website Form' },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'New' },
    assigned_owner_id: { type: DataTypes.UUID, allowNull: true },
    nda_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    demo_status: { type: DataTypes.STRING(50), allowNull: true },
    contract_status: { type: DataTypes.STRING(50), allowNull: true },
    converted_organization_id: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'leads',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
