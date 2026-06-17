// Recupera o ID do ticket da URL
const urlParams = new URLSearchParams(window.location.search);
const ticketId = parseInt(urlParams.get('id'));

let ticketAtual = null;
let pastedImageData = null;

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

function carregarDadosTicket() {
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    ticketAtual = lista.find(t => t.id === ticketId);

    if (!ticketAtual) {
        showNotification("Ticket não encontrado. Atualize a página e tente novamente.", 'error');
        voltar();
        return;
    }

    // Preenche a interface [cite: 351, 364, 385]
    document.getElementById('ticketIdLabel').innerText = ticketAtual.id;
    document.getElementById('descricaoTicket').innerText = ticketAtual.assunto;
    document.getElementById('statusLabel').innerText = ticketAtual.status;
    document.getElementById('selectPrioridade').value = ticketAtual.prioridade;
    document.getElementById('nomeSolicitante').innerText = ticketAtual.emailCliente;

    renderizarConversas();
}


function enviarResposta() {
    const campo = document.getElementById('textoResposta');
    const inputFile = document.getElementById('anexoResposta');

    const texto = campo.value;

    const temAnexoArquivo = inputFile && inputFile.files.length > 0;

    if (!texto && !temAnexoArquivo && !pastedImageData) {
        showNotification("Digite uma mensagem ou anexe um arquivo para prosseguir.", 'warning');
        return;
    }

    ticketAtual.mensagens = ticketAtual.mensagens || [];

    const novaMensagem = {
        texto: texto,
        autor: JSON.parse(localStorage.getItem('sessao_ativa')).nome,
        data: new Date().toISOString(),
        perfil: "suporte",
        anexo: null
    };

    function finalizarEnvio() {
        ticketAtual.mensagens.push(novaMensagem);
        salvarNoStorage();
        campo.value = "";
        if (inputFile) inputFile.value = "";
        pastedImageData = null;
        const preview = document.getElementById('previewAnexo');
        if (preview) preview.innerHTML = '';
        renderizarConversas();
    }

    if (pastedImageData) {
        novaMensagem.anexo = pastedImageData;
        finalizarEnvio();
    } else if (temAnexoArquivo) {
        const file = inputFile.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            novaMensagem.anexo = {
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + " KB",
                conteudo: e.target.result
            };
            finalizarEnvio();
        };
        reader.readAsDataURL(file);
    } else {
        finalizarEnvio();
    }
}

function renderizarConversas() {
    const box = document.getElementById('historicoConversa');
    const mensagens = ticketAtual.mensagens || [];

    if (mensagens.length === 0) {
        box.innerHTML = `<p style="color:#94a3b8; font-size:13px;">Aguardando retorno...</p>`;
        return;
    }

    box.innerHTML = mensagens.map(msg => `
        <div class="msg-bubble ${msg.perfil === 'suporte' ? 'admin' : 'user'}">

            <div class="msg-header">
                <strong>${msg.autor}</strong>
                <span>${new Date(msg.data).toLocaleString()}</span>
            </div>

            ${msg.texto ? `<p class="msg-texto">${msg.texto}</p>` : ""}

            ${msg.anexo ? `
                <div class="msg-anexo" onclick="baixarAnexo('${msg.anexo.conteudo}', '${msg.anexo.nome}')">
                    
                    <div class="anexo-icone">
                        <i class="fas fa-paperclip"></i>
                    </div>

                    <div class="anexo-info">
                        <div class="anexo-nome">${msg.anexo.nome}</div>
                        <div class="anexo-tamanho">${msg.anexo.tamanho}</div>
                    </div>

                </div>
            ` : ""}

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

function baixarAnexo(base64, nome) {
    const a = document.createElement("a");
    a.href = base64;
    a.download = nome;
    a.click();
}


function removerAnexoPaste() {
    pastedImageData = null;
    const preview = document.getElementById('previewAnexo');
    if (preview) preview.innerHTML = '';
}

window.addEventListener("DOMContentLoaded", () => {
    const inputFile = document.getElementById("anexoResposta");

    if (inputFile) {
        inputFile.addEventListener("change", function () {
            const preview = document.getElementById("previewAnexo");
            preview.innerHTML = "";
            pastedImageData = null;

            if (this.files.length > 0) {
                const file = this.files[0];

                preview.innerHTML = `
                    <div style="
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span>📎 ${file.name}</span>
                        <button onclick="removerAnexo()" style="border:none;background:none;color:red;cursor:pointer;">
                            ✖
                        </button>
                    </div>
                `;
            }
        });
    }

    const textoResposta = document.getElementById('textoResposta');
    if (textoResposta) {
        textoResposta.addEventListener('paste', function(e) {
            const items = (e.clipboardData || window.clipboardData)?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        pastedImageData = {
                            nome: 'screenshot.png',
                            tamanho: (file.size / 1024).toFixed(2) + ' KB',
                            conteudo: ev.target.result
                        };
                        if (inputFile) inputFile.value = '';
                        const preview = document.getElementById('previewAnexo');
                        if (preview) preview.innerHTML = `
                            <div style="padding:8px;border:1px solid #ddd;border-radius:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                                <img src="${ev.target.result}" style="height:56px;border-radius:4px;object-fit:cover;cursor:pointer;" onclick="window.open(this.src)">
                                <button onclick="removerAnexoPaste()" style="border:none;background:none;color:red;cursor:pointer;font-size:16px;">✖</button>
                            </div>`;
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        });
    }
});

// Função reutilizável para criar o HTML do chat estilo profissional
function gerarTemplateChat(mensagens, ticketId) {
    if (!mensagens || mensagens.length === 0) {
        return '<p class="empty-msg">Aguardando retorno do suporte...</p>';
    }

    return `
        <div class="chat-flow">
            ${mensagens.map(msg => `
                <div class="interaction-card">
                    <i class="fas fa-reply action-icon-top" style="position: absolute; top: 15px; right: 15px; color: #94a3b8;"></i>
                    
                    <div class="interaction-header">
                        <img src="assets/avatar-default.png" class="user-avatar" alt="Avatar">
                        <div class="interaction-meta">
                            <strong>${msg.autor}</strong><br>
                            respondeu em ${new Date(msg.data).toLocaleString('pt-BR')}
                        </div>
                    </div>
                    
                    <div class="interaction-content">
                        <p>${msg.texto}</p>
                        <p>Ticket: <a href="#" class="ticket-link">https://gesistec.suporte.com/helpdesk/tickets/${ticketId}</a></p>
                    </div>

                    ${msg.anexos && msg.anexos.length > 0 ? `
                        <div class="chat-attachments">
                            <span style="font-size: 11px; color: #64748b; font-weight: 700;">Anexos (${msg.anexos.length})</span>
                            <div class="attachment-inline-card">
                                <i class="far fa-file-alt"></i>
                                <div class="attachment-info">
                                    <strong>${msg.anexos[0].nome}</strong>
                                    <span>(${msg.anexos[0].tamanho || '---'})</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function removerAnexo() {
    const input = document.getElementById("anexoResposta");
    const preview = document.getElementById("previewAnexo");

    input.value = "";
    preview.innerHTML = "";
}

carregarDadosTicket();