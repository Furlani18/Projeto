// 1. Verificação de Sessão e Segurança
const usuarioAtivoStr = localStorage.getItem('sessao_ativa');

if (!usuarioAtivoStr) {
    window.location.href = 'index.html';
}

const usuarioAtivo = JSON.parse(usuarioAtivoStr);
const isAdmin = usuarioAtivo.perfil === 'admin';

if (!isAdmin && usuarioAtivo.perfil !== 'colaborador') {
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

// Oculta seções administrativas de quem não for admin
document.querySelectorAll('.admin-only').forEach(el => {
    if (!isAdmin) el.style.display = 'none';
});

// 3. Variáveis Globais de Controle
let chartPrioridade, chartStatus;
let anexoAdminTemp = null; 
let listaTicketsGlobal = [];
let ticketsParaTabela = [];
let ticketSelecionadoId = null;
let todasEmpresas = [];
let empresasCadastradas = [];
let usuariosCadastrados = [];

function ensureNotificationContainer() {
    let container = document.getElementById('gesistec-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gesistec-toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showNotification(message, type = 'info', duration = 4500) {
    const container = ensureNotificationContainer();
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

function mostrarToastPendente() {
    const pendingRaw = localStorage.getItem('gesistec_pending_toast');
    if (!pendingRaw) return;
    try {
        const pending = JSON.parse(pendingRaw);
        if (pending && pending.message) {
            showNotification(pending.message, pending.type || 'info');
        }
    } catch (error) {
        // Ignora dados inválidos
    }
    localStorage.removeItem('gesistec_pending_toast');
}

mostrarToastPendente();

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
        'empresasView': 'menu-empresas',
        'tiposView': 'menu-tipos',
        'usersView': 'menu-usuarios',
        'reportsView': 'menu-relatorios'
    };

    const activeMenuId = menuMap[viewId];
    if (activeMenuId) {
        const activeElement = document.getElementById(activeMenuId);
        if (activeElement) activeElement.classList.add('active');
    }

    if (viewId === 'usersView') {
        carregarUsuarios();
    } else if (viewId === 'empresasView') {
        carregarEmpresas();
    } else if (viewId === 'tiposView') {
        carregarTiposTicket();
    } else if (viewId === 'dashboardView' || viewId === 'ticketsSection') {
        carregarEstatisticas();
    }
}

/**
 * NAVEGAR PARA ATENDIMENTO COM FILTRO DE EMPRESA + STATUS/TIPO
 */
function navegarParaAtendimentoFiltrado(empresa, valor, modo) {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById('ticketsSection');
    if (target) target.style.display = 'block';

    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const menuAtendimento = document.getElementById('menu-atendimento');
    if (menuAtendimento) menuAtendimento.classList.add('active');

    const buscaEl = document.getElementById('buscaAtendimento');
    const statusEl = document.getElementById('filtroStatusAtendimento');
    const tipoEl = document.getElementById('filtroTipoAtendimento');
    const prioEl = document.getElementById('filtroPrioridadeAtendimento');

    if (buscaEl) buscaEl.value = empresa;
    if (statusEl) statusEl.value = 'todos';
    if (tipoEl) tipoEl.value = 'todos';
    if (prioEl) prioEl.value = 'todos';

    if (modo === 'status' && statusEl) statusEl.value = valor;
    else if (modo === 'tipo' && tipoEl) tipoEl.value = valor;

    aplicarFiltroAtendimento();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * BUSCA DE DADOS (MySQL) - Versão Corrigida
 */
/**
 * BUSCA DE DADOS (MySQL)
 */
async function carregarEstatisticas() {
    try {
        const response = await fetch('http://localhost:3000/api/tickets');
        const dadosBrutos = await response.json();
        
        if (!Array.isArray(dadosBrutos)) {
            console.warn("Dados recebidos não são um array:", dadosBrutos);
            return;
        }

        // Mapeamento seguindo suas 5 regras estritas do banco
        listaTicketsGlobal = dadosBrutos.map(t => ({
            id: t.id,
            assunto: t.assunto,
            usuario: t.email_usuario, 
            empresa: t.nome_empresa || "Empresa não cadastrada",
            
            // Suas 5 regras: P, E, V, F e C (o último)
            status: t.status === 'P' ? 'Pendente' : 
                   (t.status === 'E' ? 'Em Atendimento' : 
                   (t.status === 'V' ? 'Vencido' : 
                   (t.status === 'F' ? 'Finalizado' : 'Cancelado'))),

            prioridade: t.prioridade === 'A' ? 'Alta' : (t.prioridade === 'M' ? 'Média' : 'Baixa'),
            data: t.data,
            tipo: t.tipo || (t.nro_tipo === 1 ? 'Erro' : (t.nro_tipo === 2 ? 'Melhoria' : 'Dúvida')),
            prazo_dias: t.prazo_dias || 0 
        }));

        aplicarFiltros(); 
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

    if (tickets.length === 0) {
        tabela.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state-table">
                        <i class="fas fa-inbox"></i>
                        <p>Nenhum chamado encontrado com os filtros selecionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

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
        const tipoClass = ticket.tipo ? `type-${ticket.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')}` : 'type-outro';

        // LÓGICA DOS BOTÕES DE AÇÃO (Agora dentro do loop correta)
        const botoesAcao = (ticket.status === 'Finalizado' || ticket.status === 'Cancelado')
            ? `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id}, 'historico')" title="Ver Histórico">
                    <i class="fas fa-eye"></i>
                </button>
            `
            : isAdmin ? `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id}, 'historico')" title="Visualizar histórico de atendimento">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action-icon btn-finish" onclick="finalizarTicket(${ticket.id})" title="Finalizar Chamado">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button class="btn-action-icon btn-cancel" onclick="cancelarTicket(${ticket.id})" title="Cancelar Chamado">
                    <i class="fas fa-times-circle"></i>
                </button>
            ` : `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id}, 'historico')" title="Visualizar histórico de mensagens">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id}, 'atender')" title="Atender Chamado">
                    <i class="fas fa-headset"></i>
                </button>
                <button class="btn-action-icon btn-finish" onclick="finalizarTicket(${ticket.id})" title="Finalizar Chamado">
                    <i class="fas fa-check-circle"></i>
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
                    <span class="type-badge ${tipoClass}">${ticket.tipo}</span>
                </td>
                <td class="col-assunto">
                    <div class="subject-text">${ticket.assunto}</div>
                    ${infoAtraso}
                </td>
                <td class="col-data">${new Date(ticket.data).toLocaleDateString('pt-BR')}</td>
                <td class="col-prio"><span class="prio-text prio-${ticket.prioridade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}">${ticket.prioridade}</span></td>
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
 * FILTROS DA SEÇÃO DE ATENDIMENTO (busca + status + tipo + prioridade)
 */
function aplicarFiltroAtendimento() {
    const buscaEl = document.getElementById('buscaAtendimento');
    const statusEl = document.getElementById('filtroStatusAtendimento');
    const tipoEl = document.getElementById('filtroTipoAtendimento');
    const prioEl = document.getElementById('filtroPrioridadeAtendimento');

    const busca = buscaEl ? buscaEl.value.trim().toLowerCase() : '';
    const status = statusEl ? statusEl.value : 'todos';
    const tipo = tipoEl ? tipoEl.value : 'todos';
    const prioridade = prioEl ? prioEl.value : 'todos';

    let filtrados = [...ticketsParaTabela];

    if (status !== 'todos') filtrados = filtrados.filter(t => t.status === status);
    if (tipo !== 'todos') filtrados = filtrados.filter(t => t.tipo === tipo);
    if (prioridade !== 'todos') filtrados = filtrados.filter(t => t.prioridade === prioridade);
    if (busca) {
        filtrados = filtrados.filter(t =>
            String(t.id).includes(busca) ||
            (t.empresa && t.empresa.toLowerCase().includes(busca)) ||
            (t.usuario && t.usuario.toLowerCase().includes(busca)) ||
            (t.assunto && t.assunto.toLowerCase().includes(busca))
        );
    }

    renderizarTabelaGeral(filtrados);

    const contador = document.getElementById('contadorAtendimento');
    if (contador) {
        contador.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'chamado' : 'chamados'}`;
    }
}

/**
 * RENDERIZAÇÃO DOS GRÁFICOS (com texto central, legenda detalhada e ordenação por volume)
 */
// Objeto global para armazenar as instâncias e podermos destruí-las ao atualizar
let instanciasGraficosEmpresas = {};

// Desenha o total de chamados no centro de cada rosca
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const x = (left + right) / 2;
        const y = (top + bottom) / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 24px Segoe UI, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(total, x, y - 9);
        ctx.font = '600 11px Segoe UI, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(total === 1 ? 'chamado' : 'chamados', x, y + 12);
        ctx.restore();
    }
};

function renderizarGraficosPorEmpresa(tickets) {
    const container = document.getElementById('containerGraficosEmpresas');
    const modoVisao = document.getElementById('filtroModoVisao').value;
    if (!container) return;

    // 1. Limpar container e destruir instâncias antigas
    container.innerHTML = '';
    Object.values(instanciasGraficosEmpresas).forEach(chart => chart.destroy());
    instanciasGraficosEmpresas = {};

    // 2. Agrupar tickets por empresa e ordenar pela mais movimentada primeiro
    const ticketsPorEmpresa = tickets.reduce((acc, t) => {
        (acc[t.empresa] = acc[t.empresa] || []).push(t);
        return acc;
    }, {});
    const empresas = Object.keys(ticketsPorEmpresa)
        .sort((a, b) => ticketsPorEmpresa[b].length - ticketsPorEmpresa[a].length);

    const statusColorMap = {
        'Pendente': '#f59e0b',
        'Vencido': '#dc2626',
        'Em Atendimento': '#2563eb',
        'Finalizado': '#10b981',
        'Cancelado': '#94a3b8'
    };

    empresas.forEach((nomeEmpresa, index) => {
        const ticketsDaEmpresa = ticketsPorEmpresa[nomeEmpresa];
        const canvasId = `chart-${index}`;

        // 3. Criar o Card da Empresa no HTML
        const nomeEmpresaEscapado = nomeEmpresa.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const cardHtml = `
            <div class="chart-card-modern">
                <div class="chart-header">
                    <h3 class="chart-empresa-link" onclick="navegarParaAtendimentoFiltrado('${nomeEmpresaEscapado}', null, null)" title="Ver todos os chamados de ${nomeEmpresa}">
                        <i class="fas fa-building"></i> ${nomeEmpresa}
                        <i class="fas fa-external-link-alt chart-link-icon"></i>
                    </h3>
                    <span class="chart-total-badge">${ticketsDaEmpresa.length} ${ticketsDaEmpresa.length === 1 ? 'chamado' : 'chamados'}</span>
                </div>
                <div class="chart-body">
                    <canvas id="${canvasId}"></canvas>
                </div>
                <ul class="chart-legend-modern" id="legend-${canvasId}"></ul>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);

        // 4. Preparar Dados de acordo com o filtro selecionado
        let labels = [];
        let data = [];
        let colors = [];
        let accentColor = '#2563eb';

        if (modoVisao === 'tipo') {
            const tipoContagem = ticketsDaEmpresa.reduce((acc, item) => {
                const tipo = item.tipo || 'Outro';
                acc[tipo] = (acc[tipo] || 0) + 1;
                return acc;
            }, {});

            const tipoColorMap = {
                'Erro': '#ef4444',
                'Melhoria': '#2563eb',
                'Dúvida': '#f97316'
            };
            const fallbackColors = ['#6366f1', '#14b8a6', '#fb7185', '#f59e0b', '#8b5cf6'];

            labels = Object.keys(tipoContagem);
            data = Object.values(tipoContagem);
            colors = labels.map((tipo, i) => tipoColorMap[tipo] || fallbackColors[i % fallbackColors.length]);

            const topTipo = Object.entries(tipoContagem).reduce((prev, current) => current[1] > prev[1] ? current : prev, [labels[0], 0])[0];
            accentColor = tipoColorMap[topTipo] || fallbackColors[0];
        } else {
            const statuses = ['Pendente', 'Vencido', 'Em Atendimento', 'Finalizado', 'Cancelado'];
            const counts = statuses.map(s => ticketsDaEmpresa.filter(t => t.status === s).length);

            labels = statuses.filter((s, i) => counts[i] > 0);
            data = counts.filter(v => v > 0);
            colors = labels.map(s => statusColorMap[s]);

            // accent based on predominant status
            const maxIndex = counts.indexOf(Math.max(...counts));
            accentColor = statusColorMap[statuses[maxIndex]] || '#2563eb';
        }

        // 5. Inicializar o gráfico para esta empresa
        const ctx = document.getElementById(canvasId).getContext('2d');
        // Aplica cor de destaque no card do gráfico (borda lateral e título)
        const cardEl = document.getElementById(canvasId).closest('.chart-card-modern');
        if (cardEl) {
            cardEl.style.borderLeft = `6px solid ${accentColor}`;
            const header = cardEl.querySelector('.chart-header h3');
            if (header) header.style.color = accentColor;
        }

        const totalEmpresa = data.reduce((a, b) => a + b, 0);

        instanciasGraficosEmpresas[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 6,
                    spacing: 2,
                    cutout: '72%'
                }]
            },
            plugins: [centerTextPlugin],
            options: {
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const modoAtual = document.getElementById('filtroModoVisao').value;
                        navegarParaAtendimentoFiltrado(nomeEmpresa, labels[elements[0].index], modoAtual);
                    }
                },
                onHover: (event, elements) => {
                    if (event.native) event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const valor = context.parsed;
                                const pct = totalEmpresa ? Math.round((valor / totalEmpresa) * 100) : 0;
                                return ` ${context.label}: ${valor} (${pct}%) — clique para ver`;
                            }
                        }
                    }
                },
                animation: { animateRotate: true, duration: 700 },
                maintainAspectRatio: false
            }
        });

        // 6. Legenda customizada com contagem e percentual (clicável)
        const legendEl = document.getElementById(`legend-${canvasId}`);
        if (legendEl) {
            const modoAtual = document.getElementById('filtroModoVisao').value;
            legendEl.innerHTML = labels.map((label, i) => {
                const valor = data[i];
                const pct = totalEmpresa ? Math.round((valor / totalEmpresa) * 100) : 0;
                const empresaEscapada = nomeEmpresa.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const labelEscapada = label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `
                    <li class="legend-item-link" onclick="navegarParaAtendimentoFiltrado('${empresaEscapada}', '${labelEscapada}', '${modoAtual}')" title="Ver chamados ${label} de ${nomeEmpresa}">
                        <span class="legend-dot" style="background:${colors[i]}"></span>
                        <span class="legend-label">${label}</span>
                        <span class="legend-value">${valor}<small>(${pct}%)</small></span>
                        <i class="fas fa-arrow-right legend-arrow"></i>
                    </li>
                `;
            }).join('');
        }
    });
}

/**
 * AÇÕES E FILTROS
 */
/**
 * ATUALIZAR STATUS DO TICKET (sem confirmação, usada internamente)
 */
async function atualizarStatusTicket(id, novoStatus) {
    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: novoStatus })
        });

        if (response.ok) {
            console.log(`Ticket #${id} atualizado para status ${novoStatus}`);
        }
    } catch (error) {
        console.error("Erro ao atualizar status do ticket:", error);
    }
}

async function cancelarTicket(id) {
    if (!confirm(`Deseja realmente cancelar o chamado #${id}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: 'C' })
        });

        if (response.ok) carregarEstatisticas();
        else showNotification('Não foi possível cancelar o chamado.', 'error');
    } catch (error) {
        showNotification("Não foi possível cancelar o chamado. Por favor, tente novamente mais tarde.", 'error');
    }
}

async function finalizarTicket(id) {
    if (!confirm(`Deseja realmente finalizar o chamado #${id}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: 'F' })
        });

        if (response.ok) carregarEstatisticas();
        else showNotification('Não foi possível finalizar o chamado.', 'error');
    } catch (error) {
        showNotification("Não foi possível finalizar o chamado. Por favor, tente novamente mais tarde.", 'error');
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
        usuariosCadastrados = await response.json();
        aplicarFiltroUsuarios();
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
    }
}

function aplicarFiltroUsuarios() {
    const buscaEl = document.getElementById('buscaUsuario');
    const perfilEl = document.getElementById('filtroPerfilUsuario');

    const busca = buscaEl ? buscaEl.value.trim().toLowerCase() : '';
    const perfil = perfilEl ? perfilEl.value : 'todos';

    let filtrados = [...usuariosCadastrados];

    if (perfil !== 'todos') filtrados = filtrados.filter(u => (u.perfil || '').toLowerCase() === perfil);
    if (busca) {
        filtrados = filtrados.filter(u =>
            (u.nome && u.nome.toLowerCase().includes(busca)) ||
            (u.email && u.email.toLowerCase().includes(busca)) ||
            (u.empresa && u.empresa.toLowerCase().includes(busca))
        );
    }

    renderizarTabelaUsuarios(filtrados);

    const contador = document.getElementById('contadorUsuarios');
    if (contador) {
        contador.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'usuário' : 'usuários'}`;
    }
}

function renderizarTabelaUsuarios(usuarios) {
    const tbody = document.getElementById('listaUsuarios');
    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-table">
                        <i class="fas fa-users"></i>
                        <p>Nenhum usuário encontrado com os filtros selecionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = usuarios.map(user => {
        const perfilClasse = `profile-tag-${(user.perfil || '').toLowerCase()}`;
        const inicial = user.nome ? user.nome.trim().charAt(0).toUpperCase() : '?';

        return `
            <tr>
                <td class="col-usuario">
                    <span class="user-avatar">${inicial}</span>
                    <strong>${user.nome}</strong>
                </td>
                <td>${user.email}</td>
                <td>${user.empresa || '---'}</td>
                <td><span class="profile-tag ${perfilClasse}">${user.perfil}</span></td>
                <td><span class="badge finalizado">Ativo</span></td>
                <td>
                    <button class="btn-action-soft" onclick="deletarUsuario('${user.email}')" title="Remover Usuário">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    if (modal) {
        // Limpa o formulário para evitar dados residuais e autofill indesejado
        const form = document.getElementById('formUsuario');
        if (form) {
            form.reset();
            document.getElementById('userName').value = '';
            document.getElementById('userEmail').value = '';
            document.getElementById('userPass').value = '';
        }
        modal.style.display = 'flex';
        // Carrega as empresas no select
        carregarEmpresasNoSelect();
    }
}

function fecharModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function carregarEmpresasNoSelect() {
    const selectEmpresa = document.getElementById('userEmpresa');
    if (!selectEmpresa) return;

    try {
        const response = await fetch('http://localhost:3000/api/empresas');
        todasEmpresas = await response.json();

        selectEmpresa.innerHTML = '<option value="">-- Selecione uma empresa --</option>';
        
        // Filtra baseado no perfil selecionado
        filtrarEmpresasPorPerfil();
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }
}

function filtrarEmpresasPorPerfil() {
    const selectEmpresa = document.getElementById('userEmpresa');
    const selectPerfil = document.getElementById('userPerfil');
    
    if (!selectEmpresa || !selectPerfil) return;

    const perfilSelecionado = selectPerfil.value;
    const empresaSelecionada = selectEmpresa.value;
    const empresasSelecionadas = todasEmpresas.filter(emp => {
        // Se é Cliente, mostra apenas empresas Cliente (C)
        if (perfilSelecionado === 'cliente') {
            return emp.tipo === 'C';
        }
        // Se é Colaborador ou Admin, mostra apenas empresas Colaborador (E) - Gesistec
        else if (perfilSelecionado === 'colaborador' || perfilSelecionado === 'admin') {
            return emp.tipo === 'E';
        }
        return false;
    });

    // Reconstrói o select com as empresas filtradas
    selectEmpresa.innerHTML = '<option value="">-- Selecione uma empresa --</option>';
    empresasSelecionadas.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.nome;
        selectEmpresa.appendChild(option);
    });

    if (empresaSelecionada && empresasSelecionadas.some(emp => String(emp.id) === String(empresaSelecionada))) {
        selectEmpresa.value = empresaSelecionada;
    } else {
        selectEmpresa.value = '';
    }
}

async function salvarUsuario(event) {
    event.preventDefault();
    const nome = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim().toLowerCase();
    const senha = document.getElementById('userPass').value.trim();
    const perfil = document.getElementById('userPerfil').value;
    const nro_empresa = document.getElementById('userEmpresa').value;

    if (!nome || !email || !senha || !nro_empresa) {
        showNotification('Por favor, preencha todos os campos para cadastrar o usuário.', 'warning');
        return;
    }

    if (!isValidEmail(email)) {
        showNotification('Por favor, informe um e-mail válido.', 'warning');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, perfil, nro_empresa: parseInt(nro_empresa, 10) })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao cadastrar usuário.');
        }

        fecharModalUsuario();
        document.getElementById('formUsuario').reset();
        carregarUsuarios();
    } catch (error) {
        showNotification(error.message || 'Não foi possível cadastrar o usuário. Verifique os dados e tente novamente.', 'error');
    }
}

function isValidEmail(email) {
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

function abrirModalEmpresa() {
    const modal = document.getElementById('modalEmpresa');
    if (modal) modal.style.display = 'flex';
}

function fecharModalEmpresa() {
    const modal = document.getElementById('modalEmpresa');
    if (modal) modal.style.display = 'none';
}

async function carregarEmpresas() {
    const tbody = document.getElementById('listaEmpresas');
    if (!tbody) return;

    try {
        const response = await fetch('http://localhost:3000/api/empresas');
        empresasCadastradas = await response.json();
        aplicarFiltroEmpresas();
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

function aplicarFiltroEmpresas() {
    const buscaEl = document.getElementById('buscaEmpresa');
    const tipoEl = document.getElementById('filtroTipoEmpresa');

    const busca = buscaEl ? buscaEl.value.trim().toLowerCase() : '';
    const tipo = tipoEl ? tipoEl.value : 'todos';

    let filtradas = [...empresasCadastradas];

    if (tipo !== 'todos') filtradas = filtradas.filter(emp => emp.tipo === tipo);
    if (busca) {
        filtradas = filtradas.filter(emp =>
            (emp.nome && emp.nome.toLowerCase().includes(busca)) ||
            (emp.cnpj && emp.cnpj.toLowerCase().includes(busca)) ||
            (emp.cidade && emp.cidade.toLowerCase().includes(busca))
        );
    }

    renderizarTabelaEmpresas(filtradas);

    const contador = document.getElementById('contadorEmpresas');
    if (contador) {
        contador.textContent = `${filtradas.length} ${filtradas.length === 1 ? 'empresa' : 'empresas'}`;
    }
}

function renderizarTabelaEmpresas(empresas) {
    const tbody = document.getElementById('listaEmpresas');
    if (!tbody) return;

    if (empresas.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-table">
                        <i class="fas fa-building"></i>
                        <p>Nenhuma empresa encontrada com os filtros selecionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = empresas.map(emp => {
        const isColaborador = emp.tipo === 'E';
        const tipoLabel = isColaborador ? 'Colaborador' : (emp.tipo === 'C' ? 'Cliente' : emp.tipo);
        const tipoClasse = isColaborador ? 'profile-tag-colaborador' : 'profile-tag-cliente';
        return `
            <tr>
                <td class="col-id">#${emp.id}</td>
                <td><strong>${emp.nome}</strong></td>
                <td>${emp.cnpj}</td>
                <td class="col-cliente">
                    <strong>${emp.cidade}</strong>
                    <span>${emp.endereco} · ${emp.cep}</span>
                </td>
                <td><span class="profile-tag ${tipoClasse}">${tipoLabel}</span></td>
                <td>
                    <button class="btn-action-soft" onclick="deletarEmpresa(${emp.id})" title="Remover Empresa">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function salvarEmpresa(event) {
    event.preventDefault();
    const nome = document.getElementById('empresaNome').value.trim();
    const cnpj = document.getElementById('empresaCnpj').value.trim();
    const cidade = document.getElementById('empresaCidade').value.trim();
    const endereco = document.getElementById('empresaEndereco').value.trim();
    const cep = document.getElementById('empresaCep').value.trim();
    const flg_emp = document.getElementById('empresaTipo').value;

    if (!nome || !cnpj || !cidade || !endereco || !cep || !flg_emp) {
        showNotification('Por favor, preencha todos os campos para cadastrar a empresa.', 'warning');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/empresas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, cnpj, cidade, endereco, cep, flg_emp })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar empresa.');
        }

        fecharModalEmpresa();
        document.getElementById('formEmpresa').reset();
        carregarEmpresas();
    } catch (error) {
        showNotification(error.message || 'Não foi possível cadastrar a empresa. Tente novamente.', 'error');
    }
}

async function deletarEmpresa(id) {
    if (!confirm(`Deseja remover a empresa #${id}?`)) return;
    try {
        const response = await fetch(`http://localhost:3000/api/empresas/${id}`, { method: 'DELETE' });
        if (response.ok) carregarEmpresas();
    } catch (error) {
        showNotification('Não foi possível remover a empresa no momento.', 'error');
    }
}

function abrirModalTipo() {
    const modal = document.getElementById('modalTipo');
    if (modal) modal.style.display = 'flex';
}

function fecharModalTipo() {
    const modal = document.getElementById('modalTipo');
    if (modal) modal.style.display = 'none';
}

async function carregarTiposTicket() {
    const tbody = document.getElementById('listaTipos');
    if (!tbody) return;

    try {
        const response = await fetch('http://localhost:3000/api/tipos-ticket');
        const tipos = await response.json();

        const contador = document.getElementById('contadorTipos');
        if (contador) {
            contador.textContent = `${tipos.length} ${tipos.length === 1 ? 'tipo' : 'tipos'}`;
        }

        if (tipos.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">
                        <div class="empty-state-table">
                            <i class="fas fa-tags"></i>
                            <p>Nenhum tipo de chamado cadastrado ainda.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = tipos.map(tipo => {
            const tipoClass = `type-${tipo.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')}`;
            const prazoNum = parseInt(tipo.prazo_dias, 10) || 0;
            const slaClasse = prazoNum <= 2 ? 'sla-urgente' : (prazoNum <= 7 ? 'sla-atencao' : 'sla-tranquilo');

            return `
            <tr>
                <td class="col-id">#${tipo.id}</td>
                <td><span class="type-badge ${tipoClass}">${tipo.nome}</span></td>
                <td><span class="sla-pill ${slaClasse}"><i class="fas fa-clock"></i> ${tipo.prazo_dias} ${prazoNum === 1 ? 'dia' : 'dias'}</span></td>
                <td>
                    <button class="btn-action-soft" onclick="deletarTipo(${tipo.id})" title="Remover Tipo">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar tipos:', error);
    }
}

async function salvarTipo(event) {
    event.preventDefault();
    const nome = document.getElementById('tipoNome').value.trim();
    const prazo = document.getElementById('tipoPrazo').value.trim();

    if (!nome || !prazo) {
        showNotification('Por favor, preencha todos os campos para cadastrar o tipo de chamado.', 'warning');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/tipos-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, prazo_dias: parseInt(prazo, 10) })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar tipo de chamado.');
        }

        fecharModalTipo();
        document.getElementById('formTipo').reset();
        carregarTiposTicket();
    } catch (error) {
        showNotification(error.message || 'Não foi possível cadastrar o tipo de chamado. Tente novamente.', 'error');
    }
}

async function deletarTipo(id) {
    if (!confirm(`Deseja remover o tipo #${id}?`)) return;
    try {
        const response = await fetch(`http://localhost:3000/api/tipos-ticket/${id}`, { method: 'DELETE' });
        if (response.ok) carregarTiposTicket();
    } catch (error) {
        showNotification('Não foi possível remover o tipo de chamado.', 'error');
    }
}

/**
 * FILTRAGEM SEGURA (RESOLVE O ERRO DO NULL)
 */
function aplicarFiltros() {
    // Verificamos se os elementos existem antes de ler o .value
    const elStatus = document.getElementById('filterStatus');
    const elTipo = document.getElementById('filterTipo');

    const statusFiltro = elStatus ? elStatus.value : 'todos';
    const tipoFiltro = elTipo ? elTipo.value : 'todos';

    let filtrados = [...listaTicketsGlobal];

    // Só filtra se os elementos de filtro realmente estiverem no HTML
    if (statusFiltro !== 'todos') {
        filtrados = filtrados.filter(t => t.status === statusFiltro);
    }
    if (tipoFiltro !== 'todos') {
        filtrados = filtrados.filter(t => t.tipo === tipoFiltro);
    }

    // Renderiza o que sobrou
    atualizarElementosInterface(filtrados);
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
            showNotification("Não foi possível remover o usuário: " + (erro.error || 'tente novamente.'), 'error');
        }
    } catch (error) {
        showNotification("Falha de conexão ao remover o usuário. Verifique sua conexão e tente novamente.", 'error');
    }
}

async function abrirRespostaAdmin(id, modo = 'historico') {
    ticketSelecionadoId = id;
    try {
        const response = await fetch(`http://localhost:3000/api/mensagens/${id}`);
        if (!response.ok) {
            showNotification('Não foi possível carregar o histórico do ticket.', 'error');
            return;
        }
        const mensagens = await response.json();
        const chatContainer = document.getElementById('historicoChatAdmin');
        if (!chatContainer) return;

        const mensagensChat = mensagens.filter(m => m.tipo_msg !== 'D');
        let lastDate = null;
        chatContainer.innerHTML = mensagensChat.length === 0
            ? `<div class="chat-empty-state">
                   <i class="fas fa-comments"></i>
                   <p>Nenhuma mensagem ainda.</p>
               </div>`
            : mensagensChat.map(msg => {
                const isMe = msg.email_autor === usuarioAtivo.email;
                const inicial = (msg.autor_display || '?').charAt(0).toUpperCase();
                const hora = new Date(msg.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
                const dataMensagem = new Date(msg.data).toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'});

                let dateSep = '';
                if (dataMensagem !== lastDate) {
                    lastDate = dataMensagem;
                    dateSep = `<div class="chat-date-sep">${dataMensagem}</div>`;
                }

                const tipoRole = msg.tipo_autor || 'Cliente';
                const roleClass = tipoRole === 'Admin' ? 'role-admin' : tipoRole === 'Colaborador' ? 'role-colab' : 'role-client';

                return `
                    ${dateSep}
                    <div class="msg-row ${isMe ? 'msg-row-me' : 'msg-row-other'} msg-role-${roleClass}">
                        <div class="msg-avatar-bubble msg-avatar-${roleClass}">${inicial}</div>
                        <div class="msg-content">
                            <div class="msg-meta">
                                <span class="msg-author">${msg.autor_display}</span>
                                <span class="msg-role-badge ${roleClass}">${tipoRole}</span>
                                <span class="msg-time">${hora}</span>
                            </div>
                            <div class="msg-bubble msg-bubble-${roleClass}">
                                ${msg.texto ? `<p class="msg-text">${msg.texto}</p>` : ''}
                                ${msg.anexo && msg.anexo.length > 50 ? `
                                    <a class="msg-attachment-pill" href="${msg.anexo}" download="anexo-${msg.id}">
                                        <i class="fas fa-paperclip"></i> Baixar Anexo
                                    </a>` : ''}
                            </div>
                        </div>
                    </div>`;
            }).join('');

        requestAnimationFrame(() => { chatContainer.scrollTop = chatContainer.scrollHeight; });

        const ticketResponderEl = document.getElementById('idTicketResponder');
        if (ticketResponderEl) {
            ticketResponderEl.innerText = id;
        }

        const textoRespostaAdmin = document.getElementById('textoRespostaAdmin');
        const sendButton = document.querySelector('#areaRespostaAdmin .btn-send-modern');
        const attachmentArea = document.querySelector('#areaRespostaAdmin .attachment-area');
        const replyBody = document.querySelector('#areaRespostaAdmin .reply-body');
        const ticketInfoLabel = document.querySelector('#areaRespostaAdmin .ticket-info span');

        if (ticketInfoLabel) {
            ticketInfoLabel.innerHTML = modo === 'atender'
                ? `Resposta para o Chamado <strong>#${id}</strong>`
                : `Histórico do Chamado <strong>#${id}</strong>`;
        }

        if (modo === 'atender' && !isAdmin) {
            await atualizarStatusTicket(id, 'E');

            if (textoRespostaAdmin) {
                textoRespostaAdmin.disabled = false;
                textoRespostaAdmin.value = '';
                textoRespostaAdmin.placeholder = 'Digite a solução técnica...';
            }
            if (sendButton) sendButton.style.display = 'inline-flex';
            if (attachmentArea) attachmentArea.style.display = 'flex';
            if (replyBody) replyBody.style.display = 'block';
        } else {
            if (textoRespostaAdmin) {
                textoRespostaAdmin.value = '';
                textoRespostaAdmin.disabled = true;
            }
            if (sendButton) sendButton.style.display = 'none';
            if (attachmentArea) attachmentArea.style.display = 'none';
            if (replyBody) replyBody.style.display = 'none';
        }

        const cardTabela = document.getElementById('cardTabelaTickets');
        const containerInteracao = document.getElementById('containerInteracaoAdmin');
        if (cardTabela) cardTabela.style.display = 'none';
        if (containerInteracao) containerInteracao.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error("Erro no chat:", e); }
}

/**
 * ENVIAR RESPOSTA DO COLABORADOR
 */
async function enviarRespostaAdmin() {
    if (isAdmin) {
        showNotification('Administradores não podem responder tickets neste painel; ele é apenas para consulta de histórico.', 'warning');
        return;
    }

    const campoTexto = document.getElementById('textoRespostaAdmin');
    const idTicketEl = document.getElementById('idTicketResponder');
    const idTicket = idTicketEl?.innerText?.trim() || ticketSelecionadoId;

    if (!idTicket) {
        showNotification('Erro interno: não foi possível identificar o ticket. Reabra a resposta e tente novamente.', 'error');
        return;
    }

    const textoResposta = campoTexto?.value ? campoTexto.value.trim() : '';
    if (!textoResposta && !anexoAdminTemp) {
        showNotification("Por favor, escreva uma mensagem antes de enviar.", 'warning');
        return;
    }

    const payload = {
        ticket_id: idTicket,
        autor: usuarioAtivo.email,
        texto: textoResposta,
        anexo_conteudo: anexoAdminTemp ? anexoAdminTemp.conteudo : null
    };

    try {
        const response = await fetch('http://localhost:3000/api/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            campoTexto.value = "";
            anexoAdminTemp = null;
            const preview = document.getElementById('preview-anexo-admin');
            if (preview) preview.innerText = '';
            fecharAreaResposta();
        }
    } catch (error) {
        showNotification("Não foi possível enviar a resposta. Tente novamente.", 'error');
    }
}

/**
 * VOLTAR PARA A TABELA (FECHAR CHAT)
 */
function fecharAreaResposta() {
    const containerInteracao = document.getElementById('containerInteracaoAdmin');
    const cardTabela = document.getElementById('cardTabelaTickets');
    if (containerInteracao) containerInteracao.style.display = 'none';
    if (cardTabela) cardTabela.style.display = 'block';
    carregarEstatisticas();
}

/**
 * ATUALIZAÇÃO DA INTERFACE
 */
function atualizarElementosInterface(dados) {
    console.log("GESISTEC: Atualizando interface com", dados.length, "tickets.");

    // 1. Gera os gráficos dinâmicos por empresa
    renderizarGraficosPorEmpresa(dados);

    // 3. Preenche a tabela de chamados (respeitando os filtros da seção de Atendimento)
    ticketsParaTabela = dados;
    aplicarFiltroAtendimento();
}

/**
 * CONVERTER ARQUIVO PARA BASE64 (PARA O PREVIEW E ENVIO)
 */
function prepararAnexoAdmin(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Armazena na variável global que você já declarou no topo do arquivo
        anexoAdminTemp = { 
            nome: file.name, 
            conteudo: e.target.result 
        };
        
        const preview = document.getElementById('preview-anexo-admin');
        if (preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}
let mapCadastro;
let markerCadastro;
let geocoder;

/**
 * Inicializa o mapa (Chame no carregamento da página ou ao abrir o modal)
 */
function initMapCadastro() {
    const mapElement = document.getElementById("mapCadastro");
    if (!mapElement || !window.google || !google.maps) {
        console.warn('Mapa de cadastro não inicializado: elemento ou Google Maps ausente.');
        return;
    }

    geocoder = new google.maps.Geocoder();
    const defaultPos = { lat: -23.5505, lng: -46.6333 }; // São Paulo como padrão
    
    mapCadastro = new google.maps.Map(mapElement, {
        center: defaultPos,
        zoom: 13,
        disableDefaultUI: true
    });

    markerCadastro = new google.maps.Marker({
        map: mapCadastro,
        position: defaultPos
    });
}

/**
 * Busca o endereço via ViaCEP e atualiza o mapa
 */
async function buscarCep(cep) {
    const valorCep = cep.replace(/\D/g, '');

    if (valorCep.length !== 8) return;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${valorCep}/json/`);
        if (!response.ok) {
            showNotification("Não foi possível buscar o CEP.", "warning");
            return;
        }
        const data = await response.json();

        if (data.erro) {
            showNotification("CEP não encontrado.", "warning");
            return;
        }

        const empresaCidadeEl = document.getElementById('empresaCidade');
        const empresaEnderecoEl = document.getElementById('empresaEndereco');
        if (empresaCidadeEl) empresaCidadeEl.value = data.localidade + " / " + data.uf;
        if (empresaEnderecoEl) {
            empresaEnderecoEl.value = data.logradouro;
            empresaEnderecoEl.focus();
        }

        // 2. Localiza no Google Maps
        const enderecoFull = `${data.logradouro}, ${data.localidade}, ${data.uf}, Brasil`;
        localizarNoMapa(enderecoFull);

    } catch (error) {
        console.error("Erro na busca de CEP:", error);
    }
}

function localizarNoMapa(endereco) {
    if (!geocoder || !mapCadastro || !markerCadastro) {
        console.warn('Google Maps não está pronto para localização.');
        return;
    }

    geocoder.geocode({ address: endereco }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
            mapCadastro.setCenter(results[0].geometry.location);
            markerCadastro.setPosition(results[0].geometry.location);
            mapCadastro.setZoom(17);
        }
    });
}

/**
 * ENCERRAR SESSÃO E SAIR
 */
function logout() { 
    localStorage.removeItem('sessao_ativa'); 
    window.location.href = 'index.html'; 
}

/**
 * INICIALIZAÇÃO DO SISTEMA
 */
async function inicializarDashboard() {
    // 1. Carrega os dados do MySQL
    await carregarEstatisticas();
    
    // 2. Garante que a Dashboard apareça primeiro
    navegarMenu('dashboardView');
}

// Captura o campo de CNPJ do seu HTML e aplica a máscara em tempo real
const inputCnpj = document.getElementById('empresaCnpj');

if (inputCnpj) {
    inputCnpj.addEventListener('input', function (e) {
        let value = e.target.value;

        // 1. Remove tudo o que não for número
        value = value.replace(/\D/g, '');

        // 2. Limita o tamanho máximo para 14 dígitos de CNPJ
        if (value.length > 14) {
            value = value.slice(0, 14);
        }

        // 3. Aplica a paginação do CNPJ: 00.000.000/0000-00
        value = value.replace(/^(\d{2})(\d)/, '$1.$2');
        value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');

        // 4. Devolve o valor formatado para o input
        e.target.value = value;
    });
}

// Captura o campo de CEP do seu HTML e aplica a máscara em tempo real
const inputCep = document.getElementById('empresaCep');

if (inputCep) {
    inputCep.addEventListener('input', function (e) {
        let value = e.target.value;

        // 1. Remove tudo o que não for número
        value = value.replace(/\D/g, '');

        // 2. Limita o tamanho máximo para 8 dígitos
        if (value.length > 8) {
            value = value.slice(0, 8);
        }

        // 3. Aplica a formatação: 00000-000
        value = value.replace(/^(\d{5})(\d)/, '$1-$2');

        // 4. Devolve o valor formatado para o input
        e.target.value = value;
    });
}

function inicializarColaPrintAdmin() {
    const textarea = document.getElementById('textoRespostaAdmin');
    if (!textarea) return;
    textarea.addEventListener('paste', function(e) {
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = function(ev) {
                    anexoAdminTemp = { nome: 'screenshot.png', conteudo: ev.target.result };
                    const preview = document.getElementById('preview-anexo-admin');
                    if (preview) preview.innerText = '📎 Screenshot colado';
                    showNotification('Imagem colada como anexo!', 'info');
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    });
}

// Inicia o processo
inicializarDashboard();
inicializarColaPrintAdmin();