const { google } = require('googleapis');
const { readFileSync, existsSync, writeFileSync, createWriteStream } = require('fs');
const { createInterface } = require('readline');

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
    // Aqui você deve incluir a parte que lida com a autenticação

    // Após a autenticação, você deve salvar o token
    // e retornar o oAuth2Client
}

// Função para listar arquivos
async function listAllFiles(auth) {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name)',
    });

    const files = res.data.files;

    if (files.length === 0) {
        console.log('Nenhum arquivo encontrado.');
    } else {
        console.log('Arquivos encontrados:');
        files.forEach((file) => {
            console.log(`${file.name} (ID: ${file.id})`);
        });
    }
}

// Função para baixar um arquivo
async function downloadFile(auth, fileId, destPath) {
    const drive = google.drive({ version: 'v3', auth });
    const dest = createWriteStream(destPath);
    const res = await drive.files.get({
        fileId: fileId,
        alt: 'media',
    }, { responseType: 'stream' });

    res.data
        .on('end', () => {
            console.log('Download concluído.');
        })
        .on('error', (err) => {
            console.error('Erro durante o download', err);
        })
        .pipe(dest);
}

// Função principal
async function main() {
    const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const auth = await authenticate(credentials);

    // Listar todos os arquivos no Google Drive
    await listAllFiles(auth);

    // Após listar, você pode baixar um arquivo específico usando seu ID
    const fileId = '1XyEEgqKURhNSdHzudDuw29MBGAYxS40P'; // Substitua pelo ID do arquivo que deseja baixar
    const destPath = 'C:/Users/ead/Documents/GitHub/ProjectOraculo/meu_arquivo.png'; // Substitua pelo caminho e nome do arquivo
    await downloadFile(auth, fileId, destPath);
}

// Chame a função principal
main().catch(console.error);
