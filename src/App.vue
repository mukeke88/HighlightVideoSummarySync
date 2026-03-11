<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

const sections = [
  {
    id: "sec-1",
    title: "背景与核心概念",
    time: "00:00 - 00:31",
    start: 0,
    end: 31,
    items: [
      "Open Cloud 的定位与市场热度：个人级超级 AI 助手，苹果设备部署引发抢购。",
      "核心能力：自主执行、跨平台交互、深度集成本地与网络能力。",
      "技术本质：组件基于 Linux；Windows 原生兼容性差。",
      "关键结论：官方推荐且更稳定的部署方式是 WSL。",
    ],
  },
  {
    id: "sec-2",
    title: "安装前准备与环境配置",
    time: "00:31 - 01:04",
    start: 31,
    end: 64,
    items: [
      "硬件与系统要求：推荐 Windows 11；Win10 需 ≥ 2004；普通办公机即可。",
      "风险提示：工具具完全文件系统权限，误操作可能导致数据损失。",
      "安装方式对比：原生安装受限制且痛苦；WSL 安装生态完整、维护方便。",
      "最终建议：优先采用 WSL，规避原生安装坑点。",
    ],
  },
  {
    id: "sec-3",
    title: "网络环境准备",
    time: "02:08 - 02:52",
    start: 128,
    end: 172,
    items: [
      "需要稳定访问境外服务（Google API、OpenAI 等）。",
      "虚拟机部署建议使用主机代理的局域网共享。",
      "在虚拟机内配置系统级代理（http_proxy / https_proxy）。",
    ],
  },
  {
    id: "sec-4",
    title: "部署流程详解",
    time: "02:55 - 09:47",
    start: 175,
    end: 587,
    items: [
      "安装 WSL 并配置 Ubuntu：wsl --install，重启后安装发行版。",
      "一键安装 Open Cloud：curl 脚本自动装依赖与主程序。",
      "初始设置：最小化配置，先跑通流程再完善。",
      "启动可视化控制台：优先选择网页界面，确认绿色运行状态。",
    ],
  },
  {
    id: "sec-5",
    title: "核心配置：接入大模型",
    time: "07:04 - 09:45",
    start: 424,
    end: 585,
    items: [
      "推荐 Google Antigravity 授权：免费、模型丰富、额度充足。",
      "授权流程：生成链接 → 浏览器登录 → 回填回调链接。",
      "设置默认模型并验证配置：opencloud config models。",
    ],
  },
  {
    id: "sec-6",
    title: "连接外部通信渠道",
    time: "09:49 - 11:04",
    start: 589,
    end: 664,
    items: [
      "创建 Telegram 机器人并获取 Token。",
      "opencloud config channels 绑定并完成配对。",
      "效果：手机可远程操控 AI。",
    ],
  },
  {
    id: "sec-7",
    title: "功能测试与能力验证",
    time: "11:08 - 12:27",
    start: 668,
    end: 747,
    items: [
      "测试联网能力与网页读取能力。",
      "推特内容访问失败：需要登录或 Cookie。",
      "YouTube 提取：自动装插件、绕过检测，最终成功。",
      "观察结论：具备自主思考、问题拆解与替代路径能力。",
    ],
  },
  {
    id: "sec-8",
    title: "总结与展望",
    time: "12:30 - 12:48",
    start: 750,
    end: 768,
    items: [
      "总结：WSL 部署成功率高、核心优势明显、风险可控。",
      "后续建议：多账号轮换、自定义技能、接入第三方 API。",
      "最终评价：Windows 上也能获得媲美 macOS 的 AI 助手体验。",
    ],
  },
];

const state = reactive({
  status: "idle",
  elapsed: 0,
  countdown: 0,
  delaySeconds: 2,
  jumpTo: "",
});

let timerId = null;
let startEpoch = 0;

const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const activeSection = computed(() => {
  const current = sections.find(
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
});

onBeforeUnmount(() => {
  stopTimer();
});
</script>

<template>
  <div class="app">
    <section class="hero">
      <h1>Video Summary Highlighter</h1>
      <p>
        点击开始后，页面会按照时间自动高亮对应章节。你可以设置起跑延迟，让你有时间点击视频播放。
      </p>
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
        <span v-if="state.status === 'countdown'" class="countdown">
          倒计时 {{ state.countdown.toFixed(1) }}s
        </span>
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
