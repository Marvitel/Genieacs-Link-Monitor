import { eq, desc, or, ilike } from "drizzle-orm";
import { db } from "./db";
import {
  users, clients, devices, deviceLogs, configPresets, systemSettings, apiKeys,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Device, type InsertDevice,
  type DeviceLog, type InsertDeviceLog,
  type ConfigPreset, type InsertConfigPreset,
  type SystemSetting, type ApiKey,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceBySerial(serialNumber: string): Promise<Device | undefined>;
  getDeviceByGenieId(genieId: string): Promise<Device | undefined>;
  getDeviceByMac(mac: string): Promise<Device | undefined>;
  getDeviceByPppoeUser(pppoeUser: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, device: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  getDeviceLogs(deviceId?: string): Promise<DeviceLog[]>;
  createDeviceLog(log: InsertDeviceLog): Promise<DeviceLog>;

  getConfigPresets(): Promise<ConfigPreset[]>;
  getConfigPreset(id: string): Promise<ConfigPreset | undefined>;
  createConfigPreset(preset: InsertConfigPreset): Promise<ConfigPreset>;
  updateConfigPreset(id: string, preset: Partial<InsertConfigPreset>): Promise<ConfigPreset | undefined>;
  deleteConfigPreset(id: string): Promise<void>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getSettings(): Promise<SystemSetting[]>;

  getApiKeys(): Promise<ApiKey[]>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  createApiKey(data: { name: string; keyHash: string; keyPrefix: string; permissions: string; createdBy?: string }): Promise<ApiKey>;
  deleteApiKey(id: string): Promise<void>;
  updateApiKeyLastUsed(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getDevices(): Promise<Device[]> {
    return db.select().from(devices).orderBy(desc(devices.createdAt));
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async getDeviceBySerial(serialNumber: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.serialNumber, serialNumber));
    return device;
  }

  async getDeviceByGenieId(genieId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.genieId, genieId));
    return device;
  }

  async getDeviceByMac(mac: string): Promise<Device | undefined> {
    const normalized = mac.toUpperCase().replace(/-/g, ":");
    const [device] = await db.select().from(devices).where(
      or(
        ilike(devices.macAddress, normalized),
        ilike(devices.macAddress, mac)
      )
    );
    return device;
  }

  async getDeviceByPppoeUser(pppoeUser: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(ilike(devices.pppoeUser, pppoeUser));
    return device;
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [created] = await db.insert(devices).values(device).returning();
    return created;
  }

  async updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const [updated] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return updated;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getDeviceLogs(deviceId?: string): Promise<DeviceLog[]> {
    if (deviceId) {
      return db.select().from(deviceLogs).where(eq(deviceLogs.deviceId, deviceId)).orderBy(desc(deviceLogs.createdAt));
    }
    return db.select().from(deviceLogs).orderBy(desc(deviceLogs.createdAt)).limit(100);
  }

  async createDeviceLog(log: InsertDeviceLog): Promise<DeviceLog> {
    const [created] = await db.insert(deviceLogs).values(log).returning();
    return created;
  }

  async getConfigPresets(): Promise<ConfigPreset[]> {
    return db.select().from(configPresets).orderBy(desc(configPresets.createdAt));
  }

  async getConfigPreset(id: string): Promise<ConfigPreset | undefined> {
    const [preset] = await db.select().from(configPresets).where(eq(configPresets.id, id));
    return preset;
  }

  async createConfigPreset(preset: InsertConfigPreset): Promise<ConfigPreset> {
    const [created] = await db.insert(configPresets).values(preset).returning();
    return created;
  }

  async updateConfigPreset(id: string, data: Partial<InsertConfigPreset>): Promise<ConfigPreset | undefined> {
    const [updated] = await db.update(configPresets).set(data).where(eq(configPresets.id, id)).returning();
    return updated;
  }

  async deleteConfigPreset(id: string): Promise<void> {
    await db.delete(configPresets).where(eq(configPresets.id, id));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(systemSettings).values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
  }

  async getSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings);
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return key;
  }

  async createApiKey(data: { name: string; keyHash: string; keyPrefix: string; permissions: string; createdBy?: string }): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(data).returning();
    return created;
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }
}

export const storage = new DatabaseStorage();
