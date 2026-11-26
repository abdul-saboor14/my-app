import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, normalizeUsername, usernameRegex, validatePassword } from "../src/lib/auth-policy.ts";

test("usernames normalize before format validation", () => {
  assert.equal(normalizeUsername("  SaBor_14 "), "sabor_14");
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
  assert.ok(usernameRegex.test("sabor_14"));
  for (const invalid of ["ab", "1abc", "a-b", "a b", "a".repeat(31)]) {
    assert.equal(usernameRegex.test(invalid), false, invalid);
  }
});

test("new passwords require each character class and fit the length limits", () => {
  assert.ok(validatePassword("Uppercase1!!"));
  assert.ok(validatePassword("Aa1!" + "a".repeat(124)));
  for (const invalid of [
    "Short1!", "lowercase1!!", "UPPERCASE1!!", "Uppercase!!!",
    "Uppercase123", "Uppercase12 ", "Uppercase1!!\n", "Aa1!" + "a".repeat(125),
  ]) {
    assert.equal(validatePassword(invalid), false, JSON.stringify(invalid));
  }
});
