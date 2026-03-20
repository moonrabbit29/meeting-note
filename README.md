# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.12.7 create --template minimal --types ts --install npm meeting-note
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Account APIs

- `POST /api/accounts/owner`: bootstrap the first owner account. This route only works once.
- `POST /api/login`: authenticate with `email` and `password`, returns a bearer token.
- `POST /api/logout`: revoke the current session and clear the auth cookie.
- `POST /api/signup`: owner-only route to create `admin` or `employee` users.
- `GET /api/accounts`: owner-only route to list users.
- `PATCH /api/accounts/:accountId`: owner-only route to deactivate or reactivate a user with `{ "isActive": false }`.

Authentication works with `Authorization: Bearer <token>` and the login/bootstrap routes also set an HTTP-only session cookie.
