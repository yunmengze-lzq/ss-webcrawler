import logger from 'electron-log'
import { app } from 'electron'
import path from 'path'

const exeDir = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.join(__dirname, '../../')

logger.transports.file.resolvePath = () => {
  const today = new Date().toISOString().split('T')[0]
  return path.join(exeDir, 'logs', `${today}.log`)
}

logger.transports.file.level  = 'debug'
logger.transports.file.maxSize = 10 * 1024 * 1024
logger.transports.file.format  = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
logger.transports.console.level = 'debug'

export const log = {
  info:  (msg: any) => logger.info(msg),
  warn:  (msg: any) => logger.warn(msg),
  error: (msg: any) => logger.error(msg),
  debug: (msg: any) => logger.debug(msg),
}
