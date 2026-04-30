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

        // Mapeamento dos dados com JOIN da empresa
        listaTicketsGlobal = dadosBrutos.map(t => ({
            id: t.id,
            assunto: t.assunto,
            usuario: t.email_usuario, 
            empresa: t.nome_empresa || "Empresa não cadastrada", 
            status: t.status === 'A' ? 'Pendente' : (t.status === 'E' ? 'Em Atendimento' : 'Finalizado'),
            prioridade: t.prioridade === 'A' ? 'Alta' : (t.prioridade === 'M' ? 'Média' : 'Baixa'),
            data: t.data
        }));

        const setMetric = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.innerText = valor;
        };

        // Métricas do Dashboard
        setMetric('countVencidos', listaTicketsGlobal.filter(t => t.prioridade === 'Alta' && t.status !== 'Finalizado').length); 
        setMetric('countAbertos', listaTicketsGlobal.filter(t => t.status === 'Pendente').length);
        setMetric('countEspera', listaTicketsGlobal.filter(t => t.status === 'Em Atendimento').length);
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
                <td>
                    <div style="font-weight: 700; color: #1e293b;">${ticket.empresa}</div>
                    <small style="color: #94a3b8; font-size: 11px;">${ticket.usuario}</small>
                </td>
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

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarEstatisticas();