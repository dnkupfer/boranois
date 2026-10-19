import { Link } from "react-router-dom";
import { Layout } from "../components";

const PRINCIPLES = [
  { title: "Não é sobre fatos. É sobre pertencimento.", text: "A pessoa acredita no que o grupo dela acredita. Um fato de fora não entra; uma pergunta de dentro, sim.", example: "“Como você chegou a essa ideia?”" },
  { title: "Ouça primeiro.", text: "Pergunte e cale. O que ela diz nos primeiros minutos vale mais que qualquer argumento seu.", example: "“O que te preocupa mais nisso?”" },
  { title: "Faça perguntas que fazem pensar.", text: "Perguntas abrem; afirmações fecham.", example: "“De 0 a 10, quanta certeza você tem?” “O que te faria pensar diferente?”" },
  { title: "Conte histórias, não teses.", text: "O que você viveu, ou alguém do grupo dela viveu, convence mais que um número.", example: "“Minha mãe também achava isso, até que…”" },
  { title: "Resista à tentação dos fatos.", text: "Mandar link é a coisa mais fácil e a que menos funciona. Fato só quando pedido, um de cada vez, com a fonte.", example: "“Quer que eu te mande de onde tirei isso?”" },
  { title: "A pessoa decide.", text: "Sem pressão, sem culpa, sem insistência. “Ela vai votar no outro” é um final aceitável; a relação continua depois do dia 25.", example: "“Seja o que for, tá tudo bem.”" },
];

const SOURCES = [
  { who: "David McRaney, How Minds Change (2022)", what: "Passou tempo com terraplanistas e ex-membros de seitas para entender como alguém muda de convicção. Conclusão: ninguém muda derrotado; muda quando se sente seguro para duvidar." },
  { who: "Deep canvassing (Broockman & Kalla, 2016)", what: "Conversas de dez minutos sobre experiências pessoais mudaram opiniões de forma duradoura, medidas em experimentos de campo." },
  { who: "Epistemologia de rua", what: "Perguntas sobre quanta certeza a pessoa tem, e por quê, em vez de argumentos contra o que ela acredita." },
];

export function ComoFunciona() {
  return (
    <Layout>
      <h1>O método</h1>
      <p className="lead">
        Ninguém muda de ideia derrotado num debate. As pessoas mudam quando se sentem seguras para duvidar, com gente em quem
        confiam. É por isso que você, e não um político ou um vídeo, pode fazer diferença com quem conhece.
      </p>

      <section className="principles" id="metodo">
        {PRINCIPLES.map((p, i) => (
          <article className="principle" key={i}>
            <span className="num">{i + 1}</span>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
            <p className="example">{p.example}</p>
          </article>
        ))}
      </section>

      <blockquote className="pull">
        <p>Influenciar é ajudar alguém a decidir no interesse dela. Manipular é levar alguém a agir contra o próprio interesse.</p>
        <p>O teste: <em>se ela soubesse exatamente o que você está fazendo e por quê, ela te agradeceria ou se sentiria usada?</em></p>
      </blockquote>

      <h2 className="section-title">De onde vem isso</h2>
      <section className="sources">
        {SOURCES.map((s, i) => (
          <article className="source" key={i}>
            <h3>{s.who}</h3>
            <p>{s.what}</p>
          </article>
        ))}
      </section>

      <p className="muted">
        Os perfis que o app usa para reconhecer como alguém pensa são públicos: <Link to="/perfis">veja todos</Link>. O que
        guardamos e o que nunca fazemos está na <Link to="/privacidade">política de privacidade</Link>.
      </p>
    </Layout>
  );
}
