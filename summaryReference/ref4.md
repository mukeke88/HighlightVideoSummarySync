# Tutorial: Building a 3-Level LinkedIn Automation System with Claude Skills 2.0

This guide outlines how to leverage the advanced capabilities of **Claude Skills 2.0** to build an automated, high-performance content engine for LinkedIn. Unlike basic chatbots, this system uses hierarchical skills to handle brand voice, trending topic research, and automated publishing.

---

## 1. Introduction and Action Plan (00:00:00 - 00:01:25)

Claude Skills 2.0 allows users to stack individual automated capabilities ("skills") to create complex workflows. This tutorial builds a three-level system:
*   **Level 1:** Content creation using a specific brand voice and high-performing reference templates.
*   **Level 2:** Real-time trend analysis by scraping Reddit.
*   **Level 3:** Full automation via direct publishing and scheduling to LinkedIn.

### Technical Environment
The workflow is demonstrated using **Claude Code** (a command-line interface tool) within **Anti-gravity**, a cloud-based IDE (Integrated Development Environment). Using an IDE allows you to manage files and system instructions visually while interacting with the AI.

---

## 2. Level 1: Establishing the Knowledge Base (00:01:25 - 00:04:15)

The foundation of the system relies on providing Claude with a context layer consisting of your personal style and proven success patterns.

### Step 1: Tone of Voice Guidelines
*   **Mechanism:** Extract your brand voice from past conversations, blogs, or transcripts.
*   **Action:** Generate a Markdown file (`tone_of_voice.md`) that summarizes your writing style, keeping it under 1,500 words for efficiency.

### Step 2: Viral Reference Vault
*   **Mechanism:** Feed the system examples of "viral" posts to provide structural templates.
*   **Action:** Save high-performing LinkedIn posts as individual Markdown files in a dedicated folder. These serve as a "Knowledge Base" for formatting, hook styles, and Call-to-Action (CTA) structures.

---

## 3. Developing and Testing the Level 1 Skill (00:04:15 - 00:09:00)

Using the **Skill Creator**, you can transform raw instructions into a repeatable command.

### Workflow: The Skill Creator
1.  **Input:** Instruct Claude to create a skill that combines a specific topic, your tone of voice guidelines, and the reference post formats.
2.  **Design Rationale (The 2.0 Advantage):** Claude Skills 2.0 features a self-correction mechanism. It spawns multiple agents to test the skill against itself before finalizing.
3.  **Verification:** The system can generate an internal HTML report comparing "With Skill" vs. "Without Skill" performance (e.g., checking for the presence of hooks, numbers, and specific formatting like arrow lists).

### Technical Concept: Lead Magnets
The system is specifically tuned to create "lead magnet" style posts—content designed to offer a resource (like a guide or prompt list) in exchange for engagement (comments), which drives LinkedIn's algorithm.

---

## 4. Level 2: Data-Driven Topic Discovery (00:09:00 - 00:13:06)

Level 2 moves beyond manual topic selection by tapping into the "collective consciousness" of the internet via Reddit.

### Mechanism: JSON API Scraping
*   **Concept:** Reddit subreddits provide a public JSON API (e.g., `reddit.com/r/entrepreneur/.json`) that Claude can parse natively.
*   **Workflow:**
    *   **The Scraper:** The skill is updated to hit specific subreddits (r/entrepreneur, r/SaaS, etc.).
    *   **Filtering:** It filters for trending posts based on engagement metrics.
    *   **Single Source of Truth:** A reference file containing a list of target subreddits allows the system to pull data across multiple communities simultaneously.

---

## 5. Level 3: Full Automation and Publishing (00:13:06 - 00:15:58)

The final level integrates the content engine with external social media APIs to eliminate manual posting.

### Workflow: MCP and Blotato Integration
*   **Technical Concept: MCP (Model Context Protocol):** A standard that allows AI models like Claude to securely connect to external tools and data sources.
*   **Tooling:** Use a third-party service like **Blotato** which offers an MCP server for social media distribution.
*   **Mechanism:**
    1.  **Phase 1 (Discover):** Run the Reddit scraper for fresh topics.
    2.  **Phase 2 (Write):** Generate the post using the Level 1 tone/format rules.
    3.  **Phase 3 (Publish/Schedule):** Use the MCP connection to send the post directly to LinkedIn or schedule it for a future date.

---

## 6. Summary and Conclusions (00:15:58 - 00:16:24)

By moving through these three levels, the user shifts from "chatting with an AI" to "operating a system."

*   **Reliability:** The self-testing nature of Skills 2.0 ensures that the formatting (crucial for "above the fold" visibility on LinkedIn) remains consistent.
*   **Scalability:** The system allows for a month's worth of content to be researched, written, and scheduled in a single 20-minute session.
*   **Neutral Tone:** The final output is high-impact, results-driven content that mirrors the user's authentic brand voice while utilizing data-backed trending topics.