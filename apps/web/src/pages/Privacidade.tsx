import { Layout } from "../components";

export function Privacidade() {
  return (
    <Layout>
      <div className="legal">
        <h1>Política de privacidade</h1>
        <p className="muted small">Última atualização: 18 de outubro de 2026.</p>

        <h2>O que nunca fazemos</h2>
        <ul>
          <li>Inventar fatos. Cada número vem com a fonte, e o que não foi conferido não é usado.</li>
          <li>Guardar quem são as suas pessoas. Nome, anotações e a conversa com o coach ficam no seu aparelho. Não pedimos telefone.</li>
          <li>Mandar nada sozinho. Toda mensagem sai da sua mão.</li>
          <li>Pressionar. Nem você, nem o app.</li>
        </ul>

        <h2>Quem somos</h2>
        <p>
          O Boranois é um projeto voluntário, sem fins lucrativos, mantido por Daniel Kupfer. Contato para qualquer assunto desta
          política, incluindo pedidos sobre seus dados: <a href="mailto:boranois@kupfer.co">boranois@kupfer.co</a>.
        </p>

        <h2>O que fica só no seu aparelho</h2>
        <p>
          O nome e as anotações sobre cada pessoa que você adiciona, e a conversa com o coach, ficam gravados apenas no
          navegador do seu aparelho. Não são enviados ao nosso servidor nem guardados por nós. Se você apagar os dados do navegador,
          eles somem.
        </p>

        <h2>O que o nosso servidor guarda</h2>
        <ul>
          <li>Uma sessão anônima (um identificador aleatório), para que suas pessoas apareçam quando você voltar.</li>
          <li>
            Para cada pessoa adicionada: as respostas que você marcou (situação, relação, frases, preocupações, grupos), o perfil
            reconhecido, o andamento da conversa e o que você marcou que aconteceu. Nada disso identifica a pessoa.
          </li>
          <li>Se você escolher entrar com e-mail: o seu e-mail, para reconhecer você em outro aparelho.</li>
          <li>Respostas que você digitou com “+ outra”, contadas de forma anônima, para melhorar as opções.</li>
        </ul>

        <h2>Inteligência artificial</h2>
        <p>
          Para escrever mensagens no seu jeito, entender respostas digitadas e conversar com o coach, enviamos à API do Google
          Gemini o texto necessário: o modelo de mensagem, suas anotações sobre a pessoa, a amostra de como você escreve, a
          resposta que você colou e a sua pergunta. Esses textos são processados e não são guardados por nós. O uso pelo Google
          segue os termos da API do Gemini.
        </p>

        <h2>Casas de repouso</h2>

        <p>

          Na ferramenta de casas de repouso, guardamos no servidor o nome e o e-mail de quem liga (para ninguém ligar duas vezes para a

          mesma casa) e o nome e o contato de vizinhos que se oferecem para acompanhar moradores no domingo. O e-mail de quem liga não é

          mostrado a ninguém; o contato dos vizinhos é mostrado só aos voluntários organizando aquela casa. Não guardamos nada sobre os

          moradores: só quantos querem ir e o que a equipe da casa disse. Tudo isso é apagado depois do dia 25 de outubro de 2026.

        </p>


        <h2>Medição de uso</h2>
        <p>
          Só se você aceitar no aviso que aparece na primeira visita. Medimos de forma anônima quais telas são abertas, onde as
          pessoas param e quantas mensagens são enviadas, com um identificador aleatório do aparelho. Nunca nomes,
          anotações ou mensagens. Os dados ficam no nosso servidor e não vão para terceiros. Você pode recusar sem perder nada.
        </p>

        <h2>Serviços que usamos</h2>
        <p>
          Hospedagem e banco de dados: Google Cloud (Firebase, Cloud Run) e Neon, em São Paulo. Inteligência artificial: Google
          Gemini. E-mail de acesso: Resend. Não vendemos nem compartilhamos dados com anunciantes ou campanhas.
        </p>

        <h2>Por quanto tempo</h2>
        <p>
          Os dados do servidor são apagados em até 90 dias após o 2º turno (25 de outubro de 2026), salvo os dados anônimos de
          uso, que podem ser mantidos de forma agregada para avaliar o projeto.
        </p>

        <h2>Seus direitos (LGPD)</h2>
        <p>
          Você pode pedir acesso, correção ou exclusão do que temos sobre você, e retirar o consentimento da medição a qualquer
          momento (apague os dados do site no navegador, e o aviso aparece de novo). Escreva para{" "}
          <a href="mailto:boranois@kupfer.co">boranois@kupfer.co</a>. Base legal: consentimento para a medição; execução do
          serviço que você pediu para o restante.
        </p>

        <h2>Sobre as pessoas que você adiciona</h2>
        <p>
          Elas não são usuárias do app e não nos conhecem. Por isso o app foi desenhado para não guardar quem elas são. As
          conversas com elas acontecem no seu WhatsApp, fora do app, sob sua responsabilidade.
        </p>
      </div>
    </Layout>
  );
}
