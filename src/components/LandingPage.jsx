import React, { useState } from 'react';
import { 
  ShieldCheck, Clock, FileText, CheckCircle2, AlertTriangle, 
  TrendingUp, Users, DollarSign, ArrowRight, Play, BookOpen, 
  HelpCircle, ChevronDown, Award, Mail, MessageSquare, Zap, BarChart3, Lock, Check, X
} from 'lucide-react';

export default function LandingPage({ onEnterApp }) {
  const [activePlanTab, setActivePlanTab] = useState('monthly');
  const [internCount, setInternCount] = useState(3);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [showPlaybook, setShowPlaybook] = useState(false);

  // Dores e Soluções (Com Emojis Humanizados)
  const painPoints = [
    {
      icon: <ShieldCheck className="text-rose-500 w-8 h-8" />,
      title: "🛡️ Insegurança Jurídica",
      desc: "Processos trabalhistas por descaracterização de estágio assustam gestores. A Lei 11.788 exige controle rigoroso de contratos e apólices.",
      solution: "O Porto Estágios monitora e gera alertas de todos os prazos legais e termos de forma 100% automatizada."
    },
    {
      icon: <Clock className="text-amber-500 w-8 h-8" />,
      title: "📍 Ponto Sem Comprovação",
      desc: "Dificuldade em atestar se o estagiário realmente cumpre as horas (máximo 6h diárias) e se está fisicamente na unidade.",
      solution: "Registro antifraude com Reconhecimento Facial e Validação de GPS (Cerca Virtual) de alta precisão."
    },
    {
      icon: <FileText className="text-blue-600 w-8 h-8" />,
      title: "🧩 Caos de Documentos",
      desc: "TCEs perdidos, falta de relatórios semestrais obrigatórios e total descontrole na contagem de dias de recesso acumulados.",
      solution: "Dossiê digital organizado na nuvem, emissão de PDF fácil e cálculo automático de recesso devido."
    },
    {
      icon: <DollarSign className="text-emerald-500 w-8 h-8" />,
      title: "✨ Fechamento de Folha Simples",
      desc: "Calcular horas realizadas, descontar faltas e proporcionalizar o recesso toma dias do seu RH todo final de mês.",
      solution: "Emissão de espelho de ponto validado e relatórios financeiros instantâneos já prontos para a contabilidade."
    }
  ];

  // Cálculo de ROI Estimado
  const hourlyLaborRisk = 12000;
  const adminHoursSpent = 4;
  const hourlyAdminCost = 35;

  const estimatedRisk = internCount * hourlyLaborRisk;
  const adminSavings = Math.round(internCount * adminHoursSpent * hourlyAdminCost * 12);
  const totalFinancialBenefit = estimatedRisk + adminSavings;

  // Planos de Preço
  const plans = [
    {
      name: "Starter",
      price: activePlanTab === 'monthly' ? 197 : 157,
      limit: "Até 5 estagiários",
      features: [
        "Ponto Facial Antifraude",
        "Geofencing (Cerca Virtual)",
        "Registro de Ocorrências",
        "Exportação de Relatórios CSV",
        "Alertas básicos de Carga"
      ],
      cta: "Testar Grátis 🚀",
      popular: false
    },
    {
      name: "Scale (Mais Escolhido)",
      price: activePlanTab === 'monthly' ? 397 : 317,
      limit: "Até 20 estagiários",
      features: [
        "Tudo do plano Starter",
        "Dossiê Digital Completo",
        "Controle de Recesso (Férias)",
        "Cálculo Automático de Folha",
        "Alertas via E-mail & WhatsApp",
        "Gerador de Documentos PDF"
      ],
      cta: "Agendar Demonstração 🤝",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Sob Consulta",
      limit: "Estagiários ilimitados",
      features: [
        "Tudo do plano Scale",
        "Suporte Prioritário 24/7",
        "Painel com Inteligência Artificial",
        "Assinatura Eletrônica nativa",
        "Múltiplas Clínicas/Filiais",
        "Customização Jurídica"
      ],
      cta: "Falar com Consultor 💬",
      popular: false
    }
  ];

  const faqs = [
    {
      q: "O sistema atende totalmente à Lei 11.788/2008?",
      a: "Sim! Nossa plataforma foi desenhada focada na Lei do Estágio. Ela limita a jornada diária em 6 horas, calcula o recesso remunerado proporcional de 30 dias a cada ano e emite alertas sobre a entrega dos relatórios semestrais."
    },
    {
      q: "Como funciona a validação facial e de GPS? É complicado?",
      a: "É muito simples! 🤳 O estagiário registra a entrada pelo celular ou tablet. O sistema ativa a câmera (capturando a biometria) e cruza as coordenadas GPS. Se ele estiver fora do raio permitido da clínica, o gestor é avisado imediatamente."
    },
    {
      q: "Nossa clínica tem muita rotatividade. É fácil incluir novos estagiários?",
      a: "Completamente ágil. Você cadastra o novo estagiário em menos de 2 minutos e ele já pode começar a bater o ponto. A aba de Dossiê ajuda a controlar contratos a vencer para você nunca perder o prazo."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* HEADER PRINCIPAL CLEAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-emerald-500 p-2.5 rounded-2xl shadow-lg shadow-blue-500/30">
              <Zap className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-700 to-slate-800 bg-clip-text text-transparent">
                Porto Estágios
              </span>
              <span className="block text-[9px] text-slate-500 uppercase tracking-widest font-bold">Gestão Simples & Segura</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#dores" className="hover:text-blue-600 transition-colors">Como Resolvemos</a>
            <a href="#roi" className="hover:text-blue-600 transition-colors">Sua Economia</a>
            <a href="#precos" className="hover:text-blue-600 transition-colors">Planos</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">Dúvidas</a>
            <button 
              type="button"
              onClick={() => setShowPlaybook(!showPlaybook)} 
              className="text-emerald-600 hover:text-emerald-500 transition-colors flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"
            >
              <BookOpen size={14} /> Estratégia de Vendas
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <a 
              href="#precos"
              className="px-6 py-2.5 text-sm font-bold text-white rounded-full bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5"
            >
              Agendar Demo 🚀
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION SOFT */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/50 via-slate-50 to-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-8 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-white text-emerald-700 border border-emerald-200 shadow-sm">
                <ShieldCheck size={16} className="text-emerald-500" /> Paz de espírito: 100% focado na Lei 11.788
              </span>
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Sua gestão de estagiários, <br/>
                <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">simples e humana. 💡</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Diga adeus ao caos do fechamento da folha e ao medo de processos trabalhistas. Automação completa de ponto, dossiês e recessos em um sistema que sua equipe vai adorar usar.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <a 
                  href="#precos"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-1 flex items-center justify-center gap-2 text-base"
                >
                  Agendar Demonstração 🤝
                </a>
                <a 
                  href="#showcase"
                  className="w-full sm:w-auto bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 font-bold py-4 px-8 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 text-base"
                >
                  Ver Telas da Plataforma 👀
                </a>
              </div>

              <div className="pt-8 flex flex-wrap justify-center lg:justify-start gap-6 text-sm font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Setup em 5 minutos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Suporte humanizado</span>
                </div>
              </div>
            </div>

            {/* DASHBOARD PREVIEW CLEAN & SOFT */}
            <div className="lg:col-span-6 relative mt-12 lg:mt-0">
              <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-br from-blue-200/50 to-emerald-200/50 blur-2xl opacity-60"></div>
              <div className="relative bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-slate-900/5 rotate-1 hover:rotate-0 transition-transform duration-500">
                
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-400"></span>
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-400"></span>
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="bg-white text-[11px] text-slate-500 font-medium px-8 py-1.5 rounded-full shadow-sm border border-slate-100">
                    app.portoestagios.com/dashboard 🔒
                  </div>
                  <div className="w-6"></div>
                </div>

                <div className="p-0 bg-white">
                  <img src="/dashboard_mockup.png" alt="Painel do Sistema de Estágios" className="w-full h-auto object-cover opacity-95 hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SHOWCASE SECTION */}
      <section id="showcase" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 rounded-full bg-emerald-50 blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-96 h-96 rounded-full bg-blue-50 blur-3xl opacity-50"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-5">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 font-bold text-sm mb-2 border border-blue-100">
              Módulos Inteligentes ✨
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Feito para o seu RH sorrir.
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              Esqueça planilhas confusas e papelada. Nós transformamos o caos documental em uma experiência fluida, limpa e que protege o seu negócio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
            <div className="order-2 md:order-1 relative rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl bg-white p-2">
              <img src="/biometrics_mockup.png" alt="Biometria e GPS" className="w-full h-auto rounded-[2rem]" />
            </div>
            <div className="order-1 md:order-2 space-y-6 lg:pl-10">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Users className="text-blue-600 w-7 h-7" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">Ponto Antifraude no Tablet 🤳</h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                Transforme qualquer dispositivo da clínica em um quiosque. O sistema tira a foto do estagiário, verifica a face e cruza com a localização GPS. Simples para eles, 100% seguro para você.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6 lg:pr-10">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="text-emerald-600 w-7 h-7" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">Controle Financeiro e Dossiês 📂</h3>
              <p className="text-slate-600 leading-relaxed text-lg">
                Sua contabilidade vai amar. Nosso módulo financeiro entrega a folha mastigada: cruza dias trabalhados, abate as faltas injustificadas e contabiliza a proporção de férias, tudo em PDFs lindos.
              </p>
            </div>
            <div className="relative rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl bg-white p-2">
              <img src="/payroll_mockup.png" alt="Gestão Financeira e Folha" className="w-full h-auto rounded-[2rem]" />
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO DE DORES CORPORATIVAS */}
      <section id="dores" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-5">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Entendemos a sua dor. E resolvemos. 🩺
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              A informalidade gera custos ocultos. Nós criamos os trilhos para sua clínica crescer sem tropeçar na burocracia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {painPoints.map((p, idx) => (
              <div key={idx} className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-5">
                  <div className="p-3 bg-slate-50 rounded-2xl w-fit border border-slate-100 group-hover:bg-white transition-colors">
                    {p.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">{p.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-sm font-semibold text-emerald-700 flex items-start gap-2">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    {p.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI CALCULATOR */}
      <section id="roi" className="py-24 bg-blue-600 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500 rounded-full blur-[100px] opacity-50"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="bg-white rounded-[3rem] p-8 md:p-14 shadow-2xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Veja quanto você economiza 💰</h2>
              <p className="text-slate-600 font-medium text-lg">Use a barra abaixo e descubra o impacto financeiro de prevenir riscos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-sm font-bold text-slate-700">Quantidade de Estagiários</label>
                    <span className="text-3xl font-black text-blue-600">{internCount}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={internCount}
                    onChange={(e) => setInternCount(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
                    <span>1 estagiário</span>
                    <span>50 estagiários</span>
                  </div>
                </div>

                <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-600">Risco Trabalhista Mitigado/Ano:</span>
                    <span className="font-bold text-rose-600">R$ {estimatedRisk.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-600">Economia de Tempo de RH/Ano:</span>
                    <span className="font-bold text-emerald-600">R$ {adminSavings.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-[2.5rem] p-8 text-center border border-blue-100 flex flex-col justify-center h-full">
                <div className="space-y-2">
                  <span className="text-sm font-bold text-blue-700 uppercase tracking-wider">Economia Total Estimada</span>
                  <span className="block text-5xl font-black text-blue-600">
                    R$ {totalFinancialBenefit.toLocaleString('pt-BR')} <span className="text-xl text-blue-400">/ano</span>
                  </span>
                  <p className="text-sm text-slate-500 font-medium mt-4 pt-4 border-t border-blue-200/50">
                    Baseado em R$ 12k de risco por ação e {adminHoursSpent}h mensais salvas por colaborador.
                  </p>
                  <a 
                    href="#precos"
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-full text-base transition-transform hover:-translate-y-1 flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30"
                  >
                    Proteger Minha Clínica 🛡️
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="precos" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-6">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Planos desenhados para o seu momento 🌱
            </h2>
            <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-full border border-slate-200 w-fit mx-auto shadow-sm">
              <button 
                type="button"
                onClick={() => setActivePlanTab('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activePlanTab === 'monthly' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Mensal
              </button>
              <button 
                type="button"
                onClick={() => setActivePlanTab('annual')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activePlanTab === 'annual' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Anual <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full ml-1">20% OFF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((p, idx) => (
              <div 
                key={idx} 
                className={`relative bg-white rounded-[2.5rem] p-8 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                  p.popular ? 'border-2 border-blue-500 shadow-xl scale-105 z-10' : 'border border-slate-100 shadow-md'
                }`}
              >
                {p.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-blue-400 text-white text-[11px] font-extrabold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                    Mais Escolhido
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{p.name}</h3>
                <p className="text-sm font-semibold text-slate-500 mb-6">{p.limit}</p>
                
                <div className="mb-8">
                  {typeof p.price === 'number' ? (
                    <div className="flex items-baseline text-slate-900">
                      <span className="text-2xl font-bold">R$</span>
                      <span className="text-5xl font-black tracking-tight">{p.price}</span>
                      <span className="text-slate-500 font-medium ml-2">/mês</span>
                    </div>
                  ) : (
                    <span className="text-4xl font-black text-slate-900 tracking-tight">{p.price}</span>
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <p className="text-sm font-bold text-slate-900">O que está incluso:</p>
                  <ul className="space-y-3">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a 
                  href="#faq"
                  className={`block text-center w-full py-4 rounded-full font-bold mt-10 transition-all text-base shadow-sm ${
                    p.popular 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-lg' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DÚVIDAS FREQUENTES */}
      <section id="faq" className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Ficou alguma dúvida? 🤔</h2>
            <p className="text-lg text-slate-600 font-medium">
              Transparência total para você tomar a melhor decisão para o seu RH.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, idx) => (
              <div 
                key={idx} 
                className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden transition-all hover:border-blue-200"
              >
                <button 
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between font-bold text-slate-900 hover:text-blue-700 transition-colors"
                >
                  <span className="text-lg">{f.q}</span>
                  <ChevronDown 
                    size={20} 
                    className={`text-slate-400 transition-transform ${expandedFaq === idx ? 'transform rotate-180 text-blue-600' : ''}`} 
                  />
                </button>
                {expandedFaq === idx && (
                  <div className="p-6 pt-0 border-t border-slate-100 text-base text-slate-600 leading-relaxed font-medium bg-white">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* PLAYBOOK MODAL */}
      {showPlaybook && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] max-w-4xl w-full max-h-[85vh] overflow-y-auto p-8 md:p-10 space-y-8 shadow-2xl relative">
            <button 
              type="button"
              onClick={() => setShowPlaybook(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                <BookOpen size={28} />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900">Estratégia de Vendas & Setup</h2>
                <p className="text-slate-500 font-medium mt-1">Manual Executivo Interno B2B</p>
              </div>
            </div>

            <div className="space-y-6 text-base text-slate-700 font-medium">
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                  <Zap size={20} className="text-amber-500" /> 1. Funil Fechado de Alta Conversão
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-slate-600">
                  <li><strong>Lógica de Conversão:</strong> O tema claro e humanizado gera confiança. A página captura leads via botões de "Agendar Demo" que abrem WhatsApp, aumentando conversão B2B.</li>
                  <li><strong>Isca Digital (Meio de Funil):</strong> Oferecer planilhas de cálculo de recesso gratuitas em troca de dados de contato do RH.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                  <Award size={20} className="text-blue-600" /> 2. Abordagem Ativa (Outbound)
                </h3>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="block text-xs text-blue-600 uppercase font-bold mb-2 tracking-wide">Script de WhatsApp / E-mail</span>
                  <span className="italic block text-slate-600 leading-relaxed">
                    "Olá [Gestor], reparei que vocês contratam estagiários. O MPT tem autuado clínicas por descontrole nas 6h diárias e falta de relatórios. Nosso sistema evita isso com ponto facial e cerca virtual na própria clínica. Posso enviar um vídeo de 1 minuto mostrando como as clínicas daqui estão usando?"
                  </span>
                </div>
              </div>

            </div>

            <div className="pt-6 flex justify-end">
              <button 
                type="button"
                onClick={() => setShowPlaybook(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-lg"
              >
                Entendido 👍
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200 text-sm font-medium text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left space-y-1">
            <span className="font-extrabold text-slate-800 text-base">Porto Estágios</span>
            <p>Sistemas Inteligentes para Clínicas e Empresas.</p>
            <p className="text-xs text-slate-400">© 2024. Feito com cuidado para o seu RH.</p>
          </div>

          <div className="flex gap-8">
            <a href="#dores" className="hover:text-blue-600 transition-colors">Termos de Uso</a>
            <a href="#precos" className="hover:text-blue-600 transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
