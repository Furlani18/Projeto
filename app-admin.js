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
let anexoAdminTemp = null; // Memória para o arquivo antes do envio unificado

/**
 * NAVEGAÇÃO ENTRE TELAS
 */
/**
 * NAVEGAÇÃO ENTRE TELAS (Atualizada)
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

    // Se entrar na tela de usuários, carrega a lista
    if (viewId === 'usersView') {
        carregarUsuarios();
    } else {
        carregarEstatisticas();
    }
}

/**
 * LÓGICA DE ANEXO (Unificada com a Mensagem)
 */
function prepararAnexoAdmin(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        anexoAdminTemp = {
            nome: file.name,
            tamanho: (file.size / 1024).toFixed(2) + " KB",
            conteudo: e.target.result,
            data: new Date().toISOString()
        };
        const preview = document.getElementById('preview-anexo-admin');
        if (preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

/**
 * ENVIO DE RESPOSTA (Mensagem + Anexo)
 */
function enviarRespostaAdmin() {
    const campoTexto = document.getElementById('textoRespostaAdmin');
    const idTicket = document.getElementById('idTicketResponder').innerText;
    const respostaTexto = campoTexto.value;

    if (!respostaTexto.trim() && !anexoAdminTemp) {
        alert("Por favor, digite uma mensagem ou anexe um arquivo.");
        return;
    }
    listaTickets[index].status = "Em Atendimento";
    localStorage.setItem('tickets_gesistec', JSON.stringify(listaTickets));

    let listaTickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = listaTickets.findIndex(t => t.id == idTicket);

    if (index !== -1) {
        // Inicializa array de mensagens se não existir
        if (!listaTickets[index].mensagens) listaTickets[index].mensagens = [];

        const novaMensagem = {
            autor: usuarioSessao.nome,
            perfil: "suporte",
            texto: respostaTexto,
            data: new Date().toISOString(),
            anexo: anexoAdminTemp // Envia o objeto de anexo junto com o texto
        };

        listaTickets[index].mensagens.push(novaMensagem);
        listaTickets[index].status = "Em Atendimento"; 
        
        localStorage.setItem('tickets_gesistec', JSON.stringify(listaTickets));

        // Limpeza de Interface
        campoTexto.value = "";
        anexoAdminTemp = null;
        document.getElementById('preview-anexo-admin').innerText = "";
        document.getElementById('areaRespostaAdmin').style.display = 'none';
        
        alert("Resposta enviada com sucesso!");
        carregarEstatisticas(); 
    }
}

/**
 * DASHBOARD: MÉTRICAS E GRÁFICOS
 */
function carregarEstatisticas() {
    const tickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];

    const setMetric = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    };

    // Filtros de métricas reais para a GESISTEC
    const pendentes = tickets.filter(t => t.status === 'Pendente');
    const emAtendimento = tickets.filter(t => t.status === 'Em Atendimento');

    setMetric('countVencidos', tickets.filter(t => t.prioridade === 'Alta' && t.status !== 'Finalizado').length); 
    setMetric('countAbertos', pendentes.length);
    setMetric('countEspera', emAtendimento.length);
    setMetric('countNaoAtribuidos', pendentes.length);
    setMetric('countMonitorados', tickets.length);

    renderizarGraficosDonut(tickets);
    renderizarBarrasProgresso(tickets);
    renderizarTabelaGeral(tickets);
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

    const prioridades = ['Baixa', 'Média', 'Alta'];
    const total = tickets.length || 1;

    container.innerHTML = prioridades.map(prio => {
        const qtd = tickets.filter(t => t.prioridade === prio).length;
        const porc = (qtd / total) * 100;
        return `
            <div class="bar-item" style="margin-bottom: 15px;">
                <div class="bar-info" style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                    <strong>${prio}</strong> <span>${qtd}</span>
                </div>
                <div class="bar-track" style="background:#f1f5f9; height:8px; border-radius:10px; overflow:hidden;">
                    <div class="bar-fill" style="width: ${porc}%; background:#2563eb; height:100%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * TABELA DE ATENDIMENTO
 */
function renderizarTabelaGeral(tickets) {
    const tabela = document.getElementById('ticketsByClientList');
    if (!tabela) return;

    tabela.innerHTML = tickets.slice().reverse().map(ticket => {
        const statusClass = ticket.status.toLowerCase().replace(/\s+/g, '-');
        
        return `
            <tr>
                <td><span style="color: #2563eb; font-weight: 800;">#${ticket.id}</span></td>
                <td class="cliente-info">
                    <span class="cliente-nome" style="font-weight: 700;">
                        ${ticket.clienteNome || 'Cliente Externo'} 
                    </span>
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

function abrirRespostaAdmin(id) {
    const area = document.getElementById('areaRespostaAdmin');
    const tickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const ticket = tickets.find(t => t.id == id);

    if (ticket) {
        document.getElementById('idTicketResponder').innerText = id;
        area.style.display = 'block';

        // Inserir um pequeno histórico acima da resposta para o Admin se localizar
        const historicoRapido = ticket.mensagens.slice(-2).map(m => `
            <div style="font-size: 12px; padding: 5px; border-bottom: 1px solid #eee;">
                <strong>${m.autor}:</strong> ${m.texto.substring(0, 50)}...
            </div>
        `).join('');
        
        // Se quiser exibir a descrição original:
        area.insertAdjacentHTML('afterbegin', `<div id="contextoAdmin" style="background: #f8fafc; padding: 10px; margin-bottom: 10px; border-radius: 5px; font-size: 13px;"><strong>Problema:</strong> ${ticket.descricao}</div>`);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function fecharAreaResposta() {
    document.getElementById('areaRespostaAdmin').style.display = 'none';
    anexoAdminTemp = null;
    document.getElementById('preview-anexo-admin').innerText = "";
}

/**
 * Inicializa e renderiza a tabela de usuários
 */
function carregarUsuarios() {
    const usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec')) || [];
    const tbody = document.getElementById('listaUsuarios');
    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Nenhum usuário cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map((user, index) => `
        <tr>
            <td><strong>${user.nome}</strong></td>
            <td>${user.email}</td>
            <td><span class="profile-tag">${user.perfil}</span></td>
            <td><span class="badge finalizado">Ativo</span></td>
            <td>
                <button class="btn-action-soft" onclick="deletarUsuario(${index})">
                    <i class="far fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Salva um novo usuário no LocalStorage
 */
function salvarUsuario(event) {
    event.preventDefault();
    
    const novoUser = {
        nome: document.getElementById('userName').value,
        email: document.getElementById('userEmail').value,
        pass: document.getElementById('userPass').value,
        perfil: document.getElementById('userPerfil').value,
        dataCriacao: new Date().toISOString()
    };

    let usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec')) || [];
    
    // Evita duplicidade de e-mail
    if (usuarios.some(u => u.email === novoUser.email)) {
        alert("Este e-mail já está cadastrado!");
        return;
    }

    usuarios.push(novoUser);
    localStorage.setItem('usuarios_gesistec', JSON.stringify(usuarios));
    
    fecharModalUsuario();
    carregarUsuarios();
    alert("Usuário cadastrado com sucesso!");
}

// Funções de Modal
function abrirModalUsuario() { document.getElementById('modalUsuario').style.display = 'flex'; }
function fecharModalUsuario() { 
    document.getElementById('modalUsuario').style.display = 'none';
    document.getElementById('formUsuario').reset();
}

function deletarUsuario(index) {
    if (confirm("Deseja realmente remover este acesso?")) {
        let usuarios = JSON.parse(localStorage.getItem('usuarios_gesistec'));
        usuarios.splice(index, 1);
        localStorage.setItem('usuarios_gesistec', JSON.stringify(usuarios));
        carregarUsuarios();
    }
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarEstatisticas();