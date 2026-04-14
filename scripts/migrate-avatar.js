#!/usr/bin/env node

// Script para executar migração de avatar
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

async function migrate() {
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require' 
      ? { rejectUnauthorized: false } 
      : undefined,
  });

  try {
    console.log('🔄 Conectando ao PostgreSQL...');
    
    console.log('📝 Executando migração...');
    await pool.query(`
      ALTER TABLE public.app_users 
      ADD COLUMN IF NOT EXISTS avatar TEXT;
    `);
    console.log('✅ Coluna avatar adicionada com sucesso!');

    console.log('📝 Criando índice...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_app_users_avatar 
      ON public.app_users (id);
    `);
    console.log('✅ Índice criado com sucesso!');

    console.log('\n✨ Migração concluída!');
    console.log('📸 Suporte a foto de perfil ativado.');

  } catch (error) {
    console.error('❌ Erro ao executar migração:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
