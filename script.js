        let fileIndex = null,
            currentPath = [],
            currentView = "tree",
            searchQuery = "",
            intersectionObserver = null,
            expandedFolders = new Set([""]),
            currentPlaylist = [],
            currentPlaylistIndex = 0,
            isShuffle = false,
            shuffleBag = [],
            shuffleHistory = [],
            currentFilePath = "",
            currentFileName = "",
            isPlaylistFile = !1,
            currentFontSize = 16,
            themeHue = null,
            currentHls = null,
            streamTimeout = null,
            allFiles = [],
            sortBy = "name-asc",
            searchResultLimit = 100,
            lastFocusedElement = null,
            fetchCache = new Map(),
            currentVolume = 0.5, // Default volume set to 50%
            audioCtx = null,
            normalizedElements = new WeakSet(),
            compressor = null,
            useNativePlayer = false;
        // How long to wait for a track to start loading before we assume it's
        // dead/unreachable and skip to the next one. Raise this if you're on a
        // slow connection and tracks are getting skipped before they finish buffering.
        const STREAM_TIMEOUT_MS = 15000;

        const icons = {
            folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
            image: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
            video: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
            audio: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>`,
            code: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`,
            document: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
            text: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
            data: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`,
            archive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>`,
            font: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.93 13.5h4.14L12 7.98zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/></svg>`,
            markup: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`,
            style: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 5.95c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.6zm-9.2 3.8L7.87 7.79l7.35-3.04h.01l4.95 11.95-7.35 3.05z"/></svg>`,
            playlist: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>`,
            playCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
            pauseCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
            prevCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`,
            nextCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
            shuffleCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`,
            volDownCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>`,
            volUpCtl: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
            other: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>`,
            chevron: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
            info: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
        };
        function loadSettings() {
            const e = localStorage.getItem("theme");
            e && e !== "auto"
                ? document.documentElement.setAttribute("data-theme", e)
                : document.documentElement.removeAttribute("data-theme");
            const t = localStorage.getItem("fontSize");
            t &&
                ((currentFontSize = parseInt(t)),
                document.documentElement.style.setProperty("--font-size-base", currentFontSize + "px")),
                updateThemeButtons(),
                updateFontSizeLabel();
            const v = localStorage.getItem("viewMode");
            if (v === "grid" || v === "list" || v === "tree") {
                currentView = v;
                document.querySelectorAll(".view-btn").forEach((btn) => {
                    btn.classList.toggle("active", btn.dataset.view === v);
                });
                document.getElementById("treePanel").classList.toggle("visible", v === "tree");
            }
            const so = localStorage.getItem("sortBy");
            if (so) sortBy = so;
            const sortSel = document.getElementById("sortSelect");
            if (sortSel) sortSel.value = sortBy;
            useNativePlayer = localStorage.getItem("useNativePlayer") === "1";
            const nativeToggle = document.getElementById("nativePlayerToggle");
            if (nativeToggle) nativeToggle.checked = useNativePlayer;
            document.body.classList.toggle("native-player-mode", useNativePlayer);
            const flatOn = localStorage.getItem("flatDesign") === "1";
            const flatToggle = document.getElementById("flatDesignToggle");
            if (flatToggle) flatToggle.checked = flatOn;
            document.documentElement.classList.toggle("flat", flatOn);
            initThemeColor();
        }
        function setFlatDesign(on) {
            document.documentElement.classList.toggle("flat", on);
            localStorage.setItem("flatDesign", on ? "1" : "0");
        }
        function saveTheme(e) {
            e === "auto"
                ? (localStorage.removeItem("theme"), document.documentElement.removeAttribute("data-theme"))
                : (localStorage.setItem("theme", e), document.documentElement.setAttribute("data-theme", e)),
                updateThemeButtons();
            if (themeHue != null) applyThemeHue(themeHue);
        }
        function setupDropdown(btnId, menuId, dropdownId) {
            const btn = document.getElementById(btnId),
                menu = document.getElementById(menuId);
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".settings-menu.active").forEach((m) => {
                    if (m !== menu) {
                        m.classList.remove("active");
                        const otherBtn = m.previousElementSibling;
                        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                    }
                });
                const isActive = menu.classList.toggle("active");
                btn.setAttribute("aria-expanded", isActive ? "true" : "false");
            });
            document.addEventListener("click", (e) => {
                if (!e.target.closest("#" + dropdownId)) {
                    menu.classList.remove("active");
                    btn.setAttribute("aria-expanded", "false");
                }
            });
        }

        /* ---------------------------------------------------------------
           Base Color engine
           Lets the user pick a new "base driving color" that re-tints every
           theme preset (Light, Dark, Auto, HC Dark, HC Light). Each themed
           variable keeps its own original saturation & lightness so the
           preset's brightness/contrast balance stays exactly as designed —
           only the hue shifts to match whatever color the user picks.
           --------------------------------------------------------------- */
        const THEME_HUE_KEY = "themeHue";
        const THEME_BASE = {
            dark: {
                "--bg-primary": "#0d1117", "--bg-secondary": "#161b22", "--bg-tertiary": "#21262d",
                "--bg-hover": "#30363d", "--border-color": "#30363d", "--text-primary": "#e6edf3",
                "--text-secondary": "#8b949e", "--text-muted": "#6e7681", "--accent": "#58a6ff",
                "--accent-hover": "#79b8ff", "--success": "#3fb950", "--warning": "#d29922", "--danger": "#f85149"
            },
            light: {
                "--bg-primary": "#ffffff", "--bg-secondary": "#f6f8fa", "--bg-tertiary": "#eaeef2",
                "--bg-hover": "#d0d7de", "--border-color": "#d0d7de", "--text-primary": "#1f2328",
                "--text-secondary": "#656d76", "--text-muted": "#8c959f", "--accent": "#0969da",
                "--accent-hover": "#0550ae"
            },
            "hc-dark": {
                "--bg-primary": "#000000", "--bg-secondary": "#000000", "--bg-tertiary": "#000000",
                "--bg-hover": "#262626", "--border-color": "#9370ff", "--text-primary": "#ffffff",
                "--text-secondary": "#ffffff", "--text-muted": "#a3a3a3", "--accent": "#00ffff",
                "--accent-hover": "#33ffff", "--success": "#00ffff", "--warning": "#ff37cb", "--danger": "#ff4444"
            },
            "hc-light": {
                "--bg-primary": "#ffffff", "--bg-secondary": "#ffffff", "--bg-tertiary": "#ffffff",
                "--bg-hover": "#d9d9d9", "--border-color": "#6c8f00", "--text-primary": "#000000",
                "--text-secondary": "#000000", "--text-muted": "#5c5c5c", "--accent": "#ff0000",
                "--accent-hover": "#cc0000", "--success": "#ff0000", "--warning": "#00c834", "--danger": "#00bbbb"
            }
        };
        const THEME_PRESETS = [
            { name: "Blue", hue: 209.2 }, { name: "Indigo", hue: 243 }, { name: "Purple", hue: 262 },
            { name: "Pink", hue: 330 }, { name: "Red", hue: 4 }, { name: "Orange", hue: 28 },
            { name: "Yellow", hue: 48 }, { name: "Green", hue: 142 }, { name: "Teal", hue: 174 },
            { name: "Cyan", hue: 191 }, { name: "Sky", hue: 199 }, { name: "Rose", hue: 350 }
        ];
        function hexToHsl(hex) {
            hex = hex.replace("#", "");
            if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
            const r = parseInt(hex.substr(0, 2), 16) / 255,
                g = parseInt(hex.substr(2, 2), 16) / 255,
                b = parseInt(hex.substr(4, 2), 16) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0;
            const l = (max + min) / 2, d = max - min;
            if (d !== 0) {
                s = d / (1 - Math.abs(2 * l - 1));
                switch (max) {
                    case r: h = 60 * (((g - b) / d) % 6); break;
                    case g: h = 60 * ((b - r) / d + 2); break;
                    case b: h = 60 * ((r - g) / d + 4); break;
                }
            }
            if (h < 0) h += 360;
            return { h, s: s * 100, l: l * 100 };
        }
        function hslToHex(h, s, l) {
            s /= 100; l /= 100;
            const c = (1 - Math.abs(2 * l - 1)) * s,
                x = c * (1 - Math.abs((h / 60) % 2 - 1)),
                m = l - c / 2;
            let r = 0, g = 0, b = 0;
            if (h < 60) { r = c; g = x; b = 0; }
            else if (h < 120) { r = x; g = c; b = 0; }
            else if (h < 180) { r = 0; g = c; b = x; }
            else if (h < 240) { r = 0; g = x; b = c; }
            else if (h < 300) { r = x; g = 0; b = c; }
            else { r = c; g = 0; b = x; }
            const toHex = (v) => {
                const n = Math.max(0, Math.min(255, Math.round((v + m) * 255)));
                return n.toString(16).padStart(2, "0");
            };
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
        function getActivePaletteKey() {
            const attr = document.documentElement.getAttribute("data-theme");
            if (attr === "light" || attr === "hc-dark" || attr === "hc-light") return attr;
            if (attr === "dark") return "dark";
            const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
            return dark ? "dark" : "light";
        }
        function applyThemeHue(hue) {
            const root = document.documentElement.style;
            const base = THEME_BASE[getActivePaletteKey()];
            for (const [varName, baseHex] of Object.entries(base)) {
                const { s, l } = hexToHsl(baseHex);
                root.setProperty(varName, hslToHex(hue, s, l));
            }
            markActiveSwatch(hue);
        }
        function clearThemeHueVars() {
            const root = document.documentElement.style;
            for (const key of ["dark", "light", "hc-dark", "hc-light"]) {
                for (const varName of Object.keys(THEME_BASE[key])) root.removeProperty(varName);
            }
        }
        function setThemeHue(hue) {
            themeHue = hue;
            localStorage.setItem(THEME_HUE_KEY, String(hue));
            applyThemeHue(hue);
        }
        function resetThemeHue() {
            themeHue = null;
            localStorage.removeItem(THEME_HUE_KEY);
            clearThemeHueVars();
            markActiveSwatch(null);
        }
        function markActiveSwatch(hue) {
            const wrap = document.getElementById("themeSwatches");
            if (!wrap) return;
            wrap.querySelectorAll(".theme-swatch").forEach((sw) => {
                const swHue = parseFloat(sw.dataset.hue);
                sw.classList.toggle("active", hue != null && Math.abs(swHue - hue) < 0.5);
            });
        }
        function renderThemeSwatches() {
            const wrap = document.getElementById("themeSwatches");
            if (!wrap) return;
            wrap.innerHTML = THEME_PRESETS.map((p) => {
                const swatchColor = hslToHex(p.hue, 80, 60);
                return `<button type="button" class="theme-swatch" data-hue="${p.hue}" title="${p.name}" style="background:${swatchColor}"></button>`;
            }).join("");
        }
        function wireThemeColorPicker() {
            const input = document.getElementById("themeColorInput"),
                resetBtn = document.getElementById("themeResetBtn"),
                swatches = document.getElementById("themeSwatches");
            if (input) input.addEventListener("input", (e) => setThemeHue(hexToHsl(e.target.value).h));
            if (resetBtn) resetBtn.addEventListener("click", () => resetThemeHue());
            if (swatches) swatches.addEventListener("click", (e) => {
                const sw = e.target.closest(".theme-swatch");
                if (sw) setThemeHue(parseFloat(sw.dataset.hue));
            });
            if (window.matchMedia) {
                window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                    if (themeHue != null) applyThemeHue(themeHue);
                });
            }
        }
        function initThemeColor() {
            renderThemeSwatches();
            const stored = localStorage.getItem(THEME_HUE_KEY);
            if (stored !== null && stored !== "") {
                const hue = parseFloat(stored);
                if (!Number.isNaN(hue)) {
                    themeHue = hue;
                    applyThemeHue(hue);
                    const input = document.getElementById("themeColorInput");
                    if (input) input.value = hslToHex(hue, 100, 60);
                    return;
                }
            }
            markActiveSwatch(null);
        }
        function updateThemeButtons() {
            const e = localStorage.getItem("theme") || "auto";
            document.querySelectorAll(".theme-btn").forEach((t) => {
                t.classList.toggle("active", t.dataset.theme === e);
            });
        }
        function updateFontSizeLabel() {
            document.getElementById("fontSizeLabel").textContent = currentFontSize + "px";
        }
        function changeFontSize(e) {
            (currentFontSize = Math.max(10, Math.min(20, currentFontSize + e))),
                document.documentElement.style.setProperty("--font-size-base", currentFontSize + "px"),
                localStorage.setItem("fontSize", currentFontSize),
                updateFontSizeLabel();
        }
        function isPlaylistExtension(e) {
            const t = e.toLowerCase();
            return t.endsWith(".m3u") || t.endsWith(".m3u8");
        }
        function preprocessFiles(nodes, pathPrefix = "") {
            for (const node of nodes) {
                const currentPathStr = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
                const searchKey = currentPathStr.toLowerCase();
                const navPath = pathPrefix ? [...pathPrefix.split('/'), node.name] : [node.name];

                // Precompute fuzzy-search keys once per file so every keystroke
                // doesn't have to re-derive them:
                //  - normalizedKey: lowercase path with all separators/punctuation
                //    collapsed to single spaces (e.g. "+checked+/c/chillout" -> "checked c chillout")
                //  - compactKey: normalizedKey with the spaces removed, used for
                //    subsequence/fuzzy matching (e.g. "checkedcchillout")
                //  - boundarySet: indices within compactKey where a "word" starts,
                //    used to give bonus weight to matches that land on word starts
                const normalizedKey = searchKey.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
                const words = normalizedKey.length ? normalizedKey.split(" ") : [];
                const boundarySet = new Set();
                let compactKey = "";
                for (const w of words) {
                    boundarySet.add(compactKey.length);
                    compactKey += w;
                }

                allFiles.push({
                    ...node,
                    fullPath: currentPathStr,
                    navPath: navPath,
                    searchKey: searchKey,
                    normalizedKey: normalizedKey,
                    compactKey: compactKey,
                    boundarySet: boundarySet,
                    parentPath: pathPrefix.toLowerCase()
                });
                if (node.type === "directory" && node.children) {
                    preprocessFiles(node.children, currentPathStr);
                }
            }
        }

        // Scores a single fuzzy-subsequence match of `query` against `str`.
        // Returns null if `query`'s characters don't all appear in order within `str`.
        // Rewards consecutive runs of matched characters and matches that land on
        // word boundaries (tracked via `boundarySet`), and gives a small bonus for
        // matching earlier in the string.
        function fuzzySubsequenceScore(query, str, boundarySet) {
            let qi = 0, score = 0, prevIndex = -2, consecutiveRun = 0, firstIndex = -1;
            for (let i = 0; i < str.length && qi < query.length; i++) {
                if (str[i] === query[qi]) {
                    if (firstIndex === -1) firstIndex = i;
                    if (prevIndex === i - 1) {
                        consecutiveRun++;
                        score += 8 + consecutiveRun * 4;
                    } else {
                        consecutiveRun = 0;
                        score += 4;
                    }
                    if (boundarySet && boundarySet.has(i)) score += 10;
                    prevIndex = i;
                    qi++;
                }
            }
            if (qi < query.length) return null;
            score += Math.max(0, 10 - firstIndex * 0.5);
            return score;
        }

        // Scores how well a single file/folder item matches the search query.
        // Returns null when the item doesn't match at all. Matches are grouped
        // into tiers (higher score range = more relevant), so that a precise
        // match (e.g. "check chill") always outranks a loose fuzzy one
        // (e.g. "checkchill"), regardless of which folder either file is in:
        //   Tier 4 (~2000+): the full query, separators and all, is a direct
        //                     substring of the path ("c/chillout")
        //   Tier 3 (~1400-1900): every space/slash-separated token is present
        //                     as its own substring ("check chill", "check/chill")
        //   Tier 2 (~1000-1300): a single-token query matches as a substring
        //                     once punctuation is ignored
        //   Tier 1 (~300-800): fuzzy subsequence match only ("checkchill")
        function scoreSearchItem(query, tokens, compactQuery, item) {
            const rawKey = item.searchKey;
            const normKey = item.normalizedKey;

            const exactIdx = rawKey.indexOf(query);
            if (exactIdx !== -1) {
                return 2200 - exactIdx * 2 - rawKey.length * 0.1;
            }

            if (tokens.length > 1 && tokens.every((tok) => normKey.includes(tok))) {
                let score = 1400;
                let lastIdx = -1;
                let inOrder = true;
                for (const tok of tokens) {
                    const idx = normKey.indexOf(tok);
                    if (idx < lastIdx) inOrder = false;
                    lastIdx = idx;
                    if (idx === 0 || normKey[idx - 1] === " ") score += 25;
                    score += Math.max(0, 10 - idx * 0.05);
                }
                if (inOrder) score += 60;
                score -= normKey.length * 0.05;
                return score;
            }

            if (tokens.length === 1 && normKey.includes(tokens[0])) {
                const idx = normKey.indexOf(tokens[0]);
                let score = 1000;
                if (idx === 0 || normKey[idx - 1] === " ") score += 30;
                score -= idx * 0.1;
                score -= normKey.length * 0.05;
                return score;
            }

            // Cheap length check before the character-by-character scan below:
            // a query longer than the path it's being matched against can never
            // be a subsequence, so skip the scan entirely.
            if (compactQuery.length > 0 && compactQuery.length <= item.compactKey.length) {
                const fuzzy = fuzzySubsequenceScore(compactQuery, item.compactKey, item.boundarySet);
                if (fuzzy !== null) {
                    return 300 + fuzzy - item.compactKey.length * 0.05;
                }
            }

            return null;
        }

        // Runs the fuzzy search across every indexed file/folder and returns
        // results ranked by relevance first, with a bonus applied to items
        // that live in the folder currently being viewed so, among comparably
        // relevant results, local matches surface before matches from other
        // folders.
        function searchFiles(query) {
            const tokens = query.split(/[\s/]+/).filter(Boolean);
            const compactQuery = query.replace(/[^a-z0-9]/g, "");
            const currentFolderKey = currentPath.join("/").toLowerCase();
            const SAME_FOLDER_BONUS = 400;

            const scored = [];
            for (const item of allFiles) {
                const score = scoreSearchItem(query, tokens, compactQuery, item);
                if (score === null) continue;
                const inCurrentFolder = item.parentPath === currentFolderKey;
                scored.push({ item, score: score + (inCurrentFolder ? SAME_FOLDER_BONUS : 0) });
            }
            scored.sort((a, b) => b.score - a.score);
            return scored.map((s) => s.item);
        }
        
        // Initialize Web Audio API for Normalization
        function setupAudioNormalization(mediaElement) {
            // A media element can only ever be connected to one MediaElementSourceNode.
            // Since we now reuse the same <audio>/<video> element across playlist
            // track changes, skip re-connecting if it's already wired up.
            if (normalizedElements.has(mediaElement)) return;
            try {
                // Ensure CORS is handled for Web Audio
                mediaElement.crossOrigin = "anonymous";
                
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    // Settings for a "broadcast style" leveling
                    compressor = audioCtx.createDynamicsCompressor();
                    compressor.threshold.value = -24; // Start compressing early to catch peaks
                    compressor.knee.value = 30;       // Soft knee for smooth transition
                    compressor.ratio.value = 12;      // High ratio to act as a leveler
                    compressor.attack.value = 0.003;  // Fast attack
                    compressor.release.value = 0.25;  // Standard release
                    compressor.connect(audioCtx.destination);
                }

                // Browser policy requires user interaction to resume audio context
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                // Connect source to compressor
                // Note: creating a new source for a new element is standard
                const source = audioCtx.createMediaElementSource(mediaElement);
                source.connect(compressor);
                normalizedElements.add(mediaElement);
            } catch (e) {
                // Fails quietly if CORS blocks it or AudioContext not supported
                console.warn("Audio Normalization setup failed:", e);
            }
        }

        function formatTime(seconds) {
            if (!isFinite(seconds) || seconds < 0) return "--:--";
            const m = Math.floor(seconds / 60),
                sec = Math.floor(seconds % 60);
            return `${m}:${sec.toString().padStart(2, "0")}`;
        }
        // When "Use native player" is on, hand the element back to the browser's
        // own controls instead of building/wiring our custom bar.
        function mediaTagAttrs() {
            return useNativePlayer ? "controls" : "";
        }
        function mediaControlsMarkup() {
            return useNativePlayer ? "" : playerControlsHTML();
        }
        function maybeWireMediaControls(el) {
            if (!useNativePlayer) wireMediaControls(el);
        }
        // Builds the markup for our custom play/pause, prev/next, shuffle and
        // volume controls. Used for both single audio/video files and playlist
        // tracks so the native browser controls never need to be shown.
        function playerControlsHTML() {
            return `
        <div class="player-bar">
          <div class="player-seek-row">
            <span class="player-time" id="playerCurTime">0:00</span>
            <input type="range" class="player-seek" id="playerSeek" min="0" max="1000" value="0" step="1" aria-label="Seek" disabled />
            <span class="player-time" id="playerDurTime">--:--</span>
          </div>
          <div class="player-controls-row">
            <button class="playlist-btn prev-btn" id="playlistPrev" title="Previous track" aria-label="Previous track" disabled>${icons.prevCtl}</button>
            <button class="playlist-btn player-play-btn" id="playPauseBtn" title="Play" aria-label="Play">${icons.playCtl}</button>
            <button class="playlist-btn next-btn" id="playlistNext" title="Next track" aria-label="Next track" disabled>${icons.nextCtl}</button>
            <button class="playlist-btn shuffle-btn" id="playlistShuffle" title="Shuffle" aria-label="Toggle shuffle" aria-pressed="false" disabled>${icons.shuffleCtl}</button>
            <span class="player-divider"></span>
            <button class="playlist-btn" id="volDownBtn" title="Volume down" aria-label="Decrease volume">${icons.volDownCtl}</button>
            <span class="player-vol" id="playerVolLabel">50%</span>
            <button class="playlist-btn" id="volUpBtn" title="Volume up" aria-label="Increase volume">${icons.volUpCtl}</button>
          </div>
        </div>
      `;
        }
        // Wires up a freshly-created set of custom controls to the given
        // <audio>/<video> element. Only call this once per element (when it's
        // first created) since playlist tracks reuse the same element.
        function wireMediaControls(mediaEl) {
            const playBtn = document.getElementById("playPauseBtn"),
                prevBtn = document.getElementById("playlistPrev"),
                nextBtn = document.getElementById("playlistNext"),
                shuffleBtn = document.getElementById("playlistShuffle"),
                curTimeEl = document.getElementById("playerCurTime"),
                durTimeEl = document.getElementById("playerDurTime"),
                seek = document.getElementById("playerSeek"),
                volDownBtn = document.getElementById("volDownBtn"),
                volUpBtn = document.getElementById("volUpBtn"),
                volLabel = document.getElementById("playerVolLabel");
            if (!playBtn || !mediaEl) return;

            function updatePlayIcon() {
                playBtn.innerHTML = mediaEl.paused ? icons.playCtl : icons.pauseCtl;
                const label = mediaEl.paused ? "Play" : "Pause";
                (playBtn.title = label), playBtn.setAttribute("aria-label", label);
            }
            playBtn.addEventListener("click", () => {
                mediaEl.muted = false;
                mediaEl.paused ? mediaEl.play().catch(() => {}) : mediaEl.pause();
            });
            mediaEl.addEventListener("play", updatePlayIcon);
            mediaEl.addEventListener("pause", updatePlayIcon);
            updatePlayIcon();

            prevBtn.addEventListener("click", goToPrevTrack);
            nextBtn.addEventListener("click", goToNextTrack);
            shuffleBtn.addEventListener("click", toggleShuffle);

            let seeking = false;
            // For live/unknown-length streams there's no fixed duration, but the
            // browser still buffers a rewindable window of what's already been
            // received. mediaEl.seekable exposes that window so we can let
            // people scrub back into it instead of just disabling seeking.
            //
            // Some live sources (particularly HLS live streams) report a
            // seekable.end() far ahead of the actual live edge, which used to
            // pin the indicator near the start of the bar. To keep the
            // indicator tracking real playback, we treat "now" (currentTime)
            // as the live edge and only trust seekable.start() as the
            // furthest-back point we can rewind into.
            function getSeekableRange() {
                try {
                    const ranges = mediaEl.seekable;
                    if (ranges && ranges.length > 0) {
                        const last = ranges.length - 1;
                        const start = ranges.start(last);
                        const reportedEnd = ranges.end(last);
                        const end = Math.min(reportedEnd, mediaEl.currentTime + 5);
                        if (end - start > 1) return { start, end };
                    }
                } catch (err) {}
                return null;
            }
            function getSeekTarget(sliderValue) {
                const dur = mediaEl.duration;
                if (isFinite(dur) && dur > 0) return (sliderValue / 1000) * dur;
                const range = getSeekableRange();
                if (range) return range.start + (sliderValue / 1000) * (range.end - range.start);
                return mediaEl.currentTime;
            }
            function syncSeekBar() {
                if (seeking) return;
                const dur = mediaEl.duration;
                if (isFinite(dur) && dur > 0) {
                    seek.disabled = false;
                    durTimeEl.textContent = formatTime(dur);
                    seek.value = Math.round((mediaEl.currentTime / dur) * 1000);
                    return;
                }
                const range = getSeekableRange();
                if (range) {
                    seek.disabled = false;
                    durTimeEl.textContent = "LIVE";
                    const ratio = (mediaEl.currentTime - range.start) / (range.end - range.start);
                    seek.value = Math.round(Math.max(0, Math.min(1, ratio)) * 1000);
                } else {
                    seek.disabled = true;
                    seek.value = 1000;
                    durTimeEl.textContent = "LIVE";
                }
            }
            mediaEl.addEventListener("loadedmetadata", syncSeekBar);
            mediaEl.addEventListener("durationchange", syncSeekBar);
            mediaEl.addEventListener("progress", syncSeekBar);
            mediaEl.addEventListener("timeupdate", () => {
                curTimeEl.textContent = formatTime(mediaEl.currentTime);
                syncSeekBar();
            });
            syncSeekBar();
            seek.addEventListener("input", () => {
                seeking = true;
                curTimeEl.textContent = formatTime(getSeekTarget(seek.value));
            });
            seek.addEventListener("change", () => {
                mediaEl.currentTime = getSeekTarget(seek.value);
                seeking = false;
            });

            const updateVolLabel = () => (volLabel.textContent = Math.round(mediaEl.volume * 100) + "%");
            volDownBtn.addEventListener("click", () => {
                mediaEl.muted = false;
                (mediaEl.volume = Math.max(0, +(mediaEl.volume - 0.1).toFixed(2))), (currentVolume = mediaEl.volume), updateVolLabel();
            });
            volUpBtn.addEventListener("click", () => {
                mediaEl.muted = false;
                (mediaEl.volume = Math.min(1, +(mediaEl.volume + 0.1).toFixed(2))), (currentVolume = mediaEl.volume), updateVolLabel();
            });
            updateVolLabel();

            // Now that the buttons actually exist in the DOM, sync their
            // enabled/disabled and shuffle-active state.
            updatePlaylistUI();
        }
        async function init() {
            loadSettings();
            try {
                const e = await fetch("./file_index.json");
                if (!e.ok) throw new Error("Failed to load file index");
                (fileIndex = await e.json()), 
                preprocessFiles(fileIndex.root), 
                setupEventListeners(), setupIntersectionObserver(), render();
            } catch (e) {
                console.error(e),
                    (document.getElementById("main").innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h2>Could not load files</h2>
            <p>Make sure file_index.json exists.</p>
          </div>
        `);
            }
        }
        function setupEventListeners() {
            const n = document.getElementById("search");
            let e;
            n.addEventListener("input", (t) => {
                clearTimeout(e),
                    (e = setTimeout(() => {
                        (searchQuery = t.target.value.toLowerCase().trim()),
                            (searchResultLimit = 100),
                            render(),
                            (document.getElementById("main").scrollTop = 0);
                    }, 150));
            }),
                document.getElementById("logoHome").addEventListener("click", () => navigateTo([])),
                document.getElementById("logoHome").addEventListener("keydown", (e) => {
                    (e.key === "Enter" || e.key === " ") && (e.preventDefault(), navigateTo([]));
                }),
                document.querySelectorAll(".view-btn").forEach((e) => {
                    e.addEventListener("click", () => setView(e.dataset.view));
                }),
                document.getElementById("closeBtn").addEventListener("click", closeModal),
                document.getElementById("modal").addEventListener("click", (e) => {
                    e.target === e.currentTarget && closeModal();
                }),
                document.getElementById("modalContent").addEventListener("click", (e) => e.stopPropagation()),
                document.getElementById("modal").addEventListener("keydown", trapModalFocus),
                document.addEventListener("keydown", (e) => {
                    e.key === "Escape" && closeModal(),
                        e.key === "/" &&
                            document.activeElement.tagName !== "INPUT" &&
                            (e.preventDefault(), document.getElementById("search").focus());
                    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                        const modalOpen = document.getElementById("modal").classList.contains("active");
                        const activeEl = document.activeElement;
                        const isFormField = ["INPUT", "SELECT", "TEXTAREA"].includes(activeEl.tagName);
                        if (modalOpen && !isFormField) {
                            e.preventDefault();
                            handleModalKeydown(e.key);
                            return;
                        }
                        const insideMain = activeEl.closest && activeEl.closest("#main");
                        const insideTree = activeEl.closest && activeEl.closest("#treeContent");
                        if (!modalOpen && !insideMain && !insideTree && !isFormField) {
                            e.preventDefault();
                            const panel = document.getElementById("treePanel");
                            e.key === "ArrowLeft" && panel && panel.classList.contains("visible")
                                ? focusTreePanel()
                                : focusMainPanel();
                        }
                    }
                }),
                document.getElementById("main").addEventListener("click", handleCardClick),
                document.getElementById("main").addEventListener("click", handleSortHeaderClick),
                document.getElementById("main").addEventListener("keydown", handleGridKeydown),
                document.getElementById("treeContent").addEventListener("click", handleTreeClick),
                document.getElementById("treeContent").addEventListener("keydown", handleTreeKeydown);
            setupDropdown("settingsBtn", "settingsMenu", "settingsDropdown");
            setupDropdown("themeColorBtn", "themeColorMenu", "themeColorDropdown");
            document.querySelectorAll(".theme-btn").forEach((e) => {
                    e.addEventListener("click", () => saveTheme(e.dataset.theme));
                }),
                document.getElementById("fontDecrease").addEventListener("click", () => changeFontSize(-1)),
                document.getElementById("fontIncrease").addEventListener("click", () => changeFontSize(1)),
                document.getElementById("sortSelect").addEventListener("change", (e) => setSortBy(e.target.value)),
                document.getElementById("nativePlayerToggle").addEventListener("change", (e) => {
                    (useNativePlayer = e.target.checked),
                        localStorage.setItem("useNativePlayer", useNativePlayer ? "1" : "0"),
                        document.body.classList.toggle("native-player-mode", useNativePlayer);
                }),
                document.getElementById("flatDesignToggle").addEventListener("change", (e) => setFlatDesign(e.target.checked)),
                wireThemeColorPicker(),
                document.getElementById("topPrevBtn").addEventListener("click", goToPrevTrack),
                document.getElementById("topNextBtn").addEventListener("click", goToNextTrack),
                document.getElementById("topShuffleBtn").addEventListener("click", toggleShuffle),
                document.getElementById("copyLinkBtn").addEventListener("click", copyRawLink),
                document.getElementById("playlistStop").addEventListener("click", stopPlaylist),
                document.getElementById("playPlaylistBtn").addEventListener("click", startPlaylistMode);
            setupGotoStepper();
        }
        function copyRawLink() {
            const btn = document.getElementById("copyLinkBtn");
            const url = new URL(`./${currentFilePath}`, window.location.href).href;
            const done = () => {
                btn.classList.add("copied");
                setTimeout(() => btn.classList.remove("copied"), 1200);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
            } else {
                fallbackCopy(url, done);
            }
        }
        function copyStreamInfo() {
            const btn = document.getElementById("streamInfoBtn");
            let text;
            if (currentPlaylist.length > 0) {
                const item = currentPlaylist[currentPlaylistIndex];
                if (!item) return;
                text = item.header ? `${item.header}\n${item.url}` : item.url;
            } else if (currentFilePath) {
                text = new URL(`./${currentFilePath}`, window.location.href).href;
            } else {
                return;
            }
            const done = () => {
                if (btn) {
                    btn.classList.add("copied");
                    setTimeout(() => btn.classList.remove("copied"), 1200);
                }
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
            } else {
                fallbackCopy(text, done);
            }
        }
        function fallbackCopy(text, onDone) {
            const ta = document.createElement("textarea");
            (ta.value = text), (ta.style.position = "fixed"), (ta.style.opacity = "0"), document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
                onDone();
            } catch (e) {
                console.warn("Copy failed:", e);
            }
            document.body.removeChild(ta);
        }
        function handleGridKeydown(e) {
            const card = e.target.closest(".file-card");
            if (!card) return;
            const cards = Array.from(document.querySelectorAll("#main .file-card"));
            const idx = cards.indexOf(card);
            const cols = getGridColumnCount();
            switch (e.key) {
                case "Enter":
                case " ":
                case "ArrowRight":
                    // Right (or Enter) drills in: opens a file's preview, or steps
                    // into a folder — same as clicking the card.
                    e.preventDefault();
                    card.click();
                    return;
                case "ArrowLeft":
                    e.preventDefault();
                    focusTreePanel();
                    return;
                case "ArrowDown": {
                    const nextIdx = idx + cols;
                    if (nextIdx < cards.length) {
                        e.preventDefault();
                        cards[nextIdx].focus();
                    }
                    return;
                }
                case "ArrowUp": {
                    const prevIdx = idx - cols;
                    if (prevIdx >= 0) {
                        e.preventDefault();
                        cards[prevIdx].focus();
                    }
                    return;
                }
                case "Home":
                    e.preventDefault();
                    cards[0]?.focus();
                    return;
                case "End":
                    e.preventDefault();
                    cards[cards.length - 1]?.focus();
                    return;
            }
        }
        function focusTreePanel() {
            const panel = document.getElementById("treePanel");
            if (!panel || !panel.classList.contains("visible")) return;
            const active =
                document.querySelector("#treeContent .tree-item.active") ||
                document.querySelector("#treeContent .tree-item");
            active && active.focus();
        }
        function focusMainPanel() {
            const cards = document.querySelectorAll("#main .file-card");
            cards.length > 0 && cards[0].focus();
        }
        function getGridColumnCount() {
            if (currentView !== "grid") return 1;
            const grid = document.querySelector("#main .file-grid");
            if (!grid) return 1;
            const style = getComputedStyle(grid);
            const cols = style.gridTemplateColumns.split(" ").length;
            return cols || 1;
        }
        function handleTreeKeydown(e) {
            const treeItem = e.target.closest(".tree-item");
            if (!treeItem) return;
            switch (e.key) {
                case "Enter":
                case " ":
                    e.preventDefault();
                    treeItem.click();
                    return;
                case "ArrowRight":
                    e.preventDefault();
                    focusMainPanel();
                    return;
                case "ArrowDown":
                case "ArrowUp": {
                    const items = Array.from(document.querySelectorAll("#treeContent .tree-item"));
                    const idx = items.indexOf(treeItem);
                    const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
                    if (nextIdx >= 0 && nextIdx < items.length) {
                        e.preventDefault();
                        items[nextIdx].focus();
                    }
                    return;
                }
            }
        }
        function safeJsonParse(str, fallback) {
            try {
                return JSON.parse(str);
            } catch (e) {
                console.warn("Failed to parse path data:", str, e);
                return fallback;
            }
        }
        function handleCardClick(e) {
            const t = e.target.closest(".file-card");
            if (!t) return;
            if (t.dataset.directory) {
                const path = safeJsonParse(t.dataset.path, null);
                if (path) navigateTo(path);
            } else t.dataset.file && openFile(t.dataset.file, t.dataset.category, t.dataset.name);
        }
        function handleTreeClick(e) {
            const t = e.target.closest(".tree-toggle"),
                n = e.target.closest(".tree-item");
            if (t && !t.classList.contains("empty")) {
                e.stopPropagation();
                const n = t.dataset.path;
                expandedFolders.has(n) ? expandedFolders.delete(n) : expandedFolders.add(n), renderTree();
                return;
            }
            if (n) {
                const path = safeJsonParse(n.dataset.path, null);
                if (path) navigateTo(path);
            }
        }
        function setupIntersectionObserver() {
            intersectionObserver = new IntersectionObserver(
                (e) => {
                    e.forEach((e) => {
                        if (e.isIntersecting) {
                            const t = e.target;
                            t.dataset.src &&
                                ((t.src = t.dataset.src),
                                (t.onload = () => t.classList.add("loaded")),
                                (t.onerror = () => (t.style.display = "none")),
                                delete t.dataset.src,
                                intersectionObserver.unobserve(t));
                        }
                    });
                },
                { rootMargin: "50px" }
            );
        }
        function getCurrentItems() {
            let e = fileIndex.root;
            for (const n of currentPath) {
                const t = e.find((e) => e.name === n && e.type === "directory");
                if (t) e = t.children;
                else return [];
            }
            return e;
        }

        function setView(e) {
            (currentView = e),
                localStorage.setItem("viewMode", e),
                document.querySelectorAll(".view-btn").forEach((t) => {
                    t.classList.toggle("active", t.dataset.view === e);
                }),
                document.getElementById("treePanel").classList.toggle("visible", e === "tree"),
                render();
        }
        function setSortBy(e) {
            (sortBy = e), localStorage.setItem("sortBy", e), syncSortUI(), render();
        }
        function getItemSize(item) {
            if (typeof item.size === "number") return item.size;
            if (!item.sizeFormatted) return 0;
            const m = /^([\d.]+)\s*(B|KB|MB|GB|TB)?/i.exec(item.sizeFormatted.trim());
            if (!m) return 0;
            const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
            return parseFloat(m[1]) * (units[(m[2] || "B").toUpperCase()] || 1);
        }
        // Extension without the dot (e.g. "index.html" -> "html"). A leading dot
        // with no other dot (e.g. ".gitignore") counts as no extension.
        function getFileExtension(name) {
            const idx = name.lastIndexOf(".");
            return idx <= 0 ? "" : name.slice(idx + 1);
        }
        function getBaseName(name) {
            const idx = name.lastIndexOf(".");
            return idx <= 0 ? name : name.slice(0, idx);
        }
        // Looks for a modified-time field under a few common names, since this
        // depends on whatever the file_index.json generator provides. Accepts
        // a unix timestamp (seconds or ms) or a date string. Returns null if no
        // usable date is found so callers can degrade gracefully.
        function getItemDate(item) {
            const raw = item.mtime ?? item.modified ?? item.date ?? item.lastModified ?? item.updated_at ?? item.time;
            if (raw === undefined || raw === null || raw === "") return null;
            const d = typeof raw === "number" ? new Date(raw < 1e12 ? raw * 1000 : raw) : new Date(raw);
            return isNaN(d.getTime()) ? null : d;
        }
        const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        function formatItemDate(item) {
            const d = getItemDate(item);
            if (!d) return "—";
            const day = String(d.getDate()).padStart(2, "0");
            return `${d.getFullYear()}/${MONTH_ABBR[d.getMonth()]}/${day}`;
        }
        function formatItemTime(item) {
            const d = getItemDate(item);
            return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
        }
        function sortItems(items) {
            const sorted = [...items];
            const dirs = { directory: 0, file: 1 };
            sorted.sort((a, b) => {
                // Folders always come before files, regardless of sort mode.
                if (a.type !== b.type) return dirs[a.type] - dirs[b.type];
                switch (sortBy) {
                    case "name-desc":
                        return b.name.localeCompare(a.name);
                    case "ext-asc":
                        return getFileExtension(a.name).localeCompare(getFileExtension(b.name)) || a.name.localeCompare(b.name);
                    case "ext-desc":
                        return getFileExtension(b.name).localeCompare(getFileExtension(a.name)) || a.name.localeCompare(b.name);
                    case "size-desc":
                        return getItemSize(b) - getItemSize(a);
                    case "size-asc":
                        return getItemSize(a) - getItemSize(b);
                    case "date-asc":
                        return (getItemDate(a)?.getTime() ?? 0) - (getItemDate(b)?.getTime() ?? 0);
                    case "date-desc":
                        return (getItemDate(b)?.getTime() ?? 0) - (getItemDate(a)?.getTime() ?? 0);
                    case "type":
                        return (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name);
                    case "name-asc":
                    default:
                        return a.name.localeCompare(b.name);
                }
            });
            return sorted;
        }
        // Keeps the column headers (list view) and the settings dropdown (all
        // views) showing the same active sort column/direction.
        function syncSortUI() {
            const sel = document.getElementById("sortSelect");
            if (sel && sel.value !== sortBy) sel.value = sortBy;
            const [activeKey, activeDir] = sortBy.includes("-") ? sortBy.split("-") : [sortBy, "asc"];
            document.querySelectorAll(".file-list-header .col[data-sort]").forEach((col) => {
                const isActive = col.dataset.sort === activeKey;
                col.classList.toggle("active", isActive);
                const arrow = col.querySelector(".sort-arrow");
                if (arrow) arrow.textContent = isActive ? (activeDir === "desc" ? "▼" : "▲") : "";
            });
        }
        function handleSortHeaderClick(e) {
            const col = e.target.closest(".col[data-sort]");
            if (!col) return;
            const key = col.dataset.sort;
            const [activeKey, activeDir] = sortBy.includes("-") ? sortBy.split("-") : [sortBy, "asc"];
            const dir = activeKey === key && activeDir === "asc" ? "desc" : "asc";
            setSortBy(`${key}-${dir}`);
        }
        function navigateTo(e) {
            (currentPath = e), (searchQuery = ""), (document.getElementById("search").value = "");
            let t = "";
            for (const n of e) (t += (t ? "/" : "") + n), expandedFolders.add(t);
            render();
            document.getElementById("main").scrollTop = 0;
        }
        function renderBreadcrumb() {
            const t = document.getElementById("breadcrumb");
            let e = `<span class="breadcrumb-item${currentPath.length === 0 ? " current" : ""}" data-path="[]">Home</span>`;
            currentPath.forEach((t, n) => {
                const s = n === currentPath.length - 1,
                    o = JSON.stringify(currentPath.slice(0, n + 1));
                (e += `<span class="breadcrumb-separator">/</span>`),
                    (e += `<span class="breadcrumb-item${s ? " current" : ""}" data-path='${o}'>${escapeHtml(t)}</span>`);
            }),
                (t.innerHTML = e),
                t.querySelectorAll(".breadcrumb-item:not(.current)").forEach((e) => {
                    e.addEventListener("click", () => {
                        const path = safeJsonParse(e.dataset.path, null);
                        if (path) navigateTo(path);
                    });
                });
        }
        function renderTree() {
            const e = document.getElementById("treeContent");
            function t(e) {
                let n = 0;
                for (const s of e) s.type === "directory" && (n++, s.children && (n += t(s.children)));
                return n;
            }
            function n(e, t = "", s = 0) {
                let o = "";
                const i = e.filter((e) => e.type === "directory");
                for (const e of i) {
                    const a = t ? `${t}/${e.name}` : e.name,
                        r = a.split("/").filter(Boolean),
                        c = expandedFolders.has(a),
                        l = JSON.stringify(r) === JSON.stringify(currentPath),
                        d = e.children?.some((e) => e.type === "directory");
                    (o += `
            <div class="tree-item${l ? " active" : ""}" data-path='${JSON.stringify(r)}' style="padding-left: ${s * 12 + 8}px" tabindex="0" role="treeitem" aria-label="Folder ${escapeHtml(e.name)}">
              <span class="tree-toggle${d ? (c ? " expanded" : "") : " empty"}" data-path="${a}">
                ${icons.chevron}
              </span>
              ${icons.folder}
              <span class="tree-item-name">${escapeHtml(e.name)}</span>
            </div>
          `),
                        c && e.children && (o += `<div class="tree-children">${n(e.children, a, s + 1)}</div>`);
                }
                return o;
            }
            const o = currentPath.length === 0,
                i = fileIndex.root.some((e) => e.type === "directory");
            let s = `
        <div class="tree-item${o ? " active" : ""}" data-path="[]" style="padding-left: 8px" tabindex="0" role="treeitem" aria-label="Root folder">
          <span class="tree-toggle${i ? " expanded" : " empty"}" data-path="">
            ${icons.chevron}
          </span>
          ${icons.folder}
          <span class="tree-item-name">Root</span>
        </div>
      `;
            (s += n(fileIndex.root)), (e.innerHTML = s);
            const a = t(fileIndex.root) + 1,
                r = e.parentElement.clientHeight - 32,
                c = a * 28;
            e.classList.toggle("needs-scroll", c > r);
        }
        function getFileIconType(e) {
            return isPlaylistExtension(e) ? "playlist" : null;
        }
        function render() {
            renderBreadcrumb(), currentView === "tree" && renderTree();
            const n = document.getElementById("main");

            let all = [];
            if (searchQuery) {
                // Ranked by relevance (with a bonus for the current folder) —
                // don't re-sort by name/date, that would destroy the ranking.
                all = searchFiles(searchQuery);
            } else {
                all = sortItems(getCurrentItems());
            }
            const e = searchQuery ? all.slice(0, searchResultLimit) : all;

            if (e.length === 0) {
                n.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            <h2>${searchQuery ? "No results" : "Empty folder"}</h2>
            <p>${searchQuery ? "Try different terms" : "No files here"}</p>
          </div>
        `;
                return;
            }
            const isColumnView = currentView === "list" || currentView === "tree";
            const s = isColumnView ? "file-list list-columns" : "file-grid";

            const fileCount = all.filter((i) => i.type === "file").length;
            const folderCount = all.filter((i) => i.type === "directory").length;

            let t = `
        <div class="stats-bar">
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6z"/></svg>
            ${fileCount} files ${searchQuery && all.length > e.length ? `(showing ${e.length} of ${all.length})` : ""}
          </span>
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            ${folderCount} folders
          </span>
        </div>
        <div class="main-content">
          <div class="${s}" id="fileItems" role="grid">
          ${
              isColumnView && !searchQuery
                  ? `
            <div class="file-list-header" role="row">
              <span class="col-icon-spacer" aria-hidden="true"></span>
              <span class="col col-name" data-sort="name">Name<span class="sort-arrow"></span></span>
              <span class="col col-ext" data-sort="ext">Ext<span class="sort-arrow"></span></span>
              <span class="col col-size" data-sort="size">Size<span class="sort-arrow"></span></span>
              <span class="col col-date" data-sort="date">Date<span class="sort-arrow"></span></span>
              <span class="col col-time" data-sort="date">Time<span class="sort-arrow"></span></span>
            </div>
          `
                  : ""
          }
      `;
            if (currentPath.length > 0 && !searchQuery) {
                t += `
            <div class="file-card directory parent-dir" data-directory="true" data-path='${JSON.stringify(currentPath.slice(0, -1))}' tabindex="0" role="button" aria-label="Go to parent folder">
              <div class="file-icon folder">${icons.folder}</div>
              <div class="file-info">
                <span class="file-name">..</span>
                <span class="file-meta"></span>
              </div>
              ${
                  isColumnView
                      ? `
                <span class="col-ext"></span>
                <span class="col-size"></span>
                <span class="col-date"></span>
                <span class="col-time"></span>
              `
                      : ""
              }
            </div>
          `;
            }
            for (const item of e) {
                const s = item.type === "directory" ? "folder" : getFileIconType(item.name) || item.category || "other",
                    o = icons[s] || icons.other;

                let clickPath, fullDisplayPath, parentPathArr;

                if (searchQuery) {
                    clickPath = item.fullPath;
                    fullDisplayPath = item.fullPath;
                    parentPathArr = item.navPath;
                } else {
                    fullDisplayPath = (currentPath.length ? currentPath.join("/") + "/" : "") + item.name;
                    clickPath = fullDisplayPath;
                    parentPathArr = [...currentPath, item.name];
                }

                if (item.type === "directory") {
                    t += `
            <div class="file-card directory" data-directory="true" data-path='${JSON.stringify(parentPathArr)}' tabindex="0" role="button" aria-label="Open folder ${escapeHtml(item.name)}">
              <div class="file-icon folder">${icons.folder}</div>
              <div class="file-info">
                <span class="file-name">${escapeHtml(item.name)}</span>
                <span class="file-meta">
                    ${isColumnView && !searchQuery ? "" : `${item.children?.length || 0} items`}
                    ${searchQuery ? `<span class="file-path">${escapeHtml(fullDisplayPath)}</span>` : ""}
                </span>
              </div>
              ${
                  isColumnView && !searchQuery
                      ? `
                <span class="col-ext"></span>
                <span class="col-size">DIR</span>
                <span class="col-date">${escapeHtml(formatItemDate(item))}</span>
                <span class="col-time">${escapeHtml(formatItemTime(item))}</span>
              `
                      : ""
              }
            </div>
          `;
                } else {
                    let i = "";
                    currentView === "grid" &&
                        item.category === "image" &&
                        (i = `<img class="file-thumbnail lazy" data-src="./${clickPath}" alt="" loading="lazy">`),
                        (t += `
            <div class="file-card" data-file="${escapeHtml(clickPath)}" data-category="${item.category}" data-name="${escapeHtml(item.name)}" tabindex="0" role="button" aria-label="Open file ${escapeHtml(item.name)}">
              ${i}
              <div class="file-icon ${s}">${o}</div>
              <div class="file-info">
                <span class="file-name">${escapeHtml(item.name)}</span>
                <span class="file-meta">
                    ${isColumnView && !searchQuery ? "" : item.sizeFormatted}
                    ${searchQuery ? `<span class="file-path">${escapeHtml(fullDisplayPath)}</span>` : ""}
                </span>
              </div>
              ${
                  isColumnView && !searchQuery
                      ? `
                <span class="col-ext">${escapeHtml(getFileExtension(item.name))}</span>
                <span class="col-size">${item.sizeFormatted}</span>
                <span class="col-date">${escapeHtml(formatItemDate(item))}</span>
                <span class="col-time">${escapeHtml(formatItemTime(item))}</span>
              `
                      : currentView !== "grid" && !searchQuery
                        ? `<span class="file-size">${item.sizeFormatted}</span>`
                        : ""
              }
            </div>
          `);
                }
            }
            (t += "</div>"),
                searchQuery && all.length > e.length &&
                    (t += `<button class="load-more-btn" id="loadMoreBtn">Show more (${all.length - e.length} remaining)</button>`),
                (t += "</div>"),
                (n.innerHTML = t),
                document.querySelectorAll(".file-thumbnail.lazy").forEach((e) => {
                    intersectionObserver.observe(e);
                });
            const loadMoreBtn = document.getElementById("loadMoreBtn");
            loadMoreBtn &&
                loadMoreBtn.addEventListener("click", () => {
                    (searchResultLimit += 100), render();
                });
            syncSortUI();
        }
        async function parsePlaylist(e, t) {
            try {
                const s = await fetchTextCached(t),
                    o = e.substring(0, e.lastIndexOf("/") + 1),
                    lines = s.split(/\r?\n/);
                
                const playlistItems = [];
                let currentTitle = null;
                let currentHeaderLines = [];

                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    if (line.startsWith("#EXTINF:")) {
                        currentHeaderLines = [line];
                        const commaIndex = line.indexOf(',');
                        if (commaIndex !== -1) {
                            currentTitle = line.substring(commaIndex + 1).trim();
                        }
                    } else if (line.startsWith("#")) {
                        // Other directive/comment lines (e.g. #EXTVLCOPT, #EXTGRP)
                        // that belong to this entry's header block.
                        currentHeaderLines.push(line);
                    } else {
                        const url = (line.startsWith("http://") || line.startsWith("https://")) ? line : o + line;
                        const title = currentTitle || decodeURIComponent(url.split('/').pop());
                        const header = currentHeaderLines.join("\n");
                        playlistItems.push({ url, title, header });
                        currentTitle = null;
                        currentHeaderLines = [];
                    }
                }
                return playlistItems;
            } catch (e) {
                return console.error("Error parsing playlist:", e), [];
            }
        }
        function setPlaylistBuffering(isBuffering) {
            const t = document.getElementById("playlistTrack");
            if (t) t.classList.toggle("buffering", isBuffering);
            const p = document.querySelector(".preview-audio, .preview-video");
            if (p) p.classList.toggle("buffering", isBuffering);
        }
        function updatePlaylistUI() {
            const e = document.getElementById("playlistBar"),
                t = document.getElementById("playlistTrack"),
                prevBtns = document.querySelectorAll(".prev-btn"),
                nextBtns = document.querySelectorAll(".next-btn"),
                shuffleBtns = document.querySelectorAll(".shuffle-btn"),
                gotoInput = document.getElementById("gotoInput"),
                gotoUpBtn = document.getElementById("gotoUpBtn"),
                gotoDownBtn = document.getElementById("gotoDownBtn");
            if (currentPlaylist.length > 0) {
                e.classList.add("active");
                const item = currentPlaylist[currentPlaylistIndex];
                t.textContent = `${currentPlaylistIndex + 1}/${currentPlaylist.length}: ${item.title}`;
                let prevDisabled, nextDisabled;
                if (isShuffle) {
                    (prevDisabled = shuffleHistory.length <= 1), (nextDisabled = currentPlaylist.length <= 1);
                } else {
                    (prevDisabled = currentPlaylistIndex <= 0), (nextDisabled = currentPlaylistIndex >= currentPlaylist.length - 1);
                }
                prevBtns.forEach((btn) => (btn.disabled = prevDisabled));
                nextBtns.forEach((btn) => (btn.disabled = nextDisabled));
                if (gotoInput) {
                    gotoInput.max = currentPlaylist.length;
                    gotoInput.disabled = currentPlaylist.length <= 1;
                    if (document.activeElement !== gotoInput) gotoInput.value = currentPlaylistIndex + 1;
                }
                if (gotoUpBtn) gotoUpBtn.disabled = currentPlaylist.length <= 1;
                if (gotoDownBtn) gotoDownBtn.disabled = currentPlaylist.length <= 1;
            } else {
                e.classList.remove("active");
                prevBtns.forEach((btn) => (btn.disabled = true));
                nextBtns.forEach((btn) => (btn.disabled = true));
            }
            shuffleBtns.forEach((btn) => {
                btn.disabled = currentPlaylist.length <= 1;
                btn.classList.toggle("active", isShuffle);
                btn.setAttribute("aria-pressed", isShuffle ? "true" : "false");
            });
        }
        function refillShuffleBag() {
            shuffleBag = currentPlaylist.map((_, i) => i).filter((i) => i !== currentPlaylistIndex);
            for (let i = shuffleBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffleBag[i], shuffleBag[j]] = [shuffleBag[j], shuffleBag[i]];
            }
        }
        function getNextShuffleIndex() {
            if (shuffleBag.length === 0) refillShuffleBag();
            return shuffleBag.length > 0 ? shuffleBag.pop() : currentPlaylistIndex;
        }
        function toggleShuffle() {
            isShuffle = !isShuffle;
            if (isShuffle) {
                shuffleHistory = [currentPlaylistIndex];
                refillShuffleBag();
            } else {
                shuffleBag = [];
                shuffleHistory = [];
            }
            updatePlaylistUI();
        }
        function recordShuffleJump(idx) {
            shuffleHistory.push(idx);
        }
        function goToNextTrack() {
            if (currentPlaylist.length === 0) return;
            if (isShuffle) {
                const nextIdx = getNextShuffleIndex();
                shuffleHistory.push(nextIdx);
                playPlaylistTrack(nextIdx);
            } else {
                playPlaylistTrack(currentPlaylistIndex + 1);
            }
        }
        function goToPrevTrack() {
            if (currentPlaylist.length === 0) return;
            if (isShuffle) {
                if (shuffleHistory.length > 1) {
                    shuffleHistory.pop();
                    playPlaylistTrack(shuffleHistory[shuffleHistory.length - 1]);
                }
            } else {
                playPlaylistTrack(currentPlaylistIndex - 1);
            }
        }
        function closeGotoPopover() {
            // No-op: the goto popover was replaced by an inline stepper, but
            // this is kept as a harmless stub since it's still referenced
            // from a few reset paths below.
        }
        function setupGotoStepper() {
            const input = document.getElementById("gotoInput"),
                upBtn = document.getElementById("gotoUpBtn"),
                downBtn = document.getElementById("gotoDownBtn");
            if (!input || !upBtn || !downBtn) return;

            const clamp = (v) => Math.max(1, Math.min(currentPlaylist.length || 1, v || 1));

            function jumpTo(n) {
                if (currentPlaylist.length === 0) return;
                const idx = clamp(n) - 1;
                input.value = idx + 1;
                if (idx !== currentPlaylistIndex) {
                    if (isShuffle) recordShuffleJump(idx);
                    playPlaylistTrack(idx);
                }
            }
            function step(delta) {
                jumpTo((parseInt(input.value, 10) || currentPlaylistIndex + 1) + delta);
            }

            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    jumpTo(parseInt(input.value, 10));
                    input.blur();
                }
            });
            input.addEventListener("blur", () => jumpTo(parseInt(input.value, 10)));

            let holdTimeout = null;
            function startHold(delta) {
                step(delta);
                let delay = 400;
                const repeat = () => {
                    step(delta);
                    delay = Math.max(60, delay - 40);
                    holdTimeout = setTimeout(repeat, delay);
                };
                holdTimeout = setTimeout(repeat, 400);
            }
            function stopHold() {
                clearTimeout(holdTimeout);
                holdTimeout = null;
            }
            [
                [upBtn, 1],
                [downBtn, -1],
            ].forEach(([btn, delta]) => {
                btn.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    startHold(delta);
                });
                btn.addEventListener(
                    "touchstart",
                    (e) => {
                        e.preventDefault();
                        startHold(delta);
                    },
                    { passive: false },
                );
                ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) => btn.addEventListener(ev, stopHold));
            });
        }
        async function startPlaylistMode() {
            if (!isPlaylistFile || !currentFilePath) return;
            const e = `./${currentFilePath}`,
                t = await parsePlaylist(e, e);
            t.length > 0
                ? ((currentPlaylist = t),
                  (currentPlaylistIndex = 0),
                  isShuffle && ((shuffleHistory = [0]), refillShuffleBag()),
                  document.getElementById("playPlaylistBtn").classList.add("hidden"),
                  updatePlaylistUI(),
                  playPlaylistTrack(0))
                : (document.getElementById("modalBody").innerHTML = `
      <div class="preview-unavailable">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
        </svg>
        <h3>Empty or invalid playlist</h3>
        <p>No playable items found in this playlist.</p>
      </div>
    `);
        }
        function stopPlaylist() {
            if (currentHls) {
                currentHls.destroy();
                currentHls = null;
            }
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
            (currentPlaylist = []),
                (currentPlaylistIndex = 0),
                (shuffleBag = []),
                (shuffleHistory = []),
                closeGotoPopover(),
                document.getElementById("playlistBar").classList.remove("active"),
                isPlaylistFile &&
                    (document.getElementById("playPlaylistBtn").classList.remove("hidden"), showPlaylistAsText());
        }
        async function fetchTextCached(url) {
            if (fetchCache.has(url)) return fetchCache.get(url);
            const response = await fetch(url);
            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.status = response.status;
                throw err;
            }
            const text = await response.text();
            fetchCache.set(url, text);
            return text;
        }
        function renderTextPreview(container, text) {
            const MAX_LINES = 1e4;
            const allLines = text.split("\n");
            const lines = allLines.slice(0, MAX_LINES);
            const truncated = allLines.length > MAX_LINES;
            const rendered = lines.map((e) => `<span class="line">${escapeHtml(e)}</span>`).join("\n");
            container.innerHTML = `
        ${truncated ? `<div class="truncation-notice">Showing first ${MAX_LINES.toLocaleString()} of ${allLines.length.toLocaleString()} lines — download the file to see the rest.</div>` : ""}
        <div class="preview-code line-numbers">
          <pre>${rendered}</pre>
        </div>
      `;
        }
        async function showPlaylistAsText() {
            const e = `./${currentFilePath}`;
            try {
                const text = await fetchTextCached(e);
                renderTextPreview(document.getElementById("modalBody"), text);
            } catch (err) {
                showUnavailable(document.getElementById("modalBody"), currentFileName, e, err);
            }
        }

        async function resolveStreamUrl(url, depth = 0) {
            const MAX_REDIRECT_DEPTH = 5;
            if (depth >= MAX_REDIRECT_DEPTH) {
                console.warn("Playlist redirect chain too deep, using URL as-is:", url);
                return url;
            }
            const lowerUrl = url.toLowerCase();
            const isM3u = lowerUrl.endsWith('.m3u') || lowerUrl.endsWith('.m3u8');
            if (!isM3u) return url;

            try {
                const response = await fetch(url);
                const contentType = response.headers.get("content-type");

                if (response.ok && (lowerUrl.endsWith('.m3u') || (contentType && (contentType.includes('mpegurl') || contentType.includes('text'))))) {
                    const text = await response.text();
                    if (text.includes("#EXTM3U")) {
                        const lines = text.split('\n').map((l) => l.trim());

                        // HLS master playlists list multiple quality variants via
                        // #EXT-X-STREAM-INF; pick the highest-bandwidth one instead
                        // of whichever line happens to appear first.
                        let bestUrl = null,
                            bestBandwidth = -1;
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            if (line.startsWith('#EXT-X-STREAM-INF')) {
                                const bwMatch = /BANDWIDTH=(\d+)/i.exec(line);
                                const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
                                const variantLine = lines[i + 1];
                                if (variantLine && !variantLine.startsWith('#') && bandwidth > bestBandwidth) {
                                    (bestBandwidth = bandwidth), (bestUrl = variantLine);
                                }
                            }
                        }
                        if (bestUrl) {
                            const resolved = new URL(bestUrl, url).href;
                            return resolveStreamUrl(resolved, depth + 1);
                        }

                        // Otherwise this is a simple redirector list: take the
                        // first playable entry.
                        for (const line of lines) {
                            if (line && !line.startsWith('#')) {
                                const resolved = new URL(line, url).href;
                                return resolveStreamUrl(resolved, depth + 1);
                            }
                        }
                    }
                }
            } catch (e) {
            }
            return url;
        }

        function skipToNext() {
            console.log("Stream invalid or timeout. Skipping...");
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
            if (currentPlaylist.length <= 1) {
                console.log("End of playlist reached.");
                stopPlaylist();
                return;
            }
            if (isShuffle) {
                const nextIdx = getNextShuffleIndex();
                shuffleHistory.push(nextIdx);
                playPlaylistTrack(nextIdx);
            } else if (currentPlaylistIndex < currentPlaylist.length - 1) {
                playPlaylistTrack(currentPlaylistIndex + 1);
            } else {
                console.log("End of playlist reached.");
                stopPlaylist();
            }
        }

        async function playPlaylistTrack(e) {
            if (e < 0 || e >= currentPlaylist.length) return;

            if (streamTimeout) {
                clearTimeout(streamTimeout);
            }
            streamTimeout = setTimeout(() => {
                skipToNext();
            }, STREAM_TIMEOUT_MS);

            (currentPlaylistIndex = e), updatePlaylistUI();

            const item = currentPlaylist[currentPlaylistIndex];
            const s = item.title;
            document.getElementById("modalTitle").textContent = s;

            const n = document.getElementById("modalBody");
            // Show a buffering hint right away instead of a silent wait while the
            // stream URL resolves — the still-visible player makes the track
            // change feel instant rather than sluggish.
            setPlaylistBuffering(true);

            const rawUrl = item.url;
            const finalUrl = await resolveStreamUrl(rawUrl);
            const o = finalUrl.toLowerCase();

            const isSpecificVideo = o.match(/\.(mp4|webm|mkv|avi|mov|ts)$/) || o.includes("type=video");

            if (isSpecificVideo) {
                let video = n.querySelector("#videoPlayer");
                if (!video) {
                    if (currentHls) { currentHls.destroy(); currentHls = null; }
                    document.getElementById("modalContent").classList.add("video-modal");
                    n.innerHTML = `
                      <div class="preview-media-container">
                        <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link &amp; header" aria-label="Copy stream link and header">${icons.info}</button>
                        <video id="videoPlayer" class="preview-video" autoplay playsinline muted crossOrigin="anonymous" ${mediaTagAttrs()}>
                          Your browser does not support video playback.
                        </video>
                        ${mediaControlsMarkup()}
                      </div>
                    `;
                    video = document.getElementById("videoPlayer");
                    video.volume = currentVolume;
                    video.onvolumechange = (e) => currentVolume = e.target.volume;
                    setupAudioNormalization(video);
                    maybeWireMediaControls(video);
                    document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                } else if (currentHls) {
                    // Same element, but the previous track had its own HLS instance attached.
                    currentHls.destroy();
                    currentHls = null;
                }

                video.onloadeddata = () => {
                    if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
                    setPlaylistBuffering(false);
                };
                video.onerror = () => skipToNext();
                video.onended = () => {
                    if (streamTimeout) clearTimeout(streamTimeout);
                    goToNextTrack();
                };

                if (Hls.isSupported() && (o.includes('.m3u8') || o.includes('application/x-mpegurl'))) {
                    currentHls = new Hls();
                    currentHls.loadSource(finalUrl);
                    currentHls.attachMedia(video);
                    currentHls.on(Hls.Events.FRAG_LOADED, function() {
                        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
                        setPlaylistBuffering(false);
                    });
                    currentHls.on(Hls.Events.ERROR, function(event, data) {
                        if (data.fatal) skipToNext();
                    });
                } else {
                    video.src = finalUrl;
                    video.load();
                    video.play().catch(() => {});
                }

            } else {
                let audio = n.querySelector("#audioPlayer");
                if (!audio) {
                    if (currentHls) { currentHls.destroy(); currentHls = null; }
                    document.getElementById("modalContent").classList.remove("video-modal");
                    n.innerHTML = `
                      <div class="preview-audio-container">
                        <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link &amp; header" aria-label="Copy stream link and header">${icons.info}</button>
                        <div class="audio-icon">${icons.audio}</div>
                        <div class="playlist-now-playing">${escapeHtml(s)}</div>
                        <audio id="audioPlayer" class="preview-audio" autoplay crossOrigin="anonymous" ${mediaTagAttrs()}>
                          Your browser does not support audio playback.
                        </audio>
                        ${mediaControlsMarkup()}
                      </div>
                    `;
                    audio = document.getElementById("audioPlayer");
                    audio.volume = currentVolume;
                    audio.onvolumechange = (e) => currentVolume = e.target.volume;
                    setupAudioNormalization(audio);
                    maybeWireMediaControls(audio);
                    document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                } else {
                    if (currentHls) { currentHls.destroy(); currentHls = null; }
                    const titleEl = n.querySelector(".playlist-now-playing");
                    if (titleEl) titleEl.textContent = s;
                }

                audio.onloadeddata = () => {
                    if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
                    setPlaylistBuffering(false);
                };
                audio.onerror = () => skipToNext();
                audio.onended = () => {
                    if (streamTimeout) clearTimeout(streamTimeout);
                    goToNextTrack();
                };

                if (Hls.isSupported() && (o.includes('.m3u8') || o.includes('application/x-mpegurl'))) {
                    currentHls = new Hls();
                    currentHls.loadSource(finalUrl);
                    currentHls.attachMedia(audio);
                    currentHls.on(Hls.Events.FRAG_LOADED, function() {
                        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
                        setPlaylistBuffering(false);
                    });
                    currentHls.on(Hls.Events.ERROR, function(event, data) {
                        if (data.fatal) skipToNext();
                    });
                } else {
                    audio.src = finalUrl;
                    audio.load();
                    audio.play().catch(() => {});
                }
            }
        }

        async function openFile(e, t, n) {
            lastFocusedElement = document.activeElement;
            const r = document.getElementById("modal"),
                c = document.getElementById("modalTitle"),
                s = document.getElementById("modalBody"),
                i = document.getElementById("downloadBtn"),
                l = document.getElementById("rawBtn"),
                d = document.getElementById("playlistBar"),
                a = document.getElementById("playPlaylistBtn");
            (currentFilePath = e),
                (currentFileName = n),
                (isPlaylistFile = isPlaylistExtension(n)),
                (c.textContent = n),
                (i.href = `./${e}`),
                (i.download = n),
                (l.href = `./${e}`),
                (s.innerHTML = '<div class="loading"><div class="spinner"></div></div>'),
                (currentPlaylist = []),
                (currentPlaylistIndex = 0),
                (shuffleBag = []),
                (shuffleHistory = []),
                closeGotoPopover(),
                d.classList.remove("active"),
                isPlaylistFile ? a.classList.remove("hidden") : a.classList.add("hidden"),
                document.getElementById("modalContent").classList.remove("video-modal"),
                r.classList.add("active");
            requestAnimationFrame(() => document.getElementById("closeBtn").focus());
            const o = `./${e}`;
            try {
                switch (t) {
                    case "image":
                        s.innerHTML = `<img class="preview-image" src="${o}" alt="${escapeHtml(n)}">`;
                        break;
                    case "video":
                        document.getElementById("modalContent").classList.add("video-modal");
                        s.innerHTML = `
              <div class="preview-media-container">
                <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link" aria-label="Copy stream link">${icons.info}</button>
                <video class="preview-video" autoplay playsinline crossOrigin="anonymous" ${mediaTagAttrs()}>
                  <source src="${o}">
                  Your browser does not support video playback.
                </video>
                ${mediaControlsMarkup()}
              </div>
            `;
                        // Apply volume and normalization to single files too
                        const singleVideo = s.querySelector('video');
                        if (singleVideo) {
                            singleVideo.volume = currentVolume;
                            singleVideo.onvolumechange = (e) => currentVolume = e.target.volume;
                            setupAudioNormalization(singleVideo);
                            maybeWireMediaControls(singleVideo);
                        }
                        document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                        break;
                    case "audio":
                        s.innerHTML = `
              <div class="preview-audio-container">
                <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link" aria-label="Copy stream link">${icons.info}</button>
                <div class="audio-icon">${icons.audio}</div>
                <div class="playlist-now-playing">${escapeHtml(n)}</div>
                <audio class="preview-audio" autoplay crossOrigin="anonymous" ${mediaTagAttrs()}>
                  <source src="${o}">
                  Your browser does not support audio playback.
                </audio>
                ${mediaControlsMarkup()}
              </div>
            `;
                        // Apply volume and normalization to single files too
                        const singleAudio = s.querySelector('audio');
                        if (singleAudio) {
                            singleAudio.volume = currentVolume;
                            singleAudio.onvolumechange = (e) => currentVolume = e.target.volume;
                            setupAudioNormalization(singleAudio);
                            maybeWireMediaControls(singleAudio);
                        }
                        document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                        break;
                    case "document":
                        n.toLowerCase().endsWith(".pdf")
                            ? (s.innerHTML = `<iframe class="preview-pdf" src="${o}"></iframe>`)
                            : showUnavailable(s, n, o);
                        break;
                    case "playlist":
                        // Start playing right away instead of waiting for a manual
                        // "Play" click — opening the file is the trigger.
                        await startPlaylistMode();
                        break;
                    case "code":
                    case "markup":
                    case "style":
                    case "data":
                    case "text":
                        try {
                            const text = await fetchTextCached(o);
                            renderTextPreview(s, text);
                        } catch (err) {
                            showUnavailable(s, n, o, err);
                        }
                        break;
                    case "font":
                        const t = "PreviewFont" + Date.now(),
                            i = new FontFace(t, `url(${o})`);
                        await i.load(),
                            document.fonts.add(i),
                            (s.innerHTML = `
              <div style="padding: 1.5rem; text-align: center; font-family: '${t}', sans-serif;">
                <p style="font-size: 2rem; margin-bottom: 0.75rem;">The quick brown fox jumps over the lazy dog</p>
                <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
                <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">abcdefghijklmnopqrstuvwxyz</p>
                <p style="font-size: 1.5rem;">0123456789!@#$%^&*()</p>
              </div>
            `);
                        break;
                    default:
                        showUnavailable(s, n, o);
                }
            } catch (e) {
                console.error(e), showUnavailable(s, n, o);
            }
        }
        function showUnavailable(e, t, n, err) {
            let reason = "This file cannot be previewed.";
            if (err && err.status === 404) reason = "This file could not be found (404).";
            else if (err && err.status) reason = `The server returned an error (HTTP ${err.status}).`;
            else if (err) reason = "This file couldn't be loaded — it may be blocked by CORS or a network issue.";
            e.innerHTML = `
        <div class="preview-unavailable">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
          </svg>
          <h3>Preview not available</h3>
          <p>${reason}</p>
          <a class="download-btn" href="${n}" download="${escapeHtml(t)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Download
          </a>
        </div>
      `;
        }
        function handleModalKeydown(key) {
            const modalBody = document.getElementById("modalBody");
            switch (key) {
                case "ArrowUp":
                    modalBody.scrollBy({ top: -120, behavior: "smooth" });
                    break;
                case "ArrowDown":
                    modalBody.scrollBy({ top: 120, behavior: "smooth" });
                    break;
                case "ArrowLeft":
                    // If a playlist is actively playing, stop it and drop back
                    // into the (now-static) preview rather than closing outright.
                    currentPlaylist.length > 0 ? stopPlaylist() : closeModal();
                    break;
                case "ArrowRight": {
                    if (isPlaylistFile && currentPlaylist.length === 0) {
                        startPlaylistMode();
                    } else {
                        const media = modalBody.querySelector("audio, video");
                        media && media.play().catch(() => {});
                    }
                    break;
                }
            }
        }
        function closeModal() {
            const e = document.getElementById("modal");
            e.classList.remove("active");
            
            if (currentHls) {
                currentHls.destroy();
                currentHls = null;
            }
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }

            const t = e.querySelector("video"),
                n = e.querySelector("audio");
            t && t.pause(),
                n && n.pause(),
                (currentPlaylist = []),
                (currentPlaylistIndex = 0),
                (shuffleBag = []),
                (shuffleHistory = []),
                (currentFilePath = ""),
                (currentFileName = ""),
                (isPlaylistFile = !1),
                closeGotoPopover(),
                document.getElementById("playlistBar").classList.remove("active"),
                document.getElementById("playPlaylistBtn").classList.add("hidden");
            if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                lastFocusedElement.focus();
            }
            lastFocusedElement = null;
        }
        function trapModalFocus(e) {
            if (e.key !== "Tab") return;
            const modal = document.getElementById("modalContent");
            const focusable = modal.querySelectorAll(
                'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;
            const first = focusable[0],
                last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        function escapeHtml(e) {
            const t = document.createElement("div");
            return (t.textContent = e), t.innerHTML;
        }
        init();
