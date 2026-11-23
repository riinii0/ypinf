import { Source } from "@prisma/client";
import { LocalWelfareSource } from "./localWelfare";
import { MockPolicySource } from "./mock";
import type { PolicySource } from "./types";
import { YouthCenterSource } from "./youthcenter";

export type DataSourceMode = "mock" | "live";

export function getDataSourceMode(): DataSourceMode {
  return process.env.DATA_SOURCE_MODE === "live" ? "live" : "mock";
}

export function getPolicySources(): PolicySource[] {
  const mode = getDataSourceMode();

  if (mode === "mock") {
    return [
      new MockPolicySource(Source.YOUTHCENTER, "youthcenter.json"),
      new MockPolicySource(Source.LOCAL_WELFARE, "localWelfare.json"),
    ];
  }

  return [new YouthCenterSource(), new LocalWelfareSource()];
}
