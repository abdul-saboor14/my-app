import { post, reply, isUniqueViolation, rateLimited, unavailable } from "@/lib/auth-http";
import { passwordHelp } from "@/lib/auth-policy";
import { emailRegex, hashPassword, normalizeEmail, normalizeUsername, readString, usernameRegex, validatePassword } from "@/lib/auth-security";
import { getDatabase } from "@/lib/db";

export const POST = post(async (request, body) => {
  const username = normalizeUsername(readString(body, "username"));
  const email = normalizeEmail(readString(body, "email"));
  const fullName = readString(body, "fullName").trim();
  const password = readString(body, "password");
  if (!usernameRegex.test(username) || !fullName || fullName.length > 150 || /\p{C}/u.test(fullName)
    || email.length > 255 || !emailRegex.test(email)) {
    return reply({ error: "Check your name, email, and username. Usernames must start with a letter and contain 3–30 letters, digits, or underscores." }, 400);
  }
  if (!validatePassword(password)) return reply({ error: passwordHelp }, 400);

  const limited = await rateLimited(request, "register", email);
  if (limited) return limited;
  const hash = await hashPassword(password);
  const sql = getDatabase();
  try {
    const rows = await sql`
      WITH role AS (SELECT id FROM roles WHERE name = 'user'),
      registered AS (
        INSERT INTO users (username, email, full_name)
        SELECT ${username}, ${email}, ${fullName} FROM role
        RETURNING id
      ), credential AS (
        INSERT INTO credentials (user_id, password_hash)
        SELECT id, ${hash} FROM registered
      )
      INSERT INTO user_roles (user_id, role_id)
      SELECT registered.id, role.id FROM registered CROSS JOIN role
      RETURNING user_id
    `;
    if (!rows.length) return unavailable();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return reply({ error: "That username or email is unavailable." }, 409);
  }
  return reply({ message: "Account created. You can now sign in." }, 201);
});
