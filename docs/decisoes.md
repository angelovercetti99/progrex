# Decisões técnicas da Progrex

Cada entrada explica **o que** escolhemos, **porquê**, e **o que custou** escolher assim.
Nenhuma decisão é perfeita; todas trocam uma coisa por outra.

---

## 1. Expo + React Native + TypeScript

**O que é:** React Native permite escrever a interface em React (JavaScript) e obter
componentes nativos reais em iOS e Android. O Expo é uma camada por cima que trata da
parte difícil: compilar, aceder à câmara e ao armazenamento, publicar nas lojas. Também
gera a versão web a partir do mesmo código.

**Porquê:** um só código para três plataformas. Tu escreves `<View>` e `<Text>`, e o
Expo transforma-os em `UIView` no iPhone, em `android.view.View` no Android e em
`<div>` na web.

**TypeScript:** é JavaScript com tipos. Se uma função espera um `number` e lhe passas
uma `string`, o editor sublinha o erro antes de correres a app. Para quem está a aprender
é uma ajuda: os erros aparecem enquanto escreves, e não no telemóvel às 7h no ginásio.
Usamos o modo `strict`, que é o mais exigente e também o que mais ensina.

**Custo:** o React Native não é 100% nativo em desempenho nem em aparência, e há
pequenas diferenças entre plataformas. Para uma app de registo de treinos isto é
irrelevante.

---

## 2. Expo Router (navegação por ficheiros)

**O que é:** cada ficheiro em `app/` é um ecrã. `app/settings.tsx` é a rota
`/settings`, e `app/workout/[id].tsx` é `/workout/123`, em que `[id]` é um parâmetro.

**Porquê:** a estrutura de pastas *é* o mapa da app. Abres a pasta e vês logo que ecrãs
existem. Também funciona como URLs reais na web.

**Regra que seguimos:** os ficheiros em `app/` só montam a interface. A lógica (ler
treinos, gravar séries) vive em `src/features/`. Assim, os ecrãs ficam curtos e a
lógica pode ser testada sem ecrãs.

---

## 3. Local-first com SQLite

**O que é "local-first":** a fonte de verdade imediata é a base de dados *no teu
dispositivo*. Gravar uma série é instantâneo e funciona sem rede. A sincronização é um
processo em segundo plano.

**Porquê:** no ginásio a rede costuma ser má. Se cada toque esperasse pelo servidor, a
app seria lenta e falharia. Local-first dá-te velocidade e fiabilidade.

**Porquê SQLite (`expo-sqlite`):** é uma base de dados relacional completa num ficheiro.
Os nossos dados são relacionais por natureza (um treino *tem* exercícios, que *têm*
séries), e o SQL responde bem a perguntas como "qual foi o meu melhor supino nas últimas
8 semanas?". A alternativa mais simples, o AsyncStorage (chave → texto), obrigaria a
carregar tudo para memória e a filtrar à mão.

**Custo:** na web, o `expo-sqlite` corre em WebAssembly e precisa de configuração extra
no servidor de desenvolvimento. Vamos validar isto logo na Fase 0 para não haver
surpresas.

---

## 4. Drizzle ORM

**O que é:** um ORM é uma camada entre o teu código e o SQL. Com o Drizzle defines as
tabelas em TypeScript (`schema.ts`), e ele:
- gera os ficheiros de migração SQL (as instruções para criar ou alterar tabelas);
- dá-te consultas com tipos: se escreveres `set.wieght`, o editor avisa-te logo;
- tem *live queries*: o ecrã atualiza-se sozinho quando os dados mudam.

**Porquê o Drizzle e não outro:** é fino (continuas a ver e a aprender SQL, não fica
escondido), suporta o `expo-sqlite` e o Cloudflare D1, e por isso aprendes uma
ferramenta para os dois lados.

**Custo:** é mais um conceito para aprender. Em troca, evita uma classe inteira de bugs
(nomes de colunas errados, tipos trocados).

---

## 5. Modelo de dados: treino → exercício → séries

Escolheste o modelo do Strong/Hevy:

```
workouts            (o treino de 09/10)
 └─ workout_exercises   (Supino, posição 1)
     └─ sets              (série 1: 8 × 60 kg)
exercises           (catálogo: Supino, Agachamento, … + os teus)
```

**Porquê uma tabela `workout_exercises` no meio?** Porque o mesmo exercício pode
aparecer em muitos treinos, e cada treino tem uma ordem própria. Esta tabela de ligação
guarda "neste treino, o Supino foi o 1.º". Sem ela, não conseguirias ter séries com
pesos diferentes nem ordenar os exercícios.

**Catálogo com lista base + personalizados:** o coach só consegue ver a progressão do
"Supino" se o nome for sempre o mesmo. Uma lista base evita "supino", "Supino reto" e
"bench" como três exercícios diferentes.

---

## 6. IDs UUIDv7 gerados no cliente

**O problema:** com IDs autoincrement (1, 2, 3…), o telemóvel cria o treino nº 5 e a
web, offline, também cria um treino nº 5. Quando sincronizam, há colisão.

**A solução:** cada linha recebe um UUID, um identificador aleatório de 128 bits
(ex.: `018f3a2c-…`). A probabilidade de colisão é desprezável, e qualquer dispositivo
pode criar IDs sem perguntar a ninguém. A versão 7 começa pelo carimbo temporal, por
isso os IDs ficam ordenados por data de criação, o que é útil para a base de dados.

**Exercícios de base** têm IDs fixos e legíveis (`builtin:bench_press`). Assim, o
"Supino" do telemóvel e o da web são o *mesmo* registo, sem precisarem de sincronizar.

---

## 7. Soft delete (tombstones)

Quando apagas um treino, não removemos a linha: marcamos `deleted_at` com a data.

**Porquê:** se a linha desaparecesse, o sync não teria nada para enviar ao outro
dispositivo, e este nunca saberia que o treino foi apagado. Um tombstone é uma "lápide"
que diz "isto existiu e foi apagado".

---

## 8. Sincronização: last-write-wins + cursor do servidor

O mecanismo, em linguagem simples:

1. Cada alteração local marca a linha como `dirty` (por enviar).
2. A app envia ao Worker as linhas `dirty` e o seu **cursor**, que diz "já recebi tudo
   até ao número X".
3. O Worker guarda cada linha **se for mais recente** do que a que tem (comparando
   `updated_at`). Isto é o *last-write-wins* (LWW): a última edição ganha.
4. Cada linha guardada no servidor recebe um número sequencial (`server_seq`).
5. O Worker devolve todas as linhas com `server_seq > X`, e a app aplica-as e guarda o
   novo cursor.

**Porquê um cursor numérico do servidor e não datas?** Os relógios dos dispositivos não
estão perfeitamente acertados. Se o telemóvel estiver 2 minutos atrasado, um filtro
"dá-me tudo desde as 10:00" perderia alterações. Um contador atribuído só pelo servidor
nunca salta nem volta atrás.

**Porquê LWW e não algo mais sofisticado (CRDTs, merge campo a campo)?** És um único
utilizador. Raramente vais editar o *mesmo* treino em dois dispositivos ao mesmo tempo.
O LWW é simples de perceber e de depurar. Bibliotecas como PowerSync ou ElectricSQL
resolvem isto de forma mais robusta, mas escondem exatamente o que queres aprender e
acrescentam mais um serviço.

**Custo:** se editares a mesma série offline em dois dispositivos, uma das edições
perde-se. É um risco aceitável para uso pessoal.

---

## 9. "Sem contas", mas com uma chave pessoal

**O problema:** o Worker está na internet. Sem proteção, qualquer pessoa que descobrisse
o URL podia ler os teus treinos ou gastar os teus créditos da API Claude.

**A solução:** geras uma chave secreta longa e aleatória, uma vez. Guarda-la:
- no Worker, como secret `APP_TOKEN`;
- em cada dispositivo, colando-a nas Definições da app (fica no Keychain do iOS ou no
  Keystore do Android, via `expo-secure-store`).

A app envia-a em cada pedido (`Authorization: Bearer …`) e o Worker rejeita quem não a
tem. Não há login, palavras-passe nem contas. É basicamente uma "chave de casa".

**Porquê não pôr a chave no código da app?** Tudo o que vai no código de uma app pode
ser extraído por quem a instale. É a mesma razão pela qual a chave da Anthropic nunca
vai para a app. Variáveis `EXPO_PUBLIC_*` também são públicas, apesar do nome
"variável de ambiente".

**Comparação em tempo constante:** comparar strings letra a letra e parar na primeira
diferença demora um pouco mais quando as primeiras letras coincidem. Um atacante pode
medir isso e adivinhar a chave aos poucos. A comparação em tempo constante demora
sempre o mesmo.

**Custo na web:** o browser não tem Keychain, por isso a chave fica em `localStorage`.
Para uma app pessoal, no teu próprio browser, é aceitável.

---

## 10. Cloudflare Workers + D1 + Hono

**Serverless:** em vez de manteres um servidor ligado 24 h, escreves uma função que a
Cloudflare corre quando chega um pedido. Pagas por uso, e o plano gratuito chega bem
para uma pessoa.

**Porquê a Cloudflare:** um só fornecedor para a função (Workers) e a base de dados
(D1). O D1 é SQLite, a mesma tecnologia que tens no telemóvel, por isso o SQL e o
Drizzle são os mesmos dos dois lados.

**Hono:** um micro-framework para definir rotas (`app.post("/coach", …)`) e middleware
(o código que verifica a chave antes de qualquer rota). É pequeno, tipado e foi feito
para Workers.

---

## 11. A IA: só para desenhar o mesociclo (adiada, ver secção 22)

> Substitui a versão inicial, em que a IA sugeria cada treino. Ver as secções 17–21.

**Onde corre:** só no Worker. O fluxo é este:

```
App ──(perfil + espaços + resumo do histórico + chave pessoal)──▶ Worker ──▶ Claude
App ◀───────────── mesociclo validado ───────────── Worker ◀── JSON estruturado
```

**Saídas estruturadas:** damos ao Claude um *schema* (Zod) com a forma exata do
mesociclo. A API garante que o JSON devolvido cumpre esse schema.

**Mas o schema não chega.** Um JSON pode ter a forma certa e o conteúdo errado (por
exemplo, 40 séries de peito por semana). Por isso, o Worker corre também
**invariantes de domínio**: regras de treino escritas em código. É um princípio
importante quando se trabalha com IA: *nunca confies cegamente na saída de um modelo,
nem quando está bem formatada.*

**Modelo:** `claude-opus-5-5`, com `effort: "medium"` explícito (o *effort* controla
quanto o modelo "pensa"). O fallback do servidor está ativo: se o modelo recusar um
pedido por engano, a API tenta outro modelo automaticamente.

**Custos:** a API Claude é paga à parte da tua subscrição. Como só a chamamos ao criar
um mesociclo (a cada 4–6 semanas), o custo mensal deve ser de cêntimos.

---

## 12. Zod partilhado em `packages/shared`

**O que é o Zod:** descreves a forma dos dados (`z.object({ reps: z.number().int() })`)
e obténs duas coisas: um **tipo TypeScript** e um **validador em runtime**.

**Porquê partilhar:** a app e o Worker têm de concordar no formato dos pedidos de sync
e do coach. Se o schema estiver num só sítio, mudar um campo faz o TypeScript apontar
os erros nos *dois* lados. É por isso que usamos um monorepo.

**Porquê validar no Worker se já temos tipos?** Os tipos só existem enquanto escreves o
código. Em runtime chega JSON da internet, que pode ser qualquer coisa. O Zod verifica
o que realmente chegou.

---

## 13. Monorepo com npm workspaces

Um só repositório com três pacotes: `apps/mobile`, `apps/api` e `packages/shared`. O
npm liga-os entre si, por isso `import { CoachSuggestionSchema } from "@progrex/shared"`
funciona nos dois lados. O Expo suporta monorepos sem configuração extra.

**Custo:** um pouco mais de estrutura inicial. A alternativa seria copiar os schemas
entre projetos, e as cópias acabam sempre por divergir.

---

## 14. i18n (PT-PT + EN) desde o início

Todos os textos visíveis vivem em `pt.json` e `en.json`, e no código escreves
`t("workout.addSet")`. O `expo-localization` deteta o idioma do sistema e, nas
Definições, podes forçar outro.

**Porquê desde o início:** traduzir mais tarde obriga a percorrer todos os ecrãs à
procura de textos escritos diretamente no código. Começar já custa pouco.

Os nomes dos exercícios de base também são traduzidos (`name_key`). Os que criares
ficam com o nome que escreveste.

---

## 15. Estilos com StyleSheet + tema

Usamos o `StyleSheet` nativo do React Native e um ficheiro `theme.ts` com as cores, os
espaçamentos e os tamanhos de letra.

**Porquê não Tailwind/NativeWind?** São ótimos, mas acrescentam configuração e uma
"linguagem" própria. Primeiro convém perceberes como o React Native faz layout
(Flexbox). Mudar mais tarde é fácil.

---

## 16. Testes onde valem mais

Não testamos tudo. Testamos a **lógica pura** onde um erro é silencioso e caro:
- o motor de progressão e a seleção de variantes (o coração da app);
- as invariantes do mesociclo e do catálogo (ex.: todos os padrões têm variante só com peso corporal);
- a aplicação de alterações do sync / LWW (perder treinos é o pior bug possível);
- a validação e a autenticação do Worker.

Os ecrãs testam-se usando a app.

---

## 17. Planos por padrão de movimento, não por exercício

**O problema:** um plano que diga "Supino com barra" não serve num quarto de hotel.

**A solução:** o mesociclo diz *o que o corpo precisa de fazer*, e não *com que
máquina*. Por exemplo: "empurrar horizontal, 3 × 8–12, RIR 2". No dia do treino, a app
vê o equipamento do espaço onde estás e escolhe a variante possível: supino com barra
no ginásio, com halteres em casa, flexões no hotel.

**A garantia:** o catálogo tem, para *cada* padrão, pelo menos uma variante só com peso
corporal. Isto é verificado por um teste automático, por isso há sempre treino
possível.

**Porquê padrões e não grupos musculares?** Os padrões (agachar, dobradiça de anca,
puxar, empurrar…) são a forma como os treinadores organizam os planos. Também mapeiam
bem para exercícios: cada exercício pertence a exatamente um padrão.

---

## 18. RIR: o que torna variantes diferentes comparáveis

**RIR = repetições em reserva.** É a resposta a "quantas reps ainda conseguias fazer
com boa técnica?". RIR 0 é a falha, RIR 2 significa que sobravam duas.

**Porque é que isto importa:** para ganhar músculo, o que conta sobretudo é o esforço
(quão perto da falha chegas) e o volume (quantas séries duras fazes). O peso é só uma
forma de chegar lá. 12 flexões a RIR 1 e 10 supinos a RIR 1 são estímulos comparáveis.
É isto que torna um plano de hotel "igualmente eficaz".

**Limite honesto:** para *força máxima*, o peso importa mesmo. Treinar com pouco
equipamento mantém e desenvolve a força, mas não substitui a barra pesada a 100%. A
app deve dizê-lo quando o objetivo é força e o espaço é limitado.

**Pré-preenchimento:** o RIR aparece já com o valor alvo e só tocas se for diferente.
Registar uma série continua a ser rápido.

---

## 19. Progressão: dupla progressão + escada de alavancas

**Dupla progressão** é o método clássico: tens uma gama de reps (ex.: 8–12). Sobes reps
treino a treino e, quando fazes 12 em todas as séries, sobes o peso e voltas às 8.

**O problema em casa:** e se os halteres só chegam aos 20 kg? Aí entra a **escada de
alavancas**, que são outras formas de tornar o mesmo exercício mais difícil:

```
+ carga → + reps → − descanso → tempo mais lento → + 1 série → variante mais difícil
```

Em cada treino, o motor escolhe **uma** alavanca e explica-a numa frase, por exemplo:
*"Da última vez fizeste 12/11/10. Hoje tenta 12 na 2.ª série."*

**Espaço novo, variante nova:** não tentamos converter "60 kg no supino" em "x
flexões", porque isso seria inventar. A primeira vez é uma **sessão de calibração**:
trabalhas na gama com o RIR alvo, e a partir daí a progressão segue normalmente.

**Os objetivos mudam os parâmetros, não o motor.** A força usa reps baixas e prefere a
carga, a perda de gordura prefere menos descanso, e assim por diante. São valores numa
tabela, e não quatro motores diferentes.

---

## 20. IA desenha, código executa (arquitetura híbrida)

| | IA | Regras em código |
|---|---|---|
| Bom em | Juntar muitos fatores num plano coerente | Aplicar a mesma lógica sempre da mesma forma |
| Precisa de rede | Sim | Não |
| Custo | Cêntimos por chamada | Zero |
| Previsível / testável | Pouco | Totalmente |

Desenhar um mesociclo é um problema "criativo" com muitos fatores (objetivo,
experiência, dias, espaços), e a IA é boa nisso. Decidir "+1 rep ou +2,5 kg?" é uma
regra, e uma regra deve ser código: funciona offline no ginásio, dá sempre a mesma
resposta e pode ser testada.

**Regra prática que podes levar para outros projetos:** usa IA onde o problema é
difuso, e código onde o problema tem regras claras.

---

## 21. Equipamento como checklist por espaço

Cada espaço ("Casa", "Hotel Lisboa", "Ginásio X") tem uma checklist estruturada, com
limites onde importam (halteres *até 20 kg*). É estruturada porque o código de seleção
de variantes precisa de dados exatos: "tem halteres?" e "até quanto?".

**Depois do MVP:** tiras uma foto ao ginásio do hotel e a IA, que consegue ver imagens,
preenche a checklist por ti. Repara que a foto só *preenche* a checklist. O resto do
sistema não muda, porque continua a receber o mesmo formato estruturado.

---

## 22. MVP sem IA: mesociclos por templates

**Decisão:** para já, não usamos a API Claude. O mesociclo é gerado por **templates em
código**, um por combinação de objetivo e dias por semana (ex.: "Hipertrofia, 3 dias" =
corpo inteiro A/B/C com estes padrões, séries e RIR por semana).

**Porque é que isto não estraga a ideia:** o que torna a Progrex diferente (planos por
padrão, variantes conforme o espaço, alvos de progressão em cada treino) já era tudo
código. A IA só ia *personalizar mais* o desenho do mesociclo.

**Porque é que a IA pode entrar depois sem reescrever nada:** o gerador por templates
devolve um `MesocycleSchema`, que é exatamente o formato que a IA vai devolver. O resto
da app só conhece esse formato e não sabe quem o gerou. Isto chama-se **programar
contra uma interface**: definir bem a fronteira deixa-te trocar o que está de um lado
sem mexer no outro.

---

## 23. Princípios de design

A app é usada entre séries, com as mãos ocupadas e a cabeça no treino. Por isso:

- **Uma ação principal por ecrã.** Se tudo é importante, nada é.
- **Registar uma série com um toque.** Os valores vêm pré-preenchidos com o alvo e só
  corriges o que for diferente, com botões −/+ e não com o teclado.
- **Os números em grande, as palavras em pequeno.** No ginásio olhas de relance.
- **Monocromático** (atualizado: inicialmente havia um laranja de destaque). Ao estilo
  Apple, Nike e Tesla, só preto, branco e cinzentos. A ação principal é o elemento de
  maior contraste (um botão preto num ecrã claro), e o olho vai lá sozinho sem precisar
  de cor. A mudança foi feita quase só em `theme.ts`, o que mostra o valor dos tokens.
- **Tokens de design (`theme.ts`):** cores, tamanhos e espaçamentos definidos uma vez.
  Assim a app fica visualmente consistente e mudar o aspeto é editar um ficheiro.
- **Na dúvida, tira.** Minimalismo não é ter pouco, é cada coisa ter uma razão para
  estar ali.

---

## 24. SQLite assíncrono e Drizzle via `sqlite-proxy`

**O problema:** o driver oficial do Drizzle para Expo usa só chamadas **síncronas**
("faz isto e espera aqui até acabar"). No telemóvel isso é rápido. Na web, porém, o SQLite
corre num *worker* (uma thread à parte), e uma chamada síncrona obriga a thread principal
a ficar em ciclo à espera da resposta. Durante esse tempo o ecrã congela, e na primeira
chamada, enquanto o SQLite ainda carrega, pode até dar *timeout*.

**A solução:** usamos o driver `sqlite-proxy` do Drizzle. Funciona como um intermediário:
o Drizzle constrói o SQL e nós executamo-lo com a API **assíncrona** do `expo-sqlite`, que
funciona bem em todas as plataformas. O custo foi escrever duas peças pequenas que o
driver oficial trazia feitas: o *migrator* e as *live queries*.

**O que aprendes aqui:** síncrono vs. assíncrono não é só estilo. `await` deixa a app
continuar a responder enquanto espera. Bloquear a thread principal é das piores coisas
que uma app pode fazer.

---

## 25. Live queries com publish/subscribe

Quando gravas uma série, o ecrã tem de mostrar a série nova. Como é que o ecrã sabe?

- Cada escrita **publica** "mudei a tabela `sets`" (`notifyChanged('sets')`).
- Cada ecrã **subscreve** as tabelas que lê (`useLiveQuery(fn, ['sets'], …)`) e volta a ler
  quando uma delas muda.

Os dois lados não se conhecem: só conhecem o "canal" de notificações. Este padrão
(*publish/subscribe*) aparece em todo o lado: eventos do browser, Redux, sistemas de
mensagens. A regra que o torna fiável é que **todas as escritas passam pelas funções de
`queries.ts`**, e nenhuma escreve diretamente na base a partir de um ecrã.

---

## 26. Catálogo de exercícios em código

Os 84 exercícios de base vivem em `packages/shared/src/catalog.ts` e são escritos na base
em cada arranque (*upsert*: insere os novos e atualiza os que mudaram).

**Porquê em código e não só na base:**
- uma atualização da app pode corrigir ou acrescentar exercícios;
- são iguais em todos os dispositivos sem precisarem de sincronizar (IDs fixos `builtin:*`);
- o futuro gerador de planos (e a IA, mais tarde) pode lê-los sem ir à base.

Cada exercício diz o **padrão**, o **equipamento** (todos os itens necessários), o tipo
de carga, a **dificuldade** dentro do padrão (1–5) e o incremento de peso. É com estes
dados que a Fase 2 vai escolher variantes e progressões.

---

## 27. Registar uma série com um toque

Ao abrir um exercício, os valores já vêm preenchidos: com a série anterior de hoje, se
existir, senão com a mesma série da última vez, senão com valores padrão. Se a série
correu como previsto, basta tocar em **Concluir série**.

O **descanso** não se escreve: a app mede o tempo entre séries concluídas e guarda-o.
Assim, na Fase 2, "−15 s de descanso" pode ser uma alavanca de progressão com dados reais.

Um treino terminado sem nenhuma série é descartado automaticamente, porque não há nada
para guardar.

---

## 28. A lógica de treino vive em `packages/shared`, com testes

O motor de progressão, a seleção de variantes e as regras de equipamento são **funções
puras**: recebem dados e devolvem uma decisão. Não leem a base de dados nem desenham nada.

**Porquê isto importa:**
- **Testar é trivial.** Um teste é "dado isto, espero aquilo". Os 28 testes correm em
  menos de meio segundo (`npm test`), sem simular um telemóvel.
- **Reutilizável.** O futuro servidor e a IA podem usar exatamente as mesmas regras.
- **A app fica fina.** O ecrã só vai buscar os dados, chama a função e mostra o resultado.

Usamos o **Vitest** porque corre TypeScript diretamente e é muito rápido.

**Como saber se os testes valem alguma coisa:** estragámos o motor de propósito (+2 reps
em vez de +1) e confirmámos que 3 testes falharam. Um teste que nunca falha não protege
nada. A esta técnica chama-se *mutation testing*, aqui feita à mão.

---

## 29. O alvo é guardado com o treino

Quando um exercício entra no treino, o motor calcula o alvo e esse alvo fica guardado
(`workout_exercises.target`). Isto serve para duas coisas:

1. **O alvo não muda a meio do treino.** Se fosse recalculado a cada ecrã, mudaria à
   medida que registas séries.
2. **A sessão seguinte sabe o que foi pedido.** Se ontem a alavanca foi "tempo lento", hoje
   o motor sabe que o tempo já está ativo e passa à alavanca seguinte.

---

## 30. O bug que o teste ponta-a-ponta apanhou

Os testes do motor passavam todos, mas o teste que simula um utilizador real (dois treinos
seguidos no browser) mostrou "Tenta 9 reps na 2.ª série" quando devia ser "Tenta 13 reps
na 1.ª série".

**Causa:** na calibração (primeira vez), depois da 1.ª série, o pré-preenchimento voltava
ao alvo genérico de 8 reps em vez de seguir o que acabaste de fazer. O treino ficava
gravado como 12, 8, 8 em vez de 12, 12, 12.

**Lição:** testes de unidade verificam cada peça; testes ponta-a-ponta verificam se as
peças funcionam juntas. São precisos os dois. O motor estava certo, o erro estava na
forma como o ecrã o usava.

---

## 31. Como o mesociclo é construído (periodização)

Um **mesociclo** é um bloco de 4–5 semanas com um objetivo. O nosso segue três ideias
clássicas do treino:

1. **O esforço sobe semana a semana.** Começas com RIR 3 (3 reps em reserva) e acabas
   em RIR 1, perto da falha. Assim o corpo adapta-se sem te esgotares logo na primeira
   semana.
2. **O volume sobe** (hipertrofia, a partir de intermédio): na segunda metade, mais uma
   série nos exercícios principais.
3. **Acaba com uma semana de recuperação (deload)**: o mesmo peso, metade das séries e
   esforço leve. A fadiga acumulada dissipa-se e começas o bloco seguinte mais forte.

A **divisão semanal** depende dos dias. Com 2–3 dias treinas o corpo inteiro em cada
sessão; com 4, superior/inferior; com 5–6, juntam-se as sessões de empurrar, puxar e
pernas. Cada músculo é treinado pelo menos duas vezes por semana.

Se o treino não cabe nos minutos que escolheste, saem primeiro os **isolamentos**
(bíceps, gémeos…) e só depois se reduzem séries nos principais. O essencial fica sempre.

---

## 32. Testar todas as combinações

Há 4 objetivos × 5 opções de dias × 4 durações × 3 níveis = **240 planos possíveis**. Em
vez de testar meia dúzia de exemplos, o teste gera os 240 e passa cada um pelas
invariantes: semana de recuperação no fim, corpo inteiro coberto, volume dentro de
limites, sessão dentro do tempo. Corre em 23 ms.

Quando o espaço de possibilidades é pequeno, testá-lo todo é a forma mais simples de ter
a certeza. Quando a IA começar a gerar planos, as mesmas invariantes vão protegê-la.

---

## 33. O mesmo treino, sítios diferentes

O plano diz "Treino A: empurrar horizontal, puxar horizontal, empurrar vertical, puxar
vertical, bíceps". No dia, a app escolhe os exercícios para o sítio onde estás:

| Slot | Hotel (nada) | Ginásio |
|---|---|---|
| Empurrar horizontal | Flexões com pés elevados | Supino com halteres |
| Puxar horizontal | Remada invertida debaixo da mesa | Remada com barra |
| Empurrar vertical | Flexões pike com pés elevados | Press com kettlebell |
| Puxar vertical | Remada com toalha na porta (recurso) | Elevações supinadas |
| Bíceps | *saltado: sem equipamento* | Curl com barra |

Regras da escolha: mantém o exercício que usaste da última vez **naquele sítio** (para
a progressão ser comparável), nunca repete um exercício na mesma sessão e começa mais
fácil para iniciantes e mais difícil para avançados.

---

## 34. Ronda de estética: direção Apple

Escolheste a direção **Apple: calma e limpa**. O que mudou e porquê:

- **Letra Inter.** Até aqui cada plataforma usava a sua (SF no iPhone, Roboto no Android,
  outra na web). A Inter é aberta, foi desenhada para ecrãs e é a mais parecida com a SF
  Pro. Uma letra igual em todo o lado é parte da identidade de uma marca.
  - Detalhe técnico: com fontes próprias, cada peso (normal, negrito…) é um ficheiro
    separado, e o Android ignora o `fontWeight`. O nosso `Text` faz a tradução sozinho,
    por isso usa-se sempre esse componente.
- **Números grandes no treino** (`BigStepper`), como na app Fitness: o peso e as reps leem-se
  à distância de um braço, entre séries, sem óculos nem foco.
- **Animações com significado:** a série concluída entra com um ✓ e a barra de progresso
  enche. Usamos o **Reanimated**, que corre as animações na thread de interface e por isso
  ficam fluidas mesmo quando o JavaScript está ocupado.
- **Plano compacto:** a semana atual aberta, as outras recolhidas numa linha, e uma
  barra de progresso no topo.
- **Aparência à escolha:** Sistema, Claro ou Escuro. Um **Context** do React partilha o modo
  com todos os componentes sem o passar de mão em mão.
- **Ícone:** testámos três ideias. As barras a subir pareciam o sinal de rede do telemóvel
  e o "P" sozinho parecia um sinal de estacionamento. Ficou um "P" cuja haste é uma seta
  para cima: Progrex e progressão. Lição de design: um ícone vê-se a 60 px entre dezenas
  de outros, e o que importa é não ser confundido.

---

## 35. Esforço em linguagem simples (RIR para quem nunca treinou)

"RIR 2" não diz nada a quem está a começar. Por isso, a app pergunta **"Como foi?"**:

| Resposta | Quer dizer | RIR guardado |
|---|---|---|
| Fácil | ainda fazia mais 4 ou mais | 4 |
| Bom | ainda fazia mais 2 ou 3 | 2 ou 3 (o alvo, se estiver dentro) |
| Duro | só fazia mais 1 | 1 |
| No limite | não fazia mais nenhuma | 0 |

Por dentro continua tudo em números, por isso o motor não mudou. A conversão é uma
função pura testada (`packages/shared/src/effort.ts`). Na primeira vez aparece uma
explicação curta, e o ⓘ volta a mostrá-la. Quem já conhece pode ligar "Mostrar RIR" nas
Definições. Os alvos também passaram a falar português: "deixa 2 reps de reserva" e
"Semana 2 · Esforço alto" em vez de "RIR 2".

**Princípio:** a app pode ser precisa por dentro e simples por fora. A complexidade fica
do nosso lado, não do lado do utilizador.

---

## 36. Logótipo

Símbolo **A · Seta-P** (o "P" cuja haste é uma seta para cima) e o nome **"Progrex"** em
Inter SemiBold. O componente `Logo` aparece no topo do ecrã Treino, grande nas
boas-vindas e discreto no rodapé das Definições. Está desenhado em SVG
(`react-native-svg`), por isso fica nítido em qualquer tamanho e muda de cor com o tema.

---

## 37. O que nos distingue: o progresso que não se parte

A pesquisa (secção do chat de 9/10) mostrou que adaptar ao equipamento não chega: a
Fitbod já tem perfis de ginásio. O que nenhuma resolve é que **os gráficos são por
exercício**: uma semana de flexões no hotel não conta para o "supino", e quem treina em casa
nem tem gráficos de 1RM úteis.

**A nossa resposta é medir o progresso por movimento.** Três decisões técnicas:

1. **Uma fórmula para tudo (Epley).** Com peso, 1RM estimado. Sem peso, a mesma fórmula com
   o corpo como carga. Antes, 10 → 15 flexões valia "+50%" e inflacionava tudo; agora vale
   ~+12%, coerente com os exercícios com peso.
2. **Cada exercício compara-se só consigo próprio, e o movimento junta-os tendo em conta o
   tempo.** Chegámos aqui à quarta tentativa, e cada uma falhou num caso real:
   - *cadeia entre exercícios*: queda falsa ao voltar do hotel e dupla contagem ao alternar;
   - *média pesada pelo n.º de sessões*: uma sessão melhor de um exercício mais lento
     **baixava** o Índice;
   - *média simples*: um exercício medido em 2 dias, ao lado de um medido em 8 semanas,
     puxava tudo para baixo ("Índice −0,5%" num treino em que melhoraste).
   - **Final:** somamos o progresso de cada exercício, dividimos pelos dias em que cada um foi
     treinado e escalamos ao período. Ginásio 7 semanas (+10%) e depois hotel (+3%) dá +13%;
     casa e ginásio alternados (+2% cada) dá +2%; e uma sessão melhor nunca baixa o Índice.
     Cada um destes casos tem um teste.

   **Lição:** uma métrica que o utilizador vê tem de ter propriedades que ele intui ("se
   melhoro, sobe"). Escreve essas propriedades como testes antes de confiar na fórmula.
3. **Mudar o tempo (descida lenta) conta como exercício novo.** As reps descem de propósito
   e isso não pode aparecer como regressão.

## 38. Estímulo equivalente

"Série dura" = terminada a 3 reps ou menos da falha. Comparamos as séries duras desta
semana com a tua média (das semanas em que treinaste). No ecrã Treino, em viagem, mostramos
quanto do treino habitual se mantém: as séries planeadas são as mesmas em todo o lado, por
isso só se perde o que é impossível ali (ex.: bíceps sem nada). É uma estimativa e a app
diz como é calculada ("Como medimos").

## 39. Modo viagem e resumo do treino

- **Modo viagem:** ao escolher o espaço, dizes por quanto tempo ("Hoje", "3 dias", "1
  semana"). Até lá, o plano usa esse espaço e mostra "em vez de supino com halteres". Depois
  acaba sozinho, e por isso não há nada para "desligar".
- **Resumo:** ao terminar, vês as séries duras, o estímulo, o efeito no Índice e as melhores
  marcas. Se estiveres fora e mantiveres ≥ 85% do estímulo, a mensagem diz isso, que é o
  momento em que a promessa da app se torna visível.
- **Dados de exemplo:** para veres os gráficos antes de teres 8 semanas de treino. Usam o
  prefixo `demo:` e apagam-se com um toque, sem tocar nos teus dados.

---

## 40. Mapa do corpo (zonas a melhorar), sem IA

Ao criar o plano, escolhes até 3 zonas: peito, costas, ombros, braços, core, glúteos,
pernas ou gémeos. Mais do que 3 deixaria de ser foco. O gerador:

1. dá **+1 série por semana** aos movimentos dessas zonas;
2. **acrescenta** um isolamento quando faz sentido (ex.: elevações laterais para os ombros),
   até 2 vezes por semana;
3. quando falta tempo, corta por esta ordem: isolamento sem prioridade → séries dos
   principais sem prioridade → isolamento com prioridade → séries dos principais com
   prioridade. **O que escolheste melhorar é o último a sair.**

Os testes geram 960 planos (240 combinações × 4 escolhas de zonas) e todos passam nas
regras. Os testes apanharam dois erros antes de chegares a vê-los: um slot de core
acrescentado que nunca podia ser cortado (a sessão de 30 min não cabia), e os braços com
prioridade a ficarem com *menos* exercícios do que sem prioridade.

**Fotos com IA (decidido, ainda não feito):** a IA vai sugerir prioridades a partir das fotos
(que o utilizador confirma) e comparar fotos ao longo do tempo. As fotos ficam **só no
telemóvel** e só saem no momento da análise. Precisa do servidor (Fase 4) e de créditos na
API Claude, cerca de 5 cêntimos por análise.

---

## 41. O plano adapta-se a ti; o registo é uma consequência

A Progrex não é um registo de treinos. **O produto é o mesociclo a adaptar-se às tuas
condições, sejam elas quais forem**, para continuares a progredir. Com uma regra por cima de
tudo: **conveniência**. Num dia normal não preenches nada; a app deduz o que pode e só
pergunta, com um toque opcional, o que não pode adivinhar.

| Condição | Como sabemos | O que muda |
|---|---|---|
| Pouco tempo | toque "Pouco tempo" → 20/30/45 | as regras de corte do gerador, com os minutos de hoje |
| Cansado | toque "Cansado" | alvos `hold` (mantém) e +1 rep de reserva |
| Dor | toque "Dor" → zona | sai o que carrega a zona (lista mais larga de propósito) |
| Série má a meio | automático | se uma série falha o alvo por 2+ reps, as seguintes ajustam-se |
| 7+ dias sem treinar | automático | `hold`; com 14+ dias, reentrada com menos séries |
| Semana apertada | automático | se faltam mais sessões do que dias, juntam-se (nunca ficas para trás) |
| Estagnação num exercício | automático | 3 sessões sem melhorar → muda de estímulo (`plateau`) |
| Estagnação geral | automático | metade dos exercícios parados → recuperação antecipada |

Detalhes que importam:
- A lógica está em `packages/shared/src/adapt` (funções puras, testadas). A app só a chama.
- Cada adaptação mostra **uma frase com o porquê**. Uma app que muda o treino sem explicar
  parece avariada.
- O **estímulo equivalente** em viagem compara a mesma sessão ajustada nos dois sítios. Assim
  mede só o efeito do sítio; o efeito do tempo tem a sua própria frase.
- A recuperação conta do zero depois de um deload, para não entrar num ciclo de deloads.
- A dor mostra sempre: "Se a dor persistir, fala com um profissional de saúde."

---

## 42. Ronda de conveniência: contar toques

Percorremos a app como um utilizador novo e contámos os toques. O que mudou:

| Momento | Antes | Agora |
|---|---|---|
| Primeira vez até ao 1.º treino | ~10 toques, formulário de espaço + ecrã do plano | **3 toques**: onde → objetivo → dias (o resto com valores sensatos) |
| Pôr 60 kg num exercício novo | 24 toques no "+" | **tocar no número e escrever** |
| Passar ao exercício seguinte | tocar no cartão | **automático** quando completas as séries |
| Acabar o treino | botão discreto no fundo | **botão principal** quando está tudo feito |
| Máquina ocupada | só quando o motor sugeria | **"Trocar"** em qualquer exercício por começar |
| Fim do descanso | olhar para o ecrã | **vibra** |

E um defeito de qualidade que este teste apanhou: no ginásio, para força, a app escolhia o
"agachamento pistol assistido" porque tinha a dificuldade certa. Agora, **havendo carga
disponível, prefere exercícios com carga**: é a alavanca que dá progresso durante mais tempo.

**Princípio:** cada toque que a app consegue poupar, poupa. Valores por defeito sensatos,
afinar depois e nunca antes.
