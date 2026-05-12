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
let ticketSelecionadoId = null;
let todasEmpresas = [];

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
            : isAdmin ? `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id})" title="Visualizar histórico de atendimento">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action-icon btn-cancel" onclick="cancelarTicket(${ticket.id})" title="Cancelar Chamado">
                    <i class="fas fa-times-circle"></i>
                </button>
            ` : `
                <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id})" title="Atender Chamado">
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
// Objeto global para armazenar as instâncias e podermos destruí-las ao atualizar
let instanciasGraficosEmpresas = {};

function renderizarGraficosPorEmpresa(tickets) {
    const container = document.getElementById('containerGraficosEmpresas');
    const modoVisao = document.getElementById('filtroModoVisao').value;
    if (!container) return;

    // 1. Limpar container e destruir instâncias antigas
    container.innerHTML = '';
    Object.values(instanciasGraficosEmpresas).forEach(chart => chart.destroy());
    instanciasGraficosEmpresas = {};

    // 2. Agrupar tickets por empresa
    const empresas = [...new Set(tickets.map(t => t.empresa))];

    empresas.forEach((nomeEmpresa, index) => {
        const ticketsDaEmpresa = tickets.filter(t => t.empresa === nomeEmpresa);
        const canvasId = `chart-${index}`;

        // 3. Criar o Card da Empresa no HTML
        const cardHtml = `
            <div class="chart-card-modern">
                <div class="chart-header">
                    <h3><i class="fas fa-building"></i> ${nomeEmpresa}</h3>
                </div>
                <div class="chart-body">
                    <canvas id="${canvasId}"></canvas>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);

        // 4. Preparar Dados de acordo com o filtro selecionado
        let labels = [];
        let data = [];
        let colors = [];

        if (modoVisao === 'tipo') {
            const erro = ticketsDaEmpresa.filter(t => t.tipo === 'Erro').length;
            const melhoria = ticketsDaEmpresa.filter(t => t.tipo === 'Melhoria').length;
            const duvida = ticketsDaEmpresa.filter(t => t.tipo === 'Dúvida').length;
            
            labels = [`Erro (${erro})`, `Melhoria (${melhoria})`, `Dúvida (${duvida})`].filter((l, i) => [erro, melhoria, duvida][i] > 0);
            data = [erro, melhoria, duvida].filter(v => v > 0);
            colors = ['#ef4444', '#2563eb', '#f97316'];
        } else {
            const pendente = ticketsDaEmpresa.filter(t => t.status === 'Pendente').length;
            const atendimento = ticketsDaEmpresa.filter(t => t.status === 'Em Atendimento').length;
            const finalizado = ticketsDaEmpresa.filter(t => t.status === 'Finalizado').length;
            const cancelado = ticketsDaEmpresa.filter(t => t.status === 'Cancelado').length;

            labels = [`Pendente (${pendente})`, `Atendimento (${atendimento})`, `Finalizado (${finalizado})`, `Cancelado (${cancelado})`].filter((l, i) => [pendente, atendimento, finalizado, cancelado][i] > 0);
            data = [pendente, atendimento, finalizado, cancelado].filter(v => v > 0);
            colors = ['#2563eb', '#facc15', '#10b981', '#94a3b8'];
        }

        // 5. Inicializar o gráfico para esta empresa
        const ctx = document.getElementById(canvasId).getContext('2d');
        instanciasGraficosEmpresas[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, cutout: '70%' }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 10 } } }
                },
                maintainAspectRatio: false  
            }
        });
    });
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
        showNotification("Não foi possível cancelar o chamado. Por favor, tente novamente mais tarde.", 'error');
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
                <td>${user.empresa || '---'}</td>
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

function abrirModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    if (modal) {
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
    const email = document.getElementById('userEmail').value.trim();
    const senha = document.getElementById('userPass').value.trim();
    const perfil = document.getElementById('userPerfil').value;
    const nro_empresa = document.getElementById('userEmpresa').value;

    if (!nome || !email || !senha || !nro_empresa) {
        showNotification('Por favor, preencha todos os campos para cadastrar o usuário.', 'warning');
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
        const empresas = await response.json();

        tbody.innerHTML = empresas.map(emp => {
            const tipoLabel = emp.tipo === 'E' ? 'Colaborador' : (emp.tipo === 'C' ? 'Cliente' : emp.tipo);
            return `
            <tr>
                <td>#${emp.id}</td>
                <td>${emp.nome}</td>
                <td>${emp.cnpj}</td>
                <td>${emp.cidade}</td>
                <td>${emp.endereco}</td>
                <td>${emp.cep}</td>
                <td><span class="profile-tag">${tipoLabel}</span></td>
                <td>
                    <button class="btn-action-soft" onclick="deletarEmpresa(${emp.id})" title="Remover Empresa">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
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

        tbody.innerHTML = tipos.map(tipo => `
            <tr>
                <td>#${tipo.id}</td>
                <td>${tipo.nome}</td>
                <td>${tipo.prazo_dias}</td>
                <td>
                    <button class="btn-action-soft" onclick="deletarTipo(${tipo.id})" title="Remover Tipo">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
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

function aplicarFiltros() {
    const tipoFiltro = document.getElementById('filterTipo').value;
    const statusFiltro = document.getElementById('filterStatus').value;
    let listaFiltrada = [...listaTicketsGlobal];

    if (tipoFiltro !== 'todos') listaFiltrada = listaFiltrada.filter(t => t.tipo === tipoFiltro);
    if (statusFiltro !== 'todos') listaFiltrada = listaFiltrada.filter(t => t.status === statusFiltro);

    atualizarElementosInterface(listaFiltrada);
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

async function abrirRespostaAdmin(id) {
    ticketSelecionadoId = id;
    try {
        const response = await fetch(`http://localhost:3000/api/mensagens/${id}`);
        const mensagens = await response.json();
        const chatContainer = document.getElementById('historicoChatAdmin');
        if (!chatContainer) return;

        chatContainer.innerHTML = mensagens.map(msg => `
            <div class="interaction-card ${msg.email_autor === usuarioAtivo.email ? 'msg-me' : 'msg-other'}">
                <div class="msg-header"><strong>${msg.autor_display}</strong></div>
                ${msg.texto ? `<p>${msg.texto}</p>` : ''}
                ${msg.anexo && msg.anexo.length > 50 ? `<div class="attachment-link"><a href="${msg.anexo}" download="anexo-${msg.id}">📎 Baixar Anexo</a></div>` : ''}
            </div>`).join('');

        document.getElementById('idTicketResponder').innerText = id;

        const textoRespostaAdmin = document.getElementById('textoRespostaAdmin');
        const sendButton = document.querySelector('#areaRespostaAdmin .btn-send-modern');
        const attachmentArea = document.querySelector('#areaRespostaAdmin .attachment-area');
        const replyBody = document.querySelector('#areaRespostaAdmin .reply-body');
        const ticketInfoLabel = document.querySelector('#areaRespostaAdmin .ticket-info span');

        if (ticketInfoLabel) {
            ticketInfoLabel.innerHTML = isAdmin
                ? `Histórico do Chamado <strong>#${id}</strong>`
                : `Resposta para o Chamado <strong>#${id}</strong>`;
        }

        if (isAdmin) {
            if (textoRespostaAdmin) {
                textoRespostaAdmin.value = '';
                textoRespostaAdmin.disabled = true;
            }
            if (sendButton) sendButton.style.display = 'none';
            if (attachmentArea) attachmentArea.style.display = 'none';
            if (replyBody) replyBody.style.display = 'none';
        } else {
            if (textoRespostaAdmin) {
                textoRespostaAdmin.disabled = false;
                textoRespostaAdmin.placeholder = 'Digite a solução técnica...';
            }
            if (sendButton) sendButton.style.display = 'inline-flex';
            if (attachmentArea) attachmentArea.style.display = 'flex';
            if (replyBody) replyBody.style.display = 'block';
        }

        document.getElementById('cardTabelaTickets').style.display = 'none'; 
        document.getElementById('containerInteracaoAdmin').style.display = 'block'; 
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
    const idTicket = document.getElementById('idTicketResponder').innerText;
    
    if (!campoTexto.value.trim() && !anexoAdminTemp) {
        showNotification("Por favor, escreva uma mensagem antes de enviar.", 'warning');
        return;
    }

    const payload = {
        ticket_id: idTicket,
        autor: usuarioAtivo.email,
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
    document.getElementById('containerInteracaoAdmin').style.display = 'none'; 
    document.getElementById('cardTabelaTickets').style.display = 'block'; 
    carregarEstatisticas();
}

/**
 * ATUALIZAÇÃO DA INTERFACE
 */
function atualizarElementosInterface(dados) {
    console.log("GESISTEC: Atualizando interface com", dados.length, "tickets.");
    
    // 1. Gera os gráficos dinâmicos por empresa
    renderizarGraficosPorEmpresa(dados);
    
    // 2. Preenche a tabela de chamados
    renderizarTabelaGeral(dados);
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

// Inicia o processo
inicializarDashboard();