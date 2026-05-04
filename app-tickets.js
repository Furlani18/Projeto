// 1. Verificação de Sessão e Segurança
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html'; 
}

// Inicialização da Saudação
if(document.getElementById('saudacao')) {
    document.getElementById('saudacao').innerText = `Olá, ${usuarioAtivo.nome}!`;
}

let ticketAbertoId = null;
let anexoTemporario = null; 

// Lógica para Criar Novo Ticket
document.getElementById('formTicket').onsubmit = function(e) {
    e.preventDefault();

    const assunto = document.getElementById('assunto').value;
    const tipoSelecionado = document.getElementById('tipo').value; // Valor 1, 2 ou 3
    const prioridade = document.getElementById('prioridade').value;
    const descricao = document.getElementById('descricao').value;
    const anexoInput = document.getElementById('anexoTicket');

    const novoTicket = {
        assunto: assunto,
        tipo: tipoSelecionado, 
        prioridade: prioridade,
        descricao: descricao,
        emailCliente: usuarioAtivo.email,
        anexos: []
    };

    // Tratamento de anexo inicial se houver
    if (anexoInput.files.length > 0) {
        const file = anexoInput.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            novoTicket.anexos.push({
                conteudo: event.target.result // Base64
            });
            finalizarCriacao(novoTicket);
        };
        reader.readAsDataURL(file);
    } else {
        finalizarCriacao(novoTicket);
    }
};

async function finalizarCriacao(ticket) {
    // Montamos o pacote conforme o server.js espera
    const dadosParaEnviar = {
        assunto: ticket.assunto,
        prioridade: ticket.prioridade,
        login: ticket.emailCliente, 
        tipo_id: ticket.tipo, // Corrigido de ticket,tipo para ticket.tipo
        anexo: ticket.anexos.length > 0 ? ticket.anexos[0].conteudo : null
    };

    try {
        const response = await fetch('http://localhost:3000/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosParaEnviar) 
        });

        if (response.ok) {
            fecharModal();
            alert("Chamado aberto com sucesso!");
            carregarTickets(); 
        } else {
            const erro = await response.json();
            alert("Erro no Banco: " + (erro.error || erro.message));
        }
    } catch (error) {
        alert("Servidor Node.js desligado.");
    }
}

/**
 * Chat e Interação
 */
function prepararAnexo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        anexoTemporario = { nome: file.name, conteudo: e.target.result };
        const preview = document.getElementById('file-preview-name');
        if (preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

async function enviarRespostaCliente(ticketId) {
    const campoTexto = document.getElementById('reply-text');
    const texto = campoTexto ? campoTexto.value : "";

    if (!texto.trim() && !anexoTemporario) return;

    const payload = {
        ticket_id: ticketId,
        autor: usuarioAtivo.email,
        texto: texto,
        anexo_conteudo: anexoTemporario ? anexoTemporario.conteudo : null
    };

    try {
        const response = await fetch('http://localhost:3000/api/mensagens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if (campoTexto) campoTexto.value = "";
            anexoTemporario = null;
            if (document.getElementById('file-preview-name')) document.getElementById('file-preview-name').innerText = "";
            
            const btnRef = document.querySelector(`button[onclick*="irParaInteracao(${ticketId}"]`);
            if (btnRef) irParaInteracao(ticketId, btnRef, true); 
        }
    } catch (error) {
        alert("Não foi possível enviar a resposta.");
    }
}

async function irParaInteracao(id, btn, forcarAbertura = false) {
    const existingRow = document.querySelector('.row-interacao');
    if (ticketAbertoId === id && !forcarAbertura) {
        if (existingRow) existingRow.remove();
        ticketAbertoId = null;
        return;
    }
    if (existingRow) existingRow.remove();
    ticketAbertoId = id;

    try {
        const response = await fetch(`http://localhost:3000/api/mensagens/${id}`);
        const mensagens = await response.json();

        const rowAtual = btn.closest('tr');
        const assunto = rowAtual.cells[2].innerText;
        const status = rowAtual.cells[4].innerText;

        const template = document.getElementById('templateInteracao');
        const clone = template.content.cloneNode(true);

        clone.querySelector('#ticketIdDisplay').innerText = id;
        clone.querySelector('#descDoc').innerText = assunto;
        clone.querySelector('#solicitanteDoc').innerText = usuarioAtivo.email;
        if(clone.querySelector('.status-title-side')) clone.querySelector('.status-title-side').innerText = status;

        // Lógica de Anexos na Tabela
        const listaAnexos = clone.querySelector('#listaAnexosDetalhada');
        let totalAnexos = 0;
        if (listaAnexos) {
            listaAnexos.innerHTML = ''; 
            mensagens.forEach(msg => {
                if (msg.anexo && msg.anexo.length > 50) {
                    totalAnexos++;
                    listaAnexos.innerHTML += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px;"><a href="${msg.anexo}" download="anexo" style="color:#2563eb; font-weight:600;">Ver Anexo</a></td>
                            <td style="padding: 10px;">---</td>
                            <td style="padding: 10px;">${new Date(msg.data).toLocaleDateString('pt-BR')}</td>
                            <td style="padding: 10px;">${msg.autor_display}</td>
                        </tr>`;
                }
            });
            if (clone.querySelector('#countAnexos')) clone.querySelector('#countAnexos').innerText = totalAnexos;
        }

        // Chat HTML
        const chatHTML = `
            <div class="conversation-container">
                <div class="chat-flow">
                    ${mensagens.map(msg => `
                        <div class="interaction-card ${msg.email_autor === usuarioAtivo.email ? 'msg-me' : 'msg-other'}">
                            <div class="msg-header">
                                <strong>${msg.autor_display}</strong>
                                <span>${new Date(msg.data).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p>${msg.texto}</p>
                            ${msg.anexo && msg.anexo.length > 50 ? `<a href="${msg.anexo}" download>📎 Baixar Arquivo</a>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>`;

        clone.querySelector('.content-scroll-area').insertAdjacentHTML('beforeend', chatHTML);
        rowAtual.after(clone);
        document.querySelector('.btn-reply-send').onclick = () => enviarRespostaCliente(id);

    } catch (error) {
        alert("Erro ao carregar histórico.");
    }
}

/**
 * Listagem de Tickets do Banco
 */
async function carregarTickets() {
    try {
        const response = await fetch(`http://localhost:3000/api/tickets?login=${usuarioAtivo.email}`);
        const chamadosDoBanco = await response.json();

        const meusChamados = chamadosDoBanco.map(ticket => ({
            id: ticket.id,
            assunto: ticket.assunto,
            tipo: ticket.nro_tipo === 1 ? 'Erro' : (ticket.nro_tipo === 3 ? 'Melhoria' : 'Dúvida'), // Ajustado para bater com seu HTML
            prioridade: ticket.prioridade === 'A' ? 'Alta' : (ticket.prioridade === 'M' ? 'Média' : 'Baixa'),
            status: ticket.status === 'A' ? 'Pendente' : 'Finalizado',
            dataCriacao: ticket.data,
            usuario: ticket.email_usuario
        }));

        renderizarLista(meusChamados);
    } catch (error) {
        console.error("Erro na conexão:", error);
    }
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
    if(!tabela) return;
    tabela.innerHTML = ticketsParaExibir.map(ticket => `
        <tr>
            <td><strong>#${ticket.id}</strong></td>
            <td><span class="type-badge ${ticket.tipo.toLowerCase()}">${ticket.tipo}</span></td>
            <td>${ticket.assunto}</td>
            <td>${ticket.prioridade}</td>
            <td><span class="badge ${ticket.status === 'Pendente' ? 'pendente' : 'finalizado'}">${ticket.status}</span></td>
            <td>
                <button onclick="irParaInteracao(${ticket.id}, this)" class="btn-edit"><i class="fas fa-external-link-alt"></i></button>
                <button onclick="excluirTicket(${ticket.id})" class="btn-delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function excluirTicket(id) {
    if (!confirm("Deseja realmente excluir este chamado?")) return;
    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${id}`, { method: 'DELETE' });
        if (response.ok) carregarTickets();
    } catch (error) {
        alert("Erro ao excluir.");
    }
}

// Auxiliares Modal
function abrirModal() { document.getElementById('modalTicket').style.display = 'block'; }
function fecharModal() { document.getElementById('modalTicket').style.display = 'none'; document.getElementById('formTicket').reset(); }
function logout() { localStorage.removeItem('sessao_ativa'); window.location.href = 'index.html'; }

carregarTickets();