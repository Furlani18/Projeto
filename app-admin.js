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
let ticketSelecionadoId = null; // Declarada corretamente aqui

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

        // Mapeamento atualizado incluindo o prazo vindo do JOIN
        listaTicketsGlobal = dadosBrutos.map(t => ({
            id: t.id,
            assunto: t.assunto,
            usuario: t.email_usuario, 
            empresa: t.nome_empresa || "Empresa não cadastrada",
            status: t.status === 'A' ? 'Pendente' : (t.status === 'E' ? 'Em Atendimento' : 'Finalizado'),
            prioridade: t.prioridade === 'A' ? 'Alta' : (t.prioridade === 'M' ? 'Média' : 'Baixa'),
            data: t.data,
            
            // TRADUÇÃO DO TIPO BASEADA NO SEU BANCO
            tipo: t.nro_tipo === 1 ? 'Erro' : (t.nro_tipo === 2 ? 'Melhoria' : 'Dúvida'),

            // CAMPO ESSENCIAL PARA A LÓGICA DE VENCIDOS:
            prazo_dias: t.prazo_dias || 0 // Pega o valor da tabela tipo_ticket
        }));

        // Agora passamos a lista com os prazos para a interface calcular os indicadores
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

    const hoje = new Date(); // Data atual: 05/05/2026

    tabela.innerHTML = tickets.map(ticket => {
        // Cálculo de SLA
        const dataAbertura = new Date(ticket.data);
        const prazoEmMs = (ticket.prazo_dias || 0) * 24 * 60 * 60 * 1000;
        const dataLimite = new Date(dataAbertura.getTime() + prazoEmMs);
        const estaVencido = ticket.status !== 'Finalizado' && hoje > dataLimite;

        // Formatação do selo de atraso
        let infoAtraso = '';
        if (estaVencido) {
            const diffMs = hoje - dataLimite;
            const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const texto = diasAtraso < 1 ? 'HOJE' : `${diasAtraso}D`;
            infoAtraso = `<span class="sla-tag"><i class="fas fa-clock"></i> ATRASADO ${texto}</span>`;
        }

        // Mapeamento de classes para status e tipos
        const statusClass = ticket.status.toLowerCase().replace(/\s+/g, '-');
        const tipoClass = ticket.tipo === 'Erro' ? 'type-erro' : 
                         ticket.tipo === 'Melhoria' ? 'type-melhoria' : 'type-duvida';

        return `
            <tr class="${estaVencido ? 'is-overdue' : ''}">
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
                    <button class="btn-action-icon" onclick="abrirRespostaAdmin(${ticket.id})" title="Atender">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * INTERAÇÃO DE CHAT (ADMIN)
 */
async function abrirRespostaAdmin(id) {
    ticketSelecionadoId = id; // Atribui o ID global
    
    try {
        const response = await fetch(`http://localhost:3000/api/mensagens/${id}`);
        const mensagens = await response.json();

        const chatContainer = document.getElementById('historicoChatAdmin');
        chatContainer.innerHTML = mensagens.map(msg => {
            const dataObjeto = new Date(msg.data);
            const dataFormat = dataObjeto.toLocaleDateString('pt-BR');
            const horaFormat = dataObjeto.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const temAnexo = msg.anexo && msg.anexo.length > 50;
            const htmlAnexoMsg = temAnexo ? `
                <div style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:8px;">
                    <a href="${msg.anexo}" download="anexo_${msg.id}" style="font-size:12px; color:#2563eb; text-decoration:none; font-weight: 600;">
                        <i class="fas fa-download"></i> Baixar Arquivo
                    </a>
                </div>` : '';

            return `
                <div class="interaction-card ${msg.email_autor === usuarioAtivo.email ? 'msg-me' : 'msg-other'}">
                    <div class="msg-header">
                        <strong style="font-size: 12px; color: #1e293b;">${msg.autor_display}</strong>
                        <span style="font-size: 10px; color: #94a3b8;">${dataFormat} às ${horaFormat}</span>
                    </div>
                    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.4;">${msg.texto}</p>
                    ${htmlAnexoMsg}
                </div>
            `;
        }).join('');

        document.getElementById('idTicketResponder').innerText = id;
        document.getElementById('cardTabelaTickets').style.display = 'none'; 
        document.getElementById('containerInteracaoAdmin').style.display = 'block'; 
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Erro ao carregar chat:", error);
    }
}

/**
 * ENVIO DE RESPOSTA (ADMIN)
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
            document.getElementById('preview-anexo-admin').innerText = '';
            fecharAreaResposta();
        }
    } catch (error) {
        alert("Erro ao enviar resposta ao banco.");
    }
}

/**
 * GESTÃO DE USUÁRIOS
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

// FUNÇÃO DELETAR (Adicionada)
async function deletarUsuario(email) {
    if (!confirm(`Deseja remover o acesso de ${email}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/usuarios/${email}`, { method: 'DELETE' });
        if (response.ok) {
            carregarUsuarios();
        }
    } catch (error) {
        alert("Erro ao deletar usuário.");
    }
}

/**
 * AUXILIARES E GRÁFICOS
 */
function fecharAreaResposta() {
    document.getElementById('containerInteracaoAdmin').style.display = 'none';
    document.getElementById('cardTabelaTickets').style.display = 'block';
    carregarEstatisticas(); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prepararAnexoAdmin(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        anexoAdminTemp = { nome: file.name, conteudo: e.target.result };
        const preview = document.getElementById('preview-anexo-admin');
        if (preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

/**
 * RENDERIZAÇÃO DOS GRÁFICOS COM LEGENDAS AUTOMÁTICAS
 */
/**
 * RENDERIZAÇÃO DOS GRÁFICOS COM NÚMEROS NAS LEGENDAS
 */
function renderizarGraficosDonut(tickets) {
    // 1. Calculamos os totais para injetar nas strings das legendas
    const nBaixa = tickets.filter(t => t.prioridade === 'Baixa').length;
    const nMedia = tickets.filter(t => t.prioridade === 'Média').length;
    const nAlta = tickets.filter(t => t.prioridade === 'Alta').length;

    const nPendente = tickets.filter(t => t.status === 'Pendente').length;
    const nAtendimento = tickets.filter(t => t.status === 'Em Atendimento').length;
    const nFinalizado = tickets.filter(t => t.status === 'Finalizado').length;

    const config = (data, labels, colors) => ({
        type: 'doughnut',
        data: { 
            labels: labels, // Recebe os novos nomes com (X)
            datasets: [{ 
                data: data, 
                backgroundColor: colors, 
                borderWidth: 0, 
                cutout: '75%' 
            }] 
        },
        options: { 
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20, // Mais espaço para não grudar no gráfico
                        color: '#475569',
                        font: { size: 12, weight: '600' }
                    }
                }
            }, 
            maintainAspectRatio: false 
        }
    });

    // Gráfico Prioridade
    const ctxPri = document.getElementById('chartPrioridade');
    if (ctxPri) {
        if (chartPrioridade) chartPrioridade.destroy();
        chartPrioridade = new Chart(ctxPri, config(
            [nBaixa, nMedia, nAlta], 
            [`Baixa (${nBaixa})`, `Média (${nMedia})`, `Alta (${nAlta})`], 
            ['#f97316', '#2563eb', '#ef4444']
        ));
    }

    // Gráfico Status
    const ctxSta = document.getElementById('chartStatus');
    if (ctxSta) {
        if (chartStatus) chartStatus.destroy();
        chartStatus = new Chart(ctxSta, config(
            [nPendente, nAtendimento, nFinalizado], 
            [`Pendente (${nPendente})`, `Atendimento (${nAtendimento})`, `Finalizado (${nFinalizado})`], 
            ['#2563eb', '#facc15', '#10b981']
        ));
    }
}

/**
 * RENDERIZAÇÃO DAS BARRAS DE PROGRESSO (Prioridade)
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

function formatarDataSimples(dataISO) {
    if (!dataISO) return "---";
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR'); // Formato dd/mm/aaaa
}

/**
 * FILTRAGEM DINÂMICA DO DASHBOARD
 */
function aplicarFiltros() {
    const tipoFiltro = document.getElementById('filterTipo').value;
    const statusFiltro = document.getElementById('filterStatus').value;

    // Começamos com a lista completa que veio do banco
    let listaFiltrada = [...listaTicketsGlobal];

    // Filtra por Tipo (se não for "todos")
    if (tipoFiltro !== 'todos') {
        listaFiltrada = listaFiltrada.filter(t => t.tipo === tipoFiltro);
    }

    // Filtra por Status (se não for "todos")
    if (statusFiltro !== 'todos') {
        listaFiltrada = listaFiltrada.filter(t => t.status === statusFiltro);
    }

    // AGORA: Atualiza tudo na tela usando a lista filtrada!
    atualizarElementosInterface(listaFiltrada);
}

/**
 * Função auxiliar para isolar a lógica de atualização visual
 */
/**
 * Função auxiliar para atualizar apenas os componentes visuais
 */
function atualizarElementosInterface(dados) {
    // 1. Redesenha os Gráficos de Donut (Prioridade e Status)
    renderizarGraficosDonut(dados);
    
    // 2. Redesenha as Barras de Progresso de Carga de Trabalho
    renderizarBarrasProgresso(dados);
    
    // 3. Atualiza a Tabela de Atendimentos (caso esteja visível)
    renderizarTabelaGeral(dados);
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarEstatisticas();