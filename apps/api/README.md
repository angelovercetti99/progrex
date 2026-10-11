# Servidor de sincronização da Progrex

Um Cloudflare Worker (Hono + D1) que guarda os teus treinos e os passa entre o telemóvel, o
computador e o browser. Sem contas: é protegido por uma **chave pessoal** que só tu tens.
O porquê de cada escolha está em `docs/decisoes.md` (§8–10 e §47).

Custo: o plano gratuito da Cloudflare chega à vontade para uma pessoa.

## Pôr no ar (uma vez)

Corre estes comandos dentro de `apps/api/`.

1. **Entrar na Cloudflare** (abre o browser):

   ```sh
   npx wrangler login
   ```

2. **Criar a base de dados.** O comando mostra um `database_id`: copia-o para
   `wrangler.jsonc`, no lugar de `00000000-0000-0000-0000-000000000000`.

   ```sh
   npx wrangler d1 create progrex
   ```

3. **Criar as tabelas** na base de dados da Cloudflare:

   ```sh
   npm run db:migrate:remote
   ```

4. **Gerar a tua chave pessoal** e guardá-la no Worker. Guarda-a também num gestor de
   palavras-passe: vais colá-la em cada dispositivo.

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   npx wrangler secret put APP_TOKEN
   ```

   (O segundo comando pede o valor: cola a chave que o primeiro gerou.)

5. **Publicar:**

   ```sh
   npm run deploy
   ```

   No fim aparece o endereço, algo como `https://progrex-api.<a-tua-conta>.workers.dev`.

6. **Ligar cada dispositivo:** na app, **Definições → Sincronização**, cola o endereço e a
   chave e toca em **Ligar este dispositivo**. Num dispositivo novo, o primeiro ecrã tem
   "Já uso a Progrex noutro dispositivo", que leva ao mesmo sítio.

## Experimentar no teu computador (sem Cloudflare)

```sh
cp .dev.vars.example .dev.vars   # e muda APP_TOKEN para um valor teu
npm run db:migrate:local
npm run dev                      # fica em http://localhost:8787
```

Na app (no browser do mesmo computador), liga-te a `http://localhost:8787` com essa chave.
Para o telemóvel chegar ao teu computador, usa `npx wrangler dev --ip 0.0.0.0` e o IP do
computador (`http://192.168.x.x:8787`).

## Testes

```sh
npm test
```

Correm dentro de um Worker local verdadeiro, com uma base D1 local: chave, validação,
"a última edição ganha", apagados e paginação.

## Mudar a base de dados

Edita `src/db/schema.ts`, corre `npm run db:generate` (cria um ficheiro em `migrations/`) e
depois `npm run db:migrate:local` / `npm run db:migrate:remote`. Nunca edites uma migração
que já correu.

## Segurança

- A chave **nunca** vai para o git, para a app nem para variáveis `EXPO_PUBLIC_*`: só existe
  como secret do Worker, no `.dev.vars` (ignorado pelo git) e no cofre de cada dispositivo.
- Todos os pedidos sem a chave certa recebem `401`. A comparação é feita em tempo constante.
- Todo o input é validado com Zod (`packages/shared/src/sync.ts`).
- Se a chave vazar: gera outra, corre de novo `npx wrangler secret put APP_TOKEN` e volta a
  ligar cada dispositivo com a chave nova.
