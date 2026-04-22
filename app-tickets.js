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
    const tipo = document.getElementById('tipo').value;
    const prioridade = document.getElementById('prioridade').value;
    const descricao = document.getElementById('descricao').value;
    const anexoInput = document.getElementById('anexoTicket');

    const novoTicket = {
        id: Math.floor(1000 + Math.random() * 9000), // Gera ID 4 dígitos
        assunto: assunto,
        tipo: tipo,
        prioridade: prioridade,
        descricao: descricao,
        status: 'Pendente',
        dataCriacao: new Date().toISOString(),
        emailCliente: usuarioAtivo.email,
        mensagens: [],
        anexos: []
    };

    // Tratamento de anexo inicial se houver
    if (anexoInput.files.length > 0) {
        const file = anexoInput.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            novoTicket.anexos.push({
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + " KB",
                conteudo: event.target.result,
                data: new Date().toISOString(),
                usuario: usuarioAtivo.nome
            });
            finalizarCriacao(novoTicket);
        };
        reader.readAsDataURL(file);
    } else {
        finalizarCriacao(novoTicket);
    }
};

function finalizarCriacao(ticket) {
    let lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    lista.push(ticket);
    localStorage.setItem('tickets_gesistec', JSON.stringify(lista));
    
    fecharModal();
    carregarTickets();
    alert("Chamado #" + ticket.id + " criado com sucesso!");
}

// Pequeno ajuste na irParaInteracao para o botão de envio
// Dentro da função irParaInteracao, após dar o rowAtual.after(clone), adicione:
const btnMsg = document.querySelector('.btn-reply-send');
if(btnMsg) {
    btnMsg.onclick = () => enviarRespostaCliente(id);
}

/**
 * Salva as alterações de Prioridade e Status feitas dentro do chat expandido.
 */
function salvarEdicaoInline() {
    if (!ticketAbertoId) {
        alert("Erro: Nenhum ticket identificado para atualização.");
        return;
    }

    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = lista.findIndex(t => t.id === ticketAbertoId);

    if (index === -1) {
        alert("Erro: Ticket não encontrado no banco de dados.");
        return;
    }

    // Captura os novos valores dos seletores <select>
    const novaPrioridade = document.getElementById('editPrio').value;
    const novoStatus = document.getElementById('editStatus').value;

    // Atualiza o objeto na lista
    lista[index].prioridade = novaPrioridade;
    lista[index].status = novoStatus;

    // Persiste no localStorage
    localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

    alert("Ticket #" + ticketAbertoId + " atualizado com sucesso!");

    // Atualiza a tabela principal (badges) e mantém o chat aberto com os novos dados
    carregarTickets(); 
    
    // Opcional: Atualiza o texto de status na barra lateral do chat sem fechar
    const statusTitleSide = document.querySelector('.status-title-side');
    const priorityDisplay = document.querySelector('#displayPrioridade');
    if (statusTitleSide) statusTitleSide.innerText = novoStatus;
    if (priorityDisplay) priorityDisplay.innerText = novaPrioridade;
}
/**
 * Captura o arquivo selecionado e gera um preview
 */
function prepararAnexo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        anexoTemporario = {
            nome: file.name,
            tamanho: (file.size / 1024).toFixed(2) + " KB",
            conteudo: e.target.result,
            data: new Date().toISOString()
        };
        const preview = document.getElementById('file-preview-name');
        if(preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

/**
 * Envia a mensagem e o anexo. Atualiza a interface sem fechar o chat.
 */
function enviarRespostaCliente(ticketId) {
    const campoTexto = document.getElementById('reply-text');
    const texto = campoTexto ? campoTexto.value : "";

    if (!texto.trim() && !anexoTemporario) {
        alert("Digite uma mensagem ou anexe um arquivo.");
        return;
    }
    

    let listaTickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = listaTickets.findIndex(t => t.id === ticketId);

    if (index !== -1) {
        // Garante que o array de mensagens existe
        if (!listaTickets[index].mensagens) listaTickets[index].mensagens = [];

        const novaMensagem = {
            autor: usuarioAtivo.nome,
            perfil: "cliente",
            texto: texto,
            data: new Date().toISOString(),
            anexo: anexoTemporario 
        };

        listaTickets[index].mensagens.push(novaMensagem);
        localStorage.setItem('tickets_gesistec', JSON.stringify(listaTickets));

        // Limpeza de campos
        if(campoTexto) campoTexto.value = "";
        anexoTemporario = null;
        const preview = document.getElementById('file-preview-name');
        if(preview) preview.innerText = "";
        
        // Refresh inteligente: Localiza o botão na linha da tabela para re-renderizar
        const btnRef = document.querySelector(`button[onclick*="irParaInteracao(${ticketId}"]`);
        irParaInteracao(ticketId, btnRef, true); 
    }
}

// --- Gestão do Modal ---
function abrirModal() {
    document.getElementById('modalTicket').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalTicket').style.display = 'none';
    document.getElementById('formTicket').reset();
}

/**
 * Formata data ISO para PT-BR
 */
function formatarDataReferencia(dataISO) {
    if (!dataISO || dataISO === "undefined") return "Data não informada";
    const data = new Date(dataISO);
    if (isNaN(data.getTime())) return dataISO; 
    
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Renderiza o histórico de interações in-line.
 * @param {boolean} forcarAbertura - Se true, não fecha o ticket se ele já estiver aberto (usado no refresh).
 */
function irParaInteracao(id, btn, forcarAbertura = false) {
    const existingRow = document.querySelector('.row-interacao');

    // Se clicar no mesmo ID e não for um refresh, fecha a aba
    if (ticketAbertoId === id && !forcarAbertura) {
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

    // Metadados
    clone.querySelector('#ticketIdDisplay').innerText = ticket.id;
    clone.querySelector('#descDoc').innerText = ticket.assunto;
    clone.querySelector('#solicitanteDoc').innerText = ticket.emailCliente;
    clone.querySelector('#displayPrioridade').innerText = ticket.prioridade;
    clone.querySelector('#dataCriacaoDisplay').innerText = `por ${formatarDataReferencia(ticket.dataCriacao)}`;
    
    const slaElement = clone.querySelector('#slaDisplay');
    if(slaElement) slaElement.innerHTML = `<i class="far fa-clock"></i> ${calcularSLA(ticket.dataCriacao)}`;

    const scrollArea = clone.querySelector('.content-scroll-area');
    const mensagens = ticket.mensagens || [];
    
    const chatHTML = `
        <div class="conversation-container" style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <h5 style="margin-bottom: 20px; color: #1e293b; font-weight: 800;">Histórico de Interações</h5>
            <div class="chat-flow">
                ${mensagens.length > 0 ? mensagens.map(msg => `
                    <div class="interaction-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #fff;">
                        <div class="interaction-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <div style="width: 35px; height: 35px; background: #2563eb; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                ${msg.autor ? msg.autor.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div class="interaction-meta">
                                <strong>${msg.autor} <span class="profile-tag" style="font-size: 10px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${msg.perfil}</span></strong>
                                <div style="font-size: 11px; color: #64748b;">${formatarDataReferencia(msg.data)}</div>
                            </div>
                        </div>
                        <div class="interaction-content">
                            <p style="margin: 0; font-size: 14px; color: #334155;">${msg.texto.replace(/</g, "&lt;")}</p>
                        </div>
                        ${msg.anexo ? `
                            <div style="margin-top: 10px; padding: 8px; background: #f8fafc; border-radius: 4px; display: inline-block; cursor: pointer;" onclick="baixarAnexo('${msg.anexo.conteudo}', '${msg.anexo.nome}')">
                                <i class="far fa-file-alt"></i> <small>${msg.anexo.nome} (${msg.anexo.tamanho})</small>
                            </div>
                        ` : ""}
                    </div>
                `).join('') : '<p style="text-align: center; color: #94a3b8;">Nenhuma interação.</p>'}
            </div>
        </div>
    `;
    
    if (scrollArea) scrollArea.insertAdjacentHTML('beforeend', chatHTML);

    // Tabela de anexos (originais)
    const tabelaAnexos = clone.querySelector('#listaAnexosDetalhada');
    const anexos = ticket.anexos || [];
    if (tabelaAnexos) {
        tabelaAnexos.innerHTML = anexos.map(a => `
            <tr>
                <td onclick="baixarAnexo('${a.conteudo}', '${a.nome}')" style="cursor:pointer; color:#2563eb;">
                    <i class="far fa-file-alt"></i> ${a.nome}
                </td>
                <td>${a.tamanho || '---'}</td>
                <td>${formatarDataReferencia(a.data)}</td>
                <td>${a.usuario || 'Sistema'}</td> 
            </tr>
        `).join('');
    }

    rowAtual.after(clone);
}

// --- Funções de Auxílio e Dashboard ---

function carregarTickets() {
    const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const meusChamados = listaGeral.filter(t => t.emailCliente === usuarioAtivo.email);
    
    const total = document.getElementById('countTotal');
    const pendente = document.getElementById('countPendente');
    if(total) total.innerText = meusChamados.length;
    if(pendente) pendente.innerText = meusChamados.filter(t => t.status === 'Pendente').length;

    renderizarLista(meusChamados);
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
    if(!tabela) return;
    tabela.innerHTML = '';

    if (ticketsParaExibir.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Nenhum chamado encontrado.</td></tr>';
        return;
    }

    ticketsParaExibir.forEach(ticket => {
        const statusClass = ticket.status === 'Pendente' ? 'pendente' : 'finalizado';
        const tipoClass = ticket.tipo === 'Erro' ? 'type-erro' : 
                          ticket.tipo === 'Melhoria' ? 'type-melhoria' : 'type-duvida';

        tabela.innerHTML += `
            <tr>
                <td><strong>#${ticket.id}</strong></td>
                <td><span class="type-badge ${tipoClass}">${ticket.tipo || 'Geral'}</span></td>
                <td>${ticket.assunto}</td>
                <td>${ticket.prioridade}</td>
                <td><span class="badge ${statusClass}">${ticket.status}</span></td>
                <td>
                    <button onclick="irParaInteracao(${ticket.id}, this)" class="btn-edit">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button onclick="excluirTicket(${ticket.id})" class="btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function calcularSLA(dataISO) {
    if (!dataISO) return "0min";
    const diffMs = new Date() - new Date(dataISO);
    const totalMinutos = Math.floor(diffMs / 60000);
    const totalHoras = Math.floor(totalMinutos / 60);

    if (totalHoras < 1) return `${totalMinutos}min`;
    if (totalHoras < 24) return `${totalHoras}h ${totalMinutos % 60}min`;
    return `${Math.floor(totalHoras / 24)}d ${totalHoras % 24}h`;
}

function baixarAnexo(base64, nome) {
    const a = document.createElement("a");
    a.href = base64;
    a.download = nome;
    a.click();
}

function excluirTicket(id) {
    if (confirm("Deseja excluir este ticket?")) {
        let lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
        lista = lista.filter(t => t.id !== id);
        localStorage.setItem('tickets_gesistec', JSON.stringify(lista));
        carregarTickets();
    }
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarTickets();