// src/data/mockData.js
//
// ⚠️ DADOS MOCK — não é banco de dados real.
//
// Clientes, orçamentos, ordens de serviço e financeiro já foram conectados
// ao Supabase (ver src/services/api.js, quotes.js, workOrders.js,
// financial.js) e não usam mais nada deste arquivo. O que resta aqui é só
// `documentos`, que segue mock até a Fase 7 (Supabase Storage) conectar
// upload de arquivos de verdade — ver docs/BACKEND.md.

export const documentos = [
  // Vazio por padrão: upload real de arquivo exige storage de backend (Supabase Storage),
  // que ainda não está conectado neste ambiente.
];
