# ⚡ Quick Reference - PostgreSQL LOCAL

**Status:** ✅ Banco local apenas (127.0.0.1)  
**Atualizado:** 14/04/2026

## 🔑 Credenciais

```
Servidor:  127.0.0.1
Porta:     5432
Banco:     chocks
Usuário:   postgres
Senha:     mysecret
```

## 📋 DATABASE_URL

```
postgresql://postgres:mysecret@127.0.0.1:5432/chocks
```

---

## ✅ Checklist Operacional

### Status do Servidor
```bash
sudo systemctl status postgresql
```

### Conectar ao Banco
```bash
psql postgresql://postgres:mysecret@127.0.0.1:5432/chocks
```

### Ver Tabelas
```bash
sudo -u postgres psql -d chocks -c "\dt"
```

### Ver Dados de Usuários
```bash
sudo -u postgres psql -d chocks -c "SELECT * FROM app_users LIMIT 10;"
```

### Ver Conversas
```bash
sudo -u postgres psql -d chocks -c "SELECT * FROM conversations LIMIT 10;"
```

---

## 🚀 Comandos Úteis

### Backup
```bash
sudo -u postgres pg_dump chocks > /path/to/backup.sql
```

### Restaurar
```bash
psql chocks < backup.sql
```

### Reiniciar PostgreSQL
```bash
sudo systemctl restart postgresql
```

### Ver Logs
```bash
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Recarregar Config
```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl reload -D /var/lib/postgresql/16/main
```

---

## 📊 Performance

- **Latência:** <1ms (local)
- **Conexão:** 100% estável
- **Query simples:** ~1-5ms
- **Query complexa:** ~10-50ms

---

## 📁 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `/root/claude-reviews-claude/.env` | DATABASE_URL configurada |
| `/etc/postgresql/16/main/postgresql.conf` | Config principal |
| `/etc/postgresql/16/main/pg_hba.conf` | Autenticação |
| `/var/lib/postgresql/16/main/` | Dados do banco |
| `/var/log/postgresql/` | Logs |

---

## 🆘 Troubleshooting Rápido

### PostgreSQL não para iniciar?
```bash
sudo systemctl restart postgresql
sudo journalctl -u postgresql -n 50
```

### Conectar remotamente?
```bash
# Conexão local apenas
psql -h 127.0.0.1 -U postgres -d chocks
```

### Redefinir senha?
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nova_senha';"
```

---

Última atualização: 14/04/2026 ✅
