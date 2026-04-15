#!/usr/bin/env node
/**
 * Test script to validate persistence tables are created correctly
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env.local') })
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set')
  process.exit(1)
}

console.log('🔍 Testing persistence tables...\n')

const pool = new Pool({ connectionString: DATABASE_URL })

async function testTables() {
  try {
    const tables = [
      'agent_response_history',
      'agent_support_chain',
      'agent_conversational_state',
      'agent_interaction_graph',
      'api_calls_cache',
      'conversation_context',
      'message_traces',
      'conversation_metadata',
    ]

    console.log('📋 Checking tables:\n')

    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [table]
      )

      const exists = result.rows[0].exists
      const status = exists ? '✅' : '❌'
      console.log(`${status} ${table}`)
    }

    console.log('\n🔍 Checking indexes:\n')

    const indexResult = await pool.query(
      `SELECT indexname FROM pg_indexes 
       WHERE schemaname = 'public' 
       AND indexname LIKE 'idx_%'
       ORDER BY indexname`
    )

    console.log(`Found ${indexResult.rowCount} indexes:`)
    indexResult.rows.forEach(row => {
      console.log(`  📌 ${row.indexname}`)
    })

    console.log('\n✨ All persistence tables ready!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

testTables()
