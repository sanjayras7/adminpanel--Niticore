import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface FrameworkVersionAttributes {
  id: string
  framework_id: string
  version_label: string
  description: string | null
  status: 'draft' | 'active' | 'deprecated'
  effective_date: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class FrameworkVersion extends Model<FrameworkVersionAttributes> implements FrameworkVersionAttributes {
  declare id: string
  declare framework_id: string
  declare version_label: string
  declare description: string | null
  declare status: 'draft' | 'active' | 'deprecated'
  declare effective_date: Date | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

FrameworkVersion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    framework_id: { type: DataTypes.UUID, allowNull: false },
    version_label: { type: DataTypes.STRING(50), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'deprecated'),
      allowNull: false,
      defaultValue: 'draft',
    },
    effective_date: { type: DataTypes.DATEONLY, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'framework_versions',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['framework_id', 'version_label'],
      },
    ],
  },
)
