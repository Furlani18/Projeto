// Verificação de Segurança e Sessão
const usuarioSessao = JSON.parse(localStorage.getItem('sessao_ativa'));

if (!usuarioSessao || usuarioSessao.perfil !== 'colaborador') {
    window.location.href = 'index.html';
}

// Inicialização da tela
document.getElementById('nomeAdmin').innerText = `Gestor: ${usuarioSessao.nome}`;
document.getElementById('dataAtual').innerText = new Date().toLocaleDateString('pt-BR');

function carregarEstatisticas() {
    const tickets = JSON.parse(localStorage.getItem('tickets_gesistec')) || [];
    
    // Filtros de Status conforme requisitos 
    const abertos = tickets.length;
    const pendentes = tickets.filter(t => t.status === 'Pendente').length;
    const finalizados = tickets.filter(t => t.status === 'Finalizado').length;

    document.getElementById('totalAbertos').innerText = abertos;
    document.getElementById('totalPendentes').innerText = pendentes;
    document.getElementById('totalFinalizados').innerText = finalizados;

    gerarSimulacaoGrafico(tickets);
}

function gerarSimulacaoGrafico(tickets) {
    const container = document.getElementById('listaGrafico');
    
    if (tickets.length === 0) return;

    // Agrupa tickets por cliente para o gráfico 
    const contagemPorCliente = tickets.reduce((acc, t) => {
        const nome = t.emailCliente.split('@')[0]; // Pega o nome antes do @
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
    }, {});

    container.innerHTML = ''; // Limpa placeholder
    
    for (const [cliente, qtd] of Object.entries(contagemPorCliente)) {
        const alturaBarra = qtd * 30; // Escala visual
        container.innerHTML += `
            <div class="bar" style="height: ${alturaBarra}px" title="${cliente}">
                <span>${qtd}</span>
                <p style="margin-top: ${alturaBarra + 10}px; font-size: 0.7rem;">${cliente}</p>
            </div>
        `;
    }
}

function logout() {
    localStorage.removeItem('sessao_ativa');
    window.location.href = 'index.html';
}

// Atualiza dados ao carregar
carregarEstatisticas();