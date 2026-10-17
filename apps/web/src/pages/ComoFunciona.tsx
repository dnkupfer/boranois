import { Layout } from "../components";

export function ComoFunciona() {
  return (
    <Layout narrow>
      <h1>Como funciona</h1>
      <section className="card">
        <ol className="plain">
          <li><strong>Você descreve alguém que conhece</strong> com alguns toques: o que ela diz, o que a preocupa, quem ela escuta.</li>
          <li><strong>O app reconhece um jeito de pensar</strong> entre onze perfis escritos por pessoas, e diz por quê.</li>
          <li><strong>Diz por quem começar</strong>: levar alguém à urna é mais fácil do que mudar uma opinião.</li>
          <li><strong>Sugere o próximo passo e uma mensagem</strong>, no seu jeito de escrever. Você muda o que quiser e manda do seu WhatsApp.</li>
          <li><strong>Você conta o que ela respondeu</strong>, e o app sugere o passo seguinte.</li>
        </ol>
      </section>
      <section className="card">
        <h2>O que nunca fazemos</h2>
        <ul className="plain">
          <li>Inventar fatos. Cada número vem com a fonte, e o que não foi conferido não é usado.</li>
          <li>Guardar quem são as suas pessoas. Nome, telefone e anotações ficam no seu aparelho.</li>
          <li>Mandar nada sozinho. Toda mensagem sai da sua mão.</li>
          <li>Pressionar. “Ela decidiu votar no outro” é um final aceitável.</li>
        </ul>
        <p className="muted small">
          Os perfis são públicos: <a href="/api/catalogue" target="_blank" rel="noreferrer">veja o catálogo completo</a>.
        </p>
      </section>
    </Layout>
  );
}
