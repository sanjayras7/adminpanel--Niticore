import { Sequelize } from 'sequelize'
import { config } from '@/config'

export const sequelize = new Sequelize(config.database.url, {
  dialect: 'postgres',
  logging: config.isTest ? false : (msg) => console.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
})
