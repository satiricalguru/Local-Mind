import path from "path";
import fs from "fs";
import { app } from "electron";
import { Conversation, Message, ModelEntry, Generation } from "@localmind/shared-types";

// Dynamic loading of better-sqlite3 with an elegant fallback
let Database: any = null;
try {
  Database = require("better-sqlite3");
} catch (err) {
  console.warn("better-sqlite3 failed to load, falling back to JSON storage", err);
}

export class DatabaseManager {
  private db: any = null;
  private dbPath: string;
  private isFallback = false;
  private fallbackData: {
    models: any[];
    conversations: Conversation[];
    messages: Message[];
    generations: Generation[];
    settings: Record<string, string>;
  } = {
    models: [],
    conversations: [],
    messages: [],
    generations: [],
    settings: {}
  };

  constructor() {
    // Determine database path: ~/LocalMind/localmind.db
    const userHome = app.getPath("home");
    const localMindDir = path.join(userHome, "LocalMind");
    if (!fs.existsSync(localMindDir)) {
      fs.mkdirSync(localMindDir, { recursive: true });
    }
    this.dbPath = path.join(localMindDir, "localmind.db");

    if (Database) {
      try {
        this.db = new Database(this.dbPath);
        this.initTables();
      } catch (err) {
        console.error("Failed to initialize SQLite Database, falling back to JSON:", err);
        this.isFallback = true;
        this.loadFallbackFile();
      }
    } else {
      this.isFallback = true;
      this.loadFallbackFile();
    }
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT,
        installed_at INTEGER NOT NULL,
        last_used_at INTEGER,
        use_count INTEGER DEFAULT 0,
        notes TEXT,
        meta_json TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model_id TEXT NOT NULL,
        system_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0,
        workspace_id TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parent_id TEXT,
        branch_id TEXT,
        model_id TEXT,
        stats_json TEXT,
        created_at INTEGER NOT NULL,
        liked INTEGER,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        model_id TEXT NOT NULL,
        prompt TEXT,
        params_json TEXT,
        output_path TEXT,
        thumbnail_path TEXT,
        duration_ms INTEGER,
        seed INTEGER,
        favorite INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      );
    `);
  }

  // --- Fallback File Operations ---
  private loadFallbackFile() {
    const fallbackPath = this.dbPath + ".json";
    if (fs.existsSync(fallbackPath)) {
      try {
        const fileContent = fs.readFileSync(fallbackPath, "utf-8");
        this.fallbackData = JSON.parse(fileContent);
      } catch (e) {
        console.error("Failed to read JSON fallback database:", e);
      }
    }
  }

  private saveFallbackFile() {
    const fallbackPath = this.dbPath + ".json";
    try {
      fs.writeFileSync(fallbackPath, JSON.stringify(this.fallbackData, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write JSON fallback database:", e);
    }
  }

  // --- Models DB Ops ---
  getInstalledModels(): any[] {
    if (this.isFallback) {
      return this.fallbackData.models;
    }
    try {
      return this.db.prepare("SELECT * FROM models").all().map((m: any) => ({
        ...m,
        installedAt: m.installed_at,
        lastUsedAt: m.last_used_at,
        useCount: m.use_count,
        metaJson: m.meta_json ? JSON.parse(m.meta_json) : null
      }));
    } catch (e) {
      return [];
    }
  }

  addInstalledModel(model: any) {
    if (this.isFallback) {
      this.fallbackData.models = this.fallbackData.models.filter(m => m.id !== model.id);
      this.fallbackData.models.push(model);
      this.saveFallbackFile();
      return;
    }
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO models (id, variant_id, slug, name, category, file_path, size_bytes, sha256, installed_at, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        model.id,
        model.variantId,
        model.slug,
        model.name,
        model.category,
        model.filePath,
        model.sizeBytes,
        model.sha256 || "",
        model.installedAt || Date.now(),
        JSON.stringify(model.metaJson || {})
      );
    } catch (e) {
      console.error("DB Error adding model:", e);
    }
  }

  removeInstalledModel(id: string) {
    if (this.isFallback) {
      this.fallbackData.models = this.fallbackData.models.filter(m => m.id !== id);
      this.saveFallbackFile();
      return;
    }
    try {
      this.db.prepare("DELETE FROM models WHERE id = ?").run(id);
    } catch (e) {}
  }

  // --- Conversations DB Ops ---
  getConversations(): Conversation[] {
    if (this.isFallback) {
      return this.fallbackData.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    try {
      return this.db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all().map((c: any) => ({
        id: c.id,
        title: c.title,
        modelId: c.model_id,
        systemPrompt: c.system_prompt,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        pinned: c.pinned === 1,
        workspaceId: c.workspace_id
      }));
    } catch (e) {
      return [];
    }
  }

  createConversation(conv: Conversation) {
    if (this.isFallback) {
      this.fallbackData.conversations.push(conv);
      this.saveFallbackFile();
      return;
    }
    try {
      const stmt = this.db.prepare(`
        INSERT INTO conversations (id, title, model_id, system_prompt, created_at, updated_at, pinned, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        conv.id,
        conv.title,
        conv.modelId,
        conv.systemPrompt || "",
        conv.createdAt,
        conv.updatedAt,
        conv.pinned ? 1 : 0,
        conv.workspaceId || ""
      );
    } catch (e) {}
  }

  updateConversation(id: string, updates: Partial<Conversation>) {
    if (this.isFallback) {
      const conv = this.fallbackData.conversations.find(c => c.id === id);
      if (conv) {
        Object.assign(conv, updates, { updatedAt: Date.now() });
        this.saveFallbackFile();
      }
      return;
    }
    try {
      const fields = Object.keys(updates).map(k => `${k === 'modelId' ? 'model_id' : k === 'systemPrompt' ? 'system_prompt' : k} = ?`).join(", ");
      const values = Object.values(updates).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
      values.push(id);
      this.db.prepare(`UPDATE conversations SET ${fields}, updated_at = ${Date.now()} WHERE id = ?`).run(...values);
    } catch (e) {}
  }

  deleteConversation(id: string) {
    if (this.isFallback) {
      this.fallbackData.conversations = this.fallbackData.conversations.filter(c => c.id !== id);
      this.fallbackData.messages = this.fallbackData.messages.filter(m => m.conversationId !== id);
      this.saveFallbackFile();
      return;
    }
    try {
      this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
      this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    } catch (e) {}
  }

  // --- Messages DB Ops ---
  getMessages(conversationId: string): Message[] {
    if (this.isFallback) {
      return this.fallbackData.messages.filter(m => m.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt);
    }
    try {
      return this.db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId).map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        role: m.role as any,
        content: m.content,
        parentId: m.parent_id,
        branchId: m.branch_id,
        modelId: m.model_id,
        stats: m.stats_json ? JSON.parse(m.stats_json) : undefined,
        createdAt: m.created_at,
        liked: m.liked === null ? undefined : m.liked === 1
      }));
    } catch (e) {
      return [];
    }
  }

  addMessage(message: Message) {
    if (this.isFallback) {
      this.fallbackData.messages.push(message);
      this.saveFallbackFile();
      return;
    }
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, parent_id, branch_id, model_id, stats_json, created_at, liked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.parentId || "",
        message.branchId || "",
        message.modelId || "",
        message.stats ? JSON.stringify(message.stats) : "",
        message.createdAt,
        message.liked === undefined ? null : message.liked ? 1 : 0
      );
    } catch (e) {}
  }

  // --- Generations DB Ops ---
  getGenerations(category?: string): Generation[] {
    if (this.isFallback) {
      return category 
        ? this.fallbackData.generations.filter(g => g.category === category).sort((a, b) => b.createdAt - a.createdAt)
        : this.fallbackData.generations.sort((a, b) => b.createdAt - a.createdAt);
    }
    try {
      const query = category ? "SELECT * FROM generations WHERE category = ? ORDER BY created_at DESC" : "SELECT * FROM generations ORDER BY created_at DESC";
      const params = category ? [category] : [];
      return this.db.prepare(query).all(...params).map((g: any) => ({
        id: g.id,
        category: g.category as any,
        modelId: g.model_id,
        prompt: g.prompt,
        paramsJson: g.params_json,
        outputPath: g.output_path,
        thumbnailPath: g.thumbnail_path,
        durationMs: g.duration_ms,
        seed: g.seed,
        favorite: g.favorite === 1,
        createdAt: g.created_at
      }));
    } catch (e) {
      return [];
    }
  }

  addGeneration(g: Generation) {
    if (this.isFallback) {
      this.fallbackData.generations.push(g);
      this.saveFallbackFile();
      return;
    }
    try {
      const stmt = this.db.prepare(`
        INSERT INTO generations (id, category, model_id, prompt, params_json, output_path, thumbnail_path, duration_ms, seed, favorite, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        g.id,
        g.category,
        g.modelId,
        g.prompt || "",
        g.paramsJson || "{}",
        g.outputPath || "",
        g.thumbnailPath || "",
        g.durationMs || 0,
        g.seed || 0,
        g.favorite ? 1 : 0,
        g.createdAt
      );
    } catch (e) {}
  }

  deleteGeneration(id: string) {
    if (this.isFallback) {
      this.fallbackData.generations = this.fallbackData.generations.filter(g => g.id !== id);
      this.saveFallbackFile();
      return;
    }
    try {
      this.db.prepare("DELETE FROM generations WHERE id = ?").run(id);
    } catch (e) {}
  }

  // --- Settings Key Value ---
  getSettings(): Record<string, string> {
    if (this.isFallback) {
      return this.fallbackData.settings;
    }
    try {
      const rows = this.db.prepare("SELECT * FROM settings").all();
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return settings;
    } catch (e) {
      return {};
    }
  }

  setSetting(key: string, value: string) {
    if (this.isFallback) {
      this.fallbackData.settings[key] = value;
      this.saveFallbackFile();
      return;
    }
    try {
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(key, value, Date.now());
    } catch (e) {}
  }
}
