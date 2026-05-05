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
    const sql = `SELECT DES_NOME as nome, DES_LOGIN as email, FLG_TIP_COL as tipo_flag FROM colaborador`;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json(err);
        
        const listaTraduzida = data.map(user => ({
            nome: user.nome,
            email: user.email,
            perfil: user.tipo_flag === 'A' ? 'Admin' : user.tipo_flag === 'E' ? 'Colaborador' : 'Cliente'
        }));
        res.json(listaTraduzida);
    });
});

app.post('/api/usuarios', (req, res) => {
    const { nome, email, senha, perfil } = req.body;
    let flag = perfil === 'admin' ? 'A' : (perfil === 'colaborador' ? 'E' : 'C');
    let nroEmpresa = (perfil === 'cliente') ? 2 : 1; 

    const sql = `INSERT INTO colaborador (DES_NOME, DES_LOGIN, DES_SENHA, NRO_EMPRESA, FLG_TIP_COL) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [nome, email, senha, nroEmpresa, flag], (err, result) => {
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

app.listen(3000, () => console.log("🚀 Servidor GESISTEC rodando na porta 3000"));