# Alpha Chat

Alpha Chat is a mobile messaging application built with **React Native, Expo, TypeScript, and Supabase**. The project is currently under development.

## Project status

The current development focus is authentication and user profiles. Real-time conversations and additional messaging features are planned next; they should not be considered production-ready until implemented and tested.

## Planned features

- Email and password authentication
- Persistent login sessions
- User profiles and display names
- User directory
- One-to-one real-time messaging
- Group conversations
- Online status, typing indicators, and read receipts
- Image and profile-picture sharing
- Push notifications
- Privacy, blocking, and reporting controls

## Technology stack

- **Mobile:** React Native, Expo, TypeScript
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL
- **Real-time functionality:** Supabase Realtime
- **Media storage:** Supabase Storage
- **Version control:** Git and GitHub

## Prerequisites

Install the following before running the project:

- [Node.js LTS](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go) on an Android device for initial testing, or an appropriate development environment for an emulator
- A [Supabase account](https://supabase.com/)

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Kishor237323/AlphaChat.git
cd AlphaChat
```

### 2. Install dependencies

```bash
npm ci
```

If `npm ci` fails because the lockfile is out of sync with `package.json`, run `npm install` and review the changes before committing them.

### 3. Configure Supabase

Create a Supabase project and obtain its Project URL and publishable key. Add a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Replace the example values with your project's values. Never place a Supabase secret key, service-role key, database password, or other privileged credential in the mobile app. Keep `.env` out of Git; commit only safe example configuration such as `.env.example`.

Before using profile or messaging features, make sure the required Supabase tables, migrations, grants, and Row Level Security (RLS) policies have been applied and tested.

### 4. Start the Expo development server

```bash
npx expo start
```

Follow the terminal instructions to open the app in Expo Go or an appropriate emulator. If you encounter a stale Metro cache, try:

```bash
npx expo start -c
```

## Security notes

- Do not commit `.env` or any private credentials.
- Never ship Supabase service-role or secret keys in the application.
- Enable and test Row Level Security for tables exposed through the Supabase API.
- Restrict conversation and message access to authorised members on the database side; hiding UI controls is not sufficient security.
- Do not use real users' private messages or personal data for testing without appropriate safeguards.

## Development workflow

1. Create a branch for each feature or fix.
2. Make one focused change at a time.
3. Test authentication and relevant screens on a device or emulator.
4. Review database migrations and RLS policies before applying them.
5. Commit only files that belong in the project; never commit local environment files or build artifacts.

## Roadmap

- [ ] Verify signup, email confirmation, login, session restoration, and logout
- [ ] Verify profile creation and display-name updates
- [ ] Secure conversation and membership schema with RLS
- [ ] Implement real-time one-to-one text messaging
- [ ] Add group chats and message history pagination
- [ ] Add typing indicators, presence, unread counts, and read receipts
- [ ] Add secure image uploads and profile pictures
- [ ] Add push notifications using a development build
- [ ] Add blocking/reporting controls and complete security testing

## Contributing

This project is under active development. For changes, keep the existing project structure, follow TypeScript conventions, test affected flows, and document any required Supabase migration or configuration change.

## License

See the [`LICENSE`](LICENSE) file for the project's license terms.
