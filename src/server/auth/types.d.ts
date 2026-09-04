// Auth.js re-exports Session/User/JWT from @auth/core rather than declaring
// them itself, so declaration merging has to target the @auth/core modules
// directly — augmenting "next-auth" here would create unrelated interfaces
// that never merge with the ones actually used by the callback signatures.
import type { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface User {
    id: string;
    roleId: string;
    roleName: string;
  }

  interface Session {
    user: {
      id: string;
      roleId: string;
      roleName: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    roleId: string;
    roleName: string;
  }
}
