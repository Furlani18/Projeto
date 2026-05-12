const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
// Aumentado para 50mb para suportar anexos em Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'gesistec_db'
});

// ==========================================
// 1. LOGIN
// ==========================================
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    const sql = `SELECT 
                    NRO_EMPRESA as id_empresa, 
                    DES_NOME as nome, 
                    DES_LOGIN as email, 
                    FLG_TIP_COL as tipo 
                 FROM colaborador 
                 WHERE DES_LOGIN = ? AND DES_SENHA = ?`;

    db.query(sql, [email, senha], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            const user = results[0];
            let perfilTraduzido = 'cliente';

            if (user.tipo === 'A') perfilTraduzido = 'admin';
            else if (user.tipo === 'E') perfilTraduzido = 'colaborador';
            else if (user.tipo === 'C') perfilTraduzido = 'cliente';

            res.json({
                id: user.id_empresa,
                nome: user.nome,
                email: user.email,
                perfil: perfilTraduzido
            });
        } else {
            res.status(401).json({ message: "Usuário ou senha incorretos!" });
        }
    });
});

/// ==========================================
// 2. TICKETS
// ==========================================

// LISTAR TICKETS (Agora buscando o nome da empresa)
// BUSCAR TICKETS (Com o JOIN para pegar o prazo de dias)
app.get('/api/tickets', (req, res) => {
    const { login } = req.query;
    
    // Adicionamos t.QTD_DIAS e o JOIN com tipo_ticket
    let sql = `
        SELECT 
            t.NRO_TICKET as id, 
            t.DES_TICKET as assunto, 
            t.DES_LOGIN as email_usuario, 
            e.NOM_EMPRESA as nome_empresa, 
            t.DES_STATUS as status, 
            t.DES_PRIORIDADE as prioridade, 
            t.DAT_ABERTURA as data,
            t.NRO_TIPO as nro_tipo,
            tt.QTD_DIAS as prazo_dias -- <--- Pegando o prazo da tabela tipo_ticket
        FROM ticket t
        LEFT JOIN colaborador c ON t.DES_LOGIN = c.DES_LOGIN
        LEFT JOIN empresa e ON c.NRO_EMPRESA = e.NRO_EMPRESA
        LEFT JOIN tipo_ticket tt ON t.NRO_TIPO = tt.NRO_TIPO -- <--- Unindo as tabelas
    `;

    const params = [];
    if (login) {
        sql += ` WHERE t.DES_LOGIN = ?`;
        params.push(login);
    }
    sql += ` ORDER BY t.NRO_TICKET DESC`;

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("ERRO NO SQL:", err.sqlMessage);
            return res.status(500).json({ error: err.sqlMessage });
        }
        res.json(results);
    });
});

app.post('/api/tickets', (req, res) => {
    const { assunto, prioridade, login, tipo_id, anexo } = req.body;
    if (!assunto || !login || !tipo_id) {
        return res.status(400).json({ error: 'Assunto, login e tipo de chamado são obrigatórios.' });
    }

    const sqlInsertTicket = `INSERT INTO ticket (DES_TICKET, DES_PRIORIDADE, DES_LOGIN, DES_STATUS, NRO_TIPO, DAT_ABERTURA) VALUES (?, ?, ?, 'Pendente', ?, NOW())`;
    db.query(sqlInsertTicket, [assunto, prioridade || 'Média', login, tipo_id], (ticketErr, ticketResult) => {
        if (ticketErr) {
            console.error('Erro ao criar ticket:', ticketErr.message);
            return res.status(500).json({ error: ticketErr.message });
        }

        const ticketId = ticketResult.insertId;
        if (!anexo) {
            return res.json({ message: 'Chamado aberto com sucesso!', id: ticketId });
        }

        const sqlInsertAtende = `INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, DOC_ANEXO, NRO_TICKET, DES_LOGIN) VALUES (NOW(), ?, 'A', ?, ?, ?)`;
        db.query(sqlInsertAtende, ['Anexo enviado no primeiro contato', anexo, ticketId, login], (atendeErr) => {
            if (atendeErr) {
                console.error('Erro ao salvar anexo inicial:', atendeErr.message);
                return res.status(500).json({ error: atendeErr.message });
            }
            res.json({ message: 'Chamado aberto com sucesso!', id: ticketId });
        });
    });
});

// ==========================================
// 3. MENSAGENS / CHAT
// ==========================================

// BUSCAR MENSAGENS DE UM TICKET (Com JOIN para pegar o Nome do Autor)
app.get('/api/mensagens/:ticketId', (req, res) => {
    const { ticketId } = req.params;
    
    const sql = `
        SELECT 
            a.DES_LOGIN as email_autor, 
            c.DES_NOME as nome_autor, 
            a.DAT_ATENDE as data, 
            a.DES_ATENDE as texto, 
            a.DOC_ANEXO as anexo, 
            a.NRO_ATENDE as id 
        FROM atende a
        LEFT JOIN colaborador c ON a.DES_LOGIN = c.DES_LOGIN
        WHERE a.NRO_TICKET = ? 
        ORDER BY a.NRO_ATENDE ASC`;

    db.query(sql, [ticketId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const mensagensFormatadas = results.map(row => ({
            id: row.id,
            data: row.data,
            texto: row.texto,
            email_autor: row.email_autor,
            autor_display: row.nome_autor || row.email_autor,
            anexo: row.anexo ? row.anexo.toString('utf-8') : null
        }));
        
        res.json(mensagensFormatadas);
    });
});

// ENVIAR MENSAGEM NO CHAT
app.post('/api/mensagens', (req, res) => {
    const { ticket_id, autor, texto, anexo_conteudo } = req.body;

    const sql = `
        INSERT INTO atende (DAT_ATENDE, DES_ATENDE, FLG_ESTADO, DOC_ANEXO, NRO_TICKET, DES_LOGIN) 
        VALUES (NOW(), ?, 'A', ?, ?, ?)`;

    db.query(sql, [texto, anexo_conteudo, ticket_id, autor], (err, result) => {
        if (err) return res.status(500).json({ error: "Erro ao salvar mensagem" });
        res.json({ message: "Mensagem enviada com sucesso!", id: result.insertId });
    });
});

// ==========================================
// 4. GESTÃO DE USUÁRIOS
// ==========================================

app.get('/api/usuarios', (req, res) => {
    const sql = `SELECT c.DES_NOME as nome, c.DES_LOGIN as email, c.FLG_TIP_COL as tipo_flag, e.NOM_EMPRESA as empresa FROM colaborador c LEFT JOIN empresa e ON c.NRO_EMPRESA = e.NRO_EMPRESA`;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        
        const listaTraduzida = data.map(user => ({
            nome: user.nome,
            email: user.email,
            perfil: user.tipo_flag === 'A' ? 'Admin' : user.tipo_flag === 'E' ? 'Colaborador' : 'Cliente',
            empresa: user.empresa || '---'
        }));
        res.json(listaTraduzida);
    });
});

app.post('/api/usuarios', (req, res) => {
    const { nome, email, senha, perfil, nro_empresa } = req.body;
    let flag = perfil === 'admin' ? 'A' : (perfil === 'colaborador' ? 'E' : 'C');

    if (!nome || !email || !senha || !nro_empresa) {
        return res.status(400).json({ error: 'Nome, email, senha e empresa são obrigatórios.' });
    }

    const sql = `INSERT INTO colaborador (DES_NOME, DES_LOGIN, DES_SENHA, NRO_EMPRESA, FLG_TIP_COL) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [nome, email, senha, nro_empresa, flag], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Usuário gravado com sucesso!" });
    });
});

app.delete('/api/usuarios/:email', (req, res) => {
    db.query("DELETE FROM colaborador WHERE DES_LOGIN = ?", [req.params.email], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Acesso removido!" });
    });
});

// ==========================================
// 5. GESTÃO DE EMPRESAS
// ==========================================

app.get('/api/empresas', (req, res) => {
    const sql = `SELECT NRO_EMPRESA as id, NOM_EMPRESA as nome, NRO_CNPJ as cnpj, NOM_CIDADE as cidade, DES_ENDERECO as endereco, NRO_CEP as cep, FLG_EMP as tipo FROM empresa ORDER BY NRO_EMPRESA DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/empresas', (req, res) => {
    const { nome, cnpj, cidade, endereco, cep, flg_emp } = req.body;
    if (!nome || !cnpj || !cidade || !endereco || !cep || !flg_emp) {
        return res.status(400).json({ error: 'Todos os campos da empresa são obrigatórios.' });
    }
    const sql = `INSERT INTO empresa (NOM_EMPRESA, NRO_CNPJ, NOM_CIDADE, DES_ENDERECO, NRO_CEP, FLG_EMP) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [nome, cnpj, cidade, endereco, cep, flg_emp], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empresa cadastrada com sucesso!', id: result.insertId });
    });
});

app.delete('/api/empresas/:id', (req, res) => {
    const sql = `DELETE FROM empresa WHERE NRO_EMPRESA = ?`;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Empresa removida com sucesso!' });
    });
});

// ==========================================
// 6. GESTÃO DE TIPOS DE CHAMADOS
// ==========================================

app.get('/api/tipos-ticket', (req, res) => {
    const sql = `SELECT NRO_TIPO as id, DES_TIPO as nome, QTD_DIAS as prazo_dias FROM tipo_ticket ORDER BY NRO_TIPO DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/tipos-ticket', (req, res) => {
    const { nome, prazo_dias } = req.body;
    if (!nome || prazo_dias == null) {
        return res.status(400).json({ error: 'Nome e prazo são obrigatórios.' });
    }
    const sql = `INSERT INTO tipo_ticket (DES_TIPO, QTD_DIAS) VALUES (?, ?)`;
    db.query(sql, [nome, prazo_dias], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipo de chamado cadastrado com sucesso!', id: result.insertId });
    });
});

app.delete('/api/tipos-ticket/:id', (req, res) => {
    const sql = `DELETE FROM tipo_ticket WHERE NRO_TIPO = ?`;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tipo de chamado removido com sucesso!' });
    });
});

// ATUALIZAR STATUS DO TICKET (Cancelar ou Finalizar)
app.put('/api/tickets/:id/status', (req, res) => {
    const { id } = req.params;
    const { novoStatus } = req.body; // 'C' para Cancelado, 'F' para Finalizado

    const sql = `UPDATE ticket SET DES_STATUS = ? WHERE NRO_TICKET = ?`;

    db.query(sql, [novoStatus, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Status atualizado com sucesso!" });
    });
});

app.listen(3000, () => console.log("🚀 Servidor GESISTEC rodando na porta 3000"));