// 1. Verificação de Sessão e Segurança
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html'; 
}

// Inicialização do Header
const primeiroNome = usuarioAtivo.nome ? usuarioAtivo.nome.split(' ')[0] : '';
const inicial = primeiroNome ? primeiroNome.charAt(0).toUpperCase() : '?';

const elSaudacao = document.getElementById('saudacao');
if (elSaudacao) elSaudacao.innerText = `Olá, ${primeiroNome}!`;

const elAvatar = document.getElementById('userAvatarHdr');
if (elAvatar) elAvatar.innerText = inicial;

const elEmpresa = document.getElementById('empresaHeader');
if (elEmpresa && usuarioAtivo.empresa) elEmpresa.innerText = usuarioAtivo.empresa;

const elData = document.getElementById('dataAtualCliente');
if (elData) elData.innerText = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

let ticketAbertoId = null;
let anexoTemporario = null;
let anexoTemporarioTicket = null;
let meusChamadosGlobal = [];

function ensureNotificationContainer() {
    let container = document.getElementById('gesistec-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gesistec-toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showNotification(message, type = 'info', duration = 4500) {
    const container = ensureNotificationContainer();
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

function mostrarToastPendente() {
    const pendingRaw = localStorage.getItem('gesistec_pending_toast');
    if (!pendingRaw) return;
    try {
        const pending = JSON.parse(pendingRaw);
        if (pending && pending.message) {
            showNotification(pending.message, pending.type || 'info');
        }
    } catch (error) {
        // Ignora dados inválidos
    }
    localStorage.removeItem('gesistec_pending_toast');
}

mostrarToastPendente();

function formatBase64Size(base64Data) {
    if (!base64Data) return '---';

    const rawBase64 = base64Data.split(',').pop().replace(/\s/g, '');
    const padding = rawBase64.endsWith('==') ? 2 : (rawBase64.endsWith('=') ? 1 : 0);
    const bytes = Math.max(0, Math.round((rawBase64.length * 3) / 4 - padding));

    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}

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
        descricao: ticket.descricao || '',
        prioridade: ticket.prioridade,
        login: ticket.emailCliente,
        tipo_id: ticket.tipo,
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
            removerPreviewTicket();
            showNotification("Chamado aberto com sucesso.", 'success');
            carregarTickets(); 
        } else {
            const erro = await response.json();
            showNotification("Ocorreu um problema ao registrar o chamado: " + (erro.error || erro.message), 'error');
        }
    } catch (error) {
        showNotification("Não foi possível conectar ao servidor. Verifique se ele está em execução.", 'error');
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
            
            const btnRef = document.querySelector(`button[onclick*="irParaInteracao(${ticketId},"]`);
            if (btnRef) irParaInteracao(ticketId, btnRef, true);
        }
    } catch (error) {
        showNotification("Não foi possível enviar a resposta. Tente novamente.", 'error');
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

        // ORDENADO CORRETAMENTE: Primeiro captura a linha, depois lê as células
        const rowAtual = btn.closest('tr');
        const tipoAtual = rowAtual.cells[1].innerText;   
        const assunto = rowAtual.cells[2].innerText;
        const statusAtual = rowAtual.cells[4].innerText; 

        const template = document.getElementById('templateInteracao');
        const clone = template.content.cloneNode(true);

        // Injeta os dados dinamicamente no cabeçalho do detalhe do template
        const elBadgeStatus = clone.querySelector('#badgeStatusDinamico');
        if (elBadgeStatus) {
            elBadgeStatus.innerText = statusAtual;
            elBadgeStatus.className = `badge ${statusAtual.toLowerCase().replace(/\s+/g, '-')}`;
        }

        const elMainTitle = clone.querySelector('#ticketMainTitle');
        if (elMainTitle) {
            elMainTitle.innerText = tipoAtual; 
        }

        const ticketIdEl = clone.querySelector('#ticketIdDisplay');
        if (ticketIdEl) ticketIdEl.innerText = id;

        const msgDescricao = mensagens.find(m => m.tipo_msg === 'D');
        const descDocEl = clone.querySelector('#descDoc');
        if (descDocEl) {
            descDocEl.innerText = msgDescricao ? msgDescricao.texto : '';
            descDocEl.style.display = msgDescricao ? 'block' : 'none';
        }
        const contentLabelEl = clone.querySelector('.content-label');
        if (contentLabelEl) contentLabelEl.style.display = msgDescricao ? 'block' : 'none';

        const solicitanteEl = clone.querySelector('#solicitanteDoc');
        if (solicitanteEl) solicitanteEl.innerText = usuarioAtivo.email;
        
        const statusTitleSideEl = clone.querySelector('.status-title-side');
        if (statusTitleSideEl) {
            statusTitleSideEl.innerText = statusAtual;
        }

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
                            <td style="padding: 10px;">${formatBase64Size(msg.anexo)}</td>
                            <td style="padding: 10px;">${new Date(msg.data).toLocaleDateString('pt-BR')}</td>
                            <td style="padding: 10px;">${msg.autor_display}</td>
                        </tr>`;
                }
            });
            const countAnexosEl = clone.querySelector('#countAnexos');
            if (countAnexosEl) countAnexosEl.innerText = totalAnexos;
        }

        // Renderização do chat em bolhas (inserido no fim, mantendo posição original)
        const mensagensChat = mensagens.filter(m => m.tipo_msg !== 'D');
        let lastDate = null;
        const chatBubbles = mensagensChat.length === 0
            ? `<div class="chat-empty-state">
                    <i class="fas fa-comments"></i>
                    <p>Nenhuma mensagem ainda.<br>Envie a primeira resposta abaixo!</p>
               </div>`
            : mensagensChat.map(msg => {
                const isMe = msg.email_autor === usuarioAtivo.email;
                const inicial = (msg.autor_display || '?').charAt(0).toUpperCase();
                const hora = new Date(msg.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
                const dataMensagem = new Date(msg.data).toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'});

                let dateSep = '';
                if (dataMensagem !== lastDate) {
                    lastDate = dataMensagem;
                    dateSep = `<div class="chat-date-sep">${dataMensagem}</div>`;
                }

                return `
                    ${dateSep}
                    <div class="msg-row ${isMe ? 'msg-row-me' : 'msg-row-other'}">
                        <div class="msg-avatar-bubble">${inicial}</div>
                        <div class="msg-content">
                            <div class="msg-meta">
                                <span class="msg-author">${msg.autor_display}</span>
                                <span class="msg-time">${hora}</span>
                            </div>
                            <div class="msg-bubble">
                                ${msg.texto ? `<p class="msg-text">${msg.texto}</p>` : ''}
                                ${msg.anexo && msg.anexo.length > 50 ? `
                                    <a class="msg-attachment-pill" href="${msg.anexo}" download>
                                        <i class="fas fa-paperclip"></i> Baixar Anexo
                                    </a>` : ''}
                            </div>
                        </div>
                    </div>`;
            }).join('');

        const chatHTML = `<div class="chat-flow" id="chatFlowDinamico">${chatBubbles}</div>`;
        clone.querySelector('.content-scroll-area').insertAdjacentHTML('beforeend', chatHTML);
        
        // 1. Configura o clique do botão de resposta dentro do clone
        const btnEnviar = clone.querySelector('.btn-reply-send');
        if (btnEnviar) {
            btnEnviar.onclick = () => enviarRespostaCliente(id);
        }

        // 2. Configura o clique do botão de salvar edição dentro do clone
        const btnSalvar = clone.querySelector('.btn-save');
        if (btnSalvar) {
            btnSalvar.onclick = () => salvarEdicaoInline(id);
        }

        // 3. Insere o bloco completo na tabela
        rowAtual.after(clone);

        // 4. Scroll automático ao fim do chat
        requestAnimationFrame(() => {
            const chatFlow = document.getElementById('chatFlowDinamico');
            if (chatFlow) chatFlow.scrollTop = chatFlow.scrollHeight;
        });

    } catch (error) {
        showNotification("Não foi possível carregar o histórico do ticket. Tente novamente.", 'error');
    }
}

function fecharInline(button) {
    const row = button.closest('.row-interacao');
    if (row) {
        row.remove();
    }
    ticketAbertoId = null;
}

function ativarResposta() {
    const reply = document.getElementById('reply-text');
    if (!reply) return;
    reply.scrollIntoView({ behavior: 'smooth', block: 'center' });
    reply.focus();
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
            descricao: ticket.descricao || '',
            tipo: ticket.tipo || (ticket.nro_tipo === 1 ? 'Erro' : (ticket.nro_tipo === 2 ? 'Melhoria' : 'Dúvida')),
            prioridade: ticket.prioridade === 'A' ? 'Alta' : (ticket.prioridade === 'M' ? 'Média' : 'Baixa'),
            status: ticket.status === 'P' ? 'Pendente' :
                   (ticket.status === 'E' ? 'Em Atendimento' :
                   (ticket.status === 'V' ? 'Vencido' :
                   (ticket.status === 'F' ? 'Finalizado' :
                   (ticket.status === 'C' ? 'Cancelado' : 'Outro')))),
            dataCriacao: ticket.data,
            usuario: ticket.email_usuario
        }));

        meusChamadosGlobal = meusChamados;
        renderizarLista(meusChamados);
    } catch (error) {
        console.error("Erro na conexão:", error);
    }
}

async function carregarTiposTicketCliente() {
    const selectTipo = document.getElementById('tipo');
    if (!selectTipo) return;

    selectTipo.innerHTML = '<option value="" disabled selected>Carregando tipos de chamado...</option>';

    try {
        const response = await fetch('http://localhost:3000/api/tipos-ticket');
        const tipos = await response.json();

        if (!Array.isArray(tipos) || tipos.length === 0) {
            selectTipo.innerHTML = '<option value="" disabled>Não há tipos cadastrados</option>';
            return;
        }

        selectTipo.innerHTML = tipos
            .sort((a, b) => a.id - b.id)
            .map(tipo => `<option value="${tipo.id}">${tipo.nome}</option>`)
            .join('');
    } catch (error) {
        console.error('Erro ao carregar tipos de chamado:', error);
        selectTipo.innerHTML = '<option value="" disabled>Erro ao carregar tipos</option>';
    }
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
    if(!tabela) return;

    tabela.innerHTML = ticketsParaExibir.map(ticket => {
        // Normalização simplificada para gerar a classe do badge de tipo (Erro, Melhoria, Dúvida)
        const tipoClass = ticket.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const badgeClass = tipoClass.replace(/[^a-z0-9]/g, '');
        
        // CORREÇÃO: Transforma o status real (ex: "Em Atendimento") em uma classe limpa (ex: "em-atendimento")
        // Isso garante que se o banco mandar 'Pendente', a classe será 'pendente'
        const statusClass = ticket.status.toLowerCase().replace(/\s+/g, '-');

        return `
        <tr class="ticket-row">
            <td><strong>#${ticket.id}</strong></td>
            <td><span class="type-badge type-${badgeClass}">${ticket.tipo}</span></td>
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
    }).join(''); 
}

async function excluirTicket(ticketId) {
    const confirmacao = confirm('Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.');
    if (!confirmacao) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Ticket excluído com sucesso.', 'success');
            carregarTickets();
        } else {
            const erro = await response.json();
            showNotification(erro.error || 'Não foi possível excluir o ticket.', 'error');
        }
    } catch (error) {
        showNotification('Não foi possível conectar ao servidor. Verifique se ele está em execução.', 'error');
    }
}

// Auxiliares Modal
function abrirModal() { document.getElementById('modalTicket').style.display = 'block'; }
function fecharModal() { document.getElementById('modalTicket').style.display = 'none'; document.getElementById('formTicket').reset(); removerPreviewTicket(); }
function logout() { localStorage.removeItem('sessao_ativa'); window.location.href = 'index.html'; }

function removerPreviewTicket() {
    const input = document.getElementById('anexoTicket');
    const previewBox = document.getElementById('previewAnexoTicket');
    const nameLabel = document.getElementById('nomePreviewTicket');
    const sizeLabel = document.getElementById('tamanhoPreviewTicket');

    if (input) input.value = '';
    anexoTemporarioTicket = null;
    if (previewBox) previewBox.style.display = 'none';
    if (nameLabel) nameLabel.innerText = '';
    if (sizeLabel) sizeLabel.innerText = '';
}

async function salvarEdicaoInline(id) {
    // 1. Identifica o ID (vence o erro de undefined)
    const ticketId = id || ticketAbertoId;

    if (!ticketId || ticketId === "undefined") {
        showNotification("Erro: ID do ticket não identificado.", "error");
        return;
    }

    // 2. Captura os elementos do HTML que você mandou
    const elPrio = document.getElementById('editPrio');
    const elStatus = document.getElementById('editStatus');
    const elAssunto = document.getElementById('descDoc'); // O assunto costuma ser o texto da interacão

    const novaPrioridade = elPrio ? elPrio.value : 'M';
    const novoStatus = elStatus ? elStatus.value : 'P';
    const assuntoAtual = elAssunto ? elAssunto.innerText : '';

    try {
        // Envia para a rota de atualização
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assunto: assuntoAtual,
                prioridade: novaPrioridade,
                status: novoStatus // Agora enviando a letra correta (P, F, etc)
            })
        });

        if (response.ok) {
            showNotification("Ticket atualizado com sucesso!", "success");
            carregarTickets(); // Recarrega a tabela principal
        } else {
            showNotification("Erro ao salvar alterações.", "error");
        }
    } catch (error) {
        console.error("Erro FETCH:", error);
    }
}

function inicializarPreviewAnexoTicket() {
    const ticketFileInput = document.getElementById('anexoTicket');
    if (!ticketFileInput) return;

    ticketFileInput.addEventListener('change', function () {
        const previewBox = document.getElementById('previewAnexoTicket');
        const nameLabel = document.getElementById('nomePreviewTicket');
        const sizeLabel = document.getElementById('tamanhoPreviewTicket');

        if (this.files.length > 0) {
            const file = this.files[0];
            anexoTemporarioTicket = {
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + ' KB',
                conteudo: null
            };

            const reader = new FileReader();
            reader.onload = function (e) {
                if (anexoTemporarioTicket) anexoTemporarioTicket.conteudo = e.target.result;
            };
            reader.readAsDataURL(file);

            if (previewBox) previewBox.style.display = 'block';
            if (nameLabel) nameLabel.innerText = file.name;
            if (sizeLabel) sizeLabel.innerText = (file.size / 1024).toFixed(2) + ' KB';
        } else {
            removerPreviewTicket();
        }
    });
}

carregarTickets();
carregarTiposTicketCliente();
inicializarPreviewAnexoTicket();