import { defineUserSignupFields } from "wasp/server/auth";

// SPEC §4: name is 1–50 characters. The email and the password are validated by
// Wasp's own username-and-password provider.
export const userSignupFields = defineUserSignupFields({
  name: (data) => {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (name.length < 1) {
      throw new Error("Name is required.");
    }
    if (name.length > 50) {
      throw new Error("Name must be at most 50 characters.");
    }
    return name;
  },
});
