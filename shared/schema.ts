import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("operator"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  permissions: text("permissions").notNull().default("read"),
  authType: text("auth_type").notNull().default("token"),
  basicUsername: text("basic_username"),
  basicPasswordHash: text("basic_password_hash"),
  createdBy: varchar("created_by"),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  keyHash: true,
  keyPrefix: true,
  lastUsedAt: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export const USER_ROLES = ["admin", "operator", "viewer"] as const;
export const API_PERMISSIONS = ["read", "read_write", "full"] as const;

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
  genieId: text("genie_id"),
  clientId: varchar("client_id"),
  serialNumber: text("serial_number").notNull().unique(),
  model: text("model").notNull(),
  manufacturer: text("manufacturer").notNull(),
  deviceType: text("device_type").notNull(),
  macAddress: text("mac_address"),
  ipAddress: text("ip_address"),
  status: text("status").notNull().default("offline"),
  firmwareVersion: text("firmware_version"),
  hardwareVersion: text("hardware_version"),
  lastSeen: timestamp("last_seen"),
  uptime: text("uptime"),
  pppoeUser: text("pppoe_user"),
  connectionType: text("connection_type"),
  ponPort: text("pon_port"),
  oltId: text("olt_id"),
  rxPower: real("rx_power"),
  txPower: real("tx_power"),
  temperature: real("temperature"),
  voltage: real("voltage"),
  ssid: text("ssid"),
  ssid5g: text("ssid_5g"),
  wifiChannel: text("wifi_channel"),
  wifiChannel5g: text("wifi_channel_5g"),
  wifiBand: text("wifi_band"),
  wifiPassword: text("wifi_password"),
  wifiPassword5g: text("wifi_password_5g"),
  notes: text("notes"),
  configPresetId: varchar("config_preset_id"),
  tags: text("tags").array(),
  savedConfig: jsonb("saved_config"),
  savedConfigAt: timestamp("saved_config_at"),
  gponSerial: text("gpon_serial"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  parentDeviceId: varchar("parent_device_id"),
  replacedByDeviceId: varchar("replaced_by_device_id"),
  replacedAt: timestamp("replaced_at"),
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

export const networkSnapshots = pgTable("network_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  onlineCount: integer("online_count").notNull().default(0),
  offlineCount: integer("offline_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type NetworkSnapshot = typeof networkSnapshots.$inferSelect;

export interface SavedDeviceConfig {
  wifi?: {
    ssid?: string;
    password?: string;
    channel?: number;
    ssid5g?: string;
    password5g?: string;
    channel5g?: number;
  };
  pppoe?: {
    username?: string;
    password?: string;
    vlanId?: number;
    wanDeviceIndex?: number;
    wcdIndex?: number;
    connIndex?: number;
  };
  lan?: {
    lanIp?: string;
    lanSubnet?: string;
    dhcpEnabled?: boolean;
    dhcpStart?: string;
    dhcpEnd?: string;
  };
  voip?: Array<{
    profileIndex: number;
    lineIndex: number;
    enabled?: boolean;
    directoryNumber?: string;
    sipAuthUser?: string;
    sipAuthPassword?: string;
    sipUri?: string;
    sipRegistrar?: string;
    sipRegistrarPort?: number;
    sipProxyServer?: string;
    sipProxyPort?: number;
    sipOutboundProxy?: string;
    sipOutboundProxyPort?: number;
    sipDomain?: string;
  }>;
}

export const DEVICE_TYPES = ["ont", "router", "mesh", "switch", "olt"] as const;
export const DEVICE_STATUSES = ["online", "offline", "warning", "maintenance"] as const;
export const CLIENT_TYPES = ["residential", "corporate"] as const;
export const CLIENT_STATUSES = ["active", "inactive", "suspended"] as const;
export const MANUFACTURERS = ["Huawei", "ZTE", "Fiberhome", "MikroTik", "Ruijie", "TP-Link", "Intelbras", "Parks", "Datacom"] as const;
