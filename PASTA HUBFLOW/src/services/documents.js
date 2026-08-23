// src/services/documents.js
//
// Documentos reais no Supabase Storage (bucket privado `documents`, ver
// supabase/migrations/0010_..._storage.sql e 0022_documents_extend.sql).
// O binário nunca passa pelo banco — só pelo Storage. A tabela `documents`
// guarda metadados e é o que a UI lista; o Storage guarda o arquivo em si,
// no caminho {organization_id}/{entity_type}/{entity_id}/{arquivo}, que é
// exatamente o que as policies de storage.objects usam para checar que o
// usuário pertence à organização (storage.foldername(name)[1]).
//
// entity_type aceito pela constraint do banco: customer, quote, work_order,
// supplier, profile, organization, financial (ver 0022_documents_extend.sql).

import { supabase } from './supabaseClient.js';

const BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutos — só o tempo de abrir/baixar

function sanitizeFileName(name) {
  return name.replace(/[^\w.\-]+/g, '_');
}

function documentFromDb(row) {
  return {
    id: row.id,
    nomeOriginal: row.original_name,
    caminho: row.storage_path,
    bucket: row.bucket,
    tipoMime: row.mime_type || '',
    tamanhoBytes: row.size_bytes || 0,
    entidadeTipo: row.entity_type,
    entidadeId: row.entity_id,
    categoria: row.category || '',
    descricao: row.description || '',
    criadoPor: row.uploaded_by,
    criadoEm: row.created_at,
  };
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export const documentsApi = {
  /** Lista documentos anexados a uma entidade específica (cliente, orçamento, OS, fornecedor...). */
  list: async (entityType, entityId) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(documentFromDb);
  },

  /** Lista os documentos mais recentes da organização inteira (usado pela página Documentos). */
  listRecent: async (organizationId, { entityType = '', search = '', limit = 100 } = {}) => {
    let query = supabase.from('documents').select('*').eq('organization_id', organizationId);
    if (entityType) query = query.eq('entity_type', entityType);
    if (search) query = query.or(`original_name.ilike.%${search}%,category.ilike.%${search}%`);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data.map(documentFromDb);
  },

  /** Envia um arquivo (File do input) para o Storage e registra o metadado. */
  upload: async (organizationId, entityType, entityId, file, { category = '', description = '' } = {}) => {
    const userId = await currentUserId();
    const storageName = `${Date.now()}_${sanitizeFileName(file.name)}`;
    const storagePath = `${organizationId}/${entityType}/${entityId}/${storageName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('documents')
      .insert({
        organization_id: organizationId,
        original_name: file.name,
        storage_name: storageName,
        storage_path: storagePath,
        bucket: BUCKET,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        entity_type: entityType,
        entity_id: entityId,
        category: category || null,
        description: description || null,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (error) {
      // Não deixa arquivo órfão no Storage se o registro de metadado falhar.
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }
    return documentFromDb(data);
  },

  /** URL assinada temporária para abrir/baixar (bucket é privado — não há URL pública). */
  getSignedUrl: async (doc) => {
    const { data, error } = await supabase.storage
      .from(doc.bucket || BUCKET)
      .createSignedUrl(doc.caminho, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  },

  remove: async (doc) => {
    const { error: storageError } = await supabase.storage.from(doc.bucket || BUCKET).remove([doc.caminho]);
    if (storageError) throw storageError;
    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
    if (error) throw error;
  },
};
