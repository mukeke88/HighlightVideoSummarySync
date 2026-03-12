<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

const SAMPLE_MARKDOWN = `# 背景与核心概念（00:00 - 00:31）
- Open Cloud 的定位与市场热度：个人级超级 AI 助手
- 核心能力：自主执行、跨平台交互、深度集成本地与网络能力

## 安装前准备与环境配置 00:31-01:04
- 推荐 Windows 11
- 具完全文件系统权限，需谨慎

## 网络环境准备 [02:08 - 02:52]
- 需要稳定访问境外服务
- 虚拟机内配置系统代理

## 部署流程详解（02:55 - 09:47）
- 安装 WSL 并配置 Ubuntu
- 一键安装并完成初始设置`;

const initialSections = [
  {
    id: "sec-1",
    title: "背景与核心概念",
    time: "00:00 - 00:31",
    start: 0,
    end: 31,
    items: ["请在上方输入框粘贴你的视频总结 Markdown。"],
  },
];

const state = reactive({
  status: "idle",
  elapsed: 0,
  countdown: 0,
  delaySeconds: 2,
  jumpTo: "",
  parseMessage: "",
  parseError: "",
});

const markdownInput = ref(SAMPLE_MARKDOWN);
const sections = ref(initialSections);

let timerId = null;
let startEpoch = 0;

const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const toSeconds = (raw) => {
  if (!raw) return null;
  const parts = String(raw).trim().split(":").map(Number);
  if (parts.some((x) => Number.isNaN(x))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
};

const formatRange = (start, end) => `${formatClock(start)} - ${formatClock(end)}`;

const parseTimeRange = (line) => {
  if (!line) return null;
  const compactLine = line.replace(/\s+/g, " ");
  const timeToken = "(\\d{1,2}:\\d{2}(?::\\d{2})?)";
  const rangeRegex = new RegExp(`${timeToken}\\s*(?:~|\\-|–|—|至|to)\\s*${timeToken}`, "i");
  const match = compactLine.match(rangeRegex);
  if (!match) return null;
  const start = toSeconds(match[1]);
  const end = toSeconds(match[2]);
  if (start == null || end == null) return null;
  if (end <= start) return null;
  return { start, end, raw: `${match[1]} - ${match[2]}` };
};

const cleanTitle = (text) => {
  return text
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.)、]\s*/, "")
    .replace(/[（(\[]?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:~|\-|–|—|至|to)\s*\d{1,2}:\d{2}(?::\d{2})?\s*[)）\]]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const isHeading = (line) =>
  /^#{1,6}\s+/.test(line) || /^\d+[.)、]\s+/.test(line) || /^\d+(?:\.\d+)+\s+/.test(line);

const isBullet = (line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);

const looksLikeSectionTitle = (line) => {
  if (!line) return false;
  if (isBullet(line)) return false;
  const text = cleanTitle(line);
  if (!text) return false;
  return text.length <= 120;
};

const finalizeSections = (rawSections) => {
  if (!rawSections.length) return [];

  const sorted = rawSections
    .filter((x) => typeof x.start === "number")
    .sort((a, b) => a.start - b.start)
    .map((section, idx, arr) => {
      let end = section.end;
      if (typeof end !== "number") {
        const next = arr[idx + 1];
        end = next ? Math.max(section.start + 1, next.start) : section.start + 60;
      }
      if (end <= section.start) {
        end = section.start + 1;
      }
      return {
        id: `sec-${idx + 1}`,
        title: section.title || `Section ${idx + 1}`,
        time: formatRange(section.start, end),
        start: section.start,
        end,
        items: section.items.length ? section.items : ["(无要点)"]
      };
    });

  if (sorted.length) return sorted;

  const fallback = rawSections.map((section, idx) => {
    const start = idx * 60;
    const end = start + 60;
    return {
      id: `sec-${idx + 1}`,
      title: section.title || `Section ${idx + 1}`,
      time: formatRange(start, end),
      start,
      end,
      items: section.items.length ? section.items : ["(无要点)"],
    };
  });

  return fallback;
};

const parseMarkdownSummary = (markdown) => {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const rawSections = [];
  let current = null;

  const openSection = (seedLine) => {
    if (current) rawSections.push(current);
    const seed = seedLine || "";
    const range = parseTimeRange(seed);
    current = {
      title: cleanTitle(seed) || "",
      start: range?.start,
      end: range?.end,
      items: [],
    };
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isHeading(line)) {
      openSection(line);
      continue;
    }

    const lineRange = parseTimeRange(line);
    if (lineRange && looksLikeSectionTitle(line)) {
      openSection(line);
      current.start = lineRange.start;
      current.end = lineRange.end;
      if (!current.title) current.title = `Section ${rawSections.length + 1}`;
      continue;
    }

    if (!current) {
      openSection(`Section ${rawSections.length + 1}`);
    }

    if (isBullet(line)) {
      const point = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
      if (point) current.items.push(point);
    } else {
      current.items.push(line);
    }
  }

  if (current) rawSections.push(current);

  return finalizeSections(rawSections);
};

const applyMarkdown = () => {
  const parsed = parseMarkdownSummary(markdownInput.value);
  if (!parsed.length) {
    state.parseError = "未解析到有效段落，请检查 Markdown 内容。";
    state.parseMessage = "";
    return;
  }

  sections.value = parsed;
  state.parseError = "";
  state.parseMessage = `已解析 ${parsed.length} 个章节。`;
  reset();
};

const activeSection = computed(() => {
  const current = sections.value.find(
    (section) => state.elapsed >= section.start && state.elapsed < section.end
  );
  return current ?? null;
});

const statusLabel = computed(() => {
  if (state.status === "countdown") {
    return `准备开始，倒计时 ${state.countdown.toFixed(1)}s`;
  }
  if (state.status === "running") {
    return "运行中";
  }
  if (state.status === "paused") {
    return "已暂停";
  }
  return "未开始";
});

const sectionRefs = new Map();
const setSectionRef = (id, el) => {
  if (el) {
    sectionRefs.set(id, el);
  }
};

const stopTimer = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const tick = () => {
  const now = performance.now();
  state.elapsed = (now - startEpoch) / 1000;
};

const startRunning = () => {
  state.status = "running";
  startEpoch = performance.now() - state.elapsed * 1000;
  stopTimer();
  timerId = setInterval(tick, 100);
};

const startWithDelay = () => {
  if (state.status === "running") return;
  const delay = Math.max(0, Number(state.delaySeconds) || 0);
  state.countdown = delay;
  if (delay === 0) {
    startRunning();
    return;
  }
  state.status = "countdown";
  stopTimer();
  const startedAt = performance.now();
  timerId = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const remaining = Math.max(0, delay - elapsed);
    state.countdown = remaining;
    if (remaining <= 0.02) {
      startRunning();
    }
  }, 50);
};

const pause = () => {
  if (state.status !== "running") return;
  state.status = "paused";
  stopTimer();
};

const reset = () => {
  state.status = "idle";
  state.elapsed = 0;
  state.countdown = 0;
  stopTimer();
};

const jump = () => {
  const value = Number(state.jumpTo);
  if (Number.isNaN(value)) return;
  state.elapsed = Math.max(0, value);
  if (state.status === "running") {
    startEpoch = performance.now() - state.elapsed * 1000;
  }
};

watch(
  () => activeSection.value?.id,
  async (id) => {
    if (!id) return;
    await nextTick();
    const el = sectionRefs.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
);

onMounted(() => {
  state.jumpTo = "0";
  applyMarkdown();
});

onBeforeUnmount(() => {
  stopTimer();
});
</script>

<template>
  <div class="app">
    <section class="hero">
      <h1>Video Summary Highlighter</h1>
      <p>在下方粘贴 Markdown 视频总结并点击“解析总结”，程序会自动适配常见格式并按时间高亮章节。</p>

      <div class="summary-input">
        <label for="summary">粘贴视频总结（Markdown）</label>
        <textarea
          id="summary"
          v-model="markdownInput"
          placeholder="在这里粘贴你的 md 总结..."
          spellcheck="false"
        />
        <div class="summary-actions">
          <button class="secondary" @click="applyMarkdown">解析总结</button>
          <span class="ok" v-if="state.parseMessage">{{ state.parseMessage }}</span>
          <span class="error" v-if="state.parseError">{{ state.parseError }}</span>
        </div>
      </div>

      <div class="controls">
        <div class="control-group">
          <label>当前时间（秒）</label>
          <strong>{{ formatClock(state.elapsed) }} ({{ state.elapsed.toFixed(1) }}s)</strong>
        </div>
        <div class="control-group">
          <label>起跑延迟（秒）</label>
          <input v-model="state.delaySeconds" type="number" min="0" step="0.5" />
        </div>
        <div class="control-group">
          <label>跳转到时间（秒）</label>
          <div class="buttons">
            <input v-model="state.jumpTo" type="number" min="0" step="1" />
            <button class="ghost" @click="jump">跳转</button>
          </div>
        </div>
        <div class="control-group">
          <label>控制</label>
          <div class="buttons">
            <button @click="startWithDelay" :disabled="state.status === 'running'">开始</button>
            <button class="secondary" @click="pause" :disabled="state.status !== 'running'">
              暂停
            </button>
            <button class="ghost" @click="reset">重置</button>
          </div>
        </div>
      </div>
      <div class="status">
        <span>状态：</span>
        <strong>{{ statusLabel }}</strong>
        <span v-if="state.status === 'countdown'" class="countdown"> 倒计时 {{ state.countdown.toFixed(1) }}s </span>
        <span>当前段落：</span>
        <strong>{{ activeSection?.title ?? "暂无" }}</strong>
      </div>
    </section>

    <section class="timeline">
      <article
        v-for="section in sections"
        :key="section.id"
        class="section"
        :class="{ active: activeSection?.id === section.id }"
        :ref="(el) => setSectionRef(section.id, el)"
      >
        <h3>
          {{ section.title }}
          <span>{{ section.time }}</span>
        </h3>
        <ul>
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>
  </div>
</template>
