#!/bin/bash

# Pimpotasma Family Swarm - API Test Examples
# Test the family agent endpoints

echo "🎪 Pimpotasma Family Swarm - API Examples"
echo "=========================================="
echo ""

BASE="http://localhost:3000/api/coordination"

# 1. List family members
echo "1️⃣  Listar membros da família:"
echo "GET $BASE/family/members"
curl -s "$BASE/family/members" | jq .
echo ""
echo ""

# 2. Initialize family team
echo "2️⃣  Inicializar team da família:"
echo "POST $BASE/family/init"
curl -s -X POST "$BASE/family/init" | jq .
echo ""
echo ""

# 3. List workflow templates
echo "3️⃣  Listar workflow templates disponíveis:"
echo "GET $BASE/family/templates"
curl -s "$BASE/family/templates" | jq .
echo ""
echo ""

# 4. Create workflow from template: launch_product
echo "4️⃣  Criar workflow do template 'launch_product':"
echo "POST $BASE/family/workflow-template/launch_product"
curl -s -X POST "$BASE/family/workflow-template/launch_product" | jq .
echo ""
echo ""

# 5. Create custom workflow: Code Review
echo "5️⃣  Criar workflow customizado de Code Review:"
echo "POST $BASE/family/workflow"
curl -s -X POST "$BASE/family/workflow" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Code Review do Novo Módulo",
    "description": "Full review com Bento (QA), Betinha (operação), Repeteco (strategy), Pimpim (aprovação)",
    "steps": [
      {
        "agent": "bento",
        "task": "Executa first-pass code review — qualidade técnica"
      },
      {
        "agent": "betinha",
        "task": "Analisa impacto operacional"
      },
      {
        "agent": "repeteco",
        "task": "Oferece perspective estratégica"
      },
      {
        "agent": "pimpim",
        "task": "Decisão final de aprovação"
      }
    ]
  }' | jq .
echo ""
echo ""

# 6. Create workflow: Design Sprint
echo "6️⃣  Criar workflow de Design Sprint:"
echo "POST $BASE/family/workflow-template/design_sprint"
curl -s -X POST "$BASE/family/workflow-template/design_sprint" | jq .
echo ""
echo ""

# 7. Create workflow: Resolve Problem
echo "7️⃣  Criar workflow de Resolução de Problema:"
echo "POST $BASE/family/workflow-template/resolve_problem"
curl -s -X POST "$BASE/family/workflow-template/resolve_problem" | jq .
echo ""
echo ""

echo "✅ Exemplos de APIs testados!"
echo ""
echo "Próximas ações:"
echo "  • Usar workflow IDs para acompanhar progresso"
echo "  • Integrar com UI Coordination"
echo "  • Verificar inbox dos agentes"
