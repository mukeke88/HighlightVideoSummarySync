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
    items: [{ type: "text", text: "请在上方输入框粘贴你的视频总结 Markdown。", indent: 0 }],
  },
];

const state = reactive({
  status: "idle",
  elapsed: 0,
  countdown: 0,
  delaySeconds: 2,
  jumpTo: "",
  monitorHotkey: false,
  hotkeyMode: "page",
  parseMessage: "",
  parseError: "",
  contentFontScale: 1,
});

const markdownInput = ref(SAMPLE_MARKDOWN);
const sections = ref(initialSections);

let timerId = null;
let startEpoch = 0;
let disposeNativeHotkeyListener = null;

const hasNativeHotkeyBridge = () =>
  typeof window !== "undefined" &&
  typeof window.hotkeyBridge?.setMonitoring === "function" &&
  typeof window.hotkeyBridge?.onHotkeyK === "function" &&
  typeof window.hotkeyBridge?.getMode === "function";

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
    .replace(/[（(\[]?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:~|\-|–|—|至|to)\s*\d{1,2}:\d{2}(?::\d{2})?\s*[)）\]]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const isHeading = (line) => /^#{1,6}\s+/.test(line);

const isBullet = (line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
const isDivider = (line) => /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);

const looksLikeSectionTitle = (line) => {
  if (!line) return false;
  if (isBullet(line)) return false;
  const text = cleanTitle(line);
  if (!text) return false;
  return text.length <= 120;
};

const finalizeSections = (rawSections) => {
  if (!rawSections.length) return [];

  let cursor = 0;

  return rawSections.map((section, idx, arr) => {
    const hasStart = typeof section.start === "number" && section.start >= 0;
    const hasEnd = typeof section.end === "number";
    const start = hasStart ? Math.max(0, section.start) : cursor;

    let end = hasEnd ? section.end : null;
    if (typeof end !== "number" || end <= start) {
      let nextStart = null;
      for (let i = idx + 1; i < arr.length; i += 1) {
        const candidate = arr[i]?.start;
        if (typeof candidate === "number" && candidate > start) {
          nextStart = candidate;
          break;
        }
      }
      end = typeof nextStart === "number" ? nextStart : start + 60;
    }
    if (end <= start) end = start + 1;
    cursor = end;

    return {
      id: `sec-${idx + 1}`,
      title: section.title || `Section ${idx + 1}`,
      time: formatRange(start, end),
      start,
      end,
      items: section.items.length
        ? section.items
        : [{ type: "text", text: "(无要点)", indent: 0 }],
    };
  });
};

const parseMarkdownSummary = (markdown) => {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const hasTimedCues = lines.some((raw) => parseTimeRange(String(raw).trim()));
  const rawSections = [];
  let current = null;
  const toIndent = (raw) => {
    const prefix = String(raw || "").match(/^\s*/)?.[0] ?? "";
    return Math.min(4, Math.floor(prefix.replace(/\t/g, "  ").length / 2));
  };
  const pushItem = (section, type, text, indent = 0) => {
    const value = String(text || "").trim();
    if (!value) return;
    section.items.push({ type, text: value, indent });
  };

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
    if (isDivider(line)) continue;

    if (isHeading(line)) {
      const headingRange = parseTimeRange(line);
      if (headingRange) {
        openSection(line);
        current.start = headingRange.start;
        current.end = headingRange.end;
        if (!current.title) current.title = `Section ${rawSections.length + 1}`;
        continue;
      }

      if (!current) {
        if (hasTimedCues) continue;
        openSection(line);
      } else {
        const headingText = cleanTitle(line);
        pushItem(current, "heading", headingText, 0);
      }
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
      if (hasTimedCues) continue;
      openSection(`Section ${rawSections.length + 1}`);
    }

    if (isBullet(line)) {
      const point = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
      pushItem(current, "bullet", point, toIndent(lines[i]));
    } else {
      const kind = /[:：]$/.test(line) ? "label" : "text";
      pushItem(current, kind, line, toIndent(lines[i]));
    }
  }

  if (current) rawSections.push(current);

  return finalizeSections(rawSections);
};

const escapeHtml = (input) =>
  String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderInlineMarkdown = (text) => {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^\*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  return html;
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

const hotkeyModeLabel = computed(() => {
  if (!hasNativeHotkeyBridge()) return "Page";
  if (state.hotkeyMode === "hook") return "Hook";
  return "Shortcut";
});

const contentFontScaleLabel = computed(() => `${Math.round(state.contentFontScale * 100)}%`);

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
  if (!state.monitorHotkey) {
    toggleMonitorHotkey();
  }
  state.delaySeconds = 0;
  const delay = 0;
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
  if (hasNativeHotkeyBridge() && state.monitorHotkey) {
    window.hotkeyBridge.setMonitoring(false).catch(() => {});
  }
  state.status = "idle";
  state.elapsed = 0;
  state.countdown = 0;
  state.delaySeconds = 2;
  state.monitorHotkey = false;
  stopTimer();
};

const jump = () => {
  const raw = String(state.jumpTo ?? "").trim();
  if (!raw) return;
  const value = raw.includes(":") ? toSeconds(raw) : Number(raw);
  if (value == null || Number.isNaN(value)) return;
  state.elapsed = Math.max(0, value);
  if (state.status === "running") {
    startEpoch = performance.now() - state.elapsed * 1000;
  }
};

const toggleMonitorHotkey = () => {
  const next = !state.monitorHotkey;
  if (!hasNativeHotkeyBridge()) {
    state.monitorHotkey = next;
    return;
  }
  window.hotkeyBridge
    .setMonitoring(next)
    .then((result) => {
      state.monitorHotkey = Boolean(result?.enabled);
      state.hotkeyMode = String(result?.mode || state.hotkeyMode);
    })
    .catch(() => {
      state.monitorHotkey = false;
    });
};

const toggleTimerByHotkey = () => {
  if (state.status === "running") {
    pause();
    return true;
  }
  if (state.status === "paused") {
    startRunning();
    return true;
  }
  return false;
};

const onGlobalKeydown = (event) => {
  if (hasNativeHotkeyBridge()) return;
  if (!state.monitorHotkey) return;
  if (event.repeat) return;
  const key = String(event.key).toLowerCase();
  if (key !== "k" && key !== " " && key !== "spacebar") return;
  if (toggleTimerByHotkey()) {
    event.preventDefault();
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const onCtrlWheel = (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const delta = event.deltaY < 0 ? 0.05 : -0.05;
  state.contentFontScale = clamp(
    Number((state.contentFontScale + delta).toFixed(2)),
    0.7,
    2
  );
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
  state.jumpTo = "00:00";
  const savedScale = Number(localStorage.getItem("content-font-scale"));
  if (!Number.isNaN(savedScale)) {
    state.contentFontScale = clamp(savedScale, 0.7, 2);
  }
  applyMarkdown();
  window.addEventListener("keydown", onGlobalKeydown, true);
  window.addEventListener("wheel", onCtrlWheel, { passive: false });
  if (hasNativeHotkeyBridge()) {
    window.hotkeyBridge
      .getMode()
      .then((result) => {
        state.hotkeyMode = String(result?.mode || state.hotkeyMode);
      })
      .catch(() => {});
    disposeNativeHotkeyListener = window.hotkeyBridge.onHotkeyK(() => {
      if (!state.monitorHotkey) return;
      toggleTimerByHotkey();
    });
  }
});

onBeforeUnmount(() => {
  stopTimer();
  window.removeEventListener("keydown", onGlobalKeydown, true);
  window.removeEventListener("wheel", onCtrlWheel);
  if (disposeNativeHotkeyListener) {
    disposeNativeHotkeyListener();
    disposeNativeHotkeyListener = null;
  }
  if (hasNativeHotkeyBridge() && state.monitorHotkey) {
    window.hotkeyBridge.setMonitoring(false);
  }
});

watch(
  () => state.contentFontScale,
  (value) => {
    localStorage.setItem("content-font-scale", String(value));
  }
);
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

    </section>

    <aside class="control-dock">
      <div class="dock-meta-inline">
        <span><b>T</b> {{ formatClock(state.elapsed) }}</span>
        <span><b>S</b> {{ statusLabel }}</span>
        <span><b>K</b> {{ hotkeyModeLabel }}</span>
        <span><b>F</b> {{ contentFontScaleLabel }}</span>
        <span v-if="state.status === 'countdown'"><b>CD</b> {{ state.countdown.toFixed(1) }}s</span>
      </div>
      <div class="dock-section-inline">
        <b>Now:</b> <span>{{ activeSection?.title ?? "暂无" }}</span>
      </div>
      <div class="dock-row">
        <label>D</label>
        <input v-model="state.delaySeconds" type="number" min="0" step="0.5" />
        <label>J</label>
        <input v-model="state.jumpTo" type="text" placeholder="mm:ss" />
        <button class="ghost" @click="jump">Go</button>
      </div>
      <div class="dock-buttons">
        <button @click="startWithDelay" :disabled="state.status === 'running'">开始</button>
        <button class="secondary" @click="pause" :disabled="state.status !== 'running'">暂停</button>
        <button
          class="secondary"
          @click="toggleMonitorHotkey"
          :aria-pressed="state.monitorHotkey ? 'true' : 'false'"
        >
          {{ state.monitorHotkey ? "停止监听全局 K/Space" : "监听全局 K/Space" }}
        </button>
        <button class="ghost" @click="reset">重置</button>
      </div>
    </aside>

    <section class="timeline" :style="{ '--content-font-scale': state.contentFontScale }">
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
        <div class="section-items">
          <div
            v-for="(item, idx) in section.items"
            :key="`${section.id}-${idx}`"
            class="section-item"
            :class="[`type-${item.type}`, `indent-${item.indent}`]"
          >
            <span v-if="item.type === 'bullet'" class="bullet-marker">•</span>
            <span class="item-text" v-html="renderInlineMarkdown(item.text)"></span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
