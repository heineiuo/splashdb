import { BootBuffer } from 'bootbuffer'
import { MongoCommandOption } from '@splashdb/mongo-types'
import { SplashDBMongoOptions } from './SplashDBMongoOptions'
import { SplashdbClientMogno } from './SplashDBMongoClient'

type SplashRoleName = 'admin' | 'read' | 'readWrite'

type SplashAuthData = {
  user: string
  password: string
}

export class AuthManager {
  constructor(
    options: Pick<SplashDBMongoOptions, 'adminPassword'>,
    client: SplashdbClientMogno
  ) {
    this.db = 'system'
    this.client = client
    this.options = options
    this.roleCache = new Map<string, SplashRoleName>()
  }

  db: string
  client: SplashdbClientMogno
  options: Pick<SplashDBMongoOptions, 'adminPassword' | 'debug'>
  roleCache: Map<string, SplashRoleName>

  async can(
    authorization: string,
    commandOption: MongoCommandOption<{}>,
    dbname = this.db
  ): Promise<boolean> {
    try {
      if (!authorization) return false
      if (typeof commandOption !== 'object') return false
      const roleCacheId = `${authorization}:${dbname}`

      if (!this.roleCache.has(roleCacheId)) {
        const parsedAuthorization = this.parseAuthorization(authorization)
        if (this.options.debug) {
          console.log({ parsedAuthorization })
        }
        if (!parsedAuthorization) {
          return false
        }
        if (parsedAuthorization.user === 'admin') {
          if (parsedAuthorization.password === this.options.adminPassword) {
            this.roleCache.set(roleCacheId, 'admin')
            return true
          } else {
            return false
          }
        }
        const record = await this.client.basicClient.get(
          this.db,
          `user/${dbname}/${parsedAuthorization.user}`
        )

        if (!record) return false
        const result: { [x: string]: any } = {}
        for await (const entry of BootBuffer.read(Buffer.from(record))) {
          result[entry.key] = entry.value
        }
        if (result.password !== parsedAuthorization.password) return false
        const { role } = result
        this.roleCache.set(roleCacheId, role)
      }

      const role = this.roleCache.get(roleCacheId)
      if (!role) return false
      if (role === 'admin') return true
      if (role === 'read' && !('find' in commandOption)) {
        return false
      }
      return true
    } catch (e) {
      if (this.options.debug) console.error(e)
      return false
    }
  }

  parseAuthorization(authorization: string): SplashAuthData | void {
    try {
      const hex = authorization.substr('Basic '.length)
      const [user, password] = Buffer.from(hex, 'base64').toString().split(':')
      if (!!user && !!password) {
        return { user, password }
      }
    } catch (e) {}
  }
}