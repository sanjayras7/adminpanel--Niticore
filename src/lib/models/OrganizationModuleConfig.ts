import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface OrganizationModuleConfigAttributes {
  id: string
  organization_id: string
  module_id: string
  is_enabled: boolean
  config_json: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export class OrganizationModuleConfig extends Model<OrganizationModuleConfigAttributes> implements OrganizationModuleConfigAttributes {
  declare id: string
  declare organization_id: string
  declare module_id: string
  declare is_enabled: boolean
  declare config_json: Record<string, unknown> | null
  declare created_at: Date
  declare updated_at: Date
}

OrganizationModuleConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    module_id: { type: DataTypes.UUID, allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    config_json: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'organization_module_config',
    timestamps: true,
    underscored: true,
  },
)
