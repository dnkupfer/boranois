import { Link } from "react-router-dom";
import { CopyButton, Layout } from "../components";
import { useSession } from "../session";

export function Extensao() {
  const { token, extension } = useSession();

  if (extension === "connected") {
    return (
      <Layout>
        <h1>Tudo pronto!</h1>
        <p className="status ok">Extensão conectada ✓</p>
        <HowToUse />
      </Layout>
    );
  }

  return (
    <Layout>
      <h1>Instalar a extensão</h1>
      <p>Funciona no Google Chrome do computador. Leva uns 3 minutos e só precisa fazer uma vez.</p>

      {extension === "installed" && !token && (
        <p className="status warn">
          Extensão instalada. <Link to="/entrar">Entre com seu código</Link> para conectar.
        </p>
      )}
      {extension === "installed" && token && <p className="status warn">Extensão instalada, conectando…</p>}

      <ol className="steps">
        <li>
          <p>Baixe a extensão:</p>
          <a className="button primary" href="/boranois-extensao.zip" download>Baixar a extensão</a>
          <p className="muted">
            Depois, abra a pasta <strong>Downloads</strong> e dê dois cliques no arquivo{" "}
            <strong>boranois-extensao.zip</strong>. Vai aparecer uma pasta chamada <strong>boranois-extensao</strong>.
          </p>
        </li>
        <li>
          <p>Copie este endereço, cole na barra de endereço do Chrome (lá no alto) e aperte Enter:</p>
          <div className="row">
            <code>chrome://extensions</code>
            <CopyButton text="chrome://extensions" label="Copiar" />
          </div>
        </li>
        <li>
          <p>
            No canto de cima, à direita, ligue a chave <strong>“Modo do desenvolvedor”</strong>.
          </p>
        </li>
        <li>
          <p>
            Clique no botão <strong>“Carregar sem compactação”</strong>, que aparece à esquerda, e escolha a pasta{" "}
            <strong>boranois-extensao</strong> (dentro de Downloads).
          </p>
        </li>
        <li>
          <p>
            Clique no ícone de quebra-cabeça 🧩 no alto do Chrome, e depois no alfinete 📌 ao lado de{" "}
            <strong>Boranois</strong>. Vai aparecer um botão vermelho com ✓ no alto do Chrome.
          </p>
        </li>
        <li>
          <p>Volte para esta página e atualize:</p>
          <button className="primary" onClick={() => window.location.reload()}>Atualizar esta página</button>
        </li>
      </ol>
    </Layout>
  );
}

function HowToUse() {
  return (
    <section className="card">
      <h2>Como usar</h2>
      <ol>
        <li>No Instagram, abra um post (clique na foto ou no vídeo).</li>
        <li>Clique no botão vermelho ✓ no alto do Chrome.</li>
        <li>
          Se ele disser que vale a pena, use o botão ✈️ (Compartilhar) do Instagram para mandar o post ao grupo.
        </li>
      </ol>
      <p className="muted">
        A extensão só lê o post quando você clica no botão. Ela nunca curte, comenta ou compartilha sozinha.
      </p>
    </section>
  );
}
