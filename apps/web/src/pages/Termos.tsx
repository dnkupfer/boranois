import { Link } from "react-router-dom";
import { Layout } from "../components";

export function Termos() {
  return (
    <Layout>
      <div className="legal">
        <h1>Termos de uso</h1>
        <p className="muted small">Última atualização: 18 de outubro de 2026.</p>

        <h2>O que é</h2>
        <p>
          O Boranois é uma ferramenta gratuita e voluntária para ajudar você a conversar com pessoas que conhece sobre votar no
          2º turno de 2026. Ele sugere como entender a pessoa e o que dizer. Toda mensagem é enviada por você, do seu WhatsApp,
          com as suas palavras.
        </p>

        <h2>O que você se compromete</h2>
        <ul>
          <li>Conversar só com pessoas que você conhece, de forma pessoal. Nada de envio em massa, listas ou grupos.</li>
          <li>Não usar a ferramenta com quem está sob sua autoridade (funcionários, alunos, subordinados). Isso pode ser assédio eleitoral.</li>
          <li>Não mentir, não pressionar, não insistir com quem pediu para parar. “Ela decide” é regra, não sugestão.</li>
          <li>Não usar fatos que não estejam na ferramenta como fatos. O que a ferramenta mostra vem com fonte.</li>
          <li>Respeitar a lei eleitoral brasileira. A ferramenta não impulsiona conteúdo, não automatiza envios e não paga por nada.</li>
        </ul>

        <h2>O que a ferramenta não garante</h2>
        <p>
          As sugestões, inclusive as escritas por inteligência artificial, podem estar erradas ou não servir para a sua situação.
          Leia antes de enviar e mude o que quiser. A responsabilidade pelo que você envia é sua.
        </p>

        <h2>Sua conta e seus dados</h2>
        <p>
          O app funciona sem cadastro. O que fica no seu aparelho e o que guardamos está descrito na{" "}
          <Link to="/privacidade">Política de privacidade</Link>. Se você entrar com e-mail, não compartilhe o link de acesso.
        </p>

        <h2>Disponibilidade e mudanças</h2>
        <p>
          O serviço é oferecido como está, sem garantia de funcionamento contínuo. Podemos alterar ou encerrar a ferramenta,
          especialmente após o 2º turno. Estes termos podem mudar; a data acima indica a versão em vigor.
        </p>

        <h2>Conteúdo e propriedade</h2>
        <p>
          Os perfis, textos e o método são do projeto e podem ser reutilizados para fins cívicos não comerciais, com crédito. As
          mensagens que você escreve são suas.
        </p>

        <h2>Lei aplicável</h2>
        <p>Estes termos seguem as leis do Brasil. Dúvidas: <a href="mailto:boranois@kupfer.co">boranois@kupfer.co</a>.</p>
      </div>
    </Layout>
  );
}
