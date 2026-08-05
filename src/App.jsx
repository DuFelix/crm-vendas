import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';

// Imports do Firebase (SDK Modular)
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  setDoc,
} from 'firebase/firestore';

// Suas chaves de acesso ao Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyDJs8Gzdb2eaop_7NLFb7qSuIduyhE5DDs',
  authDomain: 'crm-vendas-4f4d2.firebaseapp.com',
  projectId: 'crm-vendas-4f4d2',
  storageBucket: 'crm-vendas-4f4d2.firebasestorage.app',
  messagingSenderId: '602048749228',
  appId: '1:602048749228:web:bd93de7fe0d618938f0909',
};

// Inicializando Firebase fora do componente para não recarregar em cada renderização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ETAPAS = {
  LEAD: '1. Lead',
  APRESENTACAO: '2. Apresentação',
  NEGOCIACAO: '3. Negociação',
  CADASTRO: '4. Cadastro / Lançamento',
  TREINAMENTO: '5. Treinamento Appgas',
  FINALIZADO: 'Finalizados',
};

const DEFAULT_MOTIVOS_PERDA = [
  '[VENDEDOR] Sem contato com o responsável',
  '[FINANCEIRO] Discorda da taxa de 8%',
  '[FINANCEIRO] Desacordo com pagamento online',
  '[CADASTRO] Falta de dados cadastrais',
  '[FINANCEIRO] Prazo de repasse',
  '[OPERACIONAL] Exclusividade com a bandeira da distribuidora',
];

const CORES_GRAFICO = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function App() {
  const [vendedor, setVendedor] = useState('');
  const [logado, setLogado] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  // Dados do Firebase
  const [leads, setLeads] = useState([]);
  const [historicoGeral, setHistoricoGeral] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [motivosPerda, setMotivosPerda] = useState(DEFAULT_MOTIVOS_PERDA);

  const [leadSelecionadoId, setLeadSelecionadoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [visaoAtual, setVisaoAtual] = useState('lista');

  const [toastMsg, setToastMsg] = useState('');
  const [toastErro, setToastErro] = useState(false);
  const [uploadProgresso, setUploadProgresso] = useState('');

  const [filtroVendedorDash, setFiltroVendedorDash] = useState('todos');
  const [filtroTempoDash, setFiltroTempoDash] = useState('mes');
  const [filtroExportacao, setFiltroExportacao] = useState('mes');

  const [novoVendedorNome, setNovoVendedorNome] = useState('');
  const [mostrarFormAdmin, setMostrarFormAdmin] = useState(null);
  const [novoMotivo, setNovoMotivo] = useState('');

  const [erroPermissaoFirebase, setErroPermissaoFirebase] = useState(false);

  const [loteForm, setLoteForm] = useState({
    uf: '',
    cidade: '',
    atual: 'TODOS',
    novoResponsavel: '',
  });
  const [leadsSelecionadosLote, setLeadsSelecionadosLote] = useState([]);

  const [novoComentario, setNovoComentario] = useState({
    contato: '',
    canal: 'WhatsApp',
    observacao: '',
    proximo_contato: '',
  });
  const [modalFinalizar, setModalFinalizar] = useState(null);
  const [motivoPerda, setMotivoPerda] = useState('');
  const [draggedLeadId, setDraggedLeadId] = useState(null);

  useEffect(() => {
    const lidarComErroFirebase = (error) => {
      console.error('Erro do Firebase:', error);
      if (error.code === 'permission-denied') {
        setErroPermissaoFirebase(true);
        setCarregandoDados(false);
      }
    };

    const unsubLeads = onSnapshot(
      collection(db, 'leads'),
      (snap) => {
        const data = snap.docs.map((doc) => {
          const lead = doc.data();
          if (lead.id) delete lead.id;
          return { id: doc.id, ...lead };
        });
        setLeads(data);
        setErroPermissaoFirebase(false);
      },
      lidarComErroFirebase
    );

    const unsubHist = onSnapshot(
      collection(db, 'historico'),
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setHistoricoGeral(data);
      },
      lidarComErroFirebase
    );

    const unsubVend = onSnapshot(
      collection(db, 'vendedores'),
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setVendedores(data);
      },
      lidarComErroFirebase
    );

    const unsubMotivos = onSnapshot(
      doc(db, 'config', 'motivos'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().lista) {
          setMotivosPerda(docSnap.data().lista);
        }
        setCarregandoDados(false);
      },
      lidarComErroFirebase
    );

    return () => {
      unsubLeads();
      unsubHist();
      unsubVend();
      unsubMotivos();
    };
  }, []);

  const leadAtual = leadSelecionadoId
    ? leads.find((l) => l.id === leadSelecionadoId)
    : null;
  const historicoLead = leadAtual
    ? historicoGeral.filter((h) => h.id_lead === leadAtual.id)
    : [];

  const mostrarMensagem = (texto, erro = false) => {
    setToastMsg(texto);
    setToastErro(erro);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!vendedor.trim())
      return mostrarMensagem('Digite o nome do vendedor.', true);

    const nomeLimpo = vendedor.trim().toLowerCase();
    if (nomeLimpo === 'admin') return setLogado(true);

    const vend = vendedores.find((v) => v.nome.toLowerCase() === nomeLimpo);
    if (!vend)
      return mostrarMensagem(
        'Vendedor não encontrado. O Admin precisa te cadastrar.',
        true
      );
    if (!vend.ativo) return mostrarMensagem('Seu acesso está bloqueado.', true);

    setLogado(true);
  };

  const getBusinessDaysDiff = (startDate, endDate) => {
    let count = 0;
    let curDate = new Date(startDate);
    const end = new Date(endDate);
    while (curDate < end) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
  };

  const getUrgency = (lead) => {
    const now = Date.now();
    if (lead.status_venda === 'Ganho' || lead.status_venda === 'Perdido')
      return {
        status: 'finalizado',
        texto: 'Encerrado',
        css: 'bg-slate-100 text-slate-500 border-slate-200',
        order: 5,
      };

    if (lead.proximo_contato) {
      const diff = lead.proximo_contato - now;
      if (diff < 0)
        return {
          status: 'atrasado',
          texto: '🚨 Retorno Atrasado',
          css: 'bg-red-100 text-red-700 border-red-500 font-bold animate-pulse',
          order: 0,
        };
      const isToday =
        new Date(lead.proximo_contato).toDateString() ===
        new Date().toDateString();
      if (isToday)
        return {
          status: 'hoje',
          texto: '📅 Retorno Hoje',
          css: 'bg-orange-100 text-orange-700 border-orange-400 font-bold',
          order: 1,
        };
      return {
        status: 'agendado',
        texto: `📅 Agendado: ${new Date(
          lead.proximo_contato
        ).toLocaleDateString('pt-BR')}`,
        css: 'bg-blue-50 text-blue-700 border-blue-200',
        order: 3,
      };
    }

    const lastInt = lead.ultima_interacao || lead.data_criacao;
    if (lastInt) {
      const bDays = getBusinessDaysDiff(lastInt, now);
      // Alerta 1 dia útil a partir de Apresentação
      if (
        lead.etapa_funil !== ETAPAS.LEAD &&
        lead.etapa_funil !== ETAPAS.FINALIZADO &&
        bDays >= 1
      ) {
        return {
          status: 'ocioso',
          texto: `🚨 Sem retorno (${bDays}d úteis)`,
          css: 'bg-red-100 text-red-700 border-red-500 font-bold animate-pulse',
          order: 0,
        };
      }
      if (bDays > 2)
        return {
          status: 'ocioso',
          texto: `⚠️ Ocioso (${bDays}d úteis)`,
          css: 'bg-yellow-100 text-yellow-700 border-yellow-500 font-bold',
          order: 2,
        };
      return {
        status: 'em_dia',
        texto: '✅ Em dia',
        css: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        order: 4,
      };
    }
    return {
      status: 'novo',
      texto: '⭐ Novo Lead',
      css: 'bg-purple-50 text-purple-700 border-purple-200 font-bold',
      order: 2,
    };
  };

  const isAdmin = vendedor.toLowerCase() === 'admin';

  const leadsFiltradosGeral = leads.filter((l) => {
    const matchDono =
      isAdmin ||
      (l.responsavel && l.responsavel.toLowerCase() === vendedor.toLowerCase());
    if (!matchDono) return false;
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      l.nome?.toLowerCase().includes(termo) ||
      l['CPF/CNPJ']?.includes(termo) ||
      l.cidade?.toLowerCase().includes(termo) ||
      l.uf?.toLowerCase().includes(termo) ||
      l.telefone?.includes(termo)
    );
  });

  const lidarUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async (event) => {
      setUploadProgresso('Lendo arquivo CSV...');
      const lines = event.target.result.split('\n');
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0]
        .split(delimiter)
        .map((h) => h.trim().replace(/"/g, ''));

      const novosLeads = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim() || lines[i].replace(/;/g, '').trim() === '')
          continue;
        const currentLine = lines[i]
          .split(delimiter)
          .map((val) => val.trim().replace(/"/g, ''));
        if (currentLine.length < 2) continue;

        let obj = { etapa_funil: ETAPAS.LEAD, data_criacao: Date.now() };
        headers.forEach((h, idx) => {
          if (h.toLowerCase() !== 'id' && h.trim() !== '') {
            obj[h] = currentLine[idx] || '';
          }
        });

        if (!obj.nome && obj.Nome) obj.nome = obj.Nome;
        if (!obj.cidade && obj.Cidade) obj.cidade = obj.Cidade;
        if (!obj.uf && obj.UF) obj.uf = obj.UF;

        if (obj.nome && obj.nome !== 'Sem Nome' && obj.nome !== '')
          novosLeads.push(obj);
      }

      if (novosLeads.length === 0)
        return mostrarMensagem('Nenhum lead válido encontrado.', true);

      const chunks = [];
      for (let i = 0; i < novosLeads.length; i += 450)
        chunks.push(novosLeads.slice(i, i + 450));

      let salvos = 0;
      for (let chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((lead) => {
          const docRef = doc(collection(db, 'leads'));
          batch.set(docRef, lead);
        });
        await batch.commit();
        salvos += chunk.length;
        setUploadProgresso(
          `Salvando na Nuvem: ${salvos} de ${novosLeads.length}`
        );
      }
      setUploadProgresso('');
      mostrarMensagem(
        `Importação concluída! ${novosLeads.length} salvos no Firebase.`
      );
    };
    reader.readAsText(file, 'UTF-8');
  };

  const exportarCSV = () => {
    let histFiltrado = historicoGeral;
    const now = new Date();

    if (filtroExportacao === 'mes') {
      histFiltrado = historicoGeral.filter(
        (h) =>
          new Date(h.timestamp).getMonth() === now.getMonth() &&
          new Date(h.timestamp).getFullYear() === now.getFullYear()
      );
    } else if (filtroExportacao === 'semana') {
      const umaSemanaAtras = new Date(now.setDate(now.getDate() - 7)).getTime();
      histFiltrado = historicoGeral.filter(
        (h) => h.timestamp >= umaSemanaAtras
      );
    }

    let csvContent =
      'Data,Vendedor,Revenda,CNPJ,Cidade,UF,Etapa Funil,Status Venda,Motivo Perda,Canal,Pessoa Contatada,Observacao\n';

    histFiltrado.forEach((h) => {
      const lead = leads.find((l) => l.id === h.id_lead) || {};
      const limpaStr = (str) =>
        str
          ? `"${str.toString().replace(/"/g, '""').replace(/\n/g, ' ')}"`
          : '""';

      csvContent += `${limpaStr(h.data_hora)},${limpaStr(
        h.vendedor
      )},${limpaStr(lead.nome)},${limpaStr(lead['CPF/CNPJ'])},${limpaStr(
        lead.cidade
      )},${limpaStr(lead.uf)},${limpaStr(lead.etapa_funil)},${limpaStr(
        lead.status_venda
      )},${limpaStr(lead.motivo_perda)},${limpaStr(h.canal)},${limpaStr(
        h.contato
      )},${limpaStr(h.observacao)}\n`;
    });

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Exportacao_CRM_IA_${filtroExportacao}.csv`;
    link.click();
    mostrarMensagem('Download iniciado!');
  };

  const salvarComentario = async () => {
    if (!novoComentario.contato.trim() || !novoComentario.observacao.trim())
      return mostrarMensagem('Preencha com quem falou e a observação!', true);

    const timestamp = Date.now();
    try {
      await addDoc(collection(db, 'historico'), {
        id_lead: leadAtual.id,
        data_hora: new Date().toLocaleString('pt-BR'),
        timestamp: timestamp,
        vendedor: vendedor,
        contato: novoComentario.contato,
        canal: novoComentario.canal,
        observacao: novoComentario.observacao,
      });

      const attLead = { ultima_interacao: timestamp };
      if (novoComentario.proximo_contato)
        attLead.proximo_contato = new Date(
          novoComentario.proximo_contato
        ).getTime();
      else attLead.proximo_contato = null;

      await updateDoc(doc(db, 'leads', leadAtual.id), attLead);
      setNovoComentario({
        contato: '',
        canal: 'WhatsApp',
        observacao: '',
        proximo_contato: '',
      });
      mostrarMensagem('Histórico salvo na Nuvem!');
    } catch (e) {
      mostrarMensagem('Erro ao salvar.', true);
    }
  };

  const onDrop = async (e, novaEtapa) => {
    if (!draggedLeadId) return;
    const leadArrastado = leads.find((l) => l.id === draggedLeadId);
    if (!leadArrastado) return;

    if (novaEtapa === ETAPAS.FINALIZADO && !leadArrastado.status_venda) {
      setDraggedLeadId(null);
      return mostrarMensagem('Use os botões 🏆 ou 👎 para finalizar.', true);
    }

    let stVenda = leadArrastado.status_venda;
    let stMotivo = leadArrastado.motivo_perda;
    let msgHistorico = `Avançou para ${novaEtapa}`;

    if (novaEtapa !== ETAPAS.FINALIZADO && stVenda) {
      stVenda = null;
      stMotivo = null;
      msgHistorico = `♻️ Venda Restaurada para ${novaEtapa}`;
    }

    try {
      await updateDoc(doc(db, 'leads', draggedLeadId), {
        etapa_funil: novaEtapa,
        status_venda: stVenda || null,
        motivo_perda: stMotivo || null,
      });
      if (novaEtapa !== leadArrastado.etapa_funil) {
        await addDoc(collection(db, 'historico'), {
          id_lead: draggedLeadId,
          data_hora: new Date().toLocaleString('pt-BR'),
          timestamp: Date.now(),
          vendedor: vendedor,
          contato: 'SISTEMA',
          canal: 'Automático',
          observacao: msgHistorico,
        });
      }
    } catch (err) {
      mostrarMensagem('Erro ao mover lead.', true);
    }
    setDraggedLeadId(null);
  };

  const processarFinalizacao = async () => {
    if (modalFinalizar.type === 'perda' && !motivoPerda)
      return mostrarMensagem('Selecione o motivo.', true);

    const obs =
      modalFinalizar.type === 'ganho'
        ? '🏆 Negócio Fechado com Sucesso!'
        : `❌ Negócio Perdido: ${motivoPerda}`;
    const timestamp = Date.now();

    try {
      await addDoc(collection(db, 'historico'), {
        id_lead: modalFinalizar.lead.id,
        data_hora: new Date().toLocaleString('pt-BR'),
        timestamp: timestamp,
        vendedor: vendedor,
        contato: 'SISTEMA',
        canal: 'Automático',
        observacao: obs,
      });
      await updateDoc(doc(db, 'leads', modalFinalizar.lead.id), {
        etapa_funil: ETAPAS.FINALIZADO,
        status_venda: modalFinalizar.type === 'ganho' ? 'Ganho' : 'Perdido',
        motivo_perda: motivoPerda,
        data_conclusao: timestamp,
      });

      setModalFinalizar(null);
      setMotivoPerda('');
      mostrarMensagem(
        modalFinalizar.type === 'ganho'
          ? 'Parabéns pela venda!'
          : 'Perda registrada.'
      );
    } catch (e) {
      mostrarMensagem('Erro ao gravar.', true);
    }
  };

  const renderDashboard = () => {
    const isMes = filtroTempoDash === 'mes';
    const isSemana = filtroTempoDash === 'semana';
    const now = new Date();

    const checkTime = (timestamp) => {
      if (!timestamp) return false;
      const tDate = new Date(timestamp);
      if (isMes)
        return (
          tDate.getMonth() === now.getMonth() &&
          tDate.getFullYear() === now.getFullYear()
        );
      if (isSemana) {
        const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
        return tDate >= oneWeekAgo;
      }
      return true;
    };

    let baseLeads = leads.filter((l) => {
      const donoMatch =
        filtroVendedorDash === 'todos'
          ? true
          : l.responsavel === filtroVendedorDash;
      return donoMatch;
    });

    const leadsAtivos = baseLeads.filter(
      (l) => l.etapa_funil !== ETAPAS.FINALIZADO
    );
    const leadsConvertidos = baseLeads.filter(
      (l) => l.status_venda === 'Ganho' && checkTime(l.data_conclusao)
    );
    const leadsPerdidos = baseLeads.filter(
      (l) => l.status_venda === 'Perdido' && checkTime(l.data_conclusao)
    );

    const leadsTrabalhados = leadsConvertidos.length + leadsPerdidos.length;
    const taxaConversao =
      leadsTrabalhados > 0
        ? ((leadsConvertidos.length / leadsTrabalhados) * 100).toFixed(0)
        : 0;

    const taxaDescarte =
      leadsTrabalhados > 0
        ? ((leadsPerdidos.length / leadsTrabalhados) * 100).toFixed(0)
        : 0;

    let totalAtrasados = 0;
    let totalOciosos = 0;
    let maisAtrasado = null;
    let maxDaysOcioso = -1;
    leadsAtivos.forEach((l) => {
      const urg = getUrgency(l);
      if (urg.status === 'atrasado') totalAtrasados++;
      if (urg.status === 'ocioso') totalOciosos++;

      const lastInt = l.ultima_interacao || l.data_criacao;
      if (lastInt) {
        const bDays = getBusinessDaysDiff(lastInt, Date.now());
        if (bDays > maxDaysOcioso) {
          maxDaysOcioso = bDays;
          maisAtrasado = l;
        }
      }
    });

    let sumCiclo = 0;
    let fechamentos = 0;
    baseLeads
      .filter((l) => l.status_venda && l.data_conclusao)
      .forEach((l) => {
        sumCiclo += (l.data_conclusao - l.data_criacao) / (1000 * 60 * 60 * 24);
        fechamentos++;
      });
    const cicloMedio =
      fechamentos > 0 ? (sumCiclo / fechamentos).toFixed(1) : 0;

    const dataFunil = [
      {
        name: '1. Lead',
        qtde: baseLeads.filter(
          (l) => l.etapa_funil === ETAPAS.LEAD || !l.etapa_funil
        ).length,
      },
      {
        name: '2. Apresentação',
        qtde: baseLeads.filter((l) => l.etapa_funil === ETAPAS.APRESENTACAO)
          .length,
      },
      {
        name: '3. Negociação',
        qtde: baseLeads.filter((l) => l.etapa_funil === ETAPAS.NEGOCIACAO)
          .length,
      },
      {
        name: '4. Lançamento',
        qtde: baseLeads.filter((l) => l.etapa_funil === ETAPAS.CADASTRO).length,
      },
      {
        name: '5. Treinamento',
        qtde: baseLeads.filter((l) => l.etapa_funil === ETAPAS.TREINAMENTO)
          .length,
      },
    ];

    let contagensCanais = {};
    let timelineData = {};

    historicoGeral.forEach((h) => {
      const leadMatch = baseLeads.find((l) => l.id === h.id_lead);
      if (leadMatch && checkTime(h.timestamp) && h.canal !== 'Automático') {
        contagensCanais[h.canal] = (contagensCanais[h.canal] || 0) + 1;
        const dateKey = new Date(h.timestamp).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });
        if (!timelineData[dateKey]) timelineData[dateKey] = { date: dateKey };
        timelineData[dateKey][h.canal] =
          (timelineData[dateKey][h.canal] || 0) + 1;
      }
    });

    const dataCanais = Object.keys(contagensCanais).map((c) => ({
      name: c,
      value: contagensCanais[c],
    }));
    const lineChartData = Object.values(timelineData).reverse();
    const canaisExistentes = Object.keys(contagensCanais);

    const META_POR_VENDEDOR = 20;
    const COMISSAO_REVENDA = 300;
    const metaAtual =
      filtroVendedorDash === 'todos'
        ? META_POR_VENDEDOR * vendedores.filter((v) => v.ativo).length
        : META_POR_VENDEDOR;
    const valorComissao = leadsConvertidos.length * COMISSAO_REVENDA;

    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-100/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            Métricas e Inteligência
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-2.5 px-4 rounded-xl shadow-sm outline-none"
              value={filtroTempoDash}
              onChange={(e) => setFiltroTempoDash(e.target.value)}
            >
              <option value="mes">Este Mês</option>
              <option value="semana">Esta Semana</option>
              <option value="tudo">Todo Período</option>
            </select>
            {isAdmin && (
              <select
                className="bg-blue-600 border border-blue-700 text-sm font-bold text-white py-2.5 px-4 rounded-xl shadow-sm outline-none"
                value={filtroVendedorDash}
                onChange={(e) => setFiltroVendedorDash(e.target.value)}
              >
                <option value="todos">Vendedor: Todos</option>
                {vendedores
                  .filter((v) => v.ativo)
                  .map((v) => (
                    <option key={v.id} value={v.nome}>
                      {v.nome}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-700">
                Funil de Leads
              </h3>
              <span className="text-slate-300">⚙️</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataFunil}
                  layout="vertical"
                  margin={{ left: 40, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="qtde" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-700">
                Fontes de Contato
              </h3>
              <span className="text-slate-300">⚙️</span>
            </div>
            <div className="h-64">
              {dataCanais.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataCanais}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {dataCanais.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                  Sem interações no período
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#10b981] p-6 rounded-2xl shadow-sm text-white relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-base font-medium text-emerald-50 tracking-wide">
                Número de Leads ativos
              </h3>
              <span className="text-emerald-200/50">⚙️</span>
            </div>
            <div className="text-6xl font-light text-right">
              {leadsAtivos.length}
            </div>
          </div>

          <div className="bg-[#3b82f6] p-6 rounded-2xl shadow-sm text-white relative overflow-hidden">
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-base font-medium text-blue-50 tracking-wide">
                Conversão
              </h3>
              <span className="text-blue-200/50">⚙️</span>
            </div>
            <div className="text-6xl font-light text-right">
              {taxaConversao}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-[#38bdf8] p-6 rounded-2xl shadow-sm text-white">
            <h3 className="text-sm font-medium text-sky-50 mb-6">
              Número de Leads convertidos
            </h3>
            <div className="text-5xl font-light text-right">
              {leadsConvertidos.length}
            </div>
          </div>

          <div className="bg-[#eab308] p-6 rounded-2xl shadow-sm text-white">
            <h3 className="text-sm font-medium text-yellow-50 mb-6 truncate">
              O número de Leads descart...
            </h3>
            <div className="text-5xl font-light text-right">
              {leadsPerdidos.length}
            </div>
          </div>

          <div className="bg-[#ef4444] p-6 rounded-2xl shadow-sm text-white">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-medium text-red-50">
                Perdido (Taxa)
              </h3>
              <span className="text-red-200/50">⚙️</span>
            </div>
            <div className="text-5xl font-light text-right">
              {taxaDescarte}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
              Termômetro de Follow-up
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-bold text-slate-400 mb-1">
                  Abandonados (Ociosos)
                </p>
                <p className="text-2xl font-black text-slate-800">
                  {totalOciosos}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl">
                <p className="text-xs font-bold text-red-400 mb-1">Atrasados</p>
                <p className="text-2xl font-black text-red-700">
                  {totalAtrasados}
                </p>
              </div>
            </div>
            {maisAtrasado && maxDaysOcioso > 2 && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center gap-3">
                <span className="text-xl">🚨</span>
                <div>
                  <p className="text-[10px] font-black text-orange-600 uppercase">
                    Revenda Mais Crítica
                  </p>
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {maisAtrasado.nome}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Esquecido há {maxDaysOcioso} dias úteis
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
              Ciclo Médio de Vendas
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Tempo desde a criação até o final (Ganho/Perda)
            </p>
            <div className="flex items-end gap-2">
              <span className="text-6xl font-light text-slate-800">
                {cicloMedio}
              </span>
              <span className="text-xl font-medium text-slate-500 mb-2">
                dias
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <h3 className="text-lg font-bold text-slate-700 mb-6">
            Evolução Diária de Contatos (Canal)
          </h3>
          <div className="h-64">
            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineChartData}
                  margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  {canaisExistentes.map((c, idx) => (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      stroke={CORES_GRAFICO[idx % CORES_GRAFICO.length]}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                Sem dados para a linha do tempo.
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">
              Meta de Vendas ({filtroTempoDash})
            </p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl font-black text-emerald-400">
                {leadsConvertidos.length}
              </span>
              <span className="text-xl text-slate-500 mb-1">
                / {metaAtual} fechamentos
              </span>
            </div>
            <div className="w-full md:w-64 bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(
                    (leadsConvertidos.length / metaAtual) * 100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="text-right border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">
              Projeção de Ganhos
            </p>
            <p className="text-4xl font-black text-white">
              R$ {valorComissao.toLocaleString('pt-BR')}
            </p>
            <p className="text-emerald-400 text-sm font-medium mt-1">
              + R$ {COMISSAO_REVENDA} por venda
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (erroPermissaoFirebase) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 w-full p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-lg text-center border-t-8 border-red-500">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">
            Firebase Bloqueado
          </h2>
          <p className="text-slate-600 mb-6 font-medium">
            O Google impediu a leitura dos dados. Precisamos liberar a regra de
            permissão no seu Firebase.
          </p>
          <div className="bg-slate-100 p-4 rounded-xl text-left text-sm font-mono text-slate-700 overflow-x-auto mb-6">
            <p>1. Vá no Firebase &gt; Firestore Database &gt; Aba "Regras"</p>
            <p>2. Substitua o código por:</p>
            <br />
            <p className="text-blue-600 font-bold">
              match /{'{document=**}'} {'{'}
            </p>
            <p className="text-blue-600 font-bold ml-4">
              allow read, write: if true;
            </p>
            <p className="text-blue-600 font-bold">{'}'}</p>
            <br />
            <p>3. Clique em Publicar e recarregue a página.</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-md"
          >
            Já liberei, tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (carregandoDados)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-bold text-slate-500 animate-pulse">
          Conectando ao Banco de Dados...
        </p>
      </div>
    );

  if (!logado) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 w-full font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-100">
          <div className="mb-6 flex justify-center">
            <div className="bg-blue-600 w-16 h-16 rounded-full shadow-lg text-white font-black text-2xl flex items-center justify-center">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                ></path>
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-black mb-2 text-slate-900">
            Acesso ao CRM
          </h2>
          <p className="text-slate-400 mb-8 text-xs uppercase tracking-widest font-bold">
            Base Cloud Definitiva
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Seu nome (Ex: Eduardo)"
              className="w-full border-2 border-slate-200 bg-white text-slate-800 p-4 mb-6 rounded-xl focus:outline-none focus:border-blue-500 font-medium text-lg text-center"
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg flex justify-center items-center gap-2"
            >
              Entrar na Carteira{' '}
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                ></path>
              </svg>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden w-full">
      {toastMsg && (
        <div
          className={`absolute top-6 right-8 z-50 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-3 border ${
            toastErro
              ? 'bg-red-500 border-red-600'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          {toastMsg}
        </div>
      )}

      {uploadProgresso && (
        <div className="absolute top-20 right-8 z-50 bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-3 animate-pulse border border-blue-700">
          ☁️ {uploadProgresso}
        </div>
      )}

      {modalFinalizar && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h3
              className={`text-2xl font-black mb-2 ${
                modalFinalizar.type === 'ganho'
                  ? 'text-emerald-600'
                  : 'text-red-600'
              }`}
            >
              {modalFinalizar.type === 'ganho'
                ? '🏆 Registrar Venda'
                : '👎 Registrar Perda'}
            </h3>
            <p className="text-slate-500 mb-6 font-medium">
              {modalFinalizar.lead.nome}
            </p>

            {modalFinalizar.type === 'perda' && (
              <select
                className="w-full border-2 border-slate-200 p-4 rounded-xl mb-6 font-medium text-slate-700 outline-none focus:border-red-400"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
              >
                <option value="">Selecione o motivo da perda...</option>
                {motivosPerda.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModalFinalizar(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={processarFinalizacao}
                className={`flex-1 px-4 py-3 text-white font-bold rounded-xl shadow-md ${
                  modalFinalizar.type === 'ganho'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-20 shrink-0 h-full relative">
        <div className="p-6 bg-slate-900 text-white shrink-0 rounded-br-[40px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-xl font-black shadow-inner border-2 border-indigo-400">
                {vendedor.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-black text-xl tracking-tight">
                Painel Geral
              </h2>
            </div>
            <button
              onClick={() => setLogado(false)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors border border-slate-700"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 mb-5 bg-slate-800/50 rounded-full px-3 py-1.5 border border-slate-700/50 shadow-inner">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <span className="text-xs font-bold text-slate-200">
              {leadsFiltradosGeral.length} revendas
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar (Nome, CNPJ, UF, Tel)..."
              className="w-full bg-slate-800 text-sm border border-slate-700 text-white p-3.5 pl-10 rounded-xl focus:outline-none focus:border-indigo-500 placeholder-slate-400 font-medium shadow-inner"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 mx-4 mt-4 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => {
              setVisaoAtual('lista');
              setLeadSelecionadoId(null);
            }}
            className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
              visaoAtual === 'lista' && !leadAtual
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => {
              setVisaoAtual('kanban');
              setLeadSelecionadoId(null);
            }}
            className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
              visaoAtual === 'kanban' && !leadAtual
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => {
              setVisaoAtual('dashboard');
              setLeadSelecionadoId(null);
            }}
            className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
              visaoAtual === 'dashboard'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Métricas
          </button>
        </div>

        {isAdmin && (
          <div className="px-4 py-3 shrink-0 border-b border-slate-100 space-y-2 mt-2">
            <button
              onClick={() => setVisaoAtual('gerenciar')}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              ⚙️ Painel de Configurações
            </button>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setMostrarFormAdmin(
                    mostrarFormAdmin === 'lote' ? null : 'lote'
                  )
                }
                className="flex-1 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm hover:bg-blue-700 flex justify-center items-center gap-1"
              >
                Transferir Lote
              </button>
            </div>
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={lidarUploadCSV}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl shadow-sm cursor-pointer flex justify-center items-center gap-2 transition-colors"
              >
                Subir Planilha CSV
              </label>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 space-y-2">
              <p className="text-xs font-bold text-slate-500 text-center uppercase tracking-widest">
                🤖 Exportar p/ IA
              </p>
              <select
                className="w-full border p-2 rounded-lg text-xs font-bold outline-none"
                value={filtroExportacao}
                onChange={(e) => setFiltroExportacao(e.target.value)}
              >
                <option value="tudo">Todo Histórico</option>
                <option value="mes">Este Mês</option>
                <option value="semana">Esta Semana</option>
              </select>
              <button
                onClick={exportarCSV}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm flex justify-center items-center gap-2 transition-colors"
              >
                ⬇️ Baixar CSV
              </button>
            </div>

            {mostrarFormAdmin === 'lote' && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 text-sm space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="UF (Ex: SP)"
                    className="w-full border p-2 rounded-lg"
                    value={loteForm.uf}
                    onChange={(e) =>
                      setLoteForm({ ...loteForm, uf: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    className="w-full border p-2 rounded-lg"
                    value={loteForm.cidade}
                    onChange={(e) =>
                      setLoteForm({ ...loteForm, cidade: e.target.value })
                    }
                  />
                </div>
                <select
                  className="w-full border p-2 rounded-lg font-bold text-slate-700 outline-none"
                  value={loteForm.atual}
                  onChange={(e) =>
                    setLoteForm({ ...loteForm, atual: e.target.value })
                  }
                >
                  <option value="TODOS">Filtro: Todos os Clientes</option>
                  <option value="SEM_DONO">Filtro: Somente Sem Dono</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.nome}>
                      De: {v.nome}
                    </option>
                  ))}
                </select>

                {(() => {
                  const achados = leads.filter((l) => {
                    const matchUf =
                      !loteForm.uf ||
                      l.uf?.toUpperCase() === loteForm.uf.toUpperCase();
                    const matchCidade =
                      !loteForm.cidade ||
                      l.cidade
                        ?.toLowerCase()
                        .includes(loteForm.cidade.toLowerCase());
                    const matchAtual =
                      loteForm.atual === 'TODOS'
                        ? true
                        : loteForm.atual === 'SEM_DONO'
                        ? !l.responsavel
                        : l.responsavel === loteForm.atual;
                    return matchUf && matchCidade && matchAtual;
                  });
                  return (
                    <div className="max-h-40 overflow-y-auto bg-white border rounded-lg p-2">
                      <div className="flex justify-between text-xs font-bold mb-2 pb-1 border-b sticky top-0 bg-white">
                        <span>{achados.length} achados</span>
                        <button
                          onClick={() =>
                            setLeadsSelecionadosLote(
                              leadsSelecionadosLote.length > 0
                                ? []
                                : achados.map((l) => l.id)
                            )
                          }
                          className="text-blue-600 hover:underline"
                        >
                          Sel. Todos
                        </button>
                      </div>
                      {achados.map((l) => (
                        <label
                          key={l.id}
                          className="flex items-center gap-2 text-xs py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={leadsSelecionadosLote.includes(l.id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setLeadsSelecionadosLote([
                                  ...leadsSelecionadosLote,
                                  l.id,
                                ]);
                              else
                                setLeadsSelecionadosLote(
                                  leadsSelecionadosLote.filter(
                                    (id) => id !== l.id
                                  )
                                );
                            }}
                          />
                          <span className="truncate">
                            {l.nome}{' '}
                            <span className="text-slate-400 ml-1">
                              ({l.responsavel || 'S/ Dono'})
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })()}

                <select
                  className="w-full border-2 border-blue-200 bg-blue-50 text-blue-800 font-bold p-2 rounded-lg outline-none"
                  value={loteForm.novoResponsavel}
                  onChange={(e) =>
                    setLoteForm({
                      ...loteForm,
                      novoResponsavel: e.target.value,
                    })
                  }
                >
                  <option value="">Para Novo Dono...</option>
                  {vendedores
                    .filter((v) => v.ativo)
                    .map((v) => (
                      <option key={v.id} value={v.nome}>
                        {v.nome}
                      </option>
                    ))}
                </select>
                <button
                  onClick={async () => {
                    if (!loteForm.novoResponsavel)
                      return mostrarMensagem('Selecione o novo dono.', true);
                    if (leadsSelecionadosLote.length === 0)
                      return mostrarMensagem(
                        'Selecione pelo menos um cliente.',
                        true
                      );
                    const batch = writeBatch(db);
                    leadsSelecionadosLote.forEach((leadId) => {
                      batch.update(doc(db, 'leads', leadId), {
                        responsavel: loteForm.novoResponsavel,
                      });
                      batch.set(doc(collection(db, 'historico')), {
                        id_lead: leadId,
                        data_hora: new Date().toLocaleString('pt-BR'),
                        timestamp: Date.now(),
                        vendedor: 'SISTEMA',
                        canal: 'Automático',
                        observacao: `Transferido para ${loteForm.novoResponsavel}.`,
                      });
                    });
                    try {
                      await batch.commit();
                      mostrarMensagem(
                        `${leadsSelecionadosLote.length} clientes transferidos!`
                      );
                      setLeadsSelecionadosLote([]);
                    } catch (e) {
                      mostrarMensagem('Erro na transferência.', true);
                    }
                  }}
                  disabled={leadsSelecionadosLote.length === 0}
                  className={`w-full text-white font-bold py-2 rounded-lg transition-all ${
                    leadsSelecionadosLote.length === 0
                      ? 'bg-slate-300'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Transferir ({leadsSelecionadosLote.length})
                </button>
              </div>
            )}
          </div>
        )}

        {!leadAtual && visaoAtual === 'lista' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {leadsFiltradosGeral.slice(0, 100).map((lead) => {
              const urg = getUrgency(lead);
              return (
                <div
                  key={lead.id}
                  onClick={() => setLeadSelecionadoId(lead.id)}
                  className={`bg-white p-4 rounded-2xl cursor-pointer transition-all border-2 shadow-sm hover:shadow-md ${
                    urg.status === 'atrasado' || urg.status === 'ocioso'
                      ? 'border-red-400'
                      : 'border-slate-100'
                  }`}
                >
                  <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">
                    {lead.nome || 'Sem Nome'}
                  </h3>
                  <p className="text-xs text-slate-400 mb-3 truncate">
                    {lead.cidade ? `${lead.cidade} - ${lead.uf}` : '-'}
                  </p>
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border uppercase ${
                        lead.telefone
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {lead.telefone ? 'Com Tel' : 'Sem Tel'}
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase">
                      {lead.responsavel || 'SEM DONO'}
                    </span>
                  </div>
                  {urg.status !== 'novo' &&
                    urg.status !== 'em_dia' &&
                    urg.status !== 'finalizado' && (
                      <div
                        className={`text-[10px] font-bold px-2 py-1 rounded-md text-center border ${urg.css}`}
                      >
                        {urg.texto}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 bg-slate-100 relative h-full flex flex-col min-w-0 overflow-hidden">
        {leadAtual ? (
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto pb-20">
              <button
                onClick={() => setLeadSelecionadoId(null)}
                className="mb-6 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors"
              >
                ← Voltar
              </button>

              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="h-2.5 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <div className="p-8 md:p-10">
                  <div className="flex flex-wrap gap-3 mb-6 items-center">
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-black rounded-xl border border-blue-200 uppercase tracking-widest shadow-sm">
                      Classe {leadAtual['Classe Revenda'] || 'C'}
                    </span>
                    <span className="px-4 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 shadow-sm">
                      {leadAtual['CPF/CNPJ'] || 'Documento Não Informado'}
                    </span>
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 ml-auto shadow-sm">
                      Dono da Carteira: {leadAtual.responsavel || 'Sem dono'}
                    </span>
                  </div>

                  <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight">
                    {leadAtual.nome || 'Sem Nome'}
                  </h1>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="text-slate-400">📍</div>
                      <span className="font-semibold text-slate-700 text-lg">
                        {leadAtual.cidade || '-'} - {leadAtual.uf || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="text-slate-400">📞</div>
                      <span className="font-semibold text-slate-700 text-lg">
                        {leadAtual.telefone || 'Sem telefone'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 md:p-10 mb-8">
                <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      ></path>
                    </svg>
                  </div>
                  Registrar Nova Interação
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">
                      Falei com quem?
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do Contato (Ex: Sr. Marcos - Gerente)"
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 font-medium"
                      value={novoComentario.contato}
                      onChange={(e) =>
                        setNovoComentario({
                          ...novoComentario,
                          contato: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">
                      Canal
                    </label>
                    <select
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 font-medium"
                      value={novoComentario.canal}
                      onChange={(e) =>
                        setNovoComentario({
                          ...novoComentario,
                          canal: e.target.value,
                        })
                      }
                    >
                      <option value="WhatsApp">🟢 WhatsApp</option>
                      <option value="Ligação">📞 Ligação</option>
                      <option value="E-mail">✉️ E-mail</option>
                      <option value="Visita Presencial">
                        🤝 Visita Presencial
                      </option>
                    </select>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">
                    Resumo da Negociação
                  </label>
                  <textarea
                    placeholder="Detalhe a conversa, ofertas feitas, condições..."
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 h-32 resize-none font-medium"
                    value={novoComentario.observacao}
                    onChange={(e) =>
                      setNovoComentario({
                        ...novoComentario,
                        observacao: e.target.value,
                      })
                    }
                  ></textarea>
                </div>

                <div className="flex flex-col md:flex-row gap-6 bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex-1">
                    <label className="block text-sm font-black text-blue-800 mb-2 uppercase tracking-wider">
                      ⏱ Agendar Follow-up
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full bg-white border-2 border-blue-200 p-3.5 rounded-xl outline-none font-bold text-blue-900"
                      value={novoComentario.proximo_contato}
                      onChange={(e) =>
                        setNovoComentario({
                          ...novoComentario,
                          proximo_contato: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={salvarComentario}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black px-10 py-4 rounded-xl shadow-lg mt-auto transition-transform hover:-translate-y-0.5"
                  >
                    Salvar Histórico
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-2xl text-slate-800 mb-6 flex items-center gap-3">
                  <div className="bg-slate-200 p-2 rounded-lg text-slate-600">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  Linha do Tempo
                </h3>
                {historicoLead.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
                  >
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        h.canal === 'Automático'
                          ? 'bg-purple-400'
                          : 'bg-blue-500'
                      }`}
                    ></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3 ml-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 rounded-md font-bold text-sm border bg-slate-100 text-slate-700 border-slate-200">
                          {h.vendedor}
                        </span>
                        <span className="text-slate-400 text-sm font-medium">
                          via {h.canal} com
                        </span>
                        <strong className="text-slate-800 text-base">
                          {h.contato}
                        </strong>
                      </div>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        {h.data_hora}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium ml-2 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                      {h.observacao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : visaoAtual === 'kanban' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex gap-6 h-full bg-slate-100">
            {Object.values(ETAPAS).map((etapa) => {
              const leadsEtapa = leadsFiltradosGeral
                .filter((l) => {
                  if (etapa === ETAPAS.FINALIZADO)
                    return l.etapa_funil === ETAPAS.FINALIZADO;
                  return (
                    (l.etapa_funil || ETAPAS.LEAD) === etapa &&
                    l.etapa_funil !== ETAPAS.FINALIZADO
                  );
                })
                .sort((a, b) => getUrgency(a).order - getUrgency(b).order);

              return (
                <div
                  key={etapa}
                  className="w-[340px] shrink-0 flex flex-col bg-slate-200/50 rounded-[24px] border border-slate-200/60 h-full overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, etapa)}
                >
                  <div className="p-4 flex justify-between items-center bg-slate-200/80">
                    <span className="font-black text-slate-700 text-sm uppercase tracking-wider">
                      {etapa}
                    </span>
                    <span className="bg-white text-slate-500 text-xs font-black px-2.5 py-1 rounded-full shadow-sm">
                      {leadsEtapa.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {leadsEtapa.map((lead) => {
                      const urg = getUrgency(lead);
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => setDraggedLeadId(lead.id)}
                          className={`bg-white p-5 rounded-2xl border-2 shadow-sm cursor-grab ${
                            urg.status === 'atrasado' || urg.status === 'ocioso'
                              ? 'border-red-400'
                              : 'border-slate-100'
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-md mb-2 truncate">
                            📍 {lead.cidade} - {lead.uf}
                          </div>
                          <h4 className="font-black text-slate-800 text-base mb-3 leading-tight truncate">
                            {lead.nome || 'Sem Nome'}
                          </h4>
                          <div
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg mb-4 text-center border ${urg.css}`}
                          >
                            {urg.texto}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {lead.etapa_funil !== ETAPAS.FINALIZADO && (
                              <button
                                onClick={() =>
                                  setModalFinalizar({ type: 'perda', lead })
                                }
                                className="py-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold text-xs"
                              >
                                👎
                              </button>
                            )}
                            <button
                              onClick={() => setLeadSelecionadoId(lead.id)}
                              className={`py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-xs ${
                                lead.etapa_funil === ETAPAS.FINALIZADO
                                  ? 'col-span-3'
                                  : ''
                              }`}
                            >
                              Abrir
                            </button>
                            {lead.etapa_funil !== ETAPAS.FINALIZADO && (
                              <button
                                onClick={() =>
                                  setModalFinalizar({ type: 'ganho', lead })
                                }
                                className="py-2 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl font-bold text-xs"
                              >
                                🏆
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : visaoAtual === 'dashboard' ? (
          renderDashboard()
        ) : visaoAtual === 'gerenciar' && isAdmin ? (
          <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
            <h2 className="text-3xl font-black text-slate-900 mb-8">
              Painel de Configurações da Nuvem
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  👥 Vendedores Autorizados
                </h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    className="flex-1 p-3 rounded-lg border outline-none font-bold"
                    placeholder="Novo Vendedor"
                    value={novoVendedorNome}
                    onChange={(e) => setNovoVendedorNome(e.target.value)}
                  />
                  <button
                    onClick={async () => {
                      if (novoVendedorNome) {
                        await addDoc(collection(db, 'vendedores'), {
                          nome: novoVendedorNome,
                          ativo: true,
                        });
                        setNovoVendedorNome('');
                        mostrarMensagem('Vendedor salvo!');
                      }
                    }}
                    className="bg-slate-900 text-white px-6 rounded-lg font-bold"
                  >
                    Add
                  </button>
                </div>
                <div className="bg-white rounded-xl border">
                  {vendedores.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 border-b last:border-0 flex justify-between items-center"
                    >
                      <span className="font-bold">{v.nome}</span>
                      <button
                        onClick={() =>
                          updateDoc(doc(db, 'vendedores', v.id), {
                            ativo: !v.ativo,
                          })
                        }
                        className={`px-4 py-2 rounded-lg text-xs font-bold ${
                          v.ativo
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {v.ativo ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  📉 Motivos de Perda (Funil)
                </h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    className="flex-1 p-3 rounded-lg border outline-none font-bold"
                    placeholder="Novo Motivo"
                    value={novoMotivo}
                    onChange={(e) => setNovoMotivo(e.target.value)}
                  />
                  <button
                    onClick={async () => {
                      if (novoMotivo) {
                        await setDoc(doc(db, 'config', 'motivos'), {
                          lista: [...motivosPerda, novoMotivo],
                        });
                        setNovoMotivo('');
                        mostrarMensagem('Motivo salvo!');
                      }
                    }}
                    className="bg-red-600 text-white px-6 rounded-lg font-bold"
                  >
                    Add
                  </button>
                </div>
                <div className="bg-white rounded-xl border">
                  {motivosPerda.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-4 border-b last:border-0 flex justify-between items-center"
                    >
                      <span className="font-bold text-sm">{m}</span>
                      <button
                        onClick={async () => {
                          await setDoc(doc(db, 'config', 'motivos'), {
                            lista: motivosPerda.filter((_, i) => i !== idx),
                          });
                          mostrarMensagem('Removido!');
                        }}
                        className="text-red-500 text-sm font-bold"
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full items-center justify-center text-slate-400 bg-slate-50">
            <p className="text-xl font-bold text-slate-500">
              Selecione uma visão no menu lateral.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
