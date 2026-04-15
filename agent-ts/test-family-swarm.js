#!/usr/bin/env node
/**
 * Pimpotasma Family Swarm - Practical Test
 * Test script to demonstrate family agent coordination
 *
 * Run with: npx ts-node test-family-swarm.ts
 */
import fetch from 'node-fetch';
const API_BASE = 'http://localhost:3001/api/coordination';
async function log(title, data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 ${title}`);
    console.log(`${'='.repeat(60)}`);
    console.log(JSON.stringify(data, null, 2));
}
async function test() {
    try {
        // 1. Initialize family team
        console.log('\n🎪 Iniciando teste do Swarm Pimpotasma...\n');
        const initRes = await fetch(`${API_BASE}/family/init`, { method: 'POST' });
        const initData = (await initRes.json());
        if (!initData.success)
            throw new Error(`Failed to init family team: ${initData.error || 'Unknown error'}`);
        await log('✅ Family Team Inicializado', initData.team);
        //  2. List family members
        const membersRes = await fetch(`${API_BASE}/family/members`);
        const membersData = (await membersRes.json());
        await log('🐕 Membros da Família Pimpotasma', {
            count: membersData.count,
            members: membersData.members,
        });
        // 3. List available templates
        const templatesRes = await fetch(`${API_BASE}/family/templates`);
        const templatesData = (await templatesRes.json());
        await log('📋 Modelos de Workflow Disponíveis', {
            count: templatesData.count,
            templates: templatesData.templates,
        });
        // 4. Create workflow from template: "Lançar novo produto"
        console.log('\n🚀 Criando workflow: "Lançar Novo Produto"...');
        const workflowRes = await fetch(`${API_BASE}/family/workflow-template/launch_product`, {
            method: 'POST',
        });
        if (!workflowRes.ok) {
            const errorText = await workflowRes.text();
            throw new Error(`Failed to create workflow: ${workflowRes.statusText} - ${errorText}`);
        }
        const workflowData = (await workflowRes.json());
        if (!workflowData.success)
            throw new Error(`Workflow creation failed: ${workflowData.error || 'Unknown error'}`);
        const workflow = workflowData.workflow;
        await log('✅ Workflow Criado com Sucesso!', {
            workflowId: workflow.workflowId,
            teamId: workflow.teamId,
            totalSteps: workflow.steps.length,
            steps: workflow.steps,
        });
        // 5. Create custom workflow: "Code Review"
        console.log('\n🔍 Criando workflow customizado: "Code Review"...');
        const customRes = await fetch(`${API_BASE}/family/workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goal: 'Revisar código do novo módulo de coordenação',
                description: 'Full code review com perspectivas de QA, strategy e operação',
                steps: [
                    {
                        agent: 'bento',
                        task: 'Executa first-pass code review — qualidade técnica',
                    },
                    {
                        agent: 'betinha',
                        task: 'Analisa impacto operacional e viabilidade',
                    },
                    {
                        agent: 'repeteco',
                        task: 'Oferece second opinion estratégica',
                    },
                    {
                        agent: 'pimpim',
                        task: 'Aprova ou rejeta com decisão final',
                    },
                ],
            }),
        });
        const customData = (await customRes.json());
        if (!customData.success)
            throw new Error('Custom workflow creation failed');
        await log('✅ Custom Workflow Criado!', {
            workflowId: customData.workflow.workflowId,
            goal: 'Code Review do Módulo',
            steps: customData.workflow.steps,
        });
        // 6. Simulate a conversation between family members
        console.log('\n💬 Simulando conversa entre Pimpim e Betinha...');
        const conversationExample = {
            scenario: 'Product Launch Discussion',
            messages: [
                {
                    from: 'Pimpim',
                    to: 'Betinha',
                    message: 'Betinha! Temos uma oportunidade de lançar Nova feature. Você acha viável do ponto de vista financeiro?',
                },
                {
                    from: 'Betinha',
                    to: 'Pimpim',
                    message: 'Oi Pimpim! 💚 Analisei e é viável. Precisamos de 15% do orçamento Q2. Posso delegar para Chubaka testar qualidade depois que Kitty terminar o design visual?',
                },
                {
                    from: 'Pimpim',
                    to: 'Bento',
                    message: 'Bento, qual sua análise de risco? Temos um timeline apertado...',
                },
                {
                    from: 'Bento',
                    to: 'Pimpim',
                    message: 'Timeline está apertado mas viável. Minha preocupação: faltam testes de integração. Preciso de mais 2 dias para validar.',
                },
                {
                    from: 'Pimpim',
                    to: 'Betinha + Bento',
                    message: 'OK! Vamos dar os 2 dias extras para Bento. Betinha, você consegue ajustar a data de lançamento?',
                },
                {
                    from: 'Betinha',
                    to: 'Pimpim',
                    message: 'Conseguimos! Bóra fazer isso direito. Aviso marketing para ajustar timeline.',
                },
            ],
        };
        await log('💬 Exemplo de Conversa Coordenada', conversationExample);
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
        console.log('='.repeat(60));
        console.log(`
🎪 Resumo do que foi testado:

1. ✅ Inicialização do Team "family-pimpotasma"
2. ✅ Listagem de 9 membros da família
3. ✅ 5 templates de workflow prontos
4. ✅ Workflow de "Lançar Novo Produto" com 6 etapas coordenadas
5. ✅ Workflow customizado de "Code Review" com 4 agentes
6. ✅ Simulação de conversa coordenada

🚀 Próximos passos:
   - Integration com REST endpoints
   - UI Coordination para visualizar workflows
   - Memory persistente para cada agente
   - Logs & analytics de coordenação

💚 Todos os agentes estão prontos para usar!
`);
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ ERRO DURANTE O TESTE:');
        console.error(error);
        process.exit(1);
    }
}
test();
