// 1. Verificação de Sessão e Segurança
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html'; 
}

// Inicialização da Saudação
if(document.getElementById('saudacao')) {
    document.getElementById('saudacao').innerText = `Olá, ${usuarioAtivo.nome}!`;
}

// Variável global para gerenciar qual ticket está aberto in-line
let ticketAbertoId = null;

// --- 2. Gestão do Modal de Criação ---

function abrirModal() {
    document.getElementById('modalTicket').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalTicket').style.display = 'none';
    document.getElementById('formTicket').reset();
}

// --- 3. Interação In-Line (Fluxo de Chat e Detalhes) ---

function formatarDataReferencia(dataISO) {
    if (!dataISO) return "Data não disponível";
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).replace(/\./g, '');
}

/**
 * Função para abrir/fechar a área de interação e MOSTRAR RESPOSTAS
 */
function irParaInteracao(id, btn) {
    const existingRow = document.querySelector('.row-interacao');

    if (ticketAbertoId === id) {
        if (existingRow) existingRow.remove();
        ticketAbertoId = null;
        return;
    }

    if (existingRow) existingRow.remove();

    ticketAbertoId = id;
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const ticket = lista.find(t => t.id === id);

    if (!ticket) return;

    const rowAtual = btn.closest('tr');
    const template = document.getElementById('templateInteracao');
    const clone = template.content.cloneNode(true);

    // Preenchimento de Campos Básicos
    clone.querySelector('#ticketIdDisplay').innerText = ticket.id;
    clone.querySelector('#descDoc').innerText = ticket.assunto;
    clone.querySelector('#solicitanteDoc').innerText = ticket.emailCliente;
    clone.querySelector('#displayPrioridade').innerText = ticket.prioridade;
    clone.querySelector('#dataCriacaoDisplay').innerText = `por ${formatarDataReferencia(ticket.dataCriacao)}`;
    clone.querySelector('#slaDisplay').innerHTML = `<i class="far fa-clock"></i> ${calcularSLA(ticket.dataCriacao)}`;

    // --- LÓGICA DE MENSAGENS (Onde aparece a resposta do Admin) ---
    // Procuramos um container para as mensagens dentro da área de scroll
    const scrollArea = clone.querySelector('.content-scroll-area');
    const mensagens = ticket.mensagens || [];

    if (scrollArea) {
        // Criamos o HTML do histórico de conversa
        const chatHTML = `
            <div class="conversation-container" style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <h5 style="margin-bottom: 15px; color: #1e293b;">Histórico de Interações</h5>
                <div class="chat-flow" style="display: flex; flex-direction: column; gap: 12px;">
                    ${mensagens.length > 0 ? mensagens.map(msg => `
                        <div class="msg-bubble ${msg.perfil === 'suporte' ? 'admin' : 'user'}" 
                             style="padding: 12px; border-radius: 8px; max-width: 80%; font-size: 13px; 
                             ${msg.perfil === 'suporte' ? 'background: #f0fdf4; border: 1px solid #dcfce7; align-self: flex-start;' : 'background: #f1f5f9; align-self: flex-end;'}">
                            <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">
                                <strong>${msg.autor}</strong> • ${new Date(msg.data).toLocaleString()}
                            </div>
                            <p style="margin: 0;">${msg.texto}</p>
                        </div>
                    `).join('') : '<p style="font-size: 12px; color: #94a3b8;">Aguardando retorno do suporte...</p>'}
                </div>
            </div>
        `;
        // Inserimos o chat antes da tabela de anexos ou ao final
        scrollArea.insertAdjacentHTML('beforeend', chatHTML);
    }

    // Gerencia Anexos
    const tabelaAnexos = clone.querySelector('#listaAnexosDetalhada');
    const anexos = ticket.anexos || [];
    if (clone.querySelector('#countAnexos')) clone.querySelector('#countAnexos').innerText = anexos.length;

    if (tabelaAnexos) {
        tabelaAnexos.innerHTML = anexos.map(a => `
            <tr>
                <td><i class="far fa-file-pdf"></i> ${a.nome}</td>
                <td>${a.tamanho || '---'}</td>
                <td>${a.data}</td>
                <td>${usuarioAtivo.nome}</td> 
            </tr>
        `).join('');
    }

    rowAtual.after(clone);
}

function fecharInline(btn) {
    const row = btn.closest('.row-interacao');
    if (row) row.remove();
    ticketAbertoId = null;
}

// --- 4. Lógica de Dashboard e Listagem ---

function carregarTickets() {
    const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const meusChamados = listaGeral.filter(t => t.emailCliente === usuarioAtivo.email);
    
    if(document.getElementById('countTotal')) document.getElementById('countTotal').innerText = meusChamados.length;
    if(document.getElementById('countPendente')) document.getElementById('countPendente').innerText = meusChamados.filter(t => t.status === 'Pendente').length;

    renderizarLista(meusChamados);
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
    if(!tabela) return;
    tabela.innerHTML = '';

    if (ticketsParaExibir.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:3rem;">Nenhum chamado encontrado.</td></tr>';
        return;
    }

    ticketsParaExibir.forEach(ticket => {
        const statusClass = ticket.status === 'Pendente' ? 'pendente' : 'finalizado';
        tabela.innerHTML += `
            <tr>
                <td><strong>#${ticket.id}</strong></td>
                <td>${ticket.assunto}</td>
                <td>${ticket.prioridade}</td>
                <td><span class="badge ${statusClass}">${ticket.status}</span></td>
                <td>
                    <button onclick="irParaInteracao(${ticket.id}, this)" class="btn-edit" title="Abrir Interação">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button onclick="excluirTicket(${ticket.id})" class="btn-delete" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- 5. Persistência e Criação ---

const formTicket = document.getElementById('formTicket');
if (formTicket) {
    formTicket.addEventListener('submit', function(e) {
        e.preventDefault();
        const ticketsExistentes = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
        
        const novoChamado = {
            id: Math.floor(1000 + Math.random() * 9000),
            emailCliente: usuarioAtivo.email,
            assunto: document.getElementById('assunto').value,
            prioridade: document.getElementById('prioridade').value,
            status: 'Pendente',
            anexos: [],
            mensagens: [], // IMPORTANTE: Inicializa o array de conversas vazio
            dataCriacao: new Date().toISOString() 
        };

        ticketsExistentes.push(novoChamado);
        localStorage.setItem('tickets_gesistec', JSON.stringify(ticketsExistentes));
        
        fecharModal();
        carregarTickets();
    });
}

function calcularSLA(dataISO) {
    if (!dataISO) return "- 0min";
    const criacao = new Date(dataISO);
    const agora = new Date();
    const diffMs = agora - criacao;
    
    const totalMinutos = Math.floor(diffMs / (1000 * 60));
    const totalHoras = Math.floor(totalMinutos / 60);
    const totalDias = Math.floor(totalHoras / 24);

    if (totalHoras < 1) return `- ${totalMinutos}min`;
    if (totalDias < 1) return `- ${totalHoras}h ${totalMinutos % 60}min`;

    const meses = Math.floor(totalDias / 30);
    const semanas = Math.floor((totalDias % 30) / 7);
    
    return `- ${meses}mon ${semanas}w`;
}

function excluirTicket(id) {
    if (confirm("Deseja excluir este ticket?")) {
        const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
        localStorage.setItem('tickets_gesistec', JSON.stringify(lista.filter(t => t.id !== id)));
        carregarTickets();
    }
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização
carregarTickets();