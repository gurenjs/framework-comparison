import { app, page, route } from "@wasp.sh/spec";
import { Layout } from "./src/Layout" with { type: "ref" };
import { LoginPage } from "./src/auth/LoginPage" with { type: "ref" };
import { SignupPage } from "./src/auth/SignupPage" with { type: "ref" };
import { onAfterSignup } from "./src/auth/hooks" with { type: "ref" };
import { userSignupFields } from "./src/auth/userSignupFields" with { type: "ref" };
import { postsSpec } from "./src/posts/post.wasp";

export default app({
  name: "wasp",
  wasp: { version: "^0.25.0" },
  title: "Minilog",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  // SPEC §1 asks for a unique email, a name and a hashed password. The email is
  // the username here; SPEC.md registers why this is not the `email` method.
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {
        userSignupFields,
      },
    },
    onAfterSignup,
    onAuthSucceededRedirectTo: "/",
    onAuthFailedRedirectTo: "/login",
  },
  client: {
    rootComponent: Layout,
  },
  spec: [
    postsSpec,
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
  ],
});
