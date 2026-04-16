// 1. Verificação de Sessão e Segurança
const usuarioAtivo = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioAtivo) {
    window.location.href = 'index.html'; 
}

// Inicialização da Saudação
if(document.getElementById('saudacao')) {
    document.getElementById('saudacao').innerText = `Olá, ${usuarioAtivo.nome}!`;
}

// Variável global para gerenciar qual ticket está aberto in-line
let ticketAbertoId = null;

let anexoTemporario = null; // Variável para segurar o arquivo antes de enviar

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
            conteudo: e.target.result, // Base64 do arquivo
            data: new Date().toISOString()
        };
        document.getElementById('file-preview-name').innerText = "📎 " + file.name;
    };
    reader.readAsDataURL(file);
}

/**
 * Envia a mensagem e o anexo JUNTOS
 */
function enviarRespostaCliente(ticketId) {
    const texto = document.getElementById('reply-text').value;

    if (!texto.trim() && !anexoTemporario) {
        alert("Digite uma mensagem ou anexe um arquivo.");
        return;
    }

    let listaTickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = listaTickets.findIndex(t => t.id === ticketId);

    if (index !== -1) {
        const novaMensagem = {
            autor: usuarioAtivo.nome, // Furlani ou Sidney Cerradinho
            perfil: "cliente",
            texto: texto,
            data: new Date().toISOString(),
            anexo: anexoTemporario // Aqui o anexo vai junto com a mensagem
        };

        listaTickets[index].mensagens.push(novaMensagem);
        localStorage.setItem('tickets_gesistec', JSON.stringify(listaTickets));

        // Limpa tudo após enviar
        document.getElementById('reply-text').value = "";
        anexoTemporario = null;
        document.getElementById('file-preview-name').innerText = "";
        
        // Recarrega a interação para mostrar o novo card
        irParaInteracao(ticketId, document.querySelector(`button[onclick*="${ticketId}"]`));
    }
}

// --- 2. Gestão do Modal de Criação ---

function abrirModal() {
    document.getElementById('modalTicket').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalTicket').style.display = 'none';
    document.getElementById('formTicket').reset();
}

// --- 3. Interação In-Line (Fluxo de Chat e Detalhes) ---

/**
 * Formata a data com segurança, evitando o erro de "Invalid Date".
 */
function formatarDataReferencia(dataISO) {
    // 1. Se o campo estiver vazio ou for indefinido, retorna um aviso amigável
    if (!dataISO || dataISO === "undefined") return "Data não informada";
    
    const data = new Date(dataISO);
    
    // 2. Verifica se o resultado da conversão é realmente uma data válida
    if (isNaN(data.getTime())) {
        // Se já for uma string de data (ex: 16/04/2026), retorna ela mesma
        return dataISO; 
    }
    
    // 3. Formata normalmente se estiver tudo certo
    return data.toLocaleDateString('pt-BR', {
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    }).replace(/\./g, '');
}

/**
 * Função para expandir o ticket in-line e exibir o chat profissional da GESISTEC[cite: 4, 350].
 */
/**
 * Versão Final e Limpa: Exibe o chat profissional sem links ou ícones desnecessários.
 */
/**
 * Renderiza o histórico de interações dinamicamente.
 */
function irParaInteracao(id, btn) {
    const existingRow = document.querySelector('.row-interacao');

    // Controle de abertura/fechamento
    if (ticketAbertoId === id) {
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

    // Preenchimento de metadados do ticket
    clone.querySelector('#ticketIdDisplay').innerText = ticket.id;
    clone.querySelector('#descDoc').innerText = ticket.assunto;
    clone.querySelector('#solicitanteDoc').innerText = ticket.emailCliente;
    clone.querySelector('#displayPrioridade').innerText = ticket.prioridade;
    clone.querySelector('#dataCriacaoDisplay').innerText = `por ${formatarDataReferencia(ticket.dataCriacao)}`;
    clone.querySelector('#slaDisplay').innerHTML = `<i class="far fa-clock"></i> ${calcularSLA(ticket.dataCriacao)}`;

    const scrollArea = clone.querySelector('.content-scroll-area');
    if (scrollArea) {
        const mensagens = ticket.mensagens || [];
        
        // Gera o HTML sem nenhum texto "pronto" ou de exemplo
        // Localize onde o chat é montado e atualize o template:
const chatHTML = `
    <div class="conversation-container" style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        <h5 style="margin-bottom: 20px; color: #1e293b; font-weight: 800;">Histórico de Interações</h5>
        <div class="chat-flow">
            ${mensagens.length > 0 ? mensagens.map(msg => `
                <div class="interaction-card">
                    <div class="interaction-header">
                        <div class="user-avatar-placeholder">
                            ${msg.autor ? msg.autor.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div class="interaction-meta">
                            <strong>${msg.autor} <span class="profile-tag">${msg.perfil}</span></strong>
                            <span>enviado em ${new Date(msg.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    <div class="interaction-content">
                        ${msg.texto ? `<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155;">${msg.texto.replace(/</g, "&lt;")}</p>` : ""}
                    </div>

                    ${msg.anexo && msg.anexo.conteudo ? `
                        <div class="chat-attachments" style="margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                            <div class="attachment-inline-card" onclick="baixarAnexo(\`${msg.anexo.conteudo}\`, \`${msg.anexo.nome}\`)">
                                <i class="far fa-file-alt"></i>
                                <div class="attachment-info">
                                    <strong style="font-size: 12px;">${msg.anexo.nome}</strong>
                                    <span style="font-size: 11px; color: #64748b;">${msg.anexo.tamanho || '---'}</span>
                                </div>
                            </div>
                        </div>
                    ` : ""}
                </div>
            `).join('') : '<p style="font-size: 13px; color: #94a3b8; text-align: center;">Nenhuma interação registrada.</p>'}
        </div>
    </div>
`;
        scrollArea.insertAdjacentHTML('beforeend', chatHTML);
    }

    // Gerencia a tabela de anexos originais do ticket
    const tabelaAnexos = clone.querySelector('#listaAnexosDetalhada');
    const anexos = ticket.anexos || [];
    if (clone.querySelector('#countAnexos')) clone.querySelector('#countAnexos').innerText = anexos.length;

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

function fecharInline(btn) {
    const row = btn.closest('.row-interacao');
    if (row) row.remove();
    ticketAbertoId = null;
}

// --- 4. Lógica de Dashboard e Listagem ---

function carregarTickets() {
    const listaGeral = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const meusChamados = listaGeral.filter(t => t.emailCliente === usuarioAtivo.email);
    
    if(document.getElementById('countTotal')) document.getElementById('countTotal').innerText = meusChamados.length;
    if(document.getElementById('countPendente')) document.getElementById('countPendente').innerText = meusChamados.filter(t => t.status === 'Pendente').length;

    renderizarLista(meusChamados);
}

function renderizarLista(ticketsParaExibir) {
    const tabela = document.getElementById('tabelaTickets');
    if(!tabela) return;
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
                    <button onclick="irParaInteracao(${ticket.id}, this)" class="btn-edit" title="Abrir Interação">
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

// --- 5. Persistência e Criação ---

const formTicket = document.getElementById('formTicket');
if (formTicket) {
    formTicket.addEventListener('submit', function(e) {
    e.preventDefault();

    const ticketsExistentes = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const inputFile = document.getElementById("anexoTicket");

    const novoChamado = {
        id: Math.floor(1000 + Math.random() * 9000),
        emailCliente: usuarioAtivo.email,
        assunto: document.getElementById('assunto').value,
        descricao: document.getElementById('descricao').value,
        prioridade: document.getElementById('prioridade').value,
        status: 'Pendente',
        anexos: [],
        mensagens: [],
        dataCriacao: new Date().toISOString()
    };

    // SE TEM ANEXO
    if (inputFile && inputFile.files.length > 0) {
        const file = inputFile.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            novoChamado.anexos.push({
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + " KB",
                data: new Date().toLocaleString('pt-BR'),
                usuario: usuarioAtivo.nome,
                conteudo: e.target.result
            });

            salvarTicket(novoChamado, ticketsExistentes);
        };

        reader.readAsDataURL(file);
    } else {
        salvarTicket(novoChamado, ticketsExistentes);
    }
});

// função auxiliar (deixa mais limpo)
function salvarTicket(novoChamado, lista) {
    lista.push(novoChamado);
    localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

    fecharModal();
    carregarTickets();
}
}

function salvarEdicaoInline() {
    if (!ticketAbertoId) return;

    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = lista.findIndex(t => t.id === ticketAbertoId);

    if (index === -1) return;

    // Pegar valores da tela
    const novaPrioridade = document.getElementById('editPrio')?.value;
    const novoStatus = document.getElementById('editStatus')?.value;

    // Atualizar dados
    if (novaPrioridade) lista[index].prioridade = novaPrioridade;
    if (novoStatus) lista[index].status = novoStatus;

    localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

    alert("Ticket atualizado com sucesso!");

    // Atualiza tela
    carregarTickets();
    document.querySelector('.status-title-side').innerText = novoStatus;
    document.querySelector('#displayPrioridade').innerText = novaPrioridade;
}


function calcularSLA(dataISO) {
    if (!dataISO) return "- 0min";
    const criacao = new Date(dataISO);
    const agora = new Date();
    const diffMs = agora - criacao;
    
    const totalMinutos = Math.floor(diffMs / (1000 * 60));
    const totalHoras = Math.floor(totalMinutos / 60);
    const totalDias = Math.floor(totalHoras / 24);

    if (totalHoras < 1) return `- ${totalMinutos}min`;
    if (totalDias < 1) return `- ${totalHoras}h ${totalMinutos % 60}min`;

    const meses = Math.floor(totalDias / 30);
    const semanas = Math.floor((totalDias % 30) / 7);
    
    return `- ${meses}mon ${semanas}w`;
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
function favoritarTicket() {
    alert("Favoritado!");
}

function compartilharTicket() {
    alert("Link copiado!");
}

function editarTicket() {
    alert("Modo edição ativado!");
}

function focarResposta() {
    const campo = document.getElementById("respostaInline");
    if (campo) campo.focus();
}

function associarTicket() {
    alert("Associar ticket!");
}

function enviarRespostaOnline() {
    const campo = document.getElementById("respostaInline");
    const inputFile = document.getElementById("anexoInline");

    if (!campo) return;

    const texto = campo.value;

    // validação correta
    if (!texto && inputFile.files.length === 0) {
        alert("Digite uma mensagem ou adicione um anexo!");
        return;
}
    const lista = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    const index = lista.findIndex(t => t.id === ticketAbertoId);

    if (index === -1) return;

    lista[index].mensagens = lista[index].mensagens || [];

    const novaMensagem = {
        texto: texto,
        autor: usuarioAtivo.nome,
        data: new Date().toISOString(),
        perfil: "usuario",
        anexo: null
    };

    // SE TEM ARQUIVO
    if (inputFile.files.length > 0) {
        const file = inputFile.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            novaMensagem.anexo = {
                nome: file.name,
                tamanho: (file.size / 1024).toFixed(2) + " KB",
                conteudo: e.target.result
            };

            lista[index].mensagens.push(novaMensagem);
            localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

            campo.value = "";
            inputFile.value = "";

            carregarTickets();
        };

        reader.readAsDataURL(file);
    } else {
        // SEM ANEXO
        lista[index].mensagens.push(novaMensagem);
        localStorage.setItem('tickets_gesistec', JSON.stringify(lista));

        campo.value = "";
        carregarTickets();
    }
}


function baixarAnexo(base64, nome) {
    const a = document.createElement("a");
    a.href = base64;
    a.download = nome;
    a.click();
}

// Inicialização
carregarTickets();