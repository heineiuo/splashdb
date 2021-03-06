import fs from 'fs'
import path from 'path'
import { SplashdbClient } from '../client'

global.TextEncoder = require('util').TextEncoder
global.TextDecoder = require('util').TextDecoder

jest.setTimeout(60000 * 10)

const uri = fs.readFileSync(
  path.resolve(__dirname, '../mocks/mongo-node-url.txt'),
  'utf8'
)
const client = new SplashdbClient(uri)

afterAll(() => {
  client.destroy()
})

describe('Call methods', () => {
  test('find', async (done) => {
    const deleted = await client.runCommand({
      delete: 'user',
      deletes: [
        {
          q: {},
          limit: 0,
        },
      ],
    })
    // console.info(`Deleted ${deleted.n} documents.`)

    const insertResult = await client.runCommand({
      insert: 'user',
      documents: [
        {
          username: 'example',
          password: 'password',
        },
      ],
    })
    expect(insertResult.n).toBe(1)

    const findOutput = await client.runCommand({
      find: 'user',
      limit: 0,
      filter: {},
    })
    expect(findOutput.n).toBe(1)

    const findOutputData = await findOutput.cursor.toArray()
    // console.log('findOutputData', findOutputData)
    expect(findOutputData[0].username).toBe('example')

    const updateOutput = await client.runCommand({
      update: 'user',
      updates: [
        {
          q: {},
          u: {
            username: 'example',
            password: 'new-password',
          },
        },
        {
          upsert: true,
          q: {
            username: 'example2',
          },
          u: {
            username: 'example2',
            password: 'password2',
          },
        },
      ],
    })

    expect(updateOutput.ok).toBe(1)
    expect(updateOutput.n).toBe(2)
    expect(updateOutput.upserted[0].username).toBe('example2')

    const findAndModifyOutput = await client.runCommand({
      findAndModify: 'user',
      remove: true,
      query: {
        username: 'example2',
      },
      update: {},
    })
    expect(findAndModifyOutput.ok).toBe(1)
    expect(findAndModifyOutput.value.username).toBe('example2')
    done()
  })
})
