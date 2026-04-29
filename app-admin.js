// 1. Verificação de Segurança e Sessão
const usuarioSessao = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioSessao || (usuarioSessao.perfil !== 'admin' && usuarioSessao.perfil !== 'colaborador')) {
    window.location.href = 'index.html';
}

// Inicialização de textos e data no Header
const elNome = document.getElementById('nomeAdmin');
if (elNome) elNome.innerText = usuarioSessao.nome;

const elData = document.getElementById('dataAtual');
if (elData) {
    elData.innerText = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
    });
}

// Variáveis Globais de Controle
let chartPrioridade, chartStatus;
let anexoAdminTemp = null; 
let listaTicketsGlobal = []; // Armazena os tickets vindos do banco

/**
 * NAVEGAÇÃO ENTRE TELAS
 */
function navegarMenu(viewId) {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    
    const menuMap = {
        'dashboardView': 'menu-dashboard',
        'ticketsSection': 'menu-atendimento',
        'usersView': 'menu-usuarios',
        'reportsView': 'menu-relatorios'
    };

    const activeMenuId = menuMap[viewId];
    if (activeMenuId) document.getElementById(activeMenuId).classList.add('active');

    if (viewId === 'usersView') {
        carregarUsuarios();
    } else if (viewId === 'dashboardView' || viewId === 'ticketsSection') {
        carregarEstatisticas(); // Carrega os dados do banco para ambos
    }
}

/**
 * DASHBOARD E TABELA: BUSCA DO BANCO (MySQL)
 */
async function carregarEstatisticas() {
    try {
        const response = await fetch('http://localhost:3000/api/tickets');
        const dadosBrutos = await response.json();

        if (!Array.isArray(dadosBrutos)) return;

        // Tradução de Flags do Banco para Texto do Front-end
        listaTicketsGlobal = dadosBrutos.map(t => ({
            id: t.id,
            assunto: t.assunto,
            usuario: t.usuario, // E-mail do cliente
            status: t.status === 'A' ? 'Pendente' : (t.status === 'E' ? 'Em Atendimento' : 'Finalizado'),
            prioridade: t.prioridade === 'A' ? 'Alta' : (t.prioridade === 'M' ? 'Média' : 'Baixa'),
            data: t.data
        }));

        const setMetric = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.innerText = valor;
        };

        // Filtros para as métricas
        const pendentes = listaTicketsGlobal.filter(t => t.status === 'Pendente');
        const emAtendimento = listaTicketsGlobal.filter(t => t.status === 'Em Atendimento');

        setMetric('countVencidos', listaTicketsGlobal.filter(t => t.prioridade === 'Alta' && t.status !== 'Finalizado').length); 
        setMetric('countAbertos', pendentes.length);
        setMetric('countEspera', emAtendimento.length);
        setMetric('countNaoAtribuidos', pendentes.length);
        setMetric('countMonitorados', listaTicketsGlobal.length);

        renderizarGraficosDonut(listaTicketsGlobal);
        renderizarBarrasProgresso(listaTicketsGlobal);
        renderizarTabelaGeral(listaTicketsGlobal);

    } catch (error) {
        console.error("Erro ao carregar dados do MySQL:", error);
    }
}

/**
 * TABELA DE ATENDIMENTO
 */
function renderizarTabelaGeral(tickets) {
    const tabela = document.getElementById('ticketsByClientList');
    if (!tabela) return;

    tabela.innerHTML = tickets.map(ticket => {
        const statusClass = ticket.status.toLowerCase().replace(/\s+/g, '-');
        
        return `
            <tr>
                <td><span style="color: #2563eb; font-weight: 800;">#${ticket.id}</span></td>
                <td><span style="font-weight: 700;">${ticket.usuario}</span></td>
                <td>${ticket.assunto}</td>
                <td>
                    <span style="font-weight:600; color: ${ticket.prioridade === 'Alta' ? '#ef4444' : '#475569'};">
                        ${ticket.prioridade}
                    </span>
                </td>
                <td><span class="badge ${statusClass}">${ticket.status}</span></td>
                <td>
                    <button class="btn-atender" onclick="abrirRespostaAdmin(${ticket.id})">
                        <i class="fas fa-external-link-alt"></i> Atender
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * ENVIO DE RESPOSTA (MySQL)
 */
async function enviarRespostaAdmin() {
    const campoTexto = document.getElementById('textoRespostaAdmin');
    const idTicket = document.getElementById('idTicketResponder').innerText;
    
    if (!campoTexto.value.trim() && !anexoAdminTemp) {
        alert("Digite uma mensagem!");
        return;
    }

    const payload = {
        ticket_id: idTicket,
        autor: usuarioSessao.email, // Salva o e-mail do admin que respondeu
        texto: campoTexto.value,
        anexo_conteudo: anexoAdminTemp ? anexoAdminTemp.conteudo : null
    };

    try {
        const response = await fetch('http://localhost:3000/api/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Resposta enviada e ticket atualizado!");
            campoTexto.value = "";
            fecharAreaResposta();
            carregarEstatisticas(); // Atualiza a lista e gráficos
        }
    } catch (error) {
        alert("Erro ao enviar resposta ao banco.");
    }
}

/**
 * GESTÃO DE USUÁRIOS (MySQL)
 */
async function carregarUsuarios() {
    const tbody = document.getElementById('listaUsuarios');
    if (!tbody) return;

    try {
        const response = await fetch('http://localhost:3000/api/usuarios');
        const usuarios = await response.json();

        tbody.innerHTML = usuarios.map(user => `
            <tr>
                <td><strong>${user.nome}</strong></td>
                <td>${user.email}</td>
                <td><span class="profile-tag">${user.perfil}</span></td>
                <td><span class="badge finalizado">Ativo</span></td>
                <td>
                    <button class="btn-action-soft" onclick="deletarUsuario('${user.email}')">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
    }
}

// Funções de Modal e Auxiliares
function abrirRespostaAdmin(id) {
    const ticket = listaTicketsGlobal.find(t => t.id == id);
    if (ticket) {
        document.getElementById('idTicketResponder').innerText = id;
        document.getElementById('areaRespostaAdmin').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function fecharAreaResposta() {
    document.getElementById('areaRespostaAdmin').style.display = 'none';
    anexoAdminTemp = null;
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Funções de Gráficos (Mantidas conforme seu original, mas recebendo dados do banco)
function renderizarGraficosDonut(tickets) {
    const config = (data, labels, colors) => ({
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, cutout: '75%' }] },
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
    });

    const ctxPri = document.getElementById('chartPrioridade');
    if (ctxPri) {
        if (chartPrioridade) chartPrioridade.destroy();
        chartPrioridade = new Chart(ctxPri, config([
            tickets.filter(t => t.prioridade === 'Baixa').length,
            tickets.filter(t => t.prioridade === 'Média').length,
            tickets.filter(t => t.prioridade === 'Alta').length
        ], ['Baixa', 'Média', 'Alta'], ['#f97316', '#2563eb', '#ef4444']));
    }

    const ctxSta = document.getElementById('chartStatus');
    if (ctxSta) {
        if (chartStatus) chartStatus.destroy();
        chartStatus = new Chart(ctxSta, config([
            tickets.filter(t => t.status === 'Pendente').length,
            tickets.filter(t => t.status === 'Em Atendimento').length,
            tickets.filter(t => t.status === 'Finalizado').length
        ], ['Pendente', 'Atendimento', 'Finalizado'], ['#2563eb', '#facc15', '#10b981']));
    }
}

/**
 * GESTÃO DE MODAL DE USUÁRIO
 */
function abrirModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function fecharModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    if (modal) {
        modal.style.display = 'none';
        const form = document.getElementById('formUsuario');
        if (form) form.reset();
    }
}

function renderizarBarrasProgresso(tickets) {
    const container = document.getElementById('barChartContainer');
    if (!container) return;
    const total = tickets.length || 1;
    const prios = ['Baixa', 'Média', 'Alta'];
    container.innerHTML = prios.map(prio => {
        const qtd = tickets.filter(t => t.prioridade === prio).length;
        const porc = (qtd / total) * 100;
        return `<div class="bar-item"><strong>${prio}</strong> (${qtd})<div class="bar-track"><div class="bar-fill" style="width:${porc}%"></div></div></div>`;
    }).join('');
}

// Inicialização
carregarEstatisticas();