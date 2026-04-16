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

    renderizarConversas();
}


function enviarResposta() {
    const campo = document.getElementById('textoResposta');
    const inputFile = document.getElementById('anexoResposta');

    const texto = campo.value;

    if (!texto && (!inputFile || inputFile.files.length === 0)) {
        alert("Digite uma mensagem ou adicione um anexo!");
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

    // COM ANEXO
    if (inputFile && inputFile.files.length > 0) {
        const file = inputFile.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            novaMensagem.anexo = {
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + " KB",
                conteudo: e.target.result
            };

            ticketAtual.mensagens.push(novaMensagem);
            salvarNoStorage();

            campo.value = "";
            inputFile.value = "";

            renderizarConversas();
        };

        reader.readAsDataURL(file);
    } else {
        // SEM ANEXO
        ticketAtual.mensagens.push(novaMensagem);
        salvarNoStorage();

        campo.value = "";
        renderizarConversas();
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


window.addEventListener("DOMContentLoaded", () => {
    const inputFile = document.getElementById("anexoResposta");

    if (inputFile) {
        inputFile.addEventListener("change", function () {
            const preview = document.getElementById("previewAnexo");
            preview.innerHTML = "";

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