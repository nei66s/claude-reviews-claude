# Prototype: TypeScript LLM server

Minimal prototype that exposes two endpoints:

- `POST /chat` — forwards `messages` to OpenAI Chat API using `OPENAI_API_KEY` from `.env`
- `POST /tools/run` — run simple tools: `file.read` and `bash.exec`

Quick start:

```bash
cd prototype-ts
cp .env.example .env
# set OPENAI_API_KEY in .env
npm install
npm run dev
```

Example requests:

```http
POST /chat
Content-Type: application/json

{"messages":[{"role":"user","content":"Say hi"}]}
```

```http
POST /tools/run
Content-Type: application/json

{"tool":"file.read","input":{"path":"README.md"}}
```
