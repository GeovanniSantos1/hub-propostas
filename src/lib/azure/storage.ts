/**
 * Utilitario Azure Blob Storage
 *
 * Gera URLs assinadas (SAS) para acesso temporario a arquivos
 * armazenados no Azure Blob Storage.
 */

import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'hub-propostas'

function getCredentials() {
  // Extrair account name e key da connection string
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/)
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/)

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error('Connection string invalida. Verifique AZURE_STORAGE_CONNECTION_STRING.')
  }

  return new StorageSharedKeyCredential(accountNameMatch[1], accountKeyMatch[1])
}

/**
 * Gera uma URL assinada (SAS) com validade temporaria para leitura de um blob.
 *
 * @param blobPath - Caminho do blob no container (ex: "ALL4LABELS/arquivo.pdf")
 * @param expiresInMinutes - Tempo de validade em minutos (padrao: 60)
 * @returns URL completa com SAS token para acesso direto ao arquivo
 */
export function generateBlobSasUrl(blobPath: string, expiresInMinutes = 60): string {
  const credential = getCredentials()
  const accountName = credential.accountName

  const startsOn = new Date()
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000)

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      contentDisposition: 'inline',
    },
    credential,
  ).toString()

  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobPath).replace(/%2F/g, '/')}?${sasToken}`
}

/**
 * Retorna uma instancia do container client para operacoes diretas.
 */
export function getContainerClient() {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  return blobServiceClient.getContainerClient(containerName)
}
