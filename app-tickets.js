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
        clienteNome: usuarioAtivo.nome,
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

async function finalizarCriacao(ticket) {
    // 1. Tradução: O banco espera NRO_TIPO (Inteiro) e o front manda texto
    const mapaTipos = { 'Erro': 1, 'Melhoria': 2, 'Dúvida': 3 };
    
    // 2. Montamos o pacote exatamente como o server.js espera (req.body)
    const dadosParaEnviar = {
        assunto: ticket.assunto,
        prioridade: ticket.prioridade,
        login: ticket.emailCliente, // O server.js espera 'login' para DES_LOGIN
        tipo_id: mapaTipos[ticket.tipo] || 1, // Converte texto para ID numérico
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
            alert("Chamado aberto com sucesso no MySQL!");
            // carregarTickets(); // Implementaremos a busca do banco abaixo
        } else {
            const erro = await response.json();
            // Agora o alert vai mostrar o erro real do MySQL (ex: coluna faltando)
            alert("Erro no Banco: " + (erro.error || erro.message));
        }
    } catch (error) {
        alert("Servidor Node.js desligado.");
    }
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
 * Fecha a área de interação expandida (in-line) e reseta o controle global.
 * @param {HTMLElement} btn - O botão que foi clicado.
 */
function fecharInline(btn) {
    // Busca o elemento pai 'tr' que tem a classe da linha de interação
    const row = btn.closest('.row-interacao');
    
    if (row) {
        row.remove(); // Remove a linha da tabela fisicamente
    }

    // Importante: Reseta o ID global para que o sistema saiba que 
    // agora é possível abrir este ou outro ticket novamente.
    ticketAbertoId = null;
}
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
    
    // 1. Corrigindo a lógica das mensagens dentro da variável
    const chatHTML = `
        <div class="conversation-container" style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <h5 style="margin-bottom: 20px; color: #1e293b; font-weight: 800;">Histórico de Interações</h5>
            <div class="chat-flow">
                ${mensagens.length > 0 ? mensagens.map(msg => `
                    <div class="interaction-card" style="border-left: 5px solid ${msg.perfil === 'suporte' ? '#10b981' : '#2563eb'}; margin-bottom: 15px; padding: 12px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div class="interaction-header" style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                            <strong>${msg.autor} 
                                <span class="profile-tag" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${msg.perfil === 'suporte' ? '#dcfce7' : '#dbeafe'}">
                                    ${msg.perfil === 'suporte' ? 'Suporte GESISTEC' : 'Cliente'}
                                </span>
                            </strong>
                            <span style="font-size: 11px; color: #64748b;">${new Date(msg.data).toLocaleString()}</span>
                        </div>
                        <div class="interaction-content">
                            <p style="margin: 0; font-size: 14px; color: #334155;">${msg.texto}</p>
                        </div>
                        ${msg.anexo ? `<button onclick="baixarAnexo('${msg.anexo.conteudo}', '${msg.anexo.nome}')" class="btn-link" style="margin-top: 8px; border: none; background: none; color: #2563eb; cursor: pointer; font-size: 12px;">📎 ${msg.anexo.nome}</button>` : ''}
                    </div>
                `).join('') : '<p style="text-align: center; color: #94a3b8; font-size: 13px;">Nenhuma interação registrada.</p>'}
            </div>
        </div>
    `;
    
    // 2. Inserindo o chat na área de scroll
    if (scrollArea) scrollArea.insertAdjacentHTML('beforeend', chatHTML);

    // 3. Tabela de anexos (originais)
    const tabelaAnexos = clone.querySelector('#listaAnexosDetalhada');
    const anexos = ticket.anexos || [];
    if (tabelaAnexos) {
        tabelaAnexos.innerHTML = anexos.map(a => `
            <tr>
                <td onclick="baixarAnexo('${a.conteudo}', '${a.nome}')" style="cursor:pointer; color:#2563eb; font-weight:600;">
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

async function carregarTickets() {
    try {
        const response = await fetch(`http://localhost:3000/api/tickets?login=${usuarioAtivo.email}`);
        const chamadosDoBanco = await response.json();

        // Verificação de segurança: se não for um Array, deu erro no servidor
        if (!Array.isArray(chamadosDoBanco)) {
            console.error("Servidor retornou erro:", chamadosDoBanco);
            return;
        }

        const meusChamados = chamadosDoBanco.map(ticket => {
            // ... sua lógica de tradução (prioTraduzida, statusTraduzido, etc) ...
            return {
                id: ticket.id,
                assunto: ticket.assunto,
                tipo: ticket.nro_tipo === 1 ? 'Erro' : (ticket.nro_tipo === 2 ? 'Melhoria' : 'Dúvida'),
                prioridade: ticket.prioridade === 'A' ? 'Alta' : (ticket.prioridade === 'M' ? 'Média' : 'Baixa'),
                status: ticket.status === 'A' ? 'Pendente' : 'Finalizado',
                dataCriacao: ticket.data,
                emailCliente: ticket.usuario
            };
        });

        renderizarLista(meusChamados);
    } catch (error) {
        console.error("Erro na conexão:", error);
    }
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


/**
 * ESCUTA EM TEMPO REAL:
 * Atualiza a tela do cliente se o Admin fizer alterações em outra aba.
 */
window.addEventListener('storage', (event) => {
    if (event.key === 'tickets_gesistec') {
        console.log("Detectada atualização nos tickets...");
        
        // 1. Atualiza a tabela principal (badges e status)
        carregarTickets();

        // 2. Se o usuário estiver com um chat aberto, recarrega o conteúdo dele
        if (ticketAbertoId) {
            const btnRef = document.querySelector(`button[onclick*="irParaInteracao(${ticketAbertoId}"]`);
            if (btnRef) {
                // Passamos 'true' para não fechar o ticket, apenas atualizar o conteúdo
                irParaInteracao(ticketAbertoId, btnRef, true);
            }
        }
    }
});

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Inicialização automática
carregarTickets();