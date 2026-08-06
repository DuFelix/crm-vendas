import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, LabelList } from 'recharts';

// Imports do Firebase (SDK Modular)
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, writeBatch, setDoc, deleteDoc } from "firebase/firestore";

// Suas chaves de acesso ao Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDJs8Gzdb2eaop_7NLFb7qSuIduyhE5DDs",
  authDomain: "crm-vendas-4f4d2.firebaseapp.com",
  projectId: "crm-vendas-4f4d2",
  storageBucket: "crm-vendas-4f4d2.firebasestorage.app",
  messagingSenderId: "602048749228",
  appId: "1:602048749228:web:bd93de7fe0d618938f0909"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ETAPAS = {
  LEAD: '1. Lead',
  APRESENTACAO: '2. Apresentação',
  NEGOCIACAO: '3. Negociação',
  CADASTRO: '4. Cadastro / Lançamento',
  TREINAMENTO: '5. Treinamento Appgas',
  FINALIZADO: 'Finalizados'
};

const DEFAULT_MOTIVOS_PERDA = [
  '[VENDEDOR] Sem contato com o responsável',
  '[FINANCEIRO] Discorda da taxa de 8%',
  '[FINANCEIRO] Desacordo com pagamento online',
  '[CADASTRO] Falta de dados cadastrais',
  '[FINANCEIRO] Prazo de repasse',
  '[OPERACIONAL] Exclusividade com a bandeira da distribuidora'
];

// Paleta de Cores Oficiais do Brand Book
const BRAND = {
  blue: '#2D6FEF',
  blueDark: '#1B438F',
  blueLight: '#81A9F5',
  yellow: '#F0B42E',
  black: '#101011',
  gray: '#767676',
  white: '#FFFFFF',
};

const CORES_GRAFICO = [BRAND.blue, BRAND.yellow, BRAND.blueLight, BRAND.blueDark, BRAND.gray];

const MapaDinamico = ({ leads, onMarkerClick, initialView, onMapChange }) => {
  const mapRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !window.L) return;

    if (!mapRef.current) {
      const initCenter = initialView?.center || [-14.235, -51.925];
      const initZoom = initialView?.zoom || 4;
      
      const map = window.L.map('mapa-leads').setView(initCenter, initZoom);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      map.on('moveend', () => {
        onMapChange({ center: map.getCenter(), zoom: map.getZoom() });
      });
      
      mapRef.current = map;
    }

    const map = mapRef.current;
    
    map.eachLayer((layer) => {
      if (layer instanceof window.L.CircleMarker || layer instanceof window.L.Marker) {
         map.removeLayer(layer);
      }
    });

    leads.forEach(lead => {
      const lat = parseFloat(lead.latitude || lead.lat);
      const lng = parseFloat(lead.longitude || lead.lng || lead.lon);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        if (lead.status_venda === 'Ganho') {
           const customIcon = window.L.divIcon({
              html: '<div style="font-size: 24px; line-height: 24px; text-shadow: 0 0 8px rgba(240, 180, 46, 0.8); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏆</div>',
              className: 'bg-transparent border-none',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
           });
           const marker = window.L.marker([lat, lng], { icon: customIcon }).addTo(map);
           marker.on('click', () => onMarkerClick(lead.id));
        } else {
           let color = BRAND.gray; // 1. Lead (Cinza Mediano Oficial)
           if (lead.etapa_funil === ETAPAS.APRESENTACAO) color = BRAND.blueLight; 
           else if (lead.etapa_funil === ETAPAS.NEGOCIACAO) color = BRAND.yellow; // Amarelo Caramelo
           else if (lead.etapa_funil === ETAPAS.CADASTRO) color = BRAND.blue; // Azul Principal
           else if (lead.etapa_funil === ETAPAS.TREINAMENTO) color = BRAND.blueDark; 
           else if (lead.status_venda === 'Perdido') color = '#ef4444'; // Vermelho Semântico

           const marker = window.L.circleMarker([lat, lng], {
             radius: 8,
             fillColor: color,
             color: '#ffffff',
             weight: 2,
             opacity: 1,
             fillOpacity: 0.9
           }).addTo(map);

           marker.on('click', () => onMarkerClick(lead.id));
        }
      }
    });
  }, [leafletLoaded, leads, initialView, onMapChange, onMarkerClick]);

  return (
    <div id="mapa-leads" className="w-full h-full z-0 relative">
      {!leafletLoaded && <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10"><p className="animate-pulse font-bold" style={{color: BRAND.gray}}>Carregando Mapa...</p></div>}
    </div>
  );
};

function App() {
  const [vendedor, setVendedor] = useState('');
  const [senha, setSenha] = useState(''); 
  const [logado, setLogado] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const [leads, setLeads] = useState([]);
  const [historicoGeral, setHistoricoGeral] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [motivosPerda, setMotivosPerda] = useState(DEFAULT_MOTIVOS_PERDA);
  
  const [leadSelecionadoId, setLeadSelecionadoId] = useState(null);
  const [busca, setBusca] = useState('');
  
  const [visaoAtual, setVisaoAtual] = useState('lista'); 
  const [visaoAnterior, setVisaoAnterior] = useState('lista'); 
  
  const [toastMsg, setToastMsg] = useState('');
  const [toastErro, setToastErro] = useState(false);
  const [uploadProgresso, setUploadProgresso] = useState('');
  
  const [filtroVendedorDash, setFiltroVendedorDash] = useState('todos');
  const [filtroTempoDash, setFiltroTempoDash] = useState('mes');
  const [filtroExportacao, setFiltroExportacao] = useState('mes');

  const [novoVendedorNome, setNovoVendedorNome] = useState('');
  const [novoVendedorSenha, setNovoVendedorSenha] = useState(''); 
  const [novoMotivo, setNovoMotivo] = useState('');
  const [erroPermissaoFirebase, setErroPermissaoFirebase] = useState(false); 

  const [vendedorEditandoId, setVendedorEditandoId] = useState(null);
  const [vendedorNovaSenha, setVendedorNovaSenha] = useState('');
  const [vendedorParaExcluir, setVendedorParaExcluir] = useState(null);

  const [editandoTels, setEditandoTels] = useState(false);
  const [telsTemp, setTelsTemp] = useState([]);
  
  const [novoComentario, setNovoComentario] = useState({ contato: '', canal: 'WhatsApp', observacao: '', proximo_contato: '' });
  const [modalFinalizar, setModalFinalizar] = useState(null); 
  const [motivoPerda, setMotivoPerda] = useState('');
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [leadParaExcluir, setLeadParaExcluir] = useState(null);

  const [mapaVisao, setMapaVisao] = useState({ center: [-14.235, -51.925], zoom: 4 });
  const [veioDoMapa, setVeioDoMapa] = useState(false);

  const [modalNovoLead, setModalNovoLead] = useState(false);
  const [formNovoLead, setFormNovoLead] = useState({ nome: '', telefone: '', cnpj: '', cidade: '', uf: '' });

  const [modalLote, setModalLote] = useState(false);
  const [loteFiltros, setLoteFiltros] = useState({ uf: '', cidade: '', etapa: '', responsavel: '' });
  const [loteSelecionados, setLoteSelecionados] = useState([]);
  const [loteNovoResponsavel, setLoteNovoResponsavel] = useState('');

  useEffect(() => {
      setEditandoTels(false);
      setTelsTemp([]);
  }, [leadSelecionadoId]);

  useEffect(() => {
    const lidarComErroFirebase = (error) => {
      if (error.code === 'permission-denied') {
        setErroPermissaoFirebase(true);
        setCarregandoDados(false);
      }
    };

    const unsubLeads = onSnapshot(collection(db, "leads"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(data);
      setErroPermissaoFirebase(false);
    }, lidarComErroFirebase);

    const unsubHist = onSnapshot(collection(db, "historico"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setHistoricoGeral(data);
    }, lidarComErroFirebase);

    const unsubVend = onSnapshot(collection(db, "vendedores"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendedores(data);
    }, lidarComErroFirebase);

    const unsubMotivos = onSnapshot(doc(db, "config", "motivos"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().lista) setMotivosPerda(docSnap.data().lista);
      setCarregandoDados(false);
    }, lidarComErroFirebase);

    return () => { unsubLeads(); unsubHist(); unsubVend(); unsubMotivos(); };
  }, []);

  const leadAtual = leadSelecionadoId ? leads.find(l => l.id === leadSelecionadoId) : null;
  const historicoLead = leadAtual ? historicoGeral.filter(h => h.id_lead === leadAtual.id) : [];

  const mostrarMensagem = (texto, erro = false) => {
    setToastMsg(texto);
    setToastErro(erro);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const fecharMenuMobile = () => setMenuMobileAberto(false);

  const mudarVisao = (nova) => {
    if (nova !== visaoAtual) {
      setVisaoAnterior(visaoAtual);
      setVisaoAtual(nova);
    }
    setLeadSelecionadoId(null);
    fecharMenuMobile();
  };

  const voltarVisao = () => {
    setVisaoAtual(visaoAnterior);
    setLeadSelecionadoId(null);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!vendedor.trim()) return mostrarMensagem('Digite o nome do usuário.', true);
    if (!senha.trim()) return mostrarMensagem('Digite a senha.', true);
    
    const nomeLimpo = vendedor.trim().toLowerCase();
    
    if (nomeLimpo === 'admin') {
      if (senha === 'admin') {
         setLogado(true);
         return;
      } else {
         return mostrarMensagem('Senha de Admin incorreta.', true);
      }
    }
    
    const vend = vendedores.find(v => v.nome.toLowerCase() === nomeLimpo);
    if (!vend) return mostrarMensagem('Usuário não encontrado.', true);
    if (!vend.ativo) return mostrarMensagem('Seu acesso está bloqueado.', true);
    
    const senhaCorreta = vend.senha || '123456'; 
    if (senha !== senhaCorreta) return mostrarMensagem('Senha incorreta.', true);
    
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
    if (lead.status_venda === 'Ganho' || lead.status_venda === 'Perdido') return { status: 'finalizado', texto: 'Encerrado', css: 'bg-slate-100 text-[#767676] border-slate-200', order: 5 };

    if (lead.proximo_contato) {
      const diff = lead.proximo_contato - now;
      if (diff < 0) return { status: 'atrasado', texto: '🚨 Retorno Atrasado', css: 'bg-red-100 text-red-700 border-red-500 font-bold animate-pulse', order: 0 };
      const isToday = new Date(lead.proximo_contato).toDateString() === new Date().toDateString();
      if (isToday) return { status: 'hoje', texto: '📅 Retorno Hoje', css: 'bg-[#F0B42E]/20 text-[#101011] border-[#F0B42E] font-bold', order: 1 };
      return { status: 'agendado', texto: `📅 Agendado: ${new Date(lead.proximo_contato).toLocaleDateString('pt-BR')}`, css: 'bg-[#2D6FEF]/10 text-[#2D6FEF] border-[#2D6FEF]/30', order: 3 };
    }

    const lastInt = lead.ultima_interacao || lead.data_criacao;
    if (lastInt) {
      const bDays = getBusinessDaysDiff(lastInt, now);
      if (lead.etapa_funil !== ETAPAS.LEAD && lead.etapa_funil !== ETAPAS.FINALIZADO && bDays >= 1) {
        return { status: 'ocioso', texto: `🚨 Sem retorno (${bDays}d úteis)`, css: 'bg-red-100 text-red-700 border-red-500 font-bold animate-pulse', order: 0 };
      }
      if (bDays > 2) return { status: 'ocioso', texto: `⚠️ Ocioso (${bDays}d úteis)`, css: 'bg-[#F0B42E]/20 text-[#101011] border-[#F0B42E] font-bold', order: 2 };
      return { status: 'em_dia', texto: '✅ Em dia', css: 'bg-emerald-50 text-emerald-700 border-emerald-200', order: 4 };
    }
    return { status: 'novo', texto: '⭐ Novo Lead', css: 'bg-[#1B438F]/10 text-[#1B438F] border-[#1B438F]/30 font-bold', order: 2 };
  };

  const isAdmin = vendedor.toLowerCase() === 'admin';

  const leadsFiltradosGeral = leads.filter(l => {
    const matchDono = isAdmin || (l.responsavel && l.responsavel.toLowerCase() === vendedor.toLowerCase());
    if (!matchDono) return false;
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (l.nome?.toLowerCase().includes(termo) || l['CPF/CNPJ']?.includes(termo) || l.cidade?.toLowerCase().includes(termo) || l.uf?.toLowerCase().includes(termo) || l.telefone?.includes(termo));
  });

  const parseCSVLine = (text, delimiter) => {
    let ret = [];
    let inQuote = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (inQuote) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i+1] === '"') { value += '"'; i++; } 
                else { inQuote = false; }
            } else { value += ch; }
        } else {
            if (ch === '"') { inQuote = true; } 
            else if (ch === delimiter) { ret.push(value.trim()); value = ''; } 
            else { value += ch; }
        }
    }
    ret.push(value.trim());
    return ret;
  };

  const lidarUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      setUploadProgresso('Lendo arquivo CSV...');
      const lines = event.target.result.split('\n');
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = parseCSVLine(lines[0], delimiter).map(h => h.replace(/"/g, ''));
      
      const novosLeads = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim() || lines[i].replace(/;/g, '').trim() === '') continue;
        const currentLine = parseCSVLine(lines[i], delimiter).map(val => val.replace(/"/g, ''));
        if (currentLine.length < 2) continue;
        
        let obj = { etapa_funil: ETAPAS.LEAD, data_criacao: Date.now() };
        headers.forEach((h, idx) => {
          if (h.toLowerCase() !== 'id' && h.trim() !== '') {
            let keyName = h;
            let hLower = h.toLowerCase();
            let val = currentLine[idx] || '';
            
            if (hLower === 'vendedor_responsavel' || hLower === 'vendedor responsável' || hLower === 'responsavel' || hLower === 'vendedor') {
                keyName = 'responsavel';
            }
            if (hLower === 'telefone' || hLower === 'telefones' || hLower === 'celular' || hLower === 'contato') {
                obj.telefones = val.split(/[;,\/]+/).map(t => t.trim()).filter(t => t !== '');
                obj.telefone = obj.telefones[0] || ''; 
            } else {
                obj[keyName] = val;
            }
          }
        });
        
        if (!obj.nome && obj.Nome) obj.nome = obj.Nome;
        if (!obj.cidade && obj.Cidade) obj.cidade = obj.Cidade;
        if (!obj.uf && obj.UF) obj.uf = obj.UF;
        
        if (obj.nome && obj.nome !== 'Sem Nome' && obj.nome !== '') novosLeads.push(obj);
      }

      if (novosLeads.length === 0) return mostrarMensagem('Nenhum lead válido encontrado.', true);

      const chunks = [];
      for (let i = 0; i < novosLeads.length; i += 450) chunks.push(novosLeads.slice(i, i + 450));

      let salvos = 0;
      for (let chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(lead => {
          const docRef = doc(collection(db, "leads"));
          batch.set(docRef, lead);
        });
        await batch.commit();
        salvos += chunk.length;
        setUploadProgresso(`Salvando na Nuvem: ${salvos} de ${novosLeads.length}`);
      }
      setUploadProgresso('');
      mostrarMensagem(`Importação concluída! ${novosLeads.length} salvos no Firebase.`);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const exportarCSV = () => {
    let histFiltrado = historicoGeral;
    const now = new Date();
    
    if (filtroExportacao === 'mes') {
      histFiltrado = historicoGeral.filter(h => new Date(h.timestamp).getMonth() === now.getMonth() && new Date(h.timestamp).getFullYear() === now.getFullYear());
    } else if (filtroExportacao === 'semana') {
      const umaSemanaAtras = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      histFiltrado = historicoGeral.filter(h => h.timestamp >= umaSemanaAtras.getTime());
    }

    let csvContent = "Data,Vendedor,Revenda,CNPJ,Cidade,UF,Etapa Funil,Status Venda,Motivo Perda,Canal,Pessoa Contatada,Observacao\n";
    
    histFiltrado.forEach(h => {
      const lead = leads.find(l => l.id === h.id_lead) || {};
      const limpaStr = (str) => str ? `"${str.toString().replace(/"/g, '""').replace(/\n/g, ' ')}"` : '""';
      
      csvContent += `${limpaStr(h.data_hora)},${limpaStr(h.vendedor)},${limpaStr(lead.nome)},${limpaStr(lead['CPF/CNPJ'])},${limpaStr(lead.cidade)},${limpaStr(lead.uf)},${limpaStr(lead.etapa_funil)},${limpaStr(lead.status_venda)},${limpaStr(lead.motivo_perda)},${limpaStr(h.canal)},${limpaStr(h.contato)},${limpaStr(h.observacao)}\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Exportacao_CRM_IA_${filtroExportacao}.csv`;
    link.click();
    mostrarMensagem("Download iniciado!");
  };

  const abrirWhatsApp = async (telefone) => {
    if (!leadAtual) return;

    const hora = new Date().getHours();
    let saudacao = 'Bom dia';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';
    else if (hora >= 18) saudacao = 'Boa noite';

    const nomeRevenda = leadAtual.nome || 'a revenda';
    const nomeVendedor = vendedor || 'Consultor';

    const modelos = [
        `${saudacao}! Falo com o ${nomeRevenda} pois, ele entrou em contato conosco do Appgas para aumentar o faturamento da revenda e estamos retornando.`,
        `${saudacao}! Meu nome é ${nomeVendedor} e falo pela Appgas. Tenho uma proposta para a revenda, sem custo inicial. É com o responsável que estou falando?`,
        `${saudacao}! ${nomeVendedor} da Appgas falando. Gostaria de apresentar uma proposta sem custo inicial para a revenda. É esse o contato correto?`,
        `${saudacao}! Aqui é o ${nomeVendedor}, da Appgas. Tenho uma proposta para a revenda e não há custo inicial. Posso falar com o responsável?`,
        `${saudacao}! Meu nome é ${nomeVendedor} e represento a Appgas. Gostaria de apresentar uma proposta sem investimento inicial. É com o responsável?`,
        `${saudacao}! ${nomeVendedor} da Appgas aqui. Tenho uma oportunidade para a revenda, sem custo inicial. Estou falando com o responsável?`,
        `${saudacao}! Meu nome é ${nomeVendedor}, da Appgas. Gostaria de conversar sobre uma proposta sem custo inicial para a revenda. Posso falar com o responsável?`,
        `${saudacao}! ${nomeVendedor} falando pela Appgas. Tenho uma proposta que não exige nenhum custo inicial. É esse o contato da revenda?`,
        `${saudacao}! Aqui é o ${nomeVendedor}, da Appgas. Posso apresentar uma proposta sem custo inicial para a revenda?`,
        `${saudacao}! Meu nome é ${nomeVendedor} e falo pela Appgas. Tenho uma proposta comercial sem custo inicial. É com o responsável que consigo falar?`,
        `${saudacao}! ${nomeVendedor} da Appgas falando. Estou entrando em contato para apresentar uma proposta sem custo inicial para a revenda. Posso falar com o responsável?`
    ];

    const msgSorteada = modelos[Math.floor(Math.random() * modelos.length)];
    const msgEncoded = encodeURIComponent(msgSorteada);
    
    const numLimpo = telefone.replace(/\D/g, '');
    const url = `https://wa.me/55${numLimpo}?text=${msgEncoded}`;

    window.open(url, '_blank');

    try {
        const timestamp = Date.now();
        await addDoc(collection(db, "historico"), {
            id_lead: leadAtual.id, 
            data_hora: new Date().toLocaleString('pt-BR'), 
            timestamp: timestamp, 
            vendedor: vendedor,
            contato: telefone, 
            canal: 'WhatsApp', 
            observacao: `Contato ativo iniciado via WhatsApp:\n\n"${msgSorteada}"`
        });
        
        await updateDoc(doc(db, "leads", leadAtual.id), { ultima_interacao: timestamp });
        mostrarMensagem('Dá um Appgas! WhatsApp aberto e histórico registrado.');
    } catch (e) {
        console.error("Erro ao gravar histórico", e);
    }
  };

  const salvarNovoLead = async () => {
    if(!formNovoLead.nome.trim()) return mostrarMensagem('O nome é obrigatório.', true);
    try {
      await addDoc(collection(db, "leads"), {
        nome: formNovoLead.nome,
        telefone: formNovoLead.telefone,
        telefones: formNovoLead.telefone ? [formNovoLead.telefone] : [],
        'CPF/CNPJ': formNovoLead.cnpj,
        cidade: formNovoLead.cidade,
        uf: formNovoLead.uf,
        etapa_funil: ETAPAS.LEAD,
        data_criacao: Date.now(),
        responsavel: isAdmin ? '' : vendedor 
      });
      setFormNovoLead({ nome: '', telefone: '', cnpj: '', cidade: '', uf: '' });
      setModalNovoLead(false);
      mostrarMensagem('Novo lead cadastrado com sucesso!');
    } catch(e) {
      mostrarMensagem('Erro ao cadastrar lead.', true);
    }
  };

  const salvarComentario = async () => {
    if (!novoComentario.contato.trim() || !novoComentario.observacao.trim()) return mostrarMensagem('Preencha com quem falou e a observação!', true);
    const timestamp = Date.now();
    try {
      await addDoc(collection(db, "historico"), {
        id_lead: leadAtual.id, data_hora: new Date().toLocaleString('pt-BR'), timestamp: timestamp, vendedor: vendedor,
        contato: novoComentario.contato, canal: novoComentario.canal, observacao: novoComentario.observacao
      });
      const attLead = { ultima_interacao: timestamp };
      if (novoComentario.proximo_contato) attLead.proximo_contato = new Date(novoComentario.proximo_contato).getTime();
      else attLead.proximo_contato = null; 
      
      await updateDoc(doc(db, "leads", leadAtual.id), attLead);
      setNovoComentario({ contato: '', canal: 'WhatsApp', observacao: '', proximo_contato: '' });
      mostrarMensagem('Histórico salvo na Nuvem!');
    } catch (e) { mostrarMensagem('Erro ao salvar.', true); }
  };

  const onDrop = async (e, novaEtapa) => {
    if (!draggedLeadId) return;
    const leadArrastado = leads.find(l => l.id === draggedLeadId);
    if (!leadArrastado) return;
    mudarEtapaLead(leadArrastado, novaEtapa);
    setDraggedLeadId(null);
  };

  const mudarEtapaLead = async (leadAlvo, novaEtapa) => {
    if (novaEtapa === ETAPAS.FINALIZADO && !leadAlvo.status_venda) return mostrarMensagem('Use os botões 🏆 ou 👎 para finalizar.', true);
    let stVenda = leadAlvo.status_venda; let stMotivo = leadAlvo.motivo_perda; let msgHistorico = `Avançou para ${novaEtapa}`;
    if (novaEtapa !== ETAPAS.FINALIZADO && stVenda) { stVenda = null; stMotivo = null; msgHistorico = `♻️ Venda Restaurada para ${novaEtapa}`; }
    try {
      await updateDoc(doc(db, "leads", leadAlvo.id), { etapa_funil: novaEtapa, status_venda: stVenda || null, motivo_perda: stMotivo || null });
      if (novaEtapa !== leadAlvo.etapa_funil) await addDoc(collection(db, "historico"), { id_lead: leadAlvo.id, data_hora: new Date().toLocaleString('pt-BR'), timestamp: Date.now(), vendedor: vendedor, contato: 'SISTEMA', canal: 'Automático', observacao: msgHistorico });
      mostrarMensagem(`Movido para ${novaEtapa}`);
    } catch (err) { mostrarMensagem('Erro ao mover lead.', true); }
  };

  const processarFinalizacao = async () => {
    if (modalFinalizar.type === 'perda' && !motivoPerda) return mostrarMensagem('Selecione o motivo.', true);
    const obs = modalFinalizar.type === 'ganho' ? '🏆 Negócio Fechado com Sucesso!' : `❌ Negócio Perdido: ${motivoPerda}`;
    const timestamp = Date.now();
    try {
      await addDoc(collection(db, "historico"), { id_lead: modalFinalizar.lead.id, data_hora: new Date().toLocaleString('pt-BR'), timestamp: timestamp, vendedor: vendedor, contato: 'SISTEMA', canal: 'Automático', observacao: obs });
      await updateDoc(doc(db, "leads", modalFinalizar.lead.id), { etapa_funil: ETAPAS.FINALIZADO, status_venda: modalFinalizar.type === 'ganho' ? 'Ganho' : 'Perdido', motivo_perda: motivoPerda, data_conclusao: timestamp });
      setModalFinalizar(null); setMotivoPerda('');
      mostrarMensagem(modalFinalizar.type === 'ganho' ? 'Dá um Appgas! Venda Fechada!' : 'Perda registrada.');
    } catch(e) { mostrarMensagem('Erro ao gravar.', true); }
  };

  const aplicarLote = async () => {
    if (loteSelecionados.length === 0) return mostrarMensagem('Selecione ao menos 1 lead.', true);
    if (!loteNovoResponsavel) return mostrarMensagem('Selecione o novo dono.', true);
    
    setUploadProgresso('Transferindo...');
    const batch = writeBatch(db);
    
    loteSelecionados.forEach(id => {
      const docRef = doc(db, "leads", id);
      batch.update(docRef, { responsavel: loteNovoResponsavel === 'SEM_DONO' ? '' : loteNovoResponsavel });
      
      const histRef = doc(collection(db, "historico"));
      batch.set(histRef, {
        id_lead: id, data_hora: new Date().toLocaleString('pt-BR'), timestamp: Date.now(),
        vendedor: vendedor, contato: 'SISTEMA', canal: 'Automático',
        observacao: `🔄 Transferido em Lote para: ${loteNovoResponsavel === 'SEM_DONO' ? 'Sem Dono' : loteNovoResponsavel}`
      });
    });

    try {
      await batch.commit();
      setModalLote(false);
      setLoteSelecionados([]);
      setUploadProgresso('');
      mostrarMensagem(`Transferência de ${loteSelecionados.length} concluída!`);
    } catch(e) {
      setUploadProgresso('');
      mostrarMensagem('Erro na transferência.', true);
    }
  };

  const renderDashboard = () => {
    const isMes = filtroTempoDash === 'mes';
    const isSemana = filtroTempoDash === 'semana';
    const now = new Date();

    const checkTime = (timestamp) => {
      if (!timestamp) return false;
      const tDate = new Date(timestamp);
      if (isMes) return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      if (isSemana) return tDate >= new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      return true;
    };

    let baseLeads = leads.filter(l => {
      if (!isAdmin) return l.responsavel && l.responsavel.toLowerCase() === vendedor.toLowerCase();
      if (filtroVendedorDash === 'todos') return true;
      return l.responsavel && l.responsavel.toLowerCase() === filtroVendedorDash.toLowerCase();
    });

    const leadsAtivos = baseLeads.filter(l => l.etapa_funil !== ETAPAS.FINALIZADO);
    const leadsConvertidos = baseLeads.filter(l => l.status_venda === 'Ganho' && checkTime(l.data_conclusao));
    const leadsPerdidos = baseLeads.filter(l => l.status_venda === 'Perdido' && checkTime(l.data_conclusao));
    const leadsTrabalhados = leadsConvertidos.length + leadsPerdidos.length;
    const taxaConversao = leadsTrabalhados > 0 ? ((leadsConvertidos.length / leadsTrabalhados) * 100).toFixed(0) : 0;
    const taxaDescarte = leadsTrabalhados > 0 ? ((leadsPerdidos.length / leadsTrabalhados) * 100).toFixed(0) : 0;

    let totalAtrasados = 0; let totalOciosos = 0; let maisAtrasado = null; let maxDaysOcioso = -1;
    leadsAtivos.forEach(l => {
       const urg = getUrgency(l);
       if (urg.status === 'atrasado') totalAtrasados++;
       if (urg.status === 'ocioso') totalOciosos++;
       const lastInt = l.ultima_interacao || l.data_criacao;
       if (lastInt) {
          const bDays = getBusinessDaysDiff(lastInt, Date.now());
          if (bDays > maxDaysOcioso) { maxDaysOcioso = bDays; maisAtrasado = l; }
       }
    });

    let sumCiclo = 0; let fechamentos = 0;
    baseLeads.filter(l => l.status_venda && l.data_conclusao).forEach(l => {
       sumCiclo += (l.data_conclusao - l.data_criacao) / (1000 * 60 * 60 * 24); fechamentos++;
    });
    const cicloMedio = fechamentos > 0 ? (sumCiclo/fechamentos).toFixed(1) : 0;

    const dataFunil = [
      { name: '1. Lead', qtde: baseLeads.filter(l => l.etapa_funil === ETAPAS.LEAD || !l.etapa_funil).length },
      { name: '2. Apresentação', qtde: baseLeads.filter(l => l.etapa_funil === ETAPAS.APRESENTACAO).length },
      { name: '3. Negociação', qtde: baseLeads.filter(l => l.etapa_funil === ETAPAS.NEGOCIACAO).length },
      { name: '4. Lançamento', qtde: baseLeads.filter(l => l.etapa_funil === ETAPAS.CADASTRO).length },
      { name: '5. Treinamento', qtde: baseLeads.filter(l => l.etapa_funil === ETAPAS.TREINAMENTO).length },
    ];

    let contagensCanais = {}; let timelineData = {};
    historicoGeral.forEach(h => {
       const leadMatch = baseLeads.find(l => l.id === h.id_lead);
       if (leadMatch && checkTime(h.timestamp) && h.canal !== 'Automático') {
           contagensCanais[h.canal] = (contagensCanais[h.canal] || 0) + 1;
           const dateKey = new Date(h.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
           if (!timelineData[dateKey]) timelineData[dateKey] = { date: dateKey };
           timelineData[dateKey][h.canal] = (timelineData[dateKey][h.canal] || 0) + 1;
       }
    });

    const dataCanais = Object.keys(contagensCanais).map(c => ({ name: c, value: contagensCanais[c] }));
    const lineChartData = Object.values(timelineData).reverse();
    const canaisExistentes = Object.keys(contagensCanais);
    const META_POR_VENDEDOR = 20; const COMISSAO_REVENDA = 300;
    const qtdeVendedores = vendedores.filter(v=>v.ativo).length || 1;
    const metaAtual = filtroVendedorDash === 'todos' ? META_POR_VENDEDOR * qtdeVendedores : META_POR_VENDEDOR;
    const valorComissao = leadsConvertidos.length * COMISSAO_REVENDA;

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50">
         <button onClick={voltarVisao} className={`mb-4 bg-white border border-slate-200 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold text-[${BRAND.gray}] hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors w-fit`}>
            ← Voltar
         </button>
         <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
             <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{color: BRAND.black}}>Métricas e Inteligência</h2>
             <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                 <select className="bg-white border border-slate-200 text-sm font-bold py-3 px-4 rounded-xl shadow-sm outline-none w-full sm:w-auto" style={{color: BRAND.black}} value={filtroTempoDash} onChange={e=>setFiltroTempoDash(e.target.value)}>
                    <option value="mes">Este Mês</option>
                    <option value="semana">Esta Semana</option>
                    <option value="tudo">Todo Período</option>
                 </select>
                 {isAdmin && (
                   <select className="text-sm font-bold text-white py-3 px-4 rounded-xl shadow-sm outline-none w-full sm:w-auto" style={{backgroundColor: BRAND.blue, borderColor: BRAND.blueDark}} value={filtroVendedorDash} onChange={e=>setFiltroVendedorDash(e.target.value)}>
                      <option value="todos">Vendedor: Todos</option>
                      {vendedores.filter(v=>v.ativo).map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                   </select>
                 )}
             </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-base md:text-lg font-bold" style={{color: BRAND.black}}>Funil de Leads</h3>
                   <span className="text-slate-300">⚙️</span>
                </div>
                <div className="h-56 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={dataFunil} layout="vertical" margin={{ left: 40, right: 40, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11, fill: BRAND.gray, fontWeight: 'bold'}} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="qtde" fill={BRAND.blue} radius={[0, 4, 4, 0]}>
                              <LabelList dataKey="qtde" position="right" fill={BRAND.gray} fontSize={12} fontWeight="bold" />
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-base md:text-lg font-bold" style={{color: BRAND.black}}>Fontes de Contato</h3>
                   <span className="text-slate-300">⚙️</span>
                </div>
                <div className="h-56 md:h-64">
                    {dataCanais.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={dataCanais} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                               {dataCanais.map((entry, index) => <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                         </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center font-medium text-sm" style={{color: BRAND.gray}}>Sem interações no período</div>}
                </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
             <div className="p-5 md:p-6 rounded-2xl shadow-sm text-white relative overflow-hidden" style={{backgroundColor: BRAND.blue}}>
                <div className="flex justify-between items-start mb-6 md:mb-10"><h3 className="text-sm md:text-base font-medium tracking-wide text-white/80">Número de Leads ativos</h3><span className="text-white/50">⚙️</span></div>
                <div className="text-5xl md:text-6xl font-light text-right">{leadsAtivos.length}</div>
             </div>
             <div className="p-5 md:p-6 rounded-2xl shadow-sm text-white relative overflow-hidden" style={{backgroundColor: BRAND.blueDark}}>
                <div className="flex justify-between items-start mb-6 md:mb-10"><h3 className="text-sm md:text-base font-medium tracking-wide text-white/80">Conversão</h3><span className="text-white/50">⚙️</span></div>
                <div className="text-5xl md:text-6xl font-light text-right">{taxaConversao}%</div>
             </div>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
             <div className="p-5 md:p-6 rounded-2xl shadow-sm text-white" style={{backgroundColor: BRAND.blueLight}}><h3 className="text-xs md:text-sm font-medium text-white/80 mb-4 md:mb-6">Número de Leads convertidos</h3><div className="text-4xl md:text-5xl font-light text-right">{leadsConvertidos.length}</div></div>
             <div className="p-5 md:p-6 rounded-2xl shadow-sm text-white" style={{backgroundColor: BRAND.gray}}><h3 className="text-xs md:text-sm font-medium text-white/80 mb-4 md:mb-6 truncate">Leads descartados</h3><div className="text-4xl md:text-5xl font-light text-right">{leadsPerdidos.length}</div></div>
             <div className="p-5 md:p-6 rounded-2xl shadow-sm text-white sm:col-span-2 lg:col-span-1 bg-red-500"><div className="flex justify-between items-start mb-4 md:mb-6"><h3 className="text-xs md:text-sm font-medium text-white/80">Perdido (Taxa)</h3><span className="text-white/50">⚙️</span></div><div className="text-4xl md:text-5xl font-light text-right">{taxaDescarte}%</div></div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4" style={{borderLeftColor: BRAND.yellow}}>
               <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest mb-4" style={{color: BRAND.gray}}>Termômetro de Follow-up</h3>
               <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div className="bg-slate-50 p-3 md:p-4 rounded-xl"><p className="text-[10px] md:text-xs font-bold mb-1" style={{color: BRAND.gray}}>Ociosos</p><p className="text-xl md:text-2xl font-black" style={{color: BRAND.black}}>{totalOciosos}</p></div>
                  <div className="bg-red-50 p-3 md:p-4 rounded-xl"><p className="text-[10px] md:text-xs font-bold text-red-400 mb-1">Atrasados</p><p className="text-xl md:text-2xl font-black text-red-700">{totalAtrasados}</p></div>
               </div>
               {maisAtrasado && maxDaysOcioso > 2 && (
                  <div className="p-3 rounded-lg flex items-center gap-3 border" style={{backgroundColor: `${BRAND.yellow}20`, borderColor: BRAND.yellow}}>
                     <span className="text-xl">🚨</span><div className="min-w-0"><p className="text-[9px] md:text-[10px] font-black uppercase" style={{color: BRAND.black}}>Revenda Mais Crítica</p><p className="text-sm font-bold truncate" style={{color: BRAND.black}}>{maisAtrasado.nome}</p><p className="text-xs font-medium truncate" style={{color: BRAND.gray}}>Esquecido há {maxDaysOcioso} dias úteis</p></div>
                  </div>
               )}
            </div>
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 flex flex-col justify-center" style={{borderLeftColor: BRAND.blue}}>
               <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest mb-2" style={{color: BRAND.gray}}>Ciclo Médio de Vendas</h3><p className="text-xs md:text-sm mb-4" style={{color: BRAND.gray}}>Tempo desde a criação até o final (Ganho/Perda)</p><div className="flex items-end gap-2"><span className="text-5xl md:text-6xl font-light" style={{color: BRAND.black}}>{cicloMedio}</span><span className="text-lg md:text-xl font-medium mb-2" style={{color: BRAND.gray}}>dias</span></div>
            </div>
         </div>

         <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
            <h3 className="text-base md:text-lg font-bold mb-6" style={{color: BRAND.black}}>Evolução Diária de Contatos (Canal)</h3>
            <div className="h-56 md:h-64">
               {lineChartData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis dataKey="date" tick={{fontSize: 10, fill: BRAND.gray}} />
                     <YAxis tick={{fontSize: 10, fill: BRAND.gray}} />
                     <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                     <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                     {canaisExistentes.map((c, idx) => (
                        <Line key={c} type="monotone" dataKey={c} stroke={CORES_GRAFICO[idx % CORES_GRAFICO.length]} strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                     ))}
                   </LineChart>
                 </ResponsiveContainer>
               ) : <div className="h-full flex items-center justify-center font-medium text-sm" style={{color: BRAND.gray}}>Sem dados para a linha do tempo.</div>}
            </div>
         </div>

         <div className="p-6 md:p-8 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6" style={{backgroundColor: BRAND.black}}>
             <div className="w-full md:w-auto">
                <p className="text-white/60 text-xs md:text-sm font-bold uppercase tracking-widest mb-1">Meta de Vendas ({filtroTempoDash})</p>
                <div className="flex items-end gap-2 mb-3"><span className="text-3xl md:text-4xl font-black" style={{color: BRAND.yellow}}>{leadsConvertidos.length}</span><span className="text-lg md:text-xl text-white/50 mb-0.5">/ {metaAtual} fechamentos</span></div>
                <div className="w-full md:w-64 h-3 rounded-full overflow-hidden" style={{backgroundColor: 'rgba(255,255,255,0.1)'}}><div className="h-full rounded-full transition-all duration-1000" style={{backgroundColor: BRAND.yellow, width: `${Math.min((leadsConvertidos.length/metaAtual)*100, 100)}%`}}></div></div>
             </div>
             <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-white/20 pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
                <p className="text-white/60 text-xs md:text-sm font-bold uppercase tracking-widest mb-1">Projeção de Ganhos</p>
                <p className="text-3xl md:text-4xl font-black text-white">R$ {valorComissao.toLocaleString('pt-BR')}</p>
                <p className="text-xs md:text-sm font-medium mt-1" style={{color: BRAND.yellow}}>+ R$ {COMISSAO_REVENDA} por venda</p>
             </div>
         </div>
      </div>
    );
  };

  if (erroPermissaoFirebase) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 w-full p-4 md:p-6">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap'); * { font-family: 'Lexend', sans-serif; }`}</style>
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl w-full max-w-lg text-center border-t-8 border-red-500">
          <div className="text-5xl md:text-6xl mb-4">🔒</div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-4">Firebase Bloqueado</h2>
          <p className="text-slate-600 mb-6 font-medium text-sm md:text-base">O Google impediu a leitura dos dados. Precisamos liberar a regra de permissão no seu Firebase.</p>
          <div className="bg-slate-100 p-3 md:p-4 rounded-xl text-left text-xs md:text-sm font-mono text-slate-700 overflow-x-auto mb-6">
            <p>1. Vá no Firebase &gt; Firestore Database &gt; Aba "Regras"</p>
            <p>2. Substitua o código por:</p><br/><p className="text-blue-600 font-bold">match /{'{document=**}'} {'{'}</p><p className="text-blue-600 font-bold ml-4">allow read, write: if true;</p><p className="text-blue-600 font-bold">{'}'}</p><br/>
            <p>3. Clique em Publicar e recarregue a página.</p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 md:py-4 rounded-xl transition-all shadow-md">Já liberei, tentar novamente</button>
        </div>
      </div>
    );
  }

  if (carregandoDados) return <div className="flex h-screen items-center justify-center bg-slate-50"><style>{`@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap'); * { font-family: 'Lexend', sans-serif; }`}</style><p className="text-lg md:text-xl font-bold animate-pulse" style={{color: BRAND.gray}}>Conectando ao Banco de Dados...</p></div>;

  if (!logado) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 w-full" style={{backgroundColor: BRAND.blueLight}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap'); * { font-family: 'Lexend', sans-serif; }`}</style>
        {/* Forma de "Janela" Appgas (Canto Superior Direito e Inferior Esquerdo Retos, Resto Arredondado) */}
        <div className="bg-white p-6 md:p-10 shadow-2xl w-full mx-4 max-w-md text-center relative overflow-hidden rounded-tl-[40px] rounded-br-[40px] rounded-tr-xl rounded-bl-xl border-t-8" style={{borderTopColor: BRAND.blue}}>
          <div className="mb-6 flex justify-center mt-2">
            <div className="w-16 h-16 rounded-2xl shadow-lg text-white font-black text-2xl flex items-center justify-center rotate-3" style={{backgroundColor: BRAND.blue}}>
              <svg className="w-8 h-8 -rotate-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-black mb-2" style={{color: BRAND.black}}>Acesso ao CRM</h2>
          <p className="mb-8 text-[10px] md:text-xs uppercase tracking-widest font-bold" style={{color: BRAND.gray}}>A Cultura da Agilidade</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="Nome de Usuário" className="w-full border-2 border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:bg-white transition-colors font-medium text-base text-center" style={{color: BRAND.black}} value={vendedor} onChange={(e) => setVendedor(e.target.value)} />
            <input type="password" placeholder="Sua Senha" className="w-full border-2 border-slate-200 bg-slate-50 p-4 rounded-xl focus:outline-none focus:bg-white transition-colors font-medium text-base text-center" style={{color: BRAND.black}} value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button type="submit" className="w-full text-white font-bold py-4 rounded-xl transition-all shadow-md text-base md:text-lg flex justify-center items-center gap-2 mt-2 hover:-translate-y-0.5" style={{backgroundColor: BRAND.blue}}>
              Entrar na Carteira <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen font-sans overflow-hidden w-full bg-slate-50">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap'); * { font-family: 'Lexend', sans-serif; }`}</style>
      
      {toastMsg && (
        <div className={`absolute top-4 md:top-6 right-4 md:right-8 z-[100] text-white px-4 md:px-5 py-3 rounded-2xl shadow-xl text-xs md:text-sm font-bold flex items-center gap-3 border ${toastErro ? 'bg-red-500 border-red-600' : 'bg-[#101011] border-[#101011]'}`}>
          {toastMsg}
        </div>
      )}
      {uploadProgresso && (
        <div className="absolute top-16 md:top-20 right-4 md:right-8 z-[100] text-white px-4 md:px-5 py-3 rounded-2xl shadow-xl text-xs md:text-sm font-bold flex items-center gap-3 animate-pulse border" style={{backgroundColor: BRAND.blue, borderColor: BRAND.blueDark}}>
          ☁️ {uploadProgresso}
        </div>
      )}

      {/* Header Mobile */}
      <div className="md:hidden flex items-center justify-between text-white p-4 shrink-0 w-full z-40 shadow-md h-16 absolute top-0" style={{backgroundColor: BRAND.blue}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-inner" style={{backgroundColor: BRAND.blueDark}}>
            {vendedor.charAt(0).toUpperCase()}
          </div>
          <span className="font-black text-lg tracking-tight">CRM Appgas</span>
        </div>
        <button onClick={() => setMenuMobileAberto(!menuMobileAberto)} className="p-2 rounded-xl border border-white/20 hover:bg-white/10">
          {menuMobileAberto ? (
             <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
             <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          )}
        </button>
      </div>

      {menuMobileAberto && <div className="fixed inset-0 bg-slate-900/60 z-30 md:hidden backdrop-blur-sm" onClick={fecharMenuMobile}></div>}

      {/* Sidebar de Navegação */}
      <div className={`${menuMobileAberto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 fixed md:relative z-40 md:z-20 w-[85%] sm:w-80 md:w-80 bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-lg h-full pt-16 md:pt-0`}>
        <div className="p-4 md:p-6 text-white shrink-0 rounded-br-[40px] hidden md:block" style={{backgroundColor: BRAND.blue}}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 md:w-12 h-10 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl font-black shadow-inner border-2 border-white/20" style={{backgroundColor: BRAND.blueDark}}>
                {vendedor.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-black text-lg md:text-xl tracking-tight">Painel Geral</h2>
            </div>
            <button onClick={() => setLogado(false)} className="p-2 md:p-2.5 rounded-xl text-white hover:bg-white/20 transition-colors border border-white/20">
              <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
          
          <div className="inline-flex items-center gap-2 mb-4 md:mb-5 rounded-full px-3 py-1.5 border border-white/20 shadow-inner" style={{backgroundColor: BRAND.blueDark}}>
            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(240,180,46,0.8)]" style={{backgroundColor: BRAND.yellow}}></div>
            <span className="text-[10px] md:text-xs font-bold text-white">{leadsFiltradosGeral.length} revendas</span>
          </div>

          <div className="relative">
            <input type="text" placeholder="Buscar revenda ou documento..." className="w-full text-[11px] md:text-sm border border-white/20 text-white p-3 md:p-3.5 pl-9 md:pl-10 rounded-xl focus:outline-none placeholder-white/50 font-medium shadow-inner" style={{backgroundColor: BRAND.blueDark}} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <svg className="w-4 h-4 text-white/50 absolute left-3 md:left-3.5 top-3 md:top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        <div className="md:hidden p-4 text-white shrink-0" style={{backgroundColor: BRAND.blue}}>
           <div className="relative">
            <input type="text" placeholder="Buscar revenda ou documento..." className="w-full text-xs border border-white/20 text-white p-3 pl-9 rounded-xl focus:outline-none placeholder-white/50 font-medium" style={{backgroundColor: BRAND.blueDark}} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <svg className="w-4 h-4 text-white/50 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 mx-4 mt-4 rounded-xl gap-1 shrink-0 overflow-x-auto relative">
          <button onClick={() => mudarVisao('lista')} className={`flex-1 min-w-[50px] text-[10px] md:text-[11px] font-bold py-2 px-1 rounded-lg transition-all ${visaoAtual === 'lista' && !leadAtual ? 'bg-white shadow-sm' : 'hover:text-slate-800'}`} style={{color: visaoAtual === 'lista' && !leadAtual ? BRAND.blue : BRAND.gray}}>Lista</button>
          <button onClick={() => mudarVisao('kanban')} className={`flex-1 min-w-[60px] text-[10px] md:text-[11px] font-bold py-2 px-1 rounded-lg transition-all ${visaoAtual === 'kanban' && !leadAtual ? 'bg-white shadow-sm' : 'hover:text-slate-800'}`} style={{color: visaoAtual === 'kanban' && !leadAtual ? BRAND.blue : BRAND.gray}}>Kanban</button>
          <button onClick={() => mudarVisao('dashboard')} className={`flex-1 min-w-[60px] text-[10px] md:text-[11px] font-bold py-2 px-1 rounded-lg transition-all ${visaoAtual === 'dashboard' ? 'bg-white shadow-sm' : 'hover:text-slate-800'}`} style={{color: visaoAtual === 'dashboard' ? BRAND.blue : BRAND.gray}}>Métricas</button>
          <button onClick={() => mudarVisao('mapa')} className={`flex-1 min-w-[50px] text-[10px] md:text-[11px] font-bold py-2 px-1 rounded-lg transition-all ${visaoAtual === 'mapa' && !leadAtual ? 'bg-white shadow-sm' : 'hover:text-slate-800'}`} style={{color: visaoAtual === 'mapa' && !leadAtual ? BRAND.blue : BRAND.gray}}>Mapa</button>
          <button onClick={() => mudarVisao('appgas')} className={`flex-1 min-w-[60px] text-[10px] md:text-[11px] font-bold py-2 px-1 rounded-lg transition-all ${visaoAtual === 'appgas' ? 'bg-white shadow-sm' : 'hover:text-slate-800'}`} style={{color: visaoAtual === 'appgas' ? BRAND.blue : BRAND.gray}}>Appgas</button>
        </div>

        <div className="px-4 py-3 shrink-0 border-b border-slate-100">
           <button onClick={() => { setModalNovoLead(true); fecharMenuMobile(); }} className="w-full text-white text-[10px] md:text-xs font-bold py-2.5 md:py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 mb-2" style={{backgroundColor: BRAND.blue}}>
             + Cadastrar Novo Lead
           </button>
           
           {isAdmin && (
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
              <button onClick={() => mudarVisao('gerenciar')} className="w-full text-white text-[10px] md:text-xs font-bold py-2.5 md:py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors hover:opacity-90" style={{backgroundColor: BRAND.black}}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                Gerenciar Vendedores
              </button>
              <button onClick={() => setModalLote(true)} className="w-full text-white text-[10px] md:text-xs font-bold py-2 md:py-2.5 rounded-xl shadow-sm flex justify-center items-center gap-1 transition-colors hover:opacity-90" style={{backgroundColor: BRAND.yellow, color: BRAND.black}}>
                 ⇄ Transferência em Lote
              </button>
              <div>
                <input type="file" accept=".csv" onChange={(e) => { lidarUploadCSV(e); fecharMenuMobile(); }} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="w-full text-white text-[10px] md:text-xs font-bold py-2.5 md:py-3 rounded-xl shadow-sm cursor-pointer flex justify-center items-center gap-2 transition-colors hover:opacity-90" style={{backgroundColor: BRAND.blueDark}}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  Subir Planilha CSV
                </label>
              </div>
            </div>
          )}
        </div>

        {!leadAtual && visaoAtual === 'lista' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {leadsFiltradosGeral.slice(0, 100).map(lead => {
              const urg = getUrgency(lead);
              return (
                <div key={lead.id} onClick={() => { setLeadSelecionadoId(lead.id); setVeioDoMapa(false); fecharMenuMobile(); }} className={`bg-white p-4 rounded-2xl cursor-pointer transition-all border shadow-sm hover:shadow-md ${urg.status === 'atrasado' || urg.status === 'ocioso' ? 'border-red-400 border-2' : 'border-slate-200'}`}>
                  <h3 className="font-bold text-xs md:text-sm mb-1 truncate" style={{color: BRAND.black}}>{lead.nome || 'Sem Nome'}</h3>
                  <p className="text-[10px] md:text-xs mb-3 truncate" style={{color: BRAND.gray}}>{lead.cidade ? `${lead.cidade} - ${lead.uf}` : '-'}</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-2 md:px-2.5 py-1 text-[9px] md:text-[10px] font-extrabold rounded-lg border uppercase ${lead.telefone ? 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{lead.telefone ? 'Com Tel' : 'Sem Tel'}</span>
                    <span className="text-[9px] md:text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg border" style={{backgroundColor: `${BRAND.blue}10`, color: BRAND.blue, borderColor: `${BRAND.blue}30`}}>{lead.responsavel || 'SEM DONO'}</span>
                  </div>
                  {urg.status !== 'novo' && urg.status !== 'em_dia' && urg.status !== 'finalizado' && (
                     <div className={`text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-md text-center border ${urg.css}`}>{urg.texto}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 bg-slate-50 relative h-full flex flex-col min-w-0 overflow-hidden pt-16 md:pt-0">
        
        {leadAtual ? (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto pb-20">
              <button onClick={() => setLeadSelecionadoId(null)} className="mb-4 md:mb-6 bg-white border border-slate-200 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors w-fit" style={{color: BRAND.gray}}>
                ← Voltar
              </button>

              <div className="bg-white rounded-2xl md:rounded-[32px] shadow-sm border border-slate-200 overflow-hidden mb-6 md:mb-8">
                <div className="h-2 md:h-2.5" style={{backgroundColor: BRAND.blue}}></div>
                <div className="p-5 md:p-10">
                  <div className="flex flex-col md:flex-row gap-3 mb-6 items-start md:items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                       <span className="px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-black rounded-xl border uppercase tracking-widest shadow-sm" style={{backgroundColor: `${BRAND.yellow}20`, color: BRAND.black, borderColor: BRAND.yellow}}>
                         Classe {leadAtual['Classe Revenda'] || 'C'}
                       </span>
                       <span className="px-3 md:px-4 py-1.5 bg-slate-50 text-[10px] md:text-xs font-bold rounded-xl border border-slate-200 shadow-sm" style={{color: BRAND.gray}}>
                         {leadAtual['CPF/CNPJ'] || 'Documento Não Informado'}
                       </span>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        <div className="flex items-center rounded-xl overflow-hidden shadow-sm border" style={{backgroundColor: `${BRAND.blue}10`, borderColor: `${BRAND.blue}30`}}>
                            <span className="px-3 py-1.5 text-[10px] md:text-xs font-bold border-r" style={{color: BRAND.blueDark, borderColor: `${BRAND.blue}30`}}>Dono:</span>
                            {isAdmin ? (
                                <select className="bg-transparent text-[10px] md:text-xs font-bold px-2 py-1.5 outline-none cursor-pointer" style={{color: BRAND.blueDark}}
                                        value={leadAtual.responsavel || ''} 
                                        onChange={(e) => {
                                            updateDoc(doc(db, "leads", leadAtual.id), { responsavel: e.target.value });
                                            mostrarMensagem('Vendedor alterado!');
                                        }}>
                                    <option value="">Sem Dono</option>
                                    {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                                </select>
                            ) : (
                                <span className="px-3 py-1.5 text-[10px] md:text-xs font-bold" style={{color: BRAND.blueDark}}>{leadAtual.responsavel || 'Sem dono'}</span>
                            )}
                        </div>
                        {isAdmin && (
                            <button onClick={() => setLeadParaExcluir(leadAtual)} className="px-3 md:px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-[10px] md:text-xs font-bold rounded-xl border border-red-200 transition-colors shadow-sm">
                                Excluir
                            </button>
                        )}
                    </div>
                  </div>
                  
                  <h1 className="text-3xl md:text-5xl font-black mb-6 md:mb-8 tracking-tight" style={{color: BRAND.black}}>{leadAtual.nome || 'Sem Nome'}</h1>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="flex items-center gap-3 md:gap-4 bg-slate-50 p-4 md:p-5 rounded-2xl border border-[#f1f5f9]">
                      <div className="text-slate-400">📍</div>
                      <span className="font-semibold text-sm md:text-lg" style={{color: BRAND.black}}>{leadAtual.cidade || '-'} - {leadAtual.uf || '-'}</span>
                    </div>
                    
                    <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-[#f1f5f9]">
                      <div className="flex justify-between items-center mb-3">
                         <div className="flex items-center gap-2" style={{color: BRAND.gray}}>
                             📞 <span className="text-xs font-bold uppercase tracking-wider">Telefones</span>
                         </div>
                         {!editandoTels ? (
                             <button onClick={() => { setTelsTemp(leadAtual.telefones?.length > 0 ? [...leadAtual.telefones] : (leadAtual.telefone ? [leadAtual.telefone] : [])); setEditandoTels(true); }} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors" style={{color: BRAND.blue}}>Editar</button>
                         ) : (
                             <div className="flex gap-2">
                                 <button onClick={() => setEditandoTels(false)} className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold shadow-sm hover:bg-slate-50">Cancelar</button>
                                 <button onClick={async () => {
                                     const limpos = telsTemp.map(t => t.trim()).filter(t => t !== '');
                                     try {
                                         await updateDoc(doc(db, "leads", leadAtual.id), { telefones: limpos, telefone: limpos[0] || '' });
                                         setEditandoTels(false);
                                         mostrarMensagem('Telefones salvos!');
                                     } catch(e) { mostrarMensagem('Erro ao salvar', true); }
                                 }} className="text-white px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold shadow-sm hover:opacity-90" style={{backgroundColor: BRAND.blue}}>Salvar</button>
                             </div>
                         )}
                      </div>
                      
                      {!editandoTels ? (
                         <div className="flex flex-col gap-2">
                             {(() => {
                                 const displayTels = leadAtual.telefones?.length > 0 ? leadAtual.telefones : (leadAtual.telefone ? [leadAtual.telefone] : []);
                                 if (displayTels.length === 0) return <span className="font-semibold text-sm md:text-base" style={{color: BRAND.gray}}>Sem telefone cadastrado</span>;
                                 
                                 return displayTels.map((tel, idx) => (
                                     <button key={idx} onClick={() => abrirWhatsApp(tel)} className="font-semibold text-sm md:text-base flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full transition-all text-left hover:border-[#2D6FEF]" style={{color: BRAND.black}}>
                                         {tel}
                                         <span className="text-[10px] bg-[#25D366] text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.347-.272.271-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                            Iniciar
                                         </span>
                                     </button>
                                 ));
                             })()}
                         </div>
                      ) : (
                         <div className="flex flex-col gap-2">
                             {telsTemp.map((tel, idx) => (
                                 <div key={idx} className="flex gap-2 items-center">
                                     <input type="text" className="flex-1 border-2 border-slate-200 p-2.5 rounded-xl text-sm font-semibold outline-none bg-white" style={{color: BRAND.black}} value={tel} onChange={e => { const n = [...telsTemp]; n[idx] = e.target.value; setTelsTemp(n); }} placeholder="Ex: 11999999999" />
                                     <button onClick={() => { const n = [...telsTemp]; n.splice(idx, 1); setTelsTemp(n); }} className="bg-red-50 text-red-500 hover:bg-red-100 p-2.5 rounded-xl font-bold transition-colors">✕</button>
                                 </div>
                             ))}
                             <button onClick={() => setTelsTemp([...telsTemp, ''])} className="mt-1 text-xs font-bold border py-3 rounded-xl transition-colors border-dashed w-full text-center" style={{color: BRAND.blue, borderColor: BRAND.blue, backgroundColor: `${BRAND.blue}10`}}>+ Adicionar Número</button>
                         </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#f8fafc] p-4 rounded-2xl border border-slate-200">
                     <span className="text-xs font-bold uppercase tracking-widest" style={{color: BRAND.gray}}>Etapa Atual:</span>
                     <select 
                        className="bg-white border border-slate-300 p-2.5 rounded-xl text-sm font-bold outline-none w-full sm:flex-1 shadow-sm"
                        style={{color: BRAND.black}}
                        value={leadAtual.etapa_funil || ETAPAS.LEAD}
                        onChange={(e) => mudarEtapaLead(leadAtual, e.target.value)}
                     >
                        {Object.values(ETAPAS).map(e => <option key={e} value={e}>{e}</option>)}
                     </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl md:rounded-[32px] shadow-sm border border-slate-200 p-5 md:p-10 mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-black mb-5 md:mb-6 flex items-center gap-3" style={{color: BRAND.black}}>
                   <div className="p-2 rounded-xl" style={{backgroundColor: `${BRAND.blue}20`, color: BRAND.blue}}><svg className="w-5 md:w-6 h-5 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div>
                   Registrar Nova Interação
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                  <div>
                    <input type="text" placeholder="Nome do Contato (Ex: Sr. Marcos - Gerente)" className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 md:p-4 rounded-2xl outline-none font-medium text-sm md:text-base placeholder-slate-400" style={{color: BRAND.black}} value={novoComentario.contato} onChange={e => setNovoComentario({...novoComentario, contato: e.target.value})} />
                  </div>
                  <div>
                    <select className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 md:p-4 rounded-2xl outline-none font-medium text-sm md:text-base" style={{color: BRAND.gray}} value={novoComentario.canal} onChange={e => setNovoComentario({...novoComentario, canal: e.target.value})}>
                      <option value="WhatsApp">🟢 WhatsApp</option>
                      <option value="Ligação">📞 Ligação</option>
                      <option value="E-mail">✉️ E-mail</option>
                      <option value="Visita Presencial">🤝 Visita Presencial</option>
                    </select>
                  </div>
                </div>
                
                <div className="mb-4 md:mb-6">
                  <textarea placeholder="Detalhe a conversa, ofertas feitas, condições..." className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 md:p-4 rounded-2xl outline-none h-28 md:h-32 resize-none font-medium text-sm md:text-base placeholder-slate-400" style={{color: BRAND.black}} value={novoComentario.observacao} onChange={e => setNovoComentario({...novoComentario, observacao: e.target.value})}></textarea>
                </div>

                <div className="flex flex-col md:flex-row gap-4 md:gap-6 bg-[#f8fafc] p-4 md:p-6 rounded-2xl border border-slate-100">
                  <div className="flex-1">
                    <label className="block text-[10px] md:text-xs font-black mb-2 uppercase tracking-wider" style={{color: BRAND.gray}}>⏱ Agendar Follow-up (Retorno)</label>
                    <input type="datetime-local" className="w-full bg-white border-2 border-slate-200 p-3 md:p-3.5 rounded-xl outline-none font-bold text-sm" style={{color: BRAND.black}} value={novoComentario.proximo_contato} onChange={e => setNovoComentario({...novoComentario, proximo_contato: e.target.value})} />
                  </div>
                  <button onClick={salvarComentario} className="w-full md:w-auto text-white font-black px-6 md:px-10 py-3.5 md:py-4 rounded-xl shadow-md md:mt-auto transition-colors text-sm md:text-base hover:opacity-90" style={{backgroundColor: BRAND.blue}}>Salvar Interação</button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-xl md:text-2xl mb-4 md:mb-6 flex items-center gap-3" style={{color: BRAND.black}}>
                   <div className="bg-slate-200 p-2 rounded-lg" style={{color: BRAND.gray}}><svg className="w-5 md:w-6 h-5 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                   Linha do Tempo
                </h3>
                {historicoLead.map(h => (
                  <div key={h.id} className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 md:w-1.5`} style={{backgroundColor: h.canal === 'Automático' ? BRAND.yellow : BRAND.blue}}></div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 md:mb-4 gap-2 md:gap-3 ml-2 md:ml-3">
                       <div className="flex items-center gap-2 flex-wrap">
                           <span className="px-2 md:px-3 py-1 rounded-md font-bold text-xs md:text-sm border bg-slate-100 border-slate-200" style={{color: BRAND.black}}>{h.vendedor}</span>
                           <span className="text-xs md:text-sm font-medium" style={{color: BRAND.gray}}>via {h.canal} com</span>
                           <strong className="text-sm md:text-base" style={{color: BRAND.black}}>{h.contato}</strong>
                       </div>
                       <span className="text-[10px] md:text-xs font-bold bg-slate-100 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border border-slate-200" style={{color: BRAND.gray}}>{h.data_hora}</span>
                    </div>
                    <p className="font-medium ml-2 md:ml-3 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100 whitespace-pre-wrap text-xs md:text-sm" style={{color: BRAND.black}}>{h.observacao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : visaoAtual === 'kanban' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 flex gap-4 md:gap-6 h-full bg-slate-100 items-start">
            {Object.values(ETAPAS).map(etapa => {
              const leadsEtapa = leadsFiltradosGeral.filter(l => {
                if (etapa === ETAPAS.FINALIZADO) return l.etapa_funil === ETAPAS.FINALIZADO;
                return (l.etapa_funil || ETAPAS.LEAD) === etapa && l.etapa_funil !== ETAPAS.FINALIZADO;
              }).sort((a, b) => getUrgency(a).order - getUrgency(b).order);

              return (
                <div key={etapa} className="w-[85vw] sm:w-[320px] md:w-[340px] shrink-0 flex flex-col bg-slate-200/50 rounded-[20px] md:rounded-[24px] border border-slate-200/60 max-h-full overflow-hidden" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, etapa)}>
                  <div className="p-3 md:p-4 flex justify-between items-center bg-slate-200/80">
                    <span className="font-black text-xs md:text-sm uppercase tracking-wider" style={{color: BRAND.black}}>{etapa}</span>
                    <span className="bg-white text-[10px] md:text-xs font-black px-2 md:px-2.5 py-0.5 md:py-1 rounded-full shadow-sm" style={{color: BRAND.gray}}>{leadsEtapa.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-3 md:space-y-4">
                    {leadsEtapa.map(lead => {
                      const urg = getUrgency(lead);
                      return (
                        <div key={lead.id} draggable onDragStart={(e) => setDraggedLeadId(lead.id)} className={`bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border-2 shadow-sm cursor-grab ${urg.status === 'atrasado' || urg.status === 'ocioso' ? 'border-red-400' : 'border-[#e2e8f0]'}`}>
                          <div className="text-[9px] md:text-[10px] font-black uppercase bg-slate-50 px-2 py-1 rounded-md mb-2 truncate" style={{color: BRAND.gray}}>📍 {lead.cidade} - {lead.uf}</div>
                          <h4 className="font-black text-sm md:text-base mb-2 md:mb-3 leading-tight truncate" style={{color: BRAND.black}}>{lead.nome || 'Sem Nome'}</h4>
                          <div className={`text-[10px] md:text-[11px] font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg mb-3 md:mb-4 text-center border ${urg.css}`}>{urg.texto}</div>
                          
                          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                            {lead.etapa_funil !== ETAPAS.FINALIZADO && <button onClick={() => setModalFinalizar({type: 'perda', lead})} className="py-1.5 md:py-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs">👎</button>}
                            <button onClick={() => { setLeadSelecionadoId(lead.id); setVeioDoMapa(false); }} className={`py-1.5 md:py-2 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs transition-colors hover:text-white ${lead.etapa_funil === ETAPAS.FINALIZADO ? 'col-span-3' : ''}`} style={{backgroundColor: `${BRAND.blue}10`, color: BRAND.blue}} onMouseEnter={e => e.target.style.backgroundColor = BRAND.blue} onMouseLeave={e => e.target.style.backgroundColor = `${BRAND.blue}10`} >Abrir</button>
                            {lead.etapa_funil !== ETAPAS.FINALIZADO && <button onClick={() => setModalFinalizar({type: 'ganho', lead})} className="py-1.5 md:py-2 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs">🏆</button>}
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
        ) : visaoAtual === 'mapa' ? (
          <div className="flex-1 p-4 md:p-6 h-full flex flex-col relative bg-slate-50">
             <button onClick={voltarVisao} className="mb-4 bg-white border border-slate-200 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors w-fit" style={{color: BRAND.gray}}>
                ← Voltar
             </button>
             
             <div className="flex gap-2 overflow-x-auto mb-4 shrink-0 pb-2">
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm min-w-[120px] flex-1">
                   <p className="text-[10px] md:text-xs font-bold uppercase" style={{color: BRAND.gray}}>Total na Área</p>
                   <p className="text-xl md:text-2xl font-black" style={{color: BRAND.black}}>{leadsFiltradosGeral.length}</p>
                </div>
                <div className="p-3 md:p-4 rounded-xl border shadow-sm min-w-[120px] flex-1" style={{backgroundColor: `${BRAND.yellow}10`, borderColor: `${BRAND.yellow}30`}}>
                   <p className="text-[10px] md:text-xs font-bold uppercase" style={{color: BRAND.black}}>🏆 Fechados</p>
                   <p className="text-xl md:text-2xl font-black" style={{color: BRAND.black}}>{leadsFiltradosGeral.filter(l => l.status_venda === 'Ganho').length}</p>
                </div>
                <div className="bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm min-w-[120px] flex-1">
                   <p className="text-[10px] md:text-xs font-bold uppercase" style={{color: BRAND.gray}}>Leads Frios</p>
                   <p className="text-xl md:text-2xl font-black" style={{color: BRAND.black}}>{leadsFiltradosGeral.filter(l => !l.etapa_funil || l.etapa_funil === ETAPAS.LEAD).length}</p>
                </div>
                <div className="p-3 md:p-4 rounded-xl border shadow-sm min-w-[120px] flex-1" style={{backgroundColor: `${BRAND.blue}10`, borderColor: `${BRAND.blue}30`}}>
                   <p className="text-[10px] md:text-xs font-bold uppercase" style={{color: BRAND.blueDark}}>Em Negociação</p>
                   <p className="text-xl md:text-2xl font-black" style={{color: BRAND.blue}}>{leadsFiltradosGeral.filter(l => l.etapa_funil === ETAPAS.NEGOCIACAO).length}</p>
                </div>
             </div>

             <div className="flex-1 rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative z-0">
                <MapaDinamico 
                    leads={leadsFiltradosGeral} 
                    initialView={mapaVisao}
                    onMapChange={(view) => setMapaVisao(view)}
                    onMarkerClick={(id) => { setLeadSelecionadoId(id); setVeioDoMapa(true); }} 
                />
                
                <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200 text-xs pointer-events-none">
                    <p className="font-bold mb-3 text-sm" style={{color: BRAND.black}}>Legenda de Funil</p>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                        <div className="flex flex-col gap-2 font-medium" style={{color: BRAND.gray}}>
                            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: BRAND.gray}}></div> Lead Novo</span>
                            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: BRAND.blueLight}}></div> Apresentação</span>
                            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: BRAND.yellow}}></div> Negociação</span>
                        </div>
                        <div className="flex flex-col gap-2 font-medium" style={{color: BRAND.gray}}>
                            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: BRAND.blue}}></div> Cadastro</span>
                            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: BRAND.blueDark}}></div> Treinamento</span>
                            <span className="flex items-center gap-2 font-bold" style={{color: BRAND.black}}><span className="text-base leading-none">🏆</span> Negócio Ganho</span>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        ) : visaoAtual === 'appgas' ? (
          <div className="flex-1 p-4 md:p-10 h-full bg-slate-50 flex flex-col">
             <button onClick={voltarVisao} className="mb-4 bg-white border border-slate-200 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors w-fit" style={{color: BRAND.gray}}>
                ← Voltar
             </button>
             <div className="flex-1 flex items-center justify-center">
                 <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200 max-w-lg w-full text-center">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner" style={{backgroundColor: `${BRAND.blue}10`, color: BRAND.blue}}>
                       <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                    </div>
                    <h2 className="text-2xl font-black mb-3" style={{color: BRAND.black}}>Portal Appgas</h2>
                    <p className="text-sm mb-8 leading-relaxed" style={{color: BRAND.gray}}>
                       Você está prestes a abrir o painel administrativo oficial. A conexão é segura e sua sessão será mantida na nova aba.
                    </p>
                    <a href="https://admin.appgas.com/" target="_blank" rel="noreferrer" className="block w-full text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg hover:opacity-90" style={{backgroundColor: BRAND.blue}}>
                       Abrir admin.appgas.com ↗
                    </a>
                 </div>
             </div>
          </div>
        ) : visaoAtual === 'gerenciar' && isAdmin ? (
          <div className="flex-1 p-4 md:p-8 bg-slate-50 overflow-y-auto">
             <button onClick={voltarVisao} className="mb-4 bg-white border border-slate-200 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-colors w-fit" style={{color: BRAND.gray}}>
                ← Voltar
             </button>
             <h2 className="text-2xl md:text-3xl font-black mb-6 md:mb-8" style={{color: BRAND.black}}>Painel de Configurações</h2>
             
             <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 md:mb-8">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{color: BRAND.gray}}>🤖 Inteligência Artificial</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                   <select className="flex-1 border p-3 rounded-xl text-xs md:text-sm font-bold outline-none bg-slate-50" style={{color: BRAND.black}} value={filtroExportacao} onChange={e=>setFiltroExportacao(e.target.value)}>
                      <option value="tudo">Extrair Todo o Histórico</option>
                      <option value="mes">Extrair Apenas Este Mês</option>
                      <option value="semana">Extrair Esta Semana</option>
                   </select>
                   <button onClick={exportarCSV} className="text-white text-xs md:text-sm font-bold px-6 py-3 rounded-xl shadow-sm flex justify-center items-center gap-2 transition-colors hover:opacity-90" style={{backgroundColor: BRAND.blueDark}}>
                      ⬇️ Baixar CSV para a IA
                   </button>
                </div>
             </div>

             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                 <div>
                     <h3 className="text-lg md:text-xl font-bold mb-4" style={{color: BRAND.black}}>👥 Vendedores Autorizados</h3>
                     <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 rounded-xl border outline-none font-bold text-sm" style={{color: BRAND.black}} placeholder="Novo Vendedor" value={novoVendedorNome} onChange={e=>setNovoVendedorNome(e.target.value)} />
                        <input type="password" className="flex-1 p-3 rounded-xl border outline-none font-bold text-sm" style={{color: BRAND.black}} placeholder="Senha" value={novoVendedorSenha} onChange={e=>setNovoVendedorSenha(e.target.value)} />
                        <button onClick={async () => { 
                            if(novoVendedorNome && novoVendedorSenha) { 
                                await addDoc(collection(db, "vendedores"), { nome: novoVendedorNome, senha: novoVendedorSenha, ativo: true }); 
                                setNovoVendedorNome(''); 
                                setNovoVendedorSenha('');
                                mostrarMensagem('Vendedor salvo!'); 
                            } else {
                                mostrarMensagem('Preencha o nome e a senha!', true);
                            }
                        }} className="text-white px-5 py-3 rounded-xl font-bold text-sm" style={{backgroundColor: BRAND.black}}>Add</button>
                     </div>
                     <div className="bg-white rounded-2xl border overflow-hidden">
                        {vendedores.map(v => (
                           <div key={v.id} className="p-4 border-b last:border-0 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white hover:bg-slate-50 gap-3">
                              <div className="flex flex-col">
                                 <span className="font-bold text-sm md:text-base" style={{color: BRAND.black}}>{v.nome}</span>
                                 <span className="text-xs font-medium" style={{color: BRAND.gray}}>Status: {v.ativo ? 'Ativo' : 'Bloqueado'}</span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2">
                                 {vendedorEditandoId === v.id ? (
                                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                                       <input type="text" placeholder="Nova Senha" value={vendedorNovaSenha} onChange={(e) => setVendedorNovaSenha(e.target.value)} className="w-28 text-xs p-1.5 border rounded outline-none font-bold" style={{color: BRAND.black}} />
                                       <button onClick={async () => {
                                           if (vendedorNovaSenha.trim()) {
                                               await updateDoc(doc(db, "vendedores", v.id), { senha: vendedorNovaSenha.trim() });
                                               setVendedorEditandoId(null);
                                               mostrarMensagem('Senha atualizada!');
                                           } else {
                                               mostrarMensagem('Digite uma senha válida', true);
                                           }
                                       }} className="text-white px-3 py-1.5 rounded text-xs font-bold transition-colors" style={{backgroundColor: BRAND.blue}}>Salvar</button>
                                       <button onClick={() => setVendedorEditandoId(null)} className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition-colors">✕</button>
                                    </div>
                                 ) : (
                                    <button onClick={() => { setVendedorEditandoId(v.id); setVendedorNovaSenha(v.senha || ''); }} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors" style={{color: BRAND.gray}}>
                                       🔑 Editar Senha
                                    </button>
                                 )}

                                 <button onClick={() => updateDoc(doc(db, "vendedores", v.id), { ativo: !v.ativo })} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition-colors ${v.ativo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                                    {v.ativo ? 'Bloquear' : 'Desbloquear'}
                                 </button>
                                 
                                 {v.nome.toLowerCase() !== 'admin' && (
                                     <button onClick={() => setVendedorParaExcluir(v)} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-colors">
                                        🗑️ Excluir
                                     </button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                 </div>
                 <div>
                     <h3 className="text-lg md:text-xl font-bold mb-4" style={{color: BRAND.black}}>📉 Motivos de Perda (Funil)</h3>
                     <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 rounded-xl border outline-none font-bold text-sm" style={{color: BRAND.black}} placeholder="Novo Motivo" value={novoMotivo} onChange={e=>setNovoMotivo(e.target.value)} />
                        <button onClick={async () => { if(novoMotivo) { await setDoc(doc(db, "config", "motivos"), { lista: [...motivosPerda, novoMotivo] }); setNovoMotivo(''); mostrarMensagem('Motivo salvo!'); } }} className="bg-red-600 text-white px-5 md:px-6 rounded-xl font-bold text-sm">Add</button>
                     </div>
                     <div className="bg-white rounded-2xl border overflow-hidden">
                        {motivosPerda.map((m, idx) => (
                           <div key={idx} className="p-4 border-b last:border-0 flex justify-between items-center bg-white hover:bg-slate-50">
                              <span className="font-bold text-xs md:text-sm truncate mr-2" style={{color: BRAND.black}}>{m}</span>
                              <button onClick={async () => { await setDoc(doc(db, "config", "motivos"), { lista: motivosPerda.filter((_, i) => i !== idx) }); mostrarMensagem('Removido!'); }} className="text-red-500 hover:text-red-700 text-xs md:text-sm font-bold px-2">Excluir</button>
                           </div>
                        ))}
                     </div>
                 </div>
             </div>
          </div>
        ) : (
           <div className="flex flex-col h-full items-center justify-center bg-slate-50 p-6 text-center">
             <p className="text-lg md:text-xl font-bold" style={{color: BRAND.gray}}>Selecione uma visão no menu.</p>
           </div>
        )}

      {/* Modais */}
      {modalFinalizar && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h3 className={`text-xl md:text-2xl font-black mb-2 ${modalFinalizar.type === 'ganho' ? 'text-emerald-600' : 'text-red-600'}`}>
              {modalFinalizar.type === 'ganho' ? '🏆 Registrar Venda' : '👎 Registrar Perda'}
            </h3>
            <p className="text-slate-500 mb-6 font-medium text-sm md:text-base truncate">{modalFinalizar.lead.nome}</p>
            
            {modalFinalizar.type === 'perda' && (
              <select className="w-full border-2 border-slate-200 p-3.5 md:p-4 rounded-xl mb-6 font-medium text-sm md:text-base outline-none focus:border-red-400" style={{color: BRAND.black}} value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)}>
                <option value="">Selecione o motivo da perda...</option>
                {motivosPerda.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            
            <div className="flex gap-3">
              <button onClick={() => setModalFinalizar(null)} className="flex-1 px-4 py-3 md:py-3.5 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 text-sm md:text-base" style={{color: BRAND.gray}}>Cancelar</button>
              <button onClick={processarFinalizacao} className={`flex-1 px-4 py-3 md:py-3.5 text-white font-bold rounded-xl shadow-md text-sm md:text-base ${modalFinalizar.type === 'ganho' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {leadParaExcluir && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl border-t-8 border-red-500">
            <h3 className="text-xl md:text-2xl font-black mb-2" style={{color: BRAND.black}}>Excluir Revenda</h3>
            <p className="mb-6 font-medium text-sm md:text-base" style={{color: BRAND.gray}}>Tem certeza que deseja excluir <strong>{leadParaExcluir.nome}</strong>? Esta ação apagará todo o histórico e não poderá ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setLeadParaExcluir(null)} className="flex-1 px-4 py-3 md:py-3.5 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 text-sm md:text-base" style={{color: BRAND.gray}}>Cancelar</button>
              <button onClick={async () => {
                  try {
                      await deleteDoc(doc(db, "leads", leadParaExcluir.id));
                      setLeadSelecionadoId(null);
                      setLeadParaExcluir(null);
                      mostrarMensagem('Revenda excluída permanentemente!');
                  } catch(e) { 
                      mostrarMensagem('Erro ao excluir revenda.', true); 
                  }
              }} className="flex-1 px-4 py-3 md:py-3.5 text-white font-bold rounded-xl shadow-md bg-red-600 hover:bg-red-700 text-sm md:text-base">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {vendedorParaExcluir && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl border-t-8 border-red-500">
            <h3 className="text-xl md:text-2xl font-black mb-2" style={{color: BRAND.black}}>Excluir Vendedor</h3>
            <p className="mb-6 font-medium text-sm md:text-base" style={{color: BRAND.gray}}>
              Tem certeza que deseja excluir <strong>{vendedorParaExcluir.nome}</strong>? <br/><br/>
              Todas as revendas que estavam vinculadas a ele ficarão como <strong>"Sem dono"</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setVendedorParaExcluir(null)} className="flex-1 px-4 py-3 md:py-3.5 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 text-sm md:text-base" style={{color: BRAND.gray}}>Cancelar</button>
              <button onClick={async () => {
                  try {
                      const leadsVinculados = leads.filter(l => l.responsavel === vendedorParaExcluir.nome);
                      if (leadsVinculados.length > 0) {
                          const batch = writeBatch(db);
                          leadsVinculados.forEach(l => {
                              batch.update(doc(db, "leads", l.id), { responsavel: '' });
                          });
                          await batch.commit();
                      }
                      await deleteDoc(doc(db, "vendedores", vendedorParaExcluir.id));
                      setVendedorParaExcluir(null);
                      mostrarMensagem(`Vendedor excluído e ${leadsVinculados.length} revendas liberadas!`);
                  } catch(e) { 
                      mostrarMensagem('Erro ao excluir vendedor.', true); 
                  }
              }} className="flex-1 px-4 py-3 md:py-3.5 text-white font-bold rounded-xl shadow-md bg-red-600 hover:bg-red-700 text-sm md:text-base">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNovoLead && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl border-t-8" style={{borderTopColor: BRAND.blue}}>
            <h3 className="text-xl md:text-2xl font-black mb-6" style={{color: BRAND.black}}>Cadastrar Novo Lead</h3>
            
            <div className="space-y-4 mb-6">
               <input type="text" placeholder="Nome do Cliente / Revenda *" className="w-full border-2 border-slate-200 p-3.5 rounded-xl font-medium text-sm outline-none" style={{color: BRAND.black}} value={formNovoLead.nome} onChange={e => setFormNovoLead({...formNovoLead, nome: e.target.value})} />
               <input type="text" placeholder="WhatsApp / Telefone" className="w-full border-2 border-slate-200 p-3.5 rounded-xl font-medium text-sm outline-none" style={{color: BRAND.black}} value={formNovoLead.telefone} onChange={e => setFormNovoLead({...formNovoLead, telefone: e.target.value})} />
               <input type="text" placeholder="CPF ou CNPJ" className="w-full border-2 border-slate-200 p-3.5 rounded-xl font-medium text-sm outline-none" style={{color: BRAND.black}} value={formNovoLead.cnpj} onChange={e => setFormNovoLead({...formNovoLead, cnpj: e.target.value})} />
               <div className="flex gap-3">
                 <input type="text" placeholder="Cidade" className="w-full border-2 border-slate-200 p-3.5 rounded-xl font-medium text-sm outline-none" style={{color: BRAND.black}} value={formNovoLead.cidade} onChange={e => setFormNovoLead({...formNovoLead, cidade: e.target.value})} />
                 <input type="text" placeholder="UF" className="w-24 border-2 border-slate-200 p-3.5 rounded-xl font-medium text-sm outline-none text-center" style={{color: BRAND.black}} value={formNovoLead.uf} maxLength={2} onChange={e => setFormNovoLead({...formNovoLead, uf: e.target.value.toUpperCase()})} />
               </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setModalNovoLead(false)} className="flex-1 px-4 py-3 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 text-sm" style={{color: BRAND.gray}}>Cancelar</button>
              <button onClick={salvarNovoLead} className="flex-1 px-4 py-3 text-white font-bold rounded-xl shadow-md text-sm hover:opacity-90" style={{backgroundColor: BRAND.blue}}>
                Salvar Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {modalLote && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-t-8" style={{borderTopColor: BRAND.yellow}}>
             
             <div className="p-6 md:p-8 shrink-0 bg-white border-b border-slate-100">
                <h3 className="text-xl md:text-2xl font-black mb-2" style={{color: BRAND.black}}>Transferência em Lote</h3>
                <p className="text-sm font-medium mb-6" style={{color: BRAND.gray}}>Filtre a base, selecione os clientes e transfira de uma só vez.</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   <select className="border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" style={{color: BRAND.black}} value={loteFiltros.uf} onChange={e => setLoteFiltros({...loteFiltros, uf: e.target.value})}>
                      <option value="">Todos os Estados</option>
                      {[...new Set(leads.map(l => l.uf).filter(Boolean))].sort().map(uf => <option key={uf} value={uf}>{uf}</option>)}
                   </select>
                   <select className="border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" style={{color: BRAND.black}} value={loteFiltros.cidade} onChange={e => setLoteFiltros({...loteFiltros, cidade: e.target.value})}>
                      <option value="">Todas as Cidades</option>
                      {[...new Set(leads.filter(l => !loteFiltros.uf || l.uf === loteFiltros.uf).map(l => l.cidade).filter(Boolean))].sort().map(cid => <option key={cid} value={cid}>{cid}</option>)}
                   </select>
                   <select className="border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none" style={{color: BRAND.black}} value={loteFiltros.etapa} onChange={e => setLoteFiltros({...loteFiltros, etapa: e.target.value})}>
                      <option value="">Qualquer Etapa</option>
                      {Object.values(ETAPAS).map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                   <select className="border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none bg-blue-50" style={{color: BRAND.blueDark}} value={loteFiltros.responsavel} onChange={e => setLoteFiltros({...loteFiltros, responsavel: e.target.value})}>
                      <option value="">Qualquer Vendedor</option>
                      <option value="SEM_DONO">Sem Dono</option>
                      {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                   </select>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                {(() => {
                   const filtrados = leads.filter(l => {
                      if (loteFiltros.uf && l.uf !== loteFiltros.uf) return false;
                      if (loteFiltros.cidade && l.cidade !== loteFiltros.cidade) return false;
                      if (loteFiltros.etapa && (l.etapa_funil || ETAPAS.LEAD) !== loteFiltros.etapa) return false;
                      if (loteFiltros.responsavel) {
                          if (loteFiltros.responsavel === 'SEM_DONO' && l.responsavel) return false;
                          if (loteFiltros.responsavel !== 'SEM_DONO' && l.responsavel !== loteFiltros.responsavel) return false;
                      }
                      return true;
                   });

                   return (
                     <>
                       <div className="flex justify-between items-center mb-4 px-2">
                          <span className="text-sm font-bold" style={{color: BRAND.gray}}>{filtrados.length} encontrados</span>
                          <button onClick={() => {
                             if (loteSelecionados.length === filtrados.length) setLoteSelecionados([]);
                             else setLoteSelecionados(filtrados.map(f => f.id));
                          }} className="text-xs font-bold underline" style={{color: BRAND.blue}}>
                             {loteSelecionados.length === filtrados.length && filtrados.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                          </button>
                       </div>
                       
                       <div className="space-y-2">
                          {filtrados.map(lead => (
                             <div key={lead.id} onClick={() => {
                                 setLoteSelecionados(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id])
                             }} className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-colors ${loteSelecionados.includes(lead.id) ? 'bg-[#2D6FEF]/10 border-[#2D6FEF]' : 'bg-white border-slate-200'}`}>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${loteSelecionados.includes(lead.id) ? 'bg-[#2D6FEF] border-[#2D6FEF]' : 'border-slate-300'}`}>
                                   {loteSelecionados.includes(lead.id) && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="font-bold text-sm truncate" style={{color: BRAND.black}}>{lead.nome}</p>
                                   <p className="text-xs truncate" style={{color: BRAND.gray}}>{lead.cidade} - {lead.uf} | {lead.etapa_funil || ETAPAS.LEAD}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100" style={{color: BRAND.gray}}>{lead.responsavel || 'Sem Dono'}</span>
                             </div>
                          ))}
                          {filtrados.length === 0 && <p className="text-center py-10 font-bold" style={{color: BRAND.gray}}>Nenhum cliente atende aos filtros atuais.</p>}
                       </div>
                     </>
                   )
                })()}
             </div>

             <div className="p-6 md:p-8 shrink-0 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                   <span className="text-sm font-bold whitespace-nowrap" style={{color: BRAND.black}}>Transferir {loteSelecionados.length} para:</span>
                   <select className="border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none w-full" style={{color: BRAND.black}} value={loteNovoResponsavel} onChange={e => setLoteNovoResponsavel(e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="SEM_DONO">Deixar Sem Dono</option>
                      {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                   </select>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                   <button onClick={() => setModalLote(false)} className="flex-1 sm:flex-none px-6 py-3 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 text-sm" style={{color: BRAND.gray}}>Cancelar</button>
                   <button onClick={aplicarLote} className="flex-1 sm:flex-none px-6 py-3 text-white font-bold rounded-xl shadow-md text-sm hover:opacity-90" style={{backgroundColor: BRAND.yellow, color: BRAND.black}}>
                     Aplicar Transferência
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export default App;