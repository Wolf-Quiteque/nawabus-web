import Link from "next/link";

// Política de Privacidade — linked from the site footer, the app's profile
// screen and the App Store listing (Apple requires one).

export const metadata = {
  title: "Política de Privacidade — NawaBus",
  description: "Como a NawaBus recolhe, usa e protege os dados pessoais de quem compra bilhetes no site, na app e nas agências.",
};

const UPDATED = "29 de setembro de 2026";

const SECTIONS = [
  {
    title: "1. Quem somos",
    body: [
      "A NawaBus (NIF 5000451738), com sede em Luanda, Angola, presta serviços de transporte interprovincial de passageiros e é a responsável pelo tratamento dos dados pessoais descritos nesta política, recolhidos no site www.nawabus.ao, na aplicação móvel NawaBus, no WhatsApp e nas nossas agências.",
    ],
  },
  {
    title: "2. Que dados recolhemos",
    list: [
      "Dados de conta: nome, número de telefone e a palavra-passe (guardada de forma cifrada; nunca a vemos).",
      "Dados de viagem: viagens, datas, lugares, bilhetes e o nome (e, se indicado, o telefone) das pessoas que viajam consigo.",
      "Dados de pagamento: a referência Multicaixa e o estado do pagamento. Não recolhemos nem guardamos dados de cartões ou de contas bancárias — o pagamento é feito no Multicaixa Express, no ATM ou no banco.",
      "Mensagens que nos envia (por exemplo no WhatsApp) para pedir informações ou apoio.",
      "Dados técnicos mínimos necessários para o site e a app funcionarem com segurança (por exemplo, registos de erros e de acesso).",
    ],
  },
  {
    title: "3. Para que usamos os dados",
    list: [
      "Vender e emitir bilhetes, reservar lugares e permitir o embarque.",
      "Enviar confirmações e bilhetes por SMS e mostrar os seus bilhetes no site e na app.",
      "Reprogramar viagens e prestar apoio ao cliente, incluindo por WhatsApp.",
      "Cumprir obrigações legais, nomeadamente fiscais (faturação e comunicação à AGT).",
      "Proteger o serviço contra fraude e utilização abusiva.",
    ],
    after:
      "Não vendemos os seus dados pessoais e não os usamos para publicidade de terceiros.",
  },
  {
    title: "4. Com quem partilhamos",
    body: [
      "Apenas com quem nos ajuda a prestar o serviço, e só na medida do necessário: o prestador de pagamentos por referência Multicaixa, o serviço de envio de SMS, os fornecedores de alojamento e base de dados onde o site e a app funcionam, e o fornecedor de inteligência artificial que ajuda a responder às mensagens de WhatsApp. Também podemos partilhar dados com autoridades quando a lei o exija.",
    ],
  },
  {
    title: "5. Durante quanto tempo guardamos",
    body: [
      "Os dados da conta ficam guardados enquanto a conta existir. Os registos de vendas, bilhetes e faturas são guardados pelo prazo exigido pela lei fiscal angolana, mesmo depois de a conta ser eliminada, mas deixam de estar associados ao seu nome.",
    ],
  },
  {
    title: "6. Os seus direitos",
    body: [
      "Nos termos da Lei n.º 22/11, de 17 de junho (Lei da Protecção de Dados Pessoais), pode pedir acesso aos seus dados, a sua correção ou a sua eliminação, e opor-se a determinados tratamentos.",
      "Pode eliminar a sua conta a qualquer momento na app (Perfil → Eliminar conta) ou pedindo-nos pelos contactos abaixo. Ao eliminar a conta, apagamos o seu nome, telefone e acesso; os registos de vendas exigidos por lei são mantidos de forma anónima.",
    ],
  },
  {
    title: "7. Segurança",
    body: [
      "Usamos ligações cifradas (HTTPS), palavras-passe cifradas e acessos restritos aos dados, para que só as pessoas e os sistemas que precisam possam vê-los.",
    ],
  },
  {
    title: "8. Crianças",
    body: [
      "Os nossos serviços destinam-se a adultos. Os bilhetes de crianças são comprados por um adulto responsável, que indica apenas os dados necessários para a viagem.",
    ],
  },
  {
    title: "9. Alterações e contactos",
    body: [
      "Podemos atualizar esta política; a data da última versão aparece no topo desta página.",
      "Para qualquer questão sobre os seus dados: WhatsApp ou telefone +244 930 533 405, ou numa das nossas agências.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-stone-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <Link href="/" aria-label="NawaBus — início">
            <img src="/nawabus_logo_white.webp" alt="NawaBus" className="h-7 w-auto" />
          </Link>
          <Link href="/" className="text-sm font-semibold text-stone-300 hover:text-amber-400">
            Voltar ao início
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-stone-500">Última atualização: {UPDATED}</p>
        <p className="mt-6 text-base leading-7 text-stone-700">
          Esta política explica que dados pessoais recolhemos quando compra bilhetes ou fala connosco, para que os usamos e
          quais são os seus direitos.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-extrabold">{section.title}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-stone-700">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-stone-700">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.after ? <p className="mt-3 font-semibold leading-7 text-stone-800">{section.after}</p> : null}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
