const { google } = require('googleapis');
const { readFileSync, existsSync, writeFileSync, mkdirSync, createWriteStream } = require('fs');
const { createInterface } = require('readline');
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos 
app.use(express.static(path.join(__dirname, 'public')));

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Função para autenticar via OAuth 2.0
async function authenticate(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (existsSync(TOKEN_PATH)) {
        const token = readFileSync(TOKEN_PATH, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    }

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Abra este URL para autenticação:', authUrl);
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const code = await new Promise(resolve => rl.question('Digite o código da URL de autenticação: ', resolve));
    rl.close();

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token armazenado em', TOKEN_PATH);
    return oAuth2Client;
}

// Função para listar arquivos de uma pasta específica
async function listFilesInFolder(auth, folderId) {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name)',
        spaces: 'drive'
    });

    const files = res.data.files;
    return files;
}

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Rota para listar arquivos
app.get('/list-files', async (req, res) => {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const auth = await authenticate(credentials);
    const folderId = '1W6ql2w0aJgqso_t6ZprP5Iy3m9WZcsbM'; // Substitua pelo ID da pasta que você deseja listar
    const files = await listFilesInFolder(auth, folderId);
    res.json(files);
});


// Rota para baixar arquivos
app.get('/download-file', async (req, res) => {
    const fileId = req.query.fileId;
    const fileName = req.query.fileName;

    // Verifique se fileId e fileName foram fornecidos
    if (!fileId || !fileName) {
        return res.status(400).send('ID do arquivo e nome do arquivo são necessários.');
    }

    const auth = await authenticate(JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8')));
    const drive = google.drive({ version: 'v3', auth });

    const userHomeDir = process.env.HOME || process.env.USERPROFILE; // Diretório do usuário
    const destPath = path.join(userHomeDir, 'Downloads', fileName); // Caminho para a pasta Downloads

    // Verifique e crie o diretório "Downloads" se não existir
    const dirPath = path.join(userHomeDir, 'Downloads'); 
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }

    const dest = createWriteStream(destPath);
    
    drive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'stream' }, (err, response) => {
        if (err) return res.status(500).send('Erro ao baixar o arquivo');

        response.data.pipe(dest);

        dest.on('finish', () => {
            res.download(destPath, fileName, (err) => {
                if (err) {
                    console.error('Erro ao enviar o arquivo:', err);
                    res.status(500).send('Erro ao enviar o arquivo');
                } else {
                    console.log('Arquivo enviado com sucesso');
                }
            });
        });

        dest.on('error', (err) => {
            console.error('Erro durante o download', err);
            res.status(500).send('Erro durante o download');
        });
    });
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
