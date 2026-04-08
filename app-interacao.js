// Recupera o ID do ticket da URL
const urlParams = new URLSearchParams(window.location.search);
const ticketId = parseInt(urlParams.get('id'));

let ticketAtual = null;

function carregarDadosTicket() {
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    ticketAtual = lista.find(t => t.id === ticketId);

    if (!ticketAtual) {
        alert("Ticket não encontrado!");
        voltar();
        return;
    }

    // Preenche a interface [cite: 351, 364, 385]
    document.getElementById('ticketIdLabel').innerText = ticketAtual.id;
    document.getElementById('descricaoTicket').innerText = ticketAtual.assunto;
    document.getElementById('statusLabel').innerText = ticketAtual.status;
    document.getElementById('selectPrioridade').value = ticketAtual.prioridade;
    document.getElementById('nomeSolicitante').innerText = ticketAtual.emailCliente;

    renderizarAnexos();
    renderizarConversas();
}

// Upload direto conforme solicitado [cite: 384]
function uploadDireto(input) {
    if (input.files && input.files[0]) {
        const novoAnexo = {
            nome: input.files[0].name,
            tamanho: (input.files[0].size / 1024).toFixed(2) + " KB",
            data: new Date().toLocaleString('pt-BR'),
            usuario: JSON.parse(localStorage.getItem('sessao_ativa')).nome
        };

        ticketAtual.anexos = ticketAtual.anexos || [];
        ticketAtual.anexos.push(novoAnexo);
        salvarNoStorage();
        renderizarAnexos();
    }
}

function renderizarAnexos() {
    const tabela = document.getElementById('tabelaAnexos');
    const anexos = ticketAtual.anexos || [];
    document.getElementById('anexoCount').innerText = anexos.length;
    
    tabela.innerHTML = anexos.map(a => `
        <tr>
            <td><i class="fas fa-file-alt"></i> ${a.nome}</td>
            <td>${a.tamanho}</td>
            <td>${a.data}</td>
            <td>${a.usuario}</td>
        </tr>
    `).join('');
}

function enviarResposta() {
    const texto = document.getElementById('textoResposta').value;
    if (!texto) return;

    const novaConversa = {
        texto: texto,
        usuario: JSON.parse(localStorage.getItem('sessao_ativa')).nome,
        data: new Date().toLocaleString('pt-BR')
    };

    ticketAtual.conversas = ticketAtual.conversas || [];
    ticketAtual.conversas.push(novaConversa);
    
    document.getElementById('textoResposta').value = "";
    salvarNoStorage();
    renderizarConversas();
}

function renderizarConversas() {
    const box = document.getElementById('historicoConversa');
    const conversas = ticketAtual.conversas || [];
    
    box.innerHTML = conversas.map(c => `
        <div class="chat-msg">
            <strong>${c.usuario}</strong> <small>${c.data}</small>
            <p>${c.texto}</p>
        </div>
    `).join('');
}

function salvarNoStorage() {
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec'));
    const index = lista.findIndex(t => t.id === ticketId);
    lista[index] = ticketAtual;
    localStorage.setItem('tickets_gesistec', JSON.stringify(lista));
}

function voltar() {
    window.location.href = 'tickets-cliente.html';
}

carregarDadosTicket();