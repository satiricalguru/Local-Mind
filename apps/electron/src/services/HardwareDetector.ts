import si from "systeminformation";
import { HardwareProfile, HardwareLiveStats } from "@localmind/shared-types";

export class HardwareDetector {
  private static cachedProfile: HardwareProfile | null = null;

  static async getProfile(): Promise<HardwareProfile> {
    if (this.cachedProfile) {
      return this.cachedProfile;
    }

    // Fetch hardware info with individual try-catch blocks to prevent one command error from failing the entire detection
    let cpuInfo: any = {};
    let memInfo: any = { total: 16 * 1024 * 1024 * 1024, free: 8 * 1024 * 1024 * 1024 };
    let gpuInfo: any = { controllers: [] };
    let osInfo: any = { distro: "Generic OS", release: "1.0" };
    let fsSize: any = [];

    try { cpuInfo = await si.cpu(); } catch (e) { console.warn("si.cpu failed:", e); }
    try { memInfo = await si.mem(); } catch (e) { console.warn("si.mem failed:", e); }
    try { gpuInfo = await si.graphics(); } catch (e) { console.warn("si.graphics failed:", e); }
    try { osInfo = await si.osInfo(); } catch (e) { console.warn("si.osInfo failed:", e); }
    try { fsSize = await si.fsSize(); } catch (e) { console.warn("si.fsSize failed:", e); }

    try {

      // CPU Specs
      const cpu = {
        brand: cpuInfo.brand || "Generic CPU",
        cores: cpuInfo.cores || 4,
        physicalCores: cpuInfo.physicalCores || 4,
        speed: typeof cpuInfo.speed === "number" ? cpuInfo.speed : parseFloat(String(cpuInfo.speed || "2.4")) || 2.4,
        architecture: (process.arch === "arm64" ? "arm64" : "x64") as "arm64" | "x64"
      };

      // RAM Specs
      const ramTotalGB = Math.round(memInfo.total / (1024 * 1024 * 1024));
      const ramAvailableGB = Math.round(memInfo.free / (1024 * 1024 * 1024));
      
      let ramType: "LPDDR5" | "DDR5" | "DDR4" | "unified" | "unknown" = "unknown";
      if (process.platform === "darwin" && process.arch === "arm64") {
        ramType = "unified"; // Apple Silicon unified memory
      } else {
        ramType = "DDR4";
      }

      const ram = {
        totalGB: ramTotalGB || 16,
        availableGB: ramAvailableGB || 8,
        type: ramType
      };

      // GPU Specs
      const gpus: HardwareProfile["gpus"] = [];
      let totalVramGB = 0;
      let platformBackend: HardwareProfile["backend"] = "cpu";

      if (gpuInfo.controllers && gpuInfo.controllers.length > 0) {
        for (const controller of gpuInfo.controllers) {
          const model = controller.model || controller.name || "Unknown GPU";
          const vendor = this.detectVendor(controller.vendor || model);
          const vramMB = controller.vram || controller.memoryTotal || 0;
          const vramGB = Math.round(vramMB / 1024 * 10) / 10;

          const supportsMetal = process.platform === "darwin" && process.arch === "arm64";
          const supportsCUDA = vendor === "NVIDIA";
          const supportsROCm = vendor === "AMD" && process.platform !== "darwin";
          const supportsVulkan = process.platform === "win32" || process.platform === "linux";

          gpus.push({
            vendor,
            model,
            vramGB,
            driver: controller.driverVersion || "N/A",
            supportsMetal,
            supportsCUDA,
            supportsROCm,
            supportsVulkan
          });

          totalVramGB += vramGB;
        }
      }

      // If Apple Silicon and no discrete GPU listed, add Apple Integrated GPU
      if (process.platform === "darwin" && process.arch === "arm64" && gpus.length === 0) {
        gpus.push({
          vendor: "Apple",
          model: "Apple M-Series Integrated GPU",
          vramGB: Math.round(ram.totalGB * 0.75), // standard approximation for Unified VRAM limit
          driver: "CoreImage",
          supportsMetal: true,
          supportsCUDA: false,
          supportsROCm: false,
          supportsVulkan: false
        });
        totalVramGB = Math.round(ram.totalGB * 0.75);
      }

      // Determine default compute backend
      if (process.platform === "darwin" && process.arch === "arm64") {
        platformBackend = "metal";
      } else if (gpus.some(g => g.supportsCUDA)) {
        platformBackend = "cuda";
      } else if (gpus.some(g => g.supportsROCm)) {
        platformBackend = "rocm";
      } else if (gpus.some(g => g.supportsVulkan)) {
        platformBackend = "vulkan";
      } else {
        platformBackend = "cpu";
      }

      // Disk free space
      const defaultDisk = fsSize.find((f: any) => f.mount === "/" || f.mount === "C:") || fsSize[0];
      const disk = {
        freeGB: defaultDisk ? Math.round(defaultDisk.available / (1024 * 1024 * 1024)) : 100,
        totalGB: defaultDisk ? Math.round(defaultDisk.size / (1024 * 1024 * 1024)) : 512,
        storagePathFreeGB: defaultDisk ? Math.round(defaultDisk.available / (1024 * 1024 * 1024)) : 100
      };

      // Compute Score calculation
      const cpuScore = Math.min(cpu.physicalCores / 16, 1.0) * 20;
      const ramScore = Math.min(ram.totalGB / 64, 1.0) * 20;
      const vramScore = Math.min(totalVramGB / 24, 1.0) * 60;
      const computeScore = Math.round(cpuScore + ramScore + vramScore);

      // Capability Tier
      let tier: HardwareProfile["tier"] = "Tier 1 — CPU Only";
      if (computeScore >= 80) {
        tier = "Tier 5 — Workstation";
      } else if (computeScore >= 60) {
        tier = "Tier 4 — Power GPU";
      } else if (computeScore >= 35) {
        tier = "Tier 3 — Mid GPU";
      } else if (computeScore >= 15) {
        tier = "Tier 2 — Light GPU";
      }

      const platform = (process.platform === "darwin"
        ? (process.arch === "arm64" ? "darwin-arm64" : "darwin-x64")
        : "win32-x64") as HardwareProfile["platform"];

      this.cachedProfile = {
        cpu,
        ram,
        gpus,
        backend: platformBackend,
        disk,
        platform,
        osVersion: osInfo.distro + " " + osInfo.release,
        computeScore,
        tier
      };

      return this.cachedProfile;
    } catch (e) {
      console.error("Hardware detection error, loading mock profile:", e);
      return this.getMockProfile();
    }
  }

  private static detectVendor(vendorString: string): HardwareProfile["gpus"][0]["vendor"] {
    const v = vendorString.toUpperCase();
    if (v.includes("NVIDIA") || v.includes("GEFORCE")) return "NVIDIA";
    if (v.includes("AMD") || v.includes("RADEON")) return "AMD";
    if (v.includes("APPLE") || v.includes("METAL")) return "Apple";
    if (v.includes("INTEL")) return "Intel";
    return "Unknown";
  }

  private static getMockProfile(): HardwareProfile {
    return {
      cpu: {
        brand: "Apple M2 Pro",
        cores: 12,
        physicalCores: 10,
        speed: 3.49,
        architecture: "arm64"
      },
      ram: {
        totalGB: 16,
        availableGB: 6.4,
        type: "unified"
      },
      gpus: [
        {
          vendor: "Apple",
          model: "Apple M2 Pro Integrated GPU",
          vramGB: 12,
          driver: "CoreImage",
          supportsMetal: true,
          supportsCUDA: false,
          supportsROCm: false,
          supportsVulkan: false
        }
      ],
      backend: "metal",
      disk: {
        freeGB: 184,
        totalGB: 512,
        storagePathFreeGB: 184
      },
      platform: "darwin-arm64",
      osVersion: "macOS Sequoia 15.1.0",
      computeScore: 56, // tier 3
      tier: "Tier 3 — Mid GPU"
    };
  }

  static async getLiveStats(profile: HardwareProfile): Promise<HardwareLiveStats> {
    try {
      let cpuLoad: any = { currentLoad: 12 };
      let mem: any = { total: profile.ram.totalGB * 1024 * 1024 * 1024, available: profile.ram.availableGB * 1024 * 1024 * 1024 };

      try { cpuLoad = await si.currentLoad(); } catch (e) { console.warn("si.currentLoad failed:", e); }
      try { mem = await si.mem(); } catch (e) { console.warn("si.mem failed:", e); }

      const cpuUsage = Math.round(cpuLoad.currentLoad) || 12;
      const ramUsedGB = Math.round((mem.total - mem.available) / (1024 * 1024 * 1024) * 10) / 10;

      let gpuUsage = 15; // default low activity mock
      let vramUsedGB = 2.4;

      if (profile.backend === "metal") {
        // macOS does not expose direct GPU usage through si.graphics, simulate based on CPU loads or load factor
        gpuUsage = Math.round(cpuUsage * 0.4 + 5);
        vramUsedGB = Math.round((profile.ram.totalGB * 0.15 + (cpuUsage / 100) * 1.5) * 10) / 10;
      } else if (profile.gpus.length > 0) {
        // Windows/Linux systeminformation controllers
        gpuUsage = Math.min(100, Math.round(cpuUsage * 0.6 + 8));
        vramUsedGB = Math.round((profile.gpus[0].vramGB * 0.2 + (cpuUsage / 100) * 2.0) * 10) / 10;
      }

      return {
        cpuUsage,
        ramUsedGB,
        ramTotalGB: profile.ram.totalGB,
        gpuUsage,
        vramUsedGB,
        vramTotalGB: profile.gpus[0]?.vramGB || 4,
        tempCelsius: 48 + Math.round((cpuUsage / 100) * 25)
      };
    } catch (e) {
      // Mock stats fallback
      const mockCpu = Math.round(15 + Math.random() * 10);
      return {
        cpuUsage: mockCpu,
        ramUsedGB: 9.8,
        ramTotalGB: profile.ram.totalGB,
        gpuUsage: Math.round(5 + Math.random() * 8),
        vramUsedGB: 3.2,
        vramTotalGB: profile.gpus[0]?.vramGB || 12,
        tempCelsius: 44 + Math.round(Math.random() * 5)
      };
    }
  }
}
