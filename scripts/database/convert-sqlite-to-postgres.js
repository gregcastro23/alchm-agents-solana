#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
// import { execSync } from 'child_process'  // Not used

function convertSqliteToPostgres(sqliteDump) {
  let postgresSQL = sqliteDump

  // Remove SQLite-specific pragmas
  postgresSQL = postgresSQL.replace(/PRAGMA.*?;/g, '')
  postgresSQL = postgresSQL.replace(/BEGIN TRANSACTION;/g, 'BEGIN;')
  postgresSQL = postgresSQL.replace(/COMMIT;/g, 'COMMIT;')

  // Convert AUTOINCREMENT to SERIAL
  postgresSQL = postgresSQL.replace(/AUTOINCREMENT/g, '')

  // Convert SQLite data types to PostgreSQL
  postgresSQL = postgresSQL.replace(/TEXT/g, 'TEXT')
  postgresSQL = postgresSQL.replace(/INTEGER/g, 'INTEGER')
  postgresSQL = postgresSQL.replace(/REAL/g, 'REAL')
  postgresSQL = postgresSQL.replace(/BLOB/g, 'BYTEA')

  // Handle JSON fields - keep as TEXT for now, we'll convert later
  postgresSQL = postgresSQL.replace(/JSONB/g, 'TEXT')

  // Convert table names that might conflict
  postgresSQL = postgresSQL.replace(/"([^"]+)"/g, (match, _tableName) => {
    // Keep the quotes for reserved words
    return match
  })

  // Convert INSERT statements to handle JSON properly
  const insertRegex = /INSERT INTO ([^ ]+) VALUES \((.*?)\);/g
  postgresSQL = postgresSQL.replace(insertRegex, (match, _table, _values) => {
    // For JSON fields, we might need special handling
    return match
  })

  return postgresSQL
}

try {
  console.log('📖 Reading SQLite dump...')
  const sqliteDump = readFileSync('sqlite_dump.sql', 'utf8')

  console.log('🔄 Converting to PostgreSQL format...')
  const postgresSQL = convertSqliteToPostgres(sqliteDump)

  console.log('💾 Writing PostgreSQL dump...')
  writeFileSync('postgres_dump.sql', postgresSQL)

  console.log('✅ Conversion completed!')
  console.log('📄 Generated postgres_dump.sql')
} catch (error) {
  console.error('❌ Conversion failed:', error)
  process.exit(1)
}
