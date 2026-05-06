// 1. Verificação de Sessão e Segurança
const usuarioAtivoStr = localStorage.getItem('sessao_ativa');

if (!usuarioAtivoStr) {
    window.location.href = 'index.html';
}

const usuarioAtivo = JSON.parse(usuarioAtivoStr);

if (usuarioAtivo.perfil !== 'admin' && usuarioAtivo.perfil !== 'colaborador') {
    window.location.href = 'index.html';
}

// 2. Inicialização do Header
const elNome = document.getElementById('nomeAdmin');
if (elNome) elNome.innerText = usuarioAtivo.nome;

const elData = document.getElementById('dataAtual');
if (elData) {
    elData.innerText = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' 
    });
}

// 3. Variáveis Globais de Controle
let chartPrioridade, chartStatus;
let anexoAdminTemp = null; 
let listaTicketsGlobal = []; 
let ticketSelecionadoId = null;

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
        carregarEstatisticas(); 
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

        listaTicketsGlobal = dadosBrutos.map(t => ({
            id: t.id,
            assunto: t.assunto,
            usuario: t.email_usuario, 
            empresa: t.nome_empresa || "Empresa não cadastrada",
            status: t.status === 'A' ? 'Pendente' : 
                   (t.status === 'E' ? 'Em Atendimento' : 
                   (t.status === 'C' ? 'Cancelado' : 'Finalizado')),
            prioridade: t.prioridade === 'A' ? 'Alta' : (t.prioridade === 'M' ? 'Média' : 'Baixa'),
            data: t.data,
            tipo: t.nro_tipo === 1 ? 'Erro' : (t.nro_tipo === 2 ? 'Melhoria' : 'Dúvida'),
            prazo_dias: t.prazo_dias || 0 
        }));

        atualizarElementosInterface(listaTicketsGlobal);
       
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

    const hoje = new Date();

    tabela.innerHTML = tickets.map(ticket => {
        const dataAbertura = new Date(ticket.data);
        const prazoEmMs = (ticket.prazo_dias || 0) * 24 * 60 * 60 * 1000;
        const dataLimite = new Date(dataAbertura.getTime() + prazoEmMs);
        const estaVencido = ticket.status !== 'Finalizado' && ticket.status !== 'Cancelado' && hoje > dataLimite;

        let infoAtraso = '';
        if (estaVencido) {
            const diffMs = hoje - dataLimite;
            const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const texto = diasAtraso < 1 ? 'HOJE' : `${diasAtraso}D`;
            infoAtraso = `<span class="sla-tag"><i class="fas fa-clock"></i> ATRASADO ${texto}</span>`;
        }

        const statusClass = ticket.status.toLowerCase().replace(/\s+/g, '-');
        const tipoClass = ticket.tipo === 'Erro' ? 'type-erro' : 
                         ticket.tipo === 'Melhoria' ? 'type-melhoria' : 'type-duvida';

        // LÓGICA DOS BOTÕES DE AÇÃO (Agora dentro do loop correta)
        const botoesAcao = (ticket.status === 'Finalizado' || ticket.status === 'Cancelado')
            ? `<span style="color: #94a3b8; font-size: 11px; font-weight: 600;">SEM AÇÕES</span>`
            : `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id})" title="Atender">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                <button class="btn-action-icon btn-cancel" onclick="cancelarTicket(${ticket.id})" title="Cancelar Chamado">
                    <i class="fas fa-times-circle"></i>
                </button>
            `;

        return `
            <tr class="${estaVencido ? 'is-overdue' : ''} ${ticket.status === 'Cancelado' ? 'is-canceled' : ''}">
                <td class="col-id">#${ticket.id}</td>
                <td class="col-cliente">
                    <strong>${ticket.empresa}</strong>
                    <span>${ticket.usuario}</span>
                </td>
                <td class="col-tipo">
                    <span class="badge-outline ${tipoClass}">${ticket.tipo}</span>
                </td>
                <td class="col-assunto">
                    <div class="subject-text">${ticket.assunto}</div>
                    ${infoAtraso}
                </td>
                <td class="col-data">${new Date(ticket.data).toLocaleDateString('pt-BR')}</td>
                <td class="col-prio"><span class="prio-text prio-${ticket.prioridade.toLowerCase()}">${ticket.prioridade}</span></td>
                <td class="col-status">
                    <span class="status-pill ${statusClass}">${ticket.status}</span>
                </td>
                <td class="col-acoes">
                    ${botoesAcao}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * RENDERIZAÇÃO DOS GRÁFICOS (Atualizado com Cancelados)
 */
function renderizarGraficosDonut(tickets) {
    const nBaixa = tickets.filter(t => t.prioridade === 'Baixa').length;
    const nMedia = tickets.filter(t => t.prioridade === 'Média').length;
    const nAlta = tickets.filter(t => t.prioridade === 'Alta').length;

    const nPendente = tickets.filter(t => t.status === 'Pendente').length;
    const nAtendimento = tickets.filter(t => t.status === 'Em Atendimento').length;
    const nFinalizado = tickets.filter(t => t.status === 'Finalizado').length;
    const nCancelado = tickets.filter(t => t.status === 'Cancelado').length;

    const config = (data, labels, colors) => ({
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, cutout: '75%' }] 
        },
        options: { 
            plugins: { 
                legend: { 
                    display: true, position: 'bottom',
                    labels: { usePointStyle: true, padding: 20, color: '#475569', font: { size: 11, weight: '600' } }
                }
            }, 
            maintainAspectRatio: false 
        }
    });

    const ctxPri = document.getElementById('chartPrioridade');
    if (ctxPri) {
        if (chartPrioridade) chartPrioridade.destroy();
        chartPrioridade = new Chart(ctxPri, config(
            [nBaixa, nMedia, nAlta], 
            [`Baixa (${nBaixa})`, `Média (${nMedia})`, `Alta (${nAlta})`], 
            ['#f97316', '#2563eb', '#ef4444']
        ));
    }

    const ctxSta = document.getElementById('chartStatus');
    if (ctxSta) {
        if (chartStatus) chartStatus.destroy();
        chartStatus = new Chart(ctxSta, config(
            [nPendente, nAtendimento, nFinalizado, nCancelado], 
            [`Pendente (${nPendente})`, `Atendimento (${nAtendimento})`, `Finalizado (${nFinalizado})`, `Cancelado (${nCancelado})`], 
            ['#2563eb', '#facc15', '#10b981', '#94a3b8'] // Cinza para o cancelado
        ));
    }
}

/**
 * AÇÕES E FILTROS
 */
async function cancelarTicket(id) {
    if (!confirm(`Deseja realmente cancelar o chamado #${id}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: 'C' })
        });

        if (response.ok) carregarEstatisticas();
    } catch (error) {
        alert("Erro ao cancelar chamado.");
    }
}

/**
 * GESTÃO DE USUÁRIOS: BUSCA E RENDERIZAÇÃO
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
                    <button class="btn-action-soft" onclick="deletarUsuario('${user.email}')" title="Remover Usuário">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
    }
}

function aplicarFiltros() {
    const tipoFiltro = document.getElementById('filterTipo').value;
    const statusFiltro = document.getElementById('filterStatus').value;
    let listaFiltrada = [...listaTicketsGlobal];

    if (tipoFiltro !== 'todos') listaFiltrada = listaFiltrada.filter(t => t.tipo === tipoFiltro);
    if (statusFiltro !== 'todos') listaFiltrada = listaFiltrada.filter(t => t.status === statusFiltro);

    atualizarElementosInterface(listaFiltrada);
}

/**
 * RENDERIZAÇÃO DAS BARRAS DE PROGRESSO (Prioridade/SLA)
 */
function renderizarBarrasProgresso(tickets) {
    const container = document.getElementById('barChartContainer');
    if (!container) return;

    const total = tickets.length || 1;
    const prioridadesConfig = [
        { label: 'Alta', cor: '#ef4444' },
        { label: 'Média', cor: '#2563eb' },
        { label: 'Baixa', cor: '#f97316' }
    ];

    container.innerHTML = prioridadesConfig.map(prio => {
        const qtd = tickets.filter(t => t.prioridade === prio.label).length;
        const porcentagem = (qtd / total) * 100;

        return `
            <div class="bar-item-modern" style="margin-bottom: 18px;">
                <div class="bar-info" style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                    <strong style="color: #1e293b;">${prio.label}</strong>
                    <span style="color: #64748b; font-weight: 600;">${qtd} (${porcentagem.toFixed(0)}%)</span>
                </div>
                <div class="bar-track" style="background: #f1f5f9; height: 8px; border-radius: 10px; overflow: hidden;">
                    <div class="bar-fill" style="width: ${porcentagem}%; background: ${prio.cor}; height: 100%; transition: width 0.5s ease-in-out;"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * REMOVER USUÁRIO DO SISTEMA
 */
async function deletarUsuario(email) {
    if (!confirm(`Deseja remover permanentemente o acesso de ${email}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/usuarios/${email}`, { 
            method: 'DELETE' 
        });
        
        if (response.ok) {
            // Recarrega a lista após a exclusão com sucesso
            carregarUsuarios();
        } else {
            const erro = await response.json();
            alert("Erro: " + erro.error);
        }
    } catch (error) {
        alert("Erro de conexão ao tentar deletar usuário.");
    }
}

function atualizarElementosInterface(dados) {
    renderizarGraficosDonut(dados);
    renderizarBarrasProgresso(dados);
    renderizarTabelaGeral(dados);
}

// Inicialização automática
carregarEstatisticas();