// Guias de topo de funil (SEO/AEO) — conteúdo educativo sobre manejo sustentável.
// Fonte ÚNICA: consumida pelo SSR (server/lib/seo.js) e pela SPA (public/js/app.js
// via /api/guides). Escrito em linguagem de produtor, com CTAs para o catálogo.
//
// Nota de conformidade: nada aqui promete resultado garantido — os textos usam
// "pode", "tende a", "em geral", coerente com a política anti-greenwashing do MBV.

const GUIDES = [
  {
    slug: 'como-recuperar-solo-degradado',
    title: 'Como recuperar um solo degradado: guia prático em 5 passos',
    excerpt: 'Solo compactado, ácido e sem vida microbiológica tem recuperação — e ela começa antes de plantar. Veja o passo a passo que produtores usam para trazer a terra de volta.',
    updated: '2026-07-01',
    readMin: 6,
    tags: ['solo', 'regeneração'],
    // Corpo em blocos simples (h2/p/ul) — renderizados igual no SSR e na SPA.
    blocks: [
      ['p', 'Recuperar um solo degradado não é um evento único, e sim uma sequência. Pular etapas costuma desperdiçar insumo. Este guia organiza o processo em cinco passos na ordem que faz diferença no campo.'],
      ['h2', '1. Comece pela análise de solo'],
      ['p', 'Antes de comprar qualquer coisa, colete amostras e mande analisar. A análise mostra o pH, a saturação por bases e os nutrientes que faltam — é ela que evita você corrigir o problema errado. Sem esse dado, todo o resto é chute.'],
      ['h2', '2. Corrija a acidez antes de nutrir'],
      ['p', 'Em solo ácido, boa parte do adubo aplicado fica indisponível para a planta. Calcário e neutralizadores biológicos ajustam o pH e liberam nutrientes que já estão lá. É um passo barato que multiplica o efeito de tudo o que vem depois.'],
      ['h2', '3. Devolva matéria orgânica e vida ao solo'],
      ['p', 'Solo vivo retém mais água e nutriente. Compostos orgânicos, húmus e condicionadores reintroduzem matéria orgânica e microbiologia. É o que reconstrói a estrutura da terra — o famoso "solo que esfarela na mão" em vez de virar torrão.'],
      ['h2', '4. Use plantas de cobertura no intervalo'],
      ['p', 'No período entre safras, plantas como crotalária e mixes de cobertura protegem o solo da erosão, quebram ciclos de pragas e, no caso das leguminosas, fixam nitrogênio de graça. Cobertura verde é adubação que trabalha sozinha.'],
      ['h2', '5. Mantenha com bioinsumos, não só com química'],
      ['p', 'Recuperado o solo, a manutenção com bioestimulantes e inoculantes tende a reduzir a dependência de adubo mineral ao longo das safras. O objetivo é um sistema que se sustenta, não um que precisa de dose cada vez maior.'],
      ['cta', 'fertilizantes']
    ],
    faq: [
      ['Quanto tempo leva para recuperar um solo?', 'Depende do grau de degradação e do manejo, mas em geral melhorias de estrutura e retenção de água aparecem já no primeiro ciclo, enquanto a recuperação plena costuma levar algumas safras.'],
      ['Dá para recuperar sem parar de produzir?', 'Sim. Boa parte da recuperação acontece com o manejo da própria lavoura — correção, cobertura e bioinsumos — sem precisar deixar a área em pousio total.']
    ]
  },
  {
    slug: 'bioinsumos-o-que-sao',
    title: 'Bioinsumos: o que são e por onde começar na sua lavoura',
    excerpt: 'Inoculantes, bioestimulantes, defensivos biológicos: entenda em linguagem simples o que cada um faz e como encaixá-los sem virar a operação de cabeça para baixo.',
    updated: '2026-07-03',
    readMin: 5,
    tags: ['bioinsumos', 'manejo'],
    blocks: [
      ['p', 'Bioinsumo é todo produto de origem biológica — micro-organismos, extratos vegetais, minerais — que ajuda a nutrir a planta, controlar pragas ou melhorar o solo. A ideia não é substituir tudo de uma vez, e sim reduzir a dependência de insumos químicos com escolhas certeiras.'],
      ['h2', 'Inoculantes: nitrogênio de graça'],
      ['p', 'São bactérias (como o Rhizobium) que se associam à raiz e fixam nitrogênio do ar. Em leguminosas, um inoculante bem aplicado pode reduzir bastante a necessidade de adubo nitrogenado. É o bioinsumo com melhor custo-benefício para começar.'],
      ['h2', 'Bioestimulantes: planta mais vigorosa'],
      ['p', 'Extratos de algas, aminoácidos e substâncias húmicas que estimulam enraizamento e tolerância a estresse (seca, calor). Não substituem a adubação, mas ajudam a planta a aproveitar melhor o que recebe.'],
      ['h2', 'Defensivos biológicos: controle sem resíduo'],
      ['p', 'Micro-organismos e agentes que controlam pragas de forma seletiva, preservando polinizadores e inimigos naturais. Entram muito bem no manejo integrado, alternando com o químico para reduzir resistência.'],
      ['h2', 'Por onde começar'],
      ['p', 'Comece pelo bioinsumo de maior retorno na sua cultura — em geral o inoculante — e avance de forma gradual, medindo o resultado a cada safra. Comprar tudo de uma vez sem acompanhar o efeito é o erro mais comum.'],
      ['cta', 'bioestimulantes']
    ],
    faq: [
      ['Bioinsumo funciona junto com adubo químico?', 'Sim, na maioria dos casos são complementares. O manejo integrado usa os dois de forma planejada para reduzir custo e resíduo.'],
      ['Preciso de refrigeração para guardar?', 'Alguns inoculantes e biológicos vivos pedem cuidado com temperatura e prazo de validade. Confira sempre a bula e o registro do produto.']
    ]
  },
  {
    slug: 'pagar-insumos-com-token-ntr',
    title: 'Pagar insumos com o token NTR: como funciona (sem complicação)',
    excerpt: 'O Neutrotan (NTR) é o crédito verde do MBV. Entenda em 3 minutos como ele dá desconto na sua compra, de onde vem o bônus de boas-vindas e por que é seguro.',
    updated: '2026-07-05',
    readMin: 4,
    tags: ['NTR', 'pagamento'],
    blocks: [
      ['p', 'O NTR (Neutrotan) é um crédito digital que você pode usar para pagar pedidos no MBV com desconto. Pense nele como um "vale-insumo" da loja: 1 NTR vale um valor de referência em reais, e pagar com ele sai mais barato do que cartão ou Pix.'],
      ['h2', 'O que você ganha pagando em NTR'],
      ['ul', ['5% de desconto no pedido, na hora.', '2% de volta em cashback (crédito para a próxima compra).', '150 NTR de bônus quando você cria a conta — sem custo.']],
      ['h2', 'Preciso entender de cripto?'],
      ['p', 'Não. Para o dia a dia, você usa o NTR direto no checkout, como um saldo da loja — sem instalar nada. A tecnologia por trás (blockchain) serve para deixar as transações auditáveis e transparentes, mas você não precisa lidar com ela para comprar.'],
      ['h2', 'É seguro?'],
      ['p', 'Sim. O MBV publica os endereços públicos para qualquer um auditar as movimentações na página de Transparência. O NTR é um utility token — serve para usar na loja, não é promessa de investimento nem de rentabilidade.'],
      ['cta', 'fertilizantes']
    ],
    faq: [
      ['O bônus de 150 NTR expira?', 'O bônus fica creditado na sua carteira MBV para usar nas compras. Consulte os termos do programa para condições específicas.'],
      ['Posso pagar parte em NTR e parte no cartão?', 'No momento, cada pedido é pago por um método. Você escolhe NTR quando o saldo cobre o total do pedido; caso contrário, use cartão ou Pix.']
    ]
  }
];

const bySlug = Object.fromEntries(GUIDES.map(g => [g.slug, g]));

// Lista enxuta para índices (sem o corpo).
function list() {
  return GUIDES.map(({ slug, title, excerpt, updated, readMin, tags }) => ({ slug, title, excerpt, updated, readMin, tags }));
}
function get(slug) { return bySlug[slug] || null; }

module.exports = { GUIDES, list, get };
