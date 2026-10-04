# Complete Better-Auth + Prisma 7 + Next.js App Router Architecture Guide

This guide is a complete, beginner-to-advanced reference on how authentication is built in this project using **Next.js (App Router)**, **Better-Auth**, **Prisma 7**, and **PostgreSQL (Neon DB)**.

It covers:
1. **High-Level Architecture & End-to-End Flow**
2. **Step-by-Step Deep Dive (What, Why, and How for Each File)**
3. **From-Scratch Checklist: How to Build This in a Fresh Project**
4. **Common Pitfalls & Gotchas (and How to Fix Them)**

---

## 1. High-Level Architecture & System Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Client as Client Component (login-form.jsx)
    participant AuthClient as Better-Auth Client (lib/auth-client.js)
    participant Route as Next.js API Route (app/api/auth/[...all]/route.js)
    participant ServerAuth as Better-Auth Server (lib/auth.js)
    participant DB as Database via Prisma (lib/db.js)
    participant OAuth as OAuth Provider (Google/GitHub)

    User->>Client: Clicks "Continue with Google"
    Client->>AuthClient: authClient.signIn.social({ provider: "google" })
    AuthClient->>Route: Request OAuth URL /api/auth/sign-in/social
    Route->>ServerAuth: Handled by toNextJsHandler(auth)
    ServerAuth->>User: Redirects to Google Consent Page
    User->>OAuth: Approves credentials
    OAuth->>Route: Redirects back with OAuth code & state
    Route->>ServerAuth: Exchanges code for Profile & Tokens
    ServerAuth->>DB: Upserts User, Account & creates Session in PostgreSQL
    ServerAuth->>User: Sets secure HTTP-Only session cookie & redirects to /dashboard or /
```

---

## 2. Step-by-Step Breakdown (The "Why, How, and What")

### Step 1: Database Connection & Adapter Setup
- **File**: [`lib/db.js`](file:///c:/nextjscode/21_authentication_01/lib/db.js)
- **What it does**: Creates a single, global instance of `PrismaClient` using the `@prisma/adapter-pg` driver adapter.
- **Why we need it**:
  1. **Hot Reloading in Next.js**: In development, Next.js frequently reloads server modules. Without saving the client on `globalThis`, a new database connection pool is created on every code change, quickly exhausting database connections.
  2. **Prisma 7 Driver Adapter Requirement**: Prisma 7 requires explicit driver adapters (`@prisma/adapter-pg` + `pg`) for direct PostgreSQL connections.
- **Code Pattern**:
  ```javascript
  import { PrismaPg } from "@prisma/adapter-pg";
  import { PrismaClient } from "@/lib/generated/prisma/client";

  const globalForPrisma = globalThis;

  function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    return new PrismaClient({ adapter });
  }

  export const db = globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

  export default db;
  ```

---

### Step 2: Database Schema & Authentication Models
- **File**: [`prisma/schema.prisma`](file:///c:/nextjscode/21_authentication_01/prisma/schema.prisma)
- **What it does**: Defines the 4 essential database tables required by Better-Auth:
  - `User`: Core user profile (id, email, name, avatar, timestamps).
  - `Session`: Active login sessions with tokens, expiry, and user relation.
  - `Account`: OAuth provider links (Google/GitHub tokens, password hashes).
  - `Verification`: Verification tokens for email validation or password resets.
- **Why we need it**: Better-Auth relies on these relational tables to store identity, tokens, and active sessions securely in your own database.
- **How to generate**:
  ```bash
  npx auth@latest generate
  npx prisma generate
  npx prisma db push
  ```

---

### Step 3: Server-Side Better-Auth Configuration
- **File**: [`lib/auth.js`](file:///c:/nextjscode/21_authentication_01/lib/auth.js)
- **What it does**: Initializes the backend Better-Auth engine with the Prisma adapter, enabled authentication strategies (email/password), and OAuth credentials.
- **Why we need it**: This is the single source of truth for your server-side authentication rules, token encryption, and database interactions.
- **Code Pattern**:
  ```javascript
  import { betterAuth } from "better-auth";
  import { prismaAdapter } from "better-auth/adapters/prisma";
  import db from "@/lib/db";

  export const auth = betterAuth({
    database: prismaAdapter(db, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    },
  });
  ```

---

### Step 4: Catch-All API Handler in Next.js App Router
- **File**: [`app/api/auth/[...all]/route.js`](file:///c:/nextjscode/21_authentication_01/app/api/auth/%5B...all%5D/route.js)
- **What it does**: Mounts all Better-Auth endpoints (sign-in, sign-up, callbacks, sessions, sign-out) under `/api/auth/*`.
- **Why we need it**: Next.js App Router needs route handlers to expose GET and POST HTTP endpoints for authentication events.
- **Code Pattern**:
  ```javascript
  import { auth } from "@/lib/auth";
  import { toNextJsHandler } from "better-auth/next-js";

  export const { POST, GET } = toNextJsHandler(auth);
  ```

---

### Step 5: Client-Side Better-Auth SDK
- **File**: [`lib/auth-client.js`](file:///c:/nextjscode/21_authentication_01/lib/auth-client.js)
- **What it does**: Exports React hooks (`useSession()`) and actions (`signIn`, `signUp`, `signOut`) for browser components.
- **Why we need it**: Allows frontend components to trigger authentication flows and subscribe to real-time session changes without writing manual `fetch` calls.
- **Code Pattern**:
  ```javascript
  import { createAuthClient } from "better-auth/react";

  export const authClient = createAuthClient();
  ```

---

### Step 6: Protected Pages & Server-Side Session Guarding
- **File**: [`app/login/page.js`](file:///c:/nextjscode/21_authentication_01/app/login/page.js)
- **What it does**: Checks on the server whether the user is already logged in before rendering the login page.
- **Why we need it**: Prevents already-authenticated users from seeing the login screen, redirecting them immediately to the protected area (`/`).
- **Code Pattern**:
  ```javascript
  import LoginForm from "@/components/ui/login-form";
  import { auth } from "@/lib/auth";
  import { headers } from "next/headers";
  import { redirect } from "next/navigation";

  const LoginPage = async () => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session) {
      redirect("/");
    }

    return <LoginForm />;
  };

  export default LoginPage;
  ```

---

### Step 7: Client Login Form Component
- **File**: [`components/ui/login-form.jsx`](file:///c:/nextjscode/21_authentication_01/components/ui/login-form.jsx)
- **What it does**: Renders social login buttons and triggers the OAuth redirect workflow.
- **Code Pattern**:
  ```javascript
  "use client";
  import { authClient } from "@/lib/auth-client";
  import { Button } from "@/components/ui/button";

  export default function LoginForm() {
    const handleGoogleSignIn = async () => {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    };

    const handleGithubSignIn = async () => {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });
    };

    return (
      <div>
        <Button onClick={handleGoogleSignIn}>Continue with Google</Button>
        <Button onClick={handleGithubSignIn}>Continue with GitHub</Button>
      </div>
    );
  }
  ```

---

### Step 8: Client Session Consumption & Sign Out
- **File**: [`components/ui/home.jsx`](file:///c:/nextjscode/21_authentication_01/components/ui/home.jsx)
- **What it does**: Consumes the session state with `authClient.useSession()` and allows logging out.
- **Code Pattern**:
  ```javascript
  "use client";
  import { authClient } from "@/lib/auth-client";
  import { Button } from "@/components/ui/button";
  import { useRouter } from "next/navigation";

  export default function HomeView() {
    const { data: session, isPending } = authClient.useSession();
    const router = useRouter();

    if (isPending) return <p>Loading session...</p>;
    if (!session) return <p>Not authenticated</p>;

    return (
      <div>
        <p>Logged in as: {session.user.email}</p>
        <Button
          onClick={() =>
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => router.push("/login"),
              },
            })
          }
        >
          Logout
        </Button>
      </div>
    );
  }
  ```

---

## 3. How to Build This From Scratch in a New Project

If you start a brand new project, follow these exact steps in order:

### 1. Initialize Next.js Project
```bash
npx create-next-app@latest my-auth-app
cd my-auth-app
```

### 2. Install Required Dependencies
```bash
# Better-Auth and Prisma dependencies
npm install better-auth @prisma/client @prisma/adapter-pg pg dotenv
npm install -D prisma @types/pg
```

### 3. Setup Environment Variables (`.env`)
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
BETTER_AUTH_SECRET="generate_a_random_32_character_string_here"
BETTER_AUTH_URL="http://localhost:3000"

# Optional OAuth keys:
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

### 4. Initialize Prisma
```bash
npx prisma init
```

### 5. Create Server Auth Config (`lib/auth.js`) & DB Singleton (`lib/db.js`)
Create the singleton in `lib/db.js` and better-auth server config in `lib/auth.js`.

### 6. Auto-Generate Auth Schema & Push to Database
```bash
npx auth@latest generate
npx prisma generate
npx prisma db push
```

### 7. Create API Catch-All Route
Create file `app/api/auth/[...all]/route.js` with `toNextJsHandler(auth)`.

### 8. Create Client SDK (`lib/auth-client.js`)
Create `lib/auth-client.js` with `createAuthClient()`.

### 9. Build UI Pages & Forms
- Create `app/login/page.js` for login view.
- Create `app/page.js` for authenticated dashboard/home.

---

## 4. Key Gotchas & How to Avoid Common Errors

| Gotcha / Error | Why It Happens | Solution |
| :--- | :--- | :--- |
| `PrismaClient was instantiated without any options. A driver adapter is required...` | In Prisma 7, direct connections require an adapter. | Install `@prisma/adapter-pg pg` and pass `new PrismaPg({ connectionString })` to `new PrismaClient({ adapter })`. |
| `Export Github doesn't exist in target module lucide-react` | `lucide-react` removed brand icons (GitHub, Google, etc.). | Use inline SVGs or icons from dedicated logo packages. |
| `ReferenceError: authClient is not defined` | Missing import in a client component. | Add `import { authClient } from "@/lib/auth-client";`. |
| `ReferenceError: redirect is not defined` | Calling `redirect()` in a server page without importing it. | Add `import { redirect } from "next/navigation";`. |
| `SyntaxError: await isn't allowed in non-async function` | Using `await authClient.signIn...` inside a regular function. | Prefix the function with `async`, e.g., `const handleLogin = async () => { ... }`. |
| `API Route 404 on login/logout` | Missing `[...all]` catch-all folder name. | Verify directory is `app/api/auth/[...all]/route.js`. |
