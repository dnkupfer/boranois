import { Link } from "react-router-dom";
import { BASE, LaresLayout } from "./shared";

/** The Sunday guide for whoever accompanies residents. Lawful, concrete, in order of preference. */
export function Domingo() {
  return (
    <LaresLayout narrow>
      <p><Link to={BASE}>← Casas</Link></p>
      <h1>No domingo</h1>
      <p className="lead">Você vai acompanhar pessoas que querem votar e não têm com quem ir. O que fazer, o que pode e o que não pode.</p>

      <section className="card">
        <h2>Como chegar à seção, nesta ordem</h2>
        <ol className="plain">
          <li><strong>A pé.</strong> Muitas seções ficam a poucas quadras. Confira a seção de cada pessoa antes (e-Título ou o site do TSE, pelo CPF). Pergunte se a seção é acessível; quem tem mobilidade reduzida tem direito a uma, mas o pedido tinha prazo. Se for longe, veja os outros caminhos.</li>
          <li><strong>O transporte especial da Justiça Eleitoral.</strong> Em 2026 existe o programa <em>Seu Voto Importa</em>: carro adaptado, gratuito, para quem tem deficiência ou mobilidade reduzida, pedido no cartório eleitoral com antecedência. Para este turno o prazo já passou (em SP, 16 de outubro), mas quem pediu tem o transporte garantido: pergunte na casa se alguém pediu.</li>
          <li><strong>A van da própria casa.</strong> Se a casa leva os moradores a consultas na van dela, pode levar para votar: é atividade da casa, como sempre fez. Combine com quem dirige.</li>
          <li><strong>Transporte público, com você junto.</strong> Ônibus, metrô e trem são de graça acima de 65 anos (Estatuto do Idoso, art. 39). Leve o documento da pessoa à mão.</li>
          <li><strong>Táxi ou carro de aplicativo pago pela própria pessoa.</strong> Pedido por ela ou pela casa, pago com o dinheiro dela ou da casa. Você vai junto como companhia. <strong>Nunca pago, pedido ou reembolsado pelo voluntário.</strong></li>
        </ol>
        <p className="card law stop" style={{ margin: "16px 0 0" }}>
          <strong>Nunca no seu carro.</strong> No dia da eleição, só a Justiça Eleitoral pode oferecer transporte a eleitor (Lei 6.091/74, art. 11). É crime, de quatro a seis anos, com boa intenção ou sem, e a casa responde junto. Isso vale para táxi pago por você também, mesmo que a pessoa te devolva o dinheiro depois: quem pediu o carro forneceu o transporte, e a transferência vira prova.
        </p>
        <p className="muted small" style={{ margin: "12px 0 0" }}>
          A exceção da lei é a família (art. 5º, III). Familiar ou amigo de verdade, no seu carro, por quem você levaria em qualquer eleição: pode. Morador de uma casa que você conheceu por este app: não. O que torna uma carona legal é a relação existir antes da eleição.
        </p>
      </section>

      <section className="card">
        <h2>Dentro da seção</h2>
        <ul className="plain">
          <li>Quem tem dificuldade de locomoção ou de enxergar pode entrar com uma pessoa de confiança para ajudar (Resolução do TSE). Avise o mesário na chegada: “ela pediu que eu acompanhe”.</li>
          <li>Prioridade na fila: acima de 60 anos, e absoluta acima de 80. Peça.</li>
          <li>Documento oficial com foto. O e-Título com foto vale. Título em papel não é obrigatório.</li>
        </ul>
      </section>

      <section className="card law stop">
        <h2>No domingo, não se fala de voto</h2>
        <ul className="plain">
          <li>A propaganda eleitoral termina <strong>sábado às 22h</strong> (Código Eleitoral, art. 240). No dia da eleição, a lei só permite manifestação individual e silenciosa (Lei 9.504, art. 39-A): nada de pedir voto, nem no caminho, nem na fila, nem na porta.</li>
          <li>Com idosos que dependem de você a lei é mais dura ainda (Código Eleitoral, arts. 299 e 301): qualquer “te ajudo se…” ou insistência é crime. No domingo você é companhia, só isso.</li>
          <li>Quer conversar sobre a eleição com alguém? Faça isso até sábado às 22h: na ligação, na visita, no telefone. O <Link to="/perfis">Boranois</Link> mostra como.</li>
          <li>Nada de camiseta de candidato nem adesivo em você.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Leve</h2>
        <ul className="plain">
          <li>Água, e tempo. Fila com idoso é devagar.</li>
          <li>O celular com o e-Título instalado, para achar a seção na hora se precisar.</li>
          <li>O telefone de quem fica na casa, para avisar que chegaram bem.</li>
        </ul>
        <p className="muted small">Votação das 8h às 17h. Chegue cedo: menos fila, menos sol.</p>
      </section>
    </LaresLayout>
  );
}
