import { DataTypes, Model } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { Lead } from './Lead'

export interface LeadNoteAttributes {
  id: string
  lead_id: string
  note_text: string
  created_by: string | null
  updated_by: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export class LeadNote extends Model<LeadNoteAttributes> implements LeadNoteAttributes {
  declare id: string
  declare lead_id: string
  declare note_text: string
  declare created_by: string | null
  declare updated_by: string | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

LeadNote.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lead_id: { type: DataTypes.UUID, allowNull: false },
    note_text: { type: DataTypes.TEXT, allowNull: false },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'lead_notes',
    timestamps: true,
    underscored: true,
    paranoid: true,
  },
)

LeadNote.belongsTo(Lead, { foreignKey: 'lead_id', as: 'lead' })
