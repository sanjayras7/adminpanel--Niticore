import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'

export interface FrameworkAttributes {
  id: string
  name: string
  description: string | null
  classification_id: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class Framework extends Model<FrameworkAttributes> implements FrameworkAttributes {
  declare id: string
  declare name: string
  declare description: string | null
  declare classification_id: string | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Framework.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    classification_id: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'frameworks',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)
