import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    role: string;
  }
}

export async function ensureAdminExists(): Promise<void> {
  const allUsers = await storage.getAllUsers();
  if (allUsers.length === 0) {
    const hashedPassword = await bcrypt.hash("admin", 10);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      displayName: "Administrador",
      role: "admin",
      active: true,
    });
    console.log("[Auth] Usuário admin criado automaticamente (senha: admin)");
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.status(401).json({ message: "Não autenticado" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ message: "Acesso restrito a administradores" });
    return;
  }
  next();
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = (req.headers["x-api-key"] as string) || (req.query.apikey as string);
  if (!apiKey) {
    if (req.session?.userId) {
      next();
      return;
    }
    const basicAuth = req.headers.authorization;
    if (basicAuth?.startsWith("Basic ")) {
      const decoded = Buffer.from(basicAuth.slice(6), "base64").toString();
      const [username, password] = decoded.split(":");
      if (username && password) {
        const user = await storage.getUserByUsername(username);
        if (user && user.active && await bcrypt.compare(password, user.password)) {
          (req as any).authenticatedUser = { id: user.id, username: user.username, role: user.role };
          try {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
          } catch {}
          next();
          return;
        }
      }
    }
    res.status(401).json({ message: "API key ou autenticação necessária" });
    return;
  }

  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const allKeys = await storage.getApiKeys();
  const matchedKey = allKeys.find(k => k.active && k.keyHash === keyHash);

  if (!matchedKey) {
    res.status(401).json({ message: "API key inválida" });
    return;
  }

  storage.updateApiKeyLastUsed(matchedKey.id).catch(() => {});
  (req as any).apiKeyId = matchedKey.id;
  (req as any).apiKeyPermissions = matchedKey.permissions;
  next();
}

export function generateApiKey(): string {
  return `nc_${crypto.randomBytes(32).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
