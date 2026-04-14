// 1. Verificação de Segurança e Sessão
const usuarioSessao = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioSessao || (usuarioSessao.perfil !== 'admin' && usuarioSessao.perfil !== 'colaborador')) {
    window.location.href = 'index.html';
}

// Inicialização de textos e data
const elNome = document.getElementById('nomeAdmin');
if (elNome) elNome.innerText = usuarioSessao.nome;

const elData = document.getElementById('dataAtual');
if (elData) {
    elData.innerText = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
    });
}

// Variáveis Globais
let ticketsData = [];
let chartPrioridade, chartStatus;
let idTicketAtivo = null; // Controla qual ticket o admin está respondendo agora

/**
 * NAVEGAÇÃO ENTRE TELAS (Abas do Menu Lateral)
 */
function navegarMenu(viewId) {
    // Esconde todas as seções
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');

    // Mostra a seção desejada
    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';

    // Atualiza classe 'active' no menu lateral
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    
    const menuMap = {
        'dashboardView': 'menu-dashboard',
        'ticketsSection': 'menu-atendimento',
        'usersView': 'menu-usuarios',
        'reportsView': 'menu-relatorios'
    };

    const activeMenuId = menuMap[viewId];
    if (activeMenuId) document.getElementById(activeMenuId).classList.add('active');

    // Recarrega dados se for o Dashboard ou Atendimento
    carregarEstatisticas();
}

/**
 * CARREGAMENTO DE DADOS E MÉTRICAS (Dashboard)
 */
function carregarEstatisticas() {
    const tickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    ticketsData = tickets;

    const setMetric = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    };

    const pendentes = tickets.filter(t => t.status === 'Pendente');

    // Preenche os 6 cards do storyboard
    setMetric('countVencidos', pendentes.length > 0 ? 1 : 0); 
    setMetric('countVencendoHoje', 0);
    setMetric('countAbertos', pendentes.length);
    setMetric('countEspera', 0);
    setMetric('countNaoAtribuidos', pendentes.length);
    setMetric('countMonitorados', 1);

    // Renderiza a parte visual
    renderizarGraficosDonut(tickets);
    renderizarBarrasProgresso(tickets);
    renderizarTabelaGeral(tickets);
}

/**
 * GRÁFICOS DE ROSCA (Chart.js)
 */
function renderizarGraficosDonut(tickets) {
    const config = (data, colors) => ({
        type: 'doughnut',
        data: { datasets: [{ data, backgroundColor: colors, borderWidth: 0, cutout: '75%' }] },
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
    });

    const ctxPri = document.getElementById('chartPrioridade');
    if (ctxPri) {
        if (chartPrioridade) chartPrioridade.destroy();
        chartPrioridade = new Chart(ctxPri, config([
            tickets.filter(t => t.prioridade === 'Baixa').length,
            tickets.filter(t => t.prioridade === 'Média').length,
            tickets.filter(t => t.prioridade === 'Alta').length
        ], ['#f97316', '#2563eb', '#ef4444']));
    }

    const ctxSta = document.getElementById('chartStatus');
    if (ctxSta) {
        if (chartStatus) chartStatus.destroy();
        chartStatus = new Chart(ctxSta, config([
            tickets.filter(t => t.status === 'Pendente').length,
            tickets.filter(t => t.status === 'Finalizado').length
        ], ['#2563eb', '#10b981']));
    }
}

/**
 * GRÁFICO DE BARRAS (Prioridades)
 */
function renderizarBarrasProgresso(tickets) {
    const container = document.getElementById('barChartContainer');
    if (!container) return;

    const prioridades = ['Baixa', 'Média', 'Alta', 'Urgente'];
    const total = tickets.length || 1;

    container.innerHTML = prioridades.map(prio => {
        const qtd = tickets.filter(t => t.prioridade === prio).length;
        const porc = (qtd / total) * 100;
        return `
            <div class="bar-item">
                <div class="bar-info"><span>${prio}</span> <span>${qtd}</span></div>
                <div class="bar-track"><div class="bar-fill ${prio === 'Baixa' ? 'purple' : ''}" style="width: ${porc}%"></div></div>
            </div>
        `;
    }).join('');
}

/**
 * ATENDIMENTO: TABELA E RESPOSTA
 */
function renderizarTabelaGeral(tickets) {
    const tabela = document.getElementById('ticketsByClientList');
    if (!tabela) return;

    if (tickets.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum ticket encontrado.</td></tr>';
        return;
    }

    tabela.innerHTML = tickets.slice().reverse().map(ticket => {
        const statusClass = ticket.status === 'Pendente' ? 'pendente' : 'finalizado';
        return `
            <tr>
                <td><strong>#${ticket.id}</strong></td>
                <td>${ticket.assunto}</td>
                <td>${ticket.prioridade}</td>
                <td><span class="badge ${statusClass}">${ticket.status}</span></td>
                <td><button class="btn-atender" onclick="irParaInteracao(${ticket.id})">Atender</button></td>
            </tr>
        `;
    }).join('');
}

// Abre o card de resposta para um ticket específico
function irParaInteracao(id) {
    idTicketAtivo = id;
    const areaResposta = document.getElementById('areaRespostaAdmin');
    const displayId = document.getElementById('idTicketRespondendo');

    if (areaResposta && displayId) {
        areaResposta.style.display = 'block';
        displayId.innerText = `#${id}`;
        document.getElementById('textoRespostaAdmin').focus();
        // Rola suavemente até o topo da área de atendimento
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * SALVAR RESPOSTA (Onde a mágica acontece)
 */
function salvarRespostaLivre() {
    const campoTexto = document.getElementById('textoRespostaAdmin');
    const resposta = campoTexto.value;

    if (!idTicketAtivo) return alert("Por favor, selecione um ticket na tabela primeiro.");
    if (!resposta.trim()) return alert("A resposta não pode estar vazia.");

    // 1. Carrega banco de dados
    let lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = lista.findIndex(t => t.id === idTicketAtivo);

    if (index !== -1) {
        // 2. Garante estrutura de mensagens
        if (!lista[index].mensagens) lista[index].mensagens = [];

        // 3. Adiciona a mensagem do colaborador
        lista[index].mensagens.push({
            autor: usuarioSessao.nome,
            perfil: "suporte", // Isso permite que o CSS do cliente saiba que é suporte
            texto: resposta,
            data: new Date().toISOString()
        });

        // 4. Salva no LocalStorage
        localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

        // 5. Limpa interface
        campoTexto.value = "";
        document.getElementById('areaRespostaAdmin').style.display = 'none';
        idTicketAtivo = null;

        alert("Resposta enviada com sucesso! O cliente já pode visualizar.");
        carregarEstatisticas(); // Atualiza a tabela
    }
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarEstatisticas();