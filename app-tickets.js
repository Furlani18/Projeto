// 1. Verificação de Sessão e Segurança [cite: 317]
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html'; 
}

// Inicialização da Saudação na Interface
document.getElementById('saudacao').innerText = `Olá, ${usuarioAtivo.nome}!`;

// --- 2. Gestão do Modal de Criação (Storyboard Ponto 3) [cite: 346] ---

function abrirModal() {
    document.getElementById('modalTicket').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalTicket').style.display = 'none';
    document.getElementById('formTicket').reset();
}

// --- 3. Navegação para Interação (Storyboard Ponto 4)  ---

/**
 * Redireciona para a página de interação detalhada, 
 * abandonando o uso de modais para edição.
 */
function irParaInteracao(id) {
    window.location.href = `interacao-ticket.html?id=${id}`;
}

// --- 4. Lógica de Negócio e Listagem ---

function carregarTickets() {
    const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const meusChamados = listaGeral.filter(t => t.emailCliente === usuarioAtivo.email);
    
    // Atualiza contadores do dashboard [cite: 397]
    document.getElementById('countTotal').innerText = meusChamados.length;
    document.getElementById('countPendente').innerText = meusChamados.filter(t => t.status === 'Pendente').length;

    renderizarLista(meusChamados);
}

function verHistorico() {
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const historico = lista.filter(t => t.emailCliente === usuarioAtivo.email && t.status === 'Finalizado');
    renderizarLista(historico);
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
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
                    <button onclick="irParaInteracao(${ticket.id})" class="btn-edit" title="Abrir Interação">
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

// --- 5. Persistência e Criação [cite: 346, 347] ---

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
            relato: "", // Será preenchido na página de interação [cite: 383]
            anexos: [], // Gerido na página de interação [cite: 384]
            conversas: [], // Histórico de mensagens 
            dataCriacao: new Date().toLocaleDateString('pt-BR')
        };

        ticketsExistentes.push(novoChamado);
        localStorage.setItem('tickets_gesistec', JSON.stringify(ticketsExistentes));
        
        fecharModal();
        carregarTickets();
    });
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