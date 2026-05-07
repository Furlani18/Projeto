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
    }
}

async function salvarUsuario(event) {
    event.preventDefault();
    const nome = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const senha = document.getElementById('userPass').value.trim();
    const perfil = document.getElementById('userPerfil').value;

    if (!nome || !email || !senha) {
        alert('Preencha todos os campos para cadastrar o usuário.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, perfil })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao cadastrar usuário.');
        }

        fecharModalUsuario();
        document.getElementById('formUsuario').reset();
        carregarUsuarios();
    } catch (error) {
        alert(error.message || 'Não foi possível cadastrar o usuário.');
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
            alert("Erro: " + erro.error);
        }
    } catch (error) {
        alert("Erro de conexão ao tentar deletar usuário.");
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
                <p>${msg.texto}</p>
            </div>`).join('');

        document.getElementById('idTicketResponder').innerText = id;
        document.getElementById('cardTabelaTickets').style.display = 'none'; 
        document.getElementById('containerInteracaoAdmin').style.display = 'block'; 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error("Erro no chat:", e); }
}

/**
 * ENVIAR RESPOSTA DO COLABORADOR
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
        alert("Erro ao enviar resposta.");
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