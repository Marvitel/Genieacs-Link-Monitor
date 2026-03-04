import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, clients, devices, deviceLogs, configPresets,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Device, type InsertDevice,
  type DeviceLog, type InsertDeviceLog,
  type ConfigPreset, type InsertConfigPreset,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
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
}

export const storage = new DatabaseStorage();
