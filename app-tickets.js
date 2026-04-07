// Recupera o usuário logado para filtrar os tickets [cite: 317]
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html';
}

document.getElementById('saudacao').innerText = `Olá, ${usuarioAtivo.nome}!`;

// Funções do Modal
function abrirModal() {
    document.getElementById('modalTicket').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalTicket').style.display = 'none';
    document.getElementById('formTicket').reset();
}

// Carregar tickets da "base de dados" local
function carregarTickets() {
    const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const tabela = document.getElementById('tabelaTickets');
    tabela.innerHTML = '';

    const meusChamados = listaGeral.filter(t => t.emailCliente === usuarioAtivo.email);

    // Atualiza os contadores do topo
    document.getElementById('countTotal').innerText = meusChamados.length;
    document.getElementById('countPendente').innerText = meusChamados.filter(t => t.status === 'Pendente').length;

    if (meusChamados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:3rem;">Nenhum chamado registrado no momento.</td></tr>';
        return;
    }

    meusChamados.forEach(ticket => {
        tabela.innerHTML += `
            <tr>
                <td><strong>#${ticket.id}</strong></td>
                <td>${ticket.assunto}</td>
                <td>${ticket.prioridade}</td>
                <td><span class="badge ${ticket.status.toLowerCase()}">${ticket.status}</span></td>
                <td>
                    <button onclick="excluirTicket(${ticket.id})" class="btn-icon-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// Função para exclusão temporária (apenas para teste no localStorage)
function excluirTicket(id) {
    if (confirm("Deseja realmente excluir este ticket temporariamente?")) {
        const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
        
        // Filtra a lista removendo o ticket com o ID selecionado
        const listaAtualizada = listaGeral.filter(ticket => ticket.id !== id);
        
        // Atualiza o "banco de dados" local
        localStorage.setItem('tickets_gesistec', JSON.stringify(listaAtualizada));
        
        // Recarrega a tabela e atualiza o Dashboard do Admin se estiver aberto
        carregarTickets();
        alert("Ticket removido com sucesso!");
    }
}

// Salvar novo chamado [cite: 255, 346]
document.getElementById('formTicket').addEventListener('submit', function(e) {
    e.preventDefault();

    const ticketsExistentes = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    
    const novoChamado = {
        id: Math.floor(1000 + Math.random() * 9000), // Simula ID do sistema
        emailCliente: usuarioAtivo.email,
        assunto: document.getElementById('assunto').value,
        prioridade: document.getElementById('prioridade').value,
        descricao: document.getElementById('descricao').value,
        status: 'Pendente',
        dataCriacao: new Date().toLocaleDateString('pt-BR')
    };

    ticketsExistentes.push(novoChamado);
    localStorage.setItem('tickets_gesistec', JSON.stringify(ticketsExistentes));

    alert('Ticket enviado com sucesso!');
    fecharModal();
    carregarTickets(); // Atualiza a lista [cite: 349]
});

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicializa a tabela
carregarTickets();