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
/**
 * Captura o arquivo selecionado e o prepara para envio junto com a resposta.
 */
function prepararAnexo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Armazena os dados do anexo na variável global temporária
        anexoTemporario = {
            nome: file.name,
            conteudo: e.target.result // Base64 para gravação no banco
        };
        // Atualiza o nome do arquivo no preview ao lado do botão
        const preview = document.getElementById('file-preview-name');
        if (preview) preview.innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

/**
 * Envia a resposta de texto e o anexo para o banco de dados MySQL.
 */
async function enviarRespostaCliente(ticketId) {
    const campoTexto = document.getElementById('reply-text');
    const texto = campoTexto ? campoTexto.value : "";

    // Impede o envio se não houver texto nem anexo
    if (!texto.trim() && !anexoTemporario) return;

    const payload = {
        ticket_id: ticketId,
        autor: usuarioAtivo.email, // Identifica quem está enviando
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
            // 1. Limpa os campos de entrada após o sucesso
            if (campoTexto) campoTexto.value = "";
            anexoTemporario = null;
            const preview = document.getElementById('file-preview-name');
            if (preview) preview.innerText = "";

            // 2. Atualiza o Histórico de Interações sem fechar a aba
            // Localiza o botão original na tabela para disparar o refresh da aba aberta
            const btnRef = document.querySelector(`button[onclick*="irParaInteracao(${ticketId}"]`);
            if (btnRef) {
                // Chama a função de abertura com 'true' para forçar apenas o recarregamento dos dados
                irParaInteracao(ticketId, btnRef, true); 
            }
        } else {
            alert("Erro ao salvar sua resposta no servidor.");
        }
    } catch (error) {
        console.error("Erro na comunicação:", error);
        alert("Não foi possível conectar ao servidor para enviar a resposta.");
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
/**
 * Abre a área de interação (chat) buscando dados do MySQL
 */
async function irParaInteracao(id, btn, forcarAbertura = false) {
    const existingRow = document.querySelector('.row-interacao');

    // Se clicar no mesmo ID e já estiver aberto, fecha
    if (ticketAbertoId === id && !forcarAbertura) {
        if (existingRow) existingRow.remove();
        ticketAbertoId = null;
        return;
    }

    if (existingRow) existingRow.remove();
    ticketAbertoId = id;

    try {
        // 1. Buscamos o histórico de mensagens do banco de dados
        const response = await fetch(`http://localhost:3000/api/mensagens/${id}`);
        const mensagens = await response.json();

        // 2. Precisamos dos dados básicos do ticket (assunto, etc)
        // Como já carregamos a lista, podemos buscar no array local que criamos no carregarTickets
        // Ou, se preferir, usar os dados da linha da tabela
        const rowAtual = btn.closest('tr');
        const assunto = rowAtual.cells[2].innerText;
        const status = rowAtual.cells[4].innerText;

        // 3. Pegamos o template do HTML e clonamos
        const template = document.getElementById('templateInteracao');
        if (!template) {
            console.error("Template 'templateInteracao' não encontrado no HTML!");
            return;
        }
        const clone = template.content.cloneNode(true);

        // 4. Preenchemos os metadados do cabeçalho do chat
        clone.querySelector('#ticketIdDisplay').innerText = id;
        clone.querySelector('#descDoc').innerText = assunto;
        clone.querySelector('#solicitanteDoc').innerText = usuarioAtivo.email;
        
        const statusSide = clone.querySelector('.status-title-side');
        if(statusSide) statusSide.innerText = status;

        // 5. Montamos o HTML das mensagens do histórico
        // 5. Montamos o HTML das mensagens do histórico
const scrollArea = clone.querySelector('.content-scroll-area');
const chatHTML = `
    <div class="conversation-container" style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        <h5 style="margin-bottom: 15px; color: #1e293b;">Histórico de Interações</h5>
        <div class="chat-flow">
            ${mensagens.length > 0 ? mensagens.map(msg => {
                
                // --- Lógica do Horário ---
                const dataObjeto = new Date(msg.data);
                const dataFormat = dataObjeto.toLocaleDateString('pt-BR');
                const horaFormat = dataObjeto.toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                // -------------------------

                return `
                    <div class="interaction-card" style="border-left: 4px solid ${msg.autor === usuarioAtivo.email ? '#2563eb' : '#10b981'}; margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                            <strong>${msg.autor}</strong>
                            <span style="color: #64748b;">${dataFormat} às ${horaFormat}</span>
                        </div>
                        <p style="margin: 0; font-size: 13px;">${msg.texto}</p>
                    </div>
                `;
            }).join('') : '<p style="text-align: center; color: #94a3b8; font-size: 13px;">Nenhuma mensagem ainda.</p>'}
        </div>
    </div>
`;

        if (scrollArea) scrollArea.insertAdjacentHTML('beforeend', chatHTML);

        // 6. Inserimos a nova linha logo abaixo da linha clicada
        rowAtual.after(clone);

        // 7. Configura o botão de enviar resposta dentro do chat que acabou de abrir
        const btnResponder = document.querySelector('.btn-reply-send');
        if (btnResponder) {
            btnResponder.onclick = () => enviarRespostaCliente(id);
        }

    } catch (error) {
        console.error("Erro ao carregar interação:", error);
        alert("Não foi possível carregar o histórico deste chamado.");
    }
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

        // ... dentro da sua função renderizarLista(ticketsParaExibir) ...
tabela.innerHTML += `
    <tr>
        <td><strong>#${ticket.id}</strong></td>
        <td><span class="type-badge ${tipoClass}">${ticket.tipo || 'Geral'}</span></td>
        <td>${ticket.assunto}</td>
        <td>${ticket.prioridade}</td>
        <td><span class="badge ${statusClass}">${ticket.status}</span></td>
        <td>
            <!-- O botão que abre a interação -->
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