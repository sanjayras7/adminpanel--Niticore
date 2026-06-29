import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface OrganizationAttributes {
  id: string
  name: string
  domain: string | null
  tenant_hash: string
  status: 'lead' | 'onboarding' | 'active' | 'suspended' | 'churned'
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Organization extends Model<OrganizationAttributes> implements OrganizationAttributes {
  declare id: string
  declare name: string
  declare domain: string | null
  declare tenant_hash: string
  declare status: 'lead' | 'onboarding' | 'active' | 'suspended' | 'churned'
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Organization.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: true },
    tenant_hash: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM('lead', 'onboarding', 'active', 'suspended', 'churned'),
      allowNull: false,
      defaultValue: 'lead',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'organizations',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
