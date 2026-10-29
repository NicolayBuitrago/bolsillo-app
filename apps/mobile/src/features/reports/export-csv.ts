import { type ApiClient, api } from '@bolsillo/api-client';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Downloads the CSV of all transactions, saves it in the app cache and opens
 * the share sheet (Drive, correo, WhatsApp…). The file stays only in the
 * app's cache directory.
 */
export async function exportTransactionsCsv(client: ApiClient, today: string): Promise<void> {
  const csv = await api.fetchTransactionsCsv(client);
  const file = new File(Paths.cache, `bolsillo-movimientos-${today}.csv`);
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Exportar movimientos',
  });
}
