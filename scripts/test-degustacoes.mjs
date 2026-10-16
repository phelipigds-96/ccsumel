/**
 * Script de Verificação e Testes Automatizados — Módulo Degustações
 * Executável via: "C:\Users\Phelipi\AppData\Roaming\Antigravity\bin\agy-node.cmd" scripts/test-degustacoes.mjs
 */

const SUPABASE_URL = "https://nmybjbesqozxlcamcelt.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_E3UMP6eiHHVsiPhIumI0vw_Rq1rAe5d";

// Leitura de argumentos da linha de comando
const args = process.argv.slice(2);
let token = "";
let user = "";
let password = "";

for (const arg of args) {
  if (arg.startsWith("--token=")) token = arg.split("=")[1];
  if (arg.startsWith("--user=")) user = arg.split("=")[1];
  if (arg.startsWith("--password=")) password = arg.split("=")[1];
}

console.log("=================================================================");
console.log("SUITE DE TESTES DO BANCO DE DADOS — MÓDULO DEGUSTAÇÕES");
console.log("URL:", SUPABASE_URL);
console.log("=================================================================\n");

async function apiRequest(path, method = "GET", body = null, authToken = null) {
  const headers = {
    "apikey": PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else {
    headers["Authorization"] = `Bearer ${PUBLISHABLE_KEY}`;
  }

  const options = {
    method,
    headers,
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}${path}`, options);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log("--- BATERIA 1: Validação de Existência de Tabelas e Bloqueio Anon ---");
  
  // 1.1 SELECT em degustacoes como anon
  const selDeg = await apiRequest("/rest/v1/degustacoes?select=*");
  console.log(`[1.1] SELECT public.degustacoes (anon): HTTP ${selDeg.status} (${selDeg.data?.message || selDeg.data?.code})`);
  if (selDeg.status === 401 && selDeg.data?.code === "42501") {
    console.log("  -> [PASSOU] Tabela existe e privilégios anon estão revogados com sucesso.");
  } else {
    console.log("  -> [FALHOU]", selDeg);
  }

  // 1.2 SELECT em degustacao_produtos como anon
  const selProd = await apiRequest("/rest/v1/degustacao_produtos?select=*");
  console.log(`[1.2] SELECT public.degustacao_produtos (anon): HTTP ${selProd.status} (${selProd.data?.message || selProd.data?.code})`);
  if (selProd.status === 401 && selProd.data?.code === "42501") {
    console.log("  -> [PASSOU] Tabela de produtos existe e protegida contra anon.");
  } else {
    console.log("  -> [FALHOU]", selProd);
  }

  // 1.3 SELECT em degustacoes_historico como anon
  const selHist = await apiRequest("/rest/v1/degustacoes_historico?select=*");
  console.log(`[1.3] SELECT public.degustacoes_historico (anon): HTTP ${selHist.status} (${selHist.data?.message || selHist.data?.code})`);
  if (selHist.status === 401 && selHist.data?.code === "42501") {
    console.log("  -> [PASSOU] Tabela de histórico existe e protegida contra anon.");
  } else {
    console.log("  -> [FALHOU]", selHist);
  }

  // 1.4 Tentativa de INSERT como anon
  const insDeg = await apiRequest("/rest/v1/degustacoes", "POST", { nome: "Hacker" });
  console.log(`[1.4] INSERT public.degustacoes (anon): HTTP ${insDeg.status} (${insDeg.data?.message || insDeg.data?.code})`);
  if (insDeg.status === 401 && insDeg.data?.code === "42501") {
    console.log("  -> [PASSOU] Escrita por anon bloqueada em nível SQL.");
  } else {
    console.log("  -> [FALHOU]", insDeg);
  }

  // 1.5 Tentativa de INSERT no histórico como anon
  const insHist = await apiRequest("/rest/v1/degustacoes_historico", "POST", { acao: "Invasao" });
  console.log(`[1.5] INSERT public.degustacoes_historico (anon): HTTP ${insHist.status} (${insHist.data?.message || insHist.data?.code})`);
  if (insHist.status === 401 && insHist.data?.code === "42501") {
    console.log("  -> [PASSOU] Inserção direta em histórico bloqueada para anon.");
  } else {
    console.log("  -> [FALHOU]", insHist);
  }

  // Se foram fornecidas credenciais para autenticação:
  if (!token && user && password) {
    console.log("\n--- Autenticando com credenciais informadas... ---");
    const email = user.includes("@") ? user : `${user.trim().toLowerCase()}@sumel.local`;
    const authRes = await apiRequest("/auth/v1/token?grant_type=password", "POST", {
      email,
      password,
    });
    if (authRes.ok && authRes.data?.access_token) {
      token = authRes.data.access_token;
      console.log(`Autenticado com sucesso como: ${email} (User ID: ${authRes.data.user?.id})`);
    } else {
      console.error("Falha na autenticação:", authRes.data);
    }
  }

  if (token) {
    console.log("\n--- BATERIA 2: Testes com Sessão Autenticada ---");

    // 2.1 Leitura Global (SELECT)
    const listRes = await apiRequest("/rest/v1/degustacoes?select=*", "GET", null, token);
    console.log(`[2.1] SELECT public.degustacoes (Autenticado): HTTP ${listRes.status}`);
    if (listRes.ok && Array.isArray(listRes.data)) {
      console.log(`  -> [PASSOU] Leitura global permitida para usuário autenticado. Registros retornados: ${listRes.data.length}`);
    } else {
      console.log("  -> [AVISO/FALHOU]", listRes.data);
    }

    // 2.2 Tentativa de Inserção direta em degustacoes_historico (deve ser BLOQUEADA mesmo autenticado!)
    const insHistAuth = await apiRequest("/rest/v1/degustacoes_historico", "POST", {
      acao: "Insercao Manual Proibida",
      degustacao_id_original: "00000000-0000-0000-0000-000000000000",
      degustacao_nome: "Teste",
      status_novo: "Programada",
      changed_by_name: "Tester"
    }, token);
    console.log(`[2.2] INSERT direto em public.degustacoes_historico (Autenticado): HTTP ${insHistAuth.status}`);
    if (insHistAuth.status === 401 || insHistAuth.status === 403 || insHistAuth.data?.code === "42501") {
      console.log("  -> [PASSOU] Inserção direta no histórico foi rejeitada com sucesso (apenas triggers podem gravar)!");
    } else {
      console.log("  -> [ALERTA DE SEGURANÇA: Inserção direta permitida]", insHistAuth);
    }

    // Buscar um fornecedor real existente para vincular
    const fornRes = await apiRequest("/rest/v1/fornecedores?select=id,nome&limit=1", "GET", null, token);
    const fornecedor = (fornRes.data && fornRes.data[0]) ? fornRes.data[0] : null;

    if (fornecedor) {
      console.log(`\nUsando Fornecedor de Teste: ${fornecedor.nome} (${fornecedor.id})`);

      // 2.3 Criação de Agendamento por Master
      console.log("\n[2.3] Teste de Criação de Degustação:");
      const newDegustacao = {
        nome: "Degustação Automatizada de Teste - Suite",
        loja: "Matriz",
        fornecedor_id: fornecedor.id,
        fornecedor_nome: fornecedor.nome,
        data: new Date().toISOString().split("T")[0],
        horario_inicio: "10:00:00",
        horario_fim: "12:00:00",
        responsavel_nome: "Promotor Teste",
        status: "Programada",
        justificativa_alteracao: "Agendamento de teste de validação"
      };

      const createRes = await apiRequest("/rest/v1/degustacoes", "POST", newDegustacao, token);
      console.log(`  Criação: HTTP ${createRes.status}`);

      if (createRes.status === 201 || createRes.status === 200 || createRes.ok) {
        console.log("  -> [PASSOU] Usuário possui perfil Master e criou agendamento.");
        
        // Buscar o ID criado
        const findRes = await apiRequest(`/rest/v1/degustacoes?nome=eq.${encodeURIComponent(newDegustacao.nome)}&order=created_at.desc&limit=1`, "GET", null, token);
        const createdId = findRes.data?.[0]?.id;

        if (createdId) {
          console.log(`  -> ID da Degustação criada: ${createdId}`);

          // 2.4 Verificar se a justificativa foi resetada para NULL no cabeçalho
          const degRow = findRes.data[0];
          console.log(`[2.4] Verificação de Justificativa Transiente na linha principal:`, degRow.justificativa_alteracao === null ? "[PASSOU] Campo está NULL (não vazou)" : `[ALERTA] ${degRow.justificativa_alteracao}`);

          // 2.5 Verificar se o histórico registrou a Criação
          const histRes = await apiRequest(`/rest/v1/degustacoes_historico?degustacao_id=eq.${createdId}`, "GET", null, token);
          const histEvent = histRes.data?.[0];
          if (histEvent && histEvent.acao === "Criação") {
            console.log(`[2.5] Auditoria de Criação: [PASSOU] Ação: "${histEvent.acao}", Autor: "${histEvent.changed_by_name}", Obs: "${histEvent.observacao}"`);
          } else {
            console.log(`[2.5] Auditoria de Criação: [FALHOU/NÃO ENCONTRADO]`, histRes.data);
          }

          // 2.6 Adicionar Produto com quantidade e preço
          console.log("\n[2.6] Teste de Adição de Produto e Cálculo Financeiro:");
          const itemRes = await apiRequest("/rest/v1/degustacao_produtos", "POST", {
            degustacao_id: createdId,
            descricao: "Chocolate Trufado Teste 100g",
            preco_base: 10.00,
            preco_praticado: 8.50,
            quantidade_vendida: 12.000,
            observacoes: "Item de teste automatizado"
          }, token);
          console.log(`  Adição de item: HTTP ${itemRes.status}`);

          // Buscar o item criado
          const getItemRes = await apiRequest(`/rest/v1/degustacao_produtos?degustacao_id=eq.${createdId}`, "GET", null, token);
          const item = getItemRes.data?.[0];
          if (item) {
            console.log(`  -> Item faturamento_total calculado: R$ ${item.faturamento_total} (Esperado: 12 * 8.50 = 102.00)`);
            if (Number(item.faturamento_total) === 102.00) {
              console.log("  -> [PASSOU] Trigger fn_degustacao_produtos_calc calculou faturamento com exatidão.");
            } else {
              console.log("  -> [FALHOU NO CÁLCULO]", item);
            }

            // 2.7 Sincronização no Cabeçalho
            const parentCheck = await apiRequest(`/rest/v1/degustacoes?id=eq.${createdId}`, "GET", null, token);
            const parentRow = parentCheck.data?.[0];
            console.log(`[2.7] Totais no Cabeçalho: Faturamento: R$ ${parentRow?.faturamento_total_calculado}, Qtd: ${parentRow?.quantidade_total_vendida}`);
            if (Number(parentRow?.faturamento_total_calculado) === 102.00 && Number(parentRow?.quantidade_total_vendida) === 12.000) {
              console.log("  -> [PASSOU] Trigger fn_sync_degustacao_totais sincronizou totais perfeitamente no cabeçalho.");
            } else {
              console.log("  -> [FALHOU NA SINCRONIZAÇÃO]", parentRow);
            }

            // 2.8 Bloqueio de Transferência de Produto entre Degustações
            console.log("\n[2.8] Teste de Bloqueio de Transferência de Produto:");
            const fakeId = "11111111-1111-1111-1111-111111111111";
            const transferRes = await apiRequest(`/rest/v1/degustacao_produtos?id=eq.${item.id}`, "PATCH", {
              degustacao_id: fakeId
            }, token);
            console.log(`  Tentativa de transferir item: HTTP ${transferRes.status} (${transferRes.data?.message || transferRes.data?.code})`);
            if (!transferRes.ok && (transferRes.data?.message?.includes("transferir") || transferRes.status === 400 || transferRes.status === 500)) {
              console.log("  -> [PASSOU] Transferência de produto foi bloqueada pelo trigger de integridade.");
            } else {
              console.log("  -> [FALHOU: Permitiu transferir ou erro inesperado]", transferRes);
            }
          }

          // 2.9 Tentativa de Exclusão Física com Vendas Registradas
          console.log("\n[2.9] Teste de Bloqueio de Exclusão Física com Vendas:");
          const delRes = await apiRequest(`/rest/v1/degustacoes?id=eq.${createdId}`, "DELETE", null, token);
          console.log(`  Tentativa de DELETE em degustação com vendas: HTTP ${delRes.status} (${delRes.data?.message || delRes.data?.code})`);
          if (!delRes.ok && (delRes.data?.message?.includes("excluir fisicamente") || delRes.status === 400 || delRes.status === 500)) {
            console.log("  -> [PASSOU] Trigger fn_degustacoes_prevent_delete bloqueou exclusão física.");
          } else {
            console.log("  -> [FALHOU]", delRes);
          }

          // 2.10 Cancelamento com Justificativa
          console.log("\n[2.10] Teste de Cancelamento com Justificativa:");
          const cancelSemJust = await apiRequest(`/rest/v1/degustacoes?id=eq.${createdId}`, "PATCH", {
            status: "Cancelada"
          }, token);
          console.log(`  Cancelamento sem justificativa: HTTP ${cancelSemJust.status} (${cancelSemJust.data?.message || cancelSemJust.data?.code})`);
          if (!cancelSemJust.ok && cancelSemJust.data?.message?.includes("justificativa")) {
            console.log("  -> [PASSOU] Cancelamento sem justificativa foi rejeitado.");
          } else {
            console.log("  -> [FALHOU: Permitiu cancelar sem justificativa]", cancelSemJust);
          }

          const cancelComJust = await apiRequest(`/rest/v1/degustacoes?id=eq.${createdId}`, "PATCH", {
            status: "Cancelada",
            justificativa_alteracao: "Cancelamento pelo teste automatizado de homologação"
          }, token);
          console.log(`  Cancelamento com justificativa: HTTP ${cancelComJust.status}`);
          if (cancelComJust.ok || cancelComJust.status === 204 || cancelComJust.status === 200) {
            console.log("  -> [PASSOU] Cancelamento efetuado com sucesso.");

            // Verificar se o evento de cancelamento gravou a justificativa
            const histCancel = await apiRequest(`/rest/v1/degustacoes_historico?degustacao_id=eq.${createdId}&acao=eq.Cancelamento`, "GET", null, token);
            const cancelEvent = histCancel.data?.[0];
            if (cancelEvent && cancelEvent.justificativa?.includes("homologação")) {
              console.log(`  -> [PASSOU] Histórico gravou justificativa única de cancelamento: "${cancelEvent.justificativa}"`);
            } else {
              console.log("  -> [FALHOU NO HISTÓRICO]", histCancel.data);
            }
          }
        }
      } else if (createRes.status === 401 || createRes.status === 403 || createRes.data?.code === "42501") {
        console.log("  -> [RESULTADO] O usuário autenticado NÃO é Master ativo (permissão de escrita negada por RLS). Comportamento de Usuário Comum verificado!");
      } else {
        console.log("  -> [RESPOSTA DE CRIAÇÃO]", createRes);
      }
    } else {
      console.log("Nenhum fornecedor encontrado para testar criação de agendamento.");
    }
  } else {
    console.log("\n[INFO] Para executar a Bateria 2 (testes autenticados de escrita Master, cálculos e integridade):");
    console.log("Passe: --user=<login> --password=<senha>  OU  --token=<jwt_access_token>");
  }

  console.log("\n=================================================================");
  console.log("FINAL DA EXECUÇÃO DOS TESTES");
  console.log("=================================================================");
}

runTests().catch(console.error);
