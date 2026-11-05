/* Role × route matrix for every management endpoint. The point is that
   permission is decided by the server for each request, whatever the
   frontend shows or hides. Expected codes are the authorisation outcome
   only: requests that pass authorisation may still fail validation (400)
   or find nothing (404), which counts as "allowed" here. */
import request from "supertest";
import type { Role } from "@prisma/client";
import { prisma } from "../../src/prisma";
import { app, bearer, resetDb, tokenFor } from "../helpers";

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

const X = "00000000-0000-4000-8000-000000000000";
type Route = [method: "get" | "post" | "patch" | "put" | "delete", path: string, allowed: Role[]];

const ADMIN_ONLY: Role[] = ["ADMIN"];
const MANAGERS: Role[] = ["ADMIN", "EDITOR"];

const routes: Route[] = [
  ["get", "/users", ADMIN_ONLY],
  ["get", "/users/lookup?userId=nobody", MANAGERS],
  ["post", "/users", ADMIN_ONLY],
  ["patch", `/users/${X}`, ADMIN_ONLY],
  ["post", `/users/${X}/password`, ADMIN_ONLY],
  ["get", "/audit", ADMIN_ONLY],
  ["post", `/documents/${X}/release`, ADMIN_ONLY],
  ["post", "/documents", MANAGERS],
  ["patch", `/documents/${X}`, MANAGERS],
  ["get", `/documents/${X}/grants`, MANAGERS],
  ["put", `/documents/${X}/grants`, MANAGERS],
  ["get", "/content/manage", MANAGERS],
  ["post", "/content", MANAGERS],
  ["patch", `/content/${X}`, MANAGERS],
  ["post", "/consultations", MANAGERS],
  ["patch", `/consultations/${X}`, MANAGERS],
  ["get", `/consultations/${X}/participants`, MANAGERS],
  ["post", `/consultations/${X}/participants`, MANAGERS],
  ["delete", `/consultations/${X}/participants/${X}`, MANAGERS],
  ["patch", `/consultations/${X}/comments/${X}`, MANAGERS],
  ["get", `/consultations/${X}/export.csv`, MANAGERS],
];

const ROLES: Role[] = ["ADMIN", "EDITOR", "OFFICIAL", "PUBLIC"];
const tokens: Partial<Record<Role, string>> = {};

beforeAll(async () => {
  for (const r of ROLES) tokens[r] = (await tokenFor(r)).token;
});

describe.each(routes)("%s %s", (method, path, allowed) => {
  test("anonymous → 401", async () => {
    expect((await request(app)[method](path).send({})).status).toBe(401);
  });
  test.each(ROLES)("%s", async (role) => {
    const status = (await request(app)[method](path).set(bearer(tokens[role]!)).send({})).status;
    if (allowed.includes(role)) expect([200, 201, 204, 400, 404, 409]).toContain(status);
    else expect(status).toBe(403);
  });
});
