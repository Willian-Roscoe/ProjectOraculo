// Importar bibliotecas necessárias
const { google } = require('./node_modules/googleapis/build/src/index'); // ajuste o caminho se necessário
const open = require('./node_modules/open/index'); // ajuste o caminho se necessário
const { readFileSync, existsSync, writeFileSync } = require('fs'); // Usando CommonJS
const { createInterface } = require('readline');

// Definir o caminho do arquivo de credenciais
const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

// Escopos de acesso à API do Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Função principal para autenticar e listar arquivos
async function main() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = await authenticate(credentials);
  await listFiles(auth);
}

// Função para autenticar via OAuth 2.0
async function authenticate(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Verifica se já temos um token salvo
  if (existsSync(TOKEN_PATH)) {
    const token = readFileSync(TOKEN_PATH, 'utf-8');
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  // Se não houver token, iniciar o fluxo de autenticação
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Abra este URL para autenticação:', authUrl);
  await open(authUrl);

  // Ler o código de autenticação do usuário
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Insira o código de autenticação aqui: ', (code) => {
      rl.close();
      resolve(code);
    });
  });

  // Trocar o código por um token de acesso
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Salvar o token para futuras execuções
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('Token salvo em', TOKEN_PATH);

  return oAuth2Client;
}

// Função para listar arquivos do Google Drive
async function listFiles(auth) {
  const drive = google.drive({ version: 'v3', auth });

  // Fazer requisição para listar arquivos
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

// Executar a função principal
main().catch(console.error);
