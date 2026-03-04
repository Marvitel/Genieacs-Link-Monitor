import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  document: text("document"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  plan: text("plan"),
  clientType: text("client_type").notNull().default("residential"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id"),
  serialNumber: text("serial_number").notNull().unique(),
  model: text("model").notNull(),
  manufacturer: text("manufacturer").notNull(),
  deviceType: text("device_type").notNull(),
  macAddress: text("mac_address"),
  ipAddress: text("ip_address"),
  status: text("status").notNull().default("offline"),
  firmwareVersion: text("firmware_version"),
  lastSeen: timestamp("last_seen"),
  uptime: text("uptime"),
  pppoeUser: text("pppoe_user"),
  connectionType: text("connection_type"),
  ponPort: text("pon_port"),
  oltId: text("olt_id"),
  rxPower: real("rx_power"),
  txPower: real("tx_power"),
  temperature: real("temperature"),
  ssid: text("ssid"),
  wifiChannel: text("wifi_channel"),
  wifiBand: text("wifi_band"),
  notes: text("notes"),
  configPresetId: varchar("config_preset_id"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

export const deviceLogs = pgTable("device_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeviceLogSchema = createInsertSchema(deviceLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDeviceLog = z.infer<typeof insertDeviceLogSchema>;
export type DeviceLog = typeof deviceLogs.$inferSelect;

export const configPresets = pgTable("config_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  description: text("description"),
  configData: jsonb("config_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConfigPresetSchema = createInsertSchema(configPresets).omit({
  id: true,
  createdAt: true,
});

export type InsertConfigPreset = z.infer<typeof insertConfigPresetSchema>;
export type ConfigPreset = typeof configPresets.$inferSelect;

export const DEVICE_TYPES = ["ont", "router", "mesh", "switch", "olt"] as const;
export const DEVICE_STATUSES = ["online", "offline", "warning", "maintenance"] as const;
export const CLIENT_TYPES = ["residential", "corporate"] as const;
export const CLIENT_STATUSES = ["active", "inactive", "suspended"] as const;
export const MANUFACTURERS = ["Huawei", "ZTE", "Fiberhome", "MikroTik", "Ruijie", "TP-Link", "Intelbras", "Parks", "Datacom"] as const;
