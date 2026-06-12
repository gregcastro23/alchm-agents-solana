import { storageContextFromDefaults, Settings } from 'llamaindex'
import { OpenAIEmbedding } from '@llamaindex/openai'

Settings.embedModel = new OpenAIEmbedding({ model: 'text-embedding-3-small' })

async function checkAPI() {
  const ctx = await storageContextFromDefaults({})

  console.log('StorageContext type:', typeof ctx)
  console.log(
    '\nStorageContext properties:',
    Object.keys(ctx).filter(k => !k.startsWith('_'))
  )
  console.log(
    '\nStorageContext methods:',
    Object.getOwnPropertyNames(Object.getPrototypeOf(ctx)).filter(m => !m.startsWith('_'))
  )

  console.log('\n\nDocStore type:', typeof ctx.docStore)
  console.log(
    'DocStore methods:',
    Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.docStore)).filter(
      m => !m.startsWith('_') && m !== 'constructor'
    )
  )

  console.log('\n\nIndexStore type:', typeof ctx.indexStore)
  console.log(
    'IndexStore methods:',
    Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.indexStore)).filter(
      m => !m.startsWith('_') && m !== 'constructor'
    )
  )

  console.log('\n\nVectorStore type:', typeof ctx.vectorStore)
  if (ctx.vectorStore) {
    console.log(
      'VectorStore methods:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.vectorStore)).filter(
        m => !m.startsWith('_') && m !== 'constructor'
      )
    )
  }
}

checkAPI().catch(console.error)
