import { Link } from "react-router-dom";
import { Layout } from "../components";

export function ComoFunciona() {
  return (
    <Layout narrow>
      <h1>Como funciona</h1>

      <section className="card">
        <h2>O que é isto</h2>
        <p>
          Uma ferramenta para <strong>influenciar eleitores</strong>: ajudar pessoas que você conhece a irem votar no dia 25 e,
          se estiverem em dúvida, a decidirem com calma, ouvindo alguém em quem confiam. Você.
        </p>
        <h2>Influenciar não é manipular</h2>
        <p>
          A diferença está no interesse de quem ouve. <strong>Influenciar</strong> é ajudar alguém a decidir no interesse dela:
          com o que é verdade, ouvindo o que ela pensa, e respeitando a decisão final, mesmo que seja outra.{" "}
          <strong>Manipular</strong> é levar alguém a agir contra o próprio interesse: com mentira, medo, culpa ou pressão.
        </p>
        <p>
          O teste: <em>se ela soubesse exatamente o que você está fazendo e por quê, ela te agradeceria ou se sentiria usada?</em>{" "}
          Tudo neste app passa por esse teste. Os perfis são públicos, os fatos têm fonte, e nenhuma mensagem sai sem a sua mão.
        </p>
      </section>

      <section className="card">
        <h2>O método</h2>
        <p>
          Ninguém muda de ideia derrotado num debate. As pessoas mudam quando se sentem seguras para duvidar, e isso
          acontece dentro do próprio grupo, com gente em quem confiam. É por isso que você, e não um político ou um
          vídeo, é quem pode fazer diferença com quem conhece.
        </p>
        <ol className="plain">
          <li><strong>Não é sobre fatos. É sobre pertencimento.</strong> A pessoa acredita no que o grupo dela acredita. Um fato de fora não entra; uma pergunta de dentro, sim.</li>
          <li><strong>Ouça primeiro.</strong> Pergunte e cale. “Como você chegou a essa ideia?” vale mais que qualquer argumento.</li>
          <li><strong>Faça perguntas que fazem pensar.</strong> “De 0 a 10, quanta certeza você tem?” “O que te faria pensar diferente?” “O que ele vai fazer de diferente, na prática?”</li>
          <li><strong>Conte histórias, não teses.</strong> O que você viveu, ou alguém do grupo dela, convence mais que um número.</li>
          <li><strong>Resista à tentação dos fatos.</strong> Mandar link é a coisa mais fácil e a que menos funciona. Fato só quando pedido, um de cada vez, com a fonte.</li>
          <li><strong>A pessoa decide.</strong> Sem pressão, sem culpa, sem insistência. “Ela vai votar no outro” é um final aceitável; a relação continua depois do dia 25.</li>
        </ol>
        <p className="muted small">
          De onde vem isso: David McRaney, <em>How Minds Change</em> (2022), que passou tempo com terraplanistas e
          ex-membros de seitas para entender como alguém muda de convicção; o <em>deep canvassing</em>, conversas de
          dez minutos sobre experiências pessoais que mudaram opiniões de forma duradoura em estudos de campo
          (Broockman e Kalla, 2016); e a <em>epistemologia de rua</em>, perguntas sobre quanta certeza a pessoa tem e por quê.
        </p>
      </section>

      <section className="card">
        <h2>O que o app faz</h2>
        <ol className="plain">
          <li><strong>Você descreve alguém que conhece</strong> com alguns toques: o que ela diz, o que a preocupa, quem ela escuta.</li>
          <li><strong>O app reconhece um jeito de pensar</strong> entre os perfis escritos por pessoas, e diz por quê.</li>
          <li><strong>Diz por quem começar</strong>: levar alguém à urna é mais fácil do que mudar uma opinião.</li>
          <li><strong>Sugere o próximo passo e uma mensagem</strong>, no seu jeito de escrever. Você muda o que quiser e manda do seu WhatsApp.</li>
          <li><strong>Você conta o que ela respondeu</strong> e conversa com o coach sobre o próximo movimento.</li>
        </ol>
      </section>

      <section className="card">
        <h2>O que nunca fazemos</h2>
        <ul className="plain">
          <li>Inventar fatos. Cada número vem com a fonte, e o que não foi conferido não é usado.</li>
          <li>Guardar quem são as suas pessoas. Nome, telefone, anotações e a conversa com o coach ficam no seu aparelho.</li>
          <li>Mandar nada sozinho. Toda mensagem sai da sua mão.</li>
          <li>Pressionar. Nem você, nem o app.</li>
        </ul>
        <p className="muted small">
          Os perfis são públicos: <Link to="/perfis">veja todos</Link>.
        </p>
        <h2>Privacidade e medição</h2>
        <p className="small">
          O app guarda no seu aparelho o que precisa para funcionar: sua sessão e as pessoas que você adiciona. Isso não precisa
          de permissão. Se você aceitar, medimos o uso de forma anônima (que telas são abertas, onde as pessoas param, quantas
          mensagens são enviadas), com um identificador aleatório do aparelho, nunca com nomes, telefones, anotações ou
          mensagens. Os dados ficam no nosso próprio servidor; nada vai para terceiros.
        </p>
      </section>
    </Layout>
  );
}
