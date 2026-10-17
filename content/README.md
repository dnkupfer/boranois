# Catálogo

Tudo que o app recomenda vem daqui. Pessoas escrevem e revisam; a IA só coloca em palavras.

- `personas/*.json` — um arquivo por perfil. Veja a estrutura em `nao_adianta.json`.
- `facts.json` — o banco de fatos. **Todo fato precisa de `sourceUrl`.** Fatos com `verified: false` não são usados até alguém conferir e mudar para `true`.
- `contents.json` — vídeos e posts para enviar. `messenger` diz de quem é a voz (ex.: "pastor", "trabalhadora", "policial"); o app prefere vozes do mesmo grupo da pessoa.
- `questions.json` — o fluxo de perguntas do “adicionar pessoa”: uma por vez, com ramificações (`next`). Cada opção aponta (`sets`) para os chips que o motor entende; opções sem `sets` viram tags. Toda pergunta mostra “+ outra”: a resposta digitada vai para o modelo, que a encaixa numa opção existente ou nos chips, ou insere uma pergunta de acompanhamento só para aquela pessoa; o resultado é validado contra a árvore antes de ser usado. `max: 1` = escolha única; sem `max` = quantas quiser.
- `proposals/` (não versionado) — relatórios de `npm run analyse -w @boranois/api`: opções nunca usadas, respostas digitadas e, com Gemini, mudanças propostas para uma pessoa revisar e aplicar aqui.
- `defaults.json` — passos usados quando o perfil não tem passo para o estado da conversa, e os lembretes de véspera e dia da eleição.
- `scoring.json` — pesos do match e da prioridade. Mudou? Suba `version`.

Num passo, liste em `facts` só fatos intercambiáveis (qualquer um serve para aquela mensagem). Se o fato principal não estiver verificado, o passo é pulado.

Placeholders nos templates: `{nome}`, `{fato}`, `{conteudo}`, `{preocupacao}`.

Teste do espelho: quem se encaixa no perfil leria a descrição e diria "sim, sou eu, e é justo". Se não passar, reescreva.
