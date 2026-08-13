        // -- Navigation / browsing state --
        let fileIndex = null,
            currentPath = [],
            currentView = "tree",
            expandedFolders = new Set([""]),
            allFiles = [],
            sortBy = "name-asc",
            suppressHashSync = false;

        // -- Search / listing state --
        let searchQuery = "",
            searchResultLimit = 100,
            // Separate (larger) page size for plain folder browsing. Search
            // results are already ranked, so a small page makes sense there;
            // a normal folder listing has no ranking to lean on, so this is
            // set higher to stay invisible for the vast majority of folders
            // and only kick in for the rare folder with hundreds+ of items.
            folderResultLimit = 300;

        // -- Open file / playback state --
        let currentFilePath = "",
            currentFileName = "",
            isPlaylistFile = false,
            currentPlaylist = [],
            currentPlaylistIndex = 0,
            isShuffle = false,
            shuffleBag = [],
            shuffleHistory = [],
            currentHls = null,
            streamTimeout = null,
            useNativePlayer = false,
            fetchCache = new Map();

        // -- Audio pipeline state --
        let currentVolume = 0.5, // Default volume set to 50%
            audioCtx = null,
            normalizedElements = new WeakSet(),
            compressor = null;

        // -- Theming / UI preference state --
        let currentFontSize = 16,
            vividColor = null,
            colorIntensity = 60,
            uiDepth = 1;

        // -- Pins / favorites --
        let pinnedFolders = [],
            favoriteFiles = [];

        // -- Modal focus restoration: maps modal element id -> the element
        // that had focus before it opened, so openModal/closeModal (below)
        // can restore focus on close without a separate variable per modal.
        let modalFocusReturn = new Map();

        // -- Misc / one-offs --
        let intersectionObserver = null;
        // How long to wait for a track to start loading before we assume it's
        // dead/unreachable and skip to the next one. Raise this if you're on a
        // slow connection and tracks are getting skipped before they finish buffering.
        const STREAM_TIMEOUT_MS = 15000;

        // Shared SVG markup for icon pairs that are visually identical (the icons
        // object below intentionally exposes both keys for readability at each
        // call site, e.g. `icons.code` vs `icons.markup`, without duplicating the
        // underlying path data).
        const iconCodeBrackets = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`;
        const iconDocPage = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
        const icons = {
            folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
            image: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
            video: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
            audio: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="20" height="14"/><circle cx="8" cy="12" r="2.4" fill="var(--bg-tertiary)"/><circle cx="16" cy="12" r="2.4" fill="var(--bg-tertiary)"/><circle cx="8" cy="12" r="0.8"/><circle cx="16" cy="12" r="0.8"/><rect x="10" y="15.6" width="4" height="1.6" fill="var(--bg-tertiary)"/></svg>`,
            code: iconCodeBrackets,
            document: iconDocPage,
            text: iconDocPage,
            data: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`,
            archive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>`,
            font: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.93 13.5h4.14L12 7.98zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/></svg>`,
            markup: iconCodeBrackets,
            style: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 5.95c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.6zm-9.2 3.8L7.87 7.79l7.35-3.04h.01l4.95 11.95-7.35 3.05z"/></svg>`,
            playlist: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="6.4" r="1.3" fill="var(--bg-tertiary)"/><circle cx="7" cy="15.2" r="1.3" fill="var(--bg-tertiary)"/><circle cx="17" cy="15.2" r="1.3" fill="var(--bg-tertiary)"/></svg>`,
            starOutline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
            starFilled: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
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

        // Small two-tone illustrations for empty/no-results/error states, using
        // currentColor for the outline and var(--accent) for the highlight so
        // they follow the active theme automatically.
        const emptyStateIllustrations = {
            folder: `<svg class="empty-state-illustration" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 30c0-2.2 1.8-4 4-4h16l6 7h32c2.2 0 4 1.8 4 4v34c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V30z" fill="currentColor" opacity="0.12"/>
                <path d="M14 30c0-2.2 1.8-4 4-4h16l6 7h32c2.2 0 4 1.8 4 4v34c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V30z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
                <circle cx="48" cy="56" r="10" fill="var(--accent)" opacity="0.15"/>
                <path d="M43 56h10M48 51v10" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
            </svg>`,
            search: `<svg class="empty-state-illustration" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 26c0-2.2 1.8-4 4-4h14l5 6h27c2.2 0 4 1.8 4 4v30c0 2.2-1.8 4-4 4H22c-2.2 0-4-1.8-4-4V26z" fill="currentColor" opacity="0.1"/>
                <path d="M18 26c0-2.2 1.8-4 4-4h14l5 6h27c2.2 0 4 1.8 4 4v30c0 2.2-1.8 4-4 4H22c-2.2 0-4-1.8-4-4V26z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
                <circle cx="56" cy="58" r="13" fill="var(--bg-primary)" stroke="var(--accent)" stroke-width="3"/>
                <path d="M65.5 67.5 L76 78" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
            </svg>`,
            error: `<svg class="empty-state-illustration" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 30c0-2.2 1.8-4 4-4h16l6 7h32c2.2 0 4 1.8 4 4v34c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V30z" fill="currentColor" opacity="0.1"/>
                <path d="M14 30c0-2.2 1.8-4 4-4h16l6 7h32c2.2 0 4 1.8 4 4v34c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V30z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M48 44 L60 65 L36 65 Z" fill="var(--danger)" opacity="0.15" stroke="var(--danger)" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M48 53v5" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="48" cy="61.5" r="1.4" fill="var(--danger)"/>
            </svg>`,
        };

        // A big pool of music-gear glyphs for the icon shown above the audio
        // player: cassette tapes, boomboxes, CDs/vinyl, portable players,
        // headphones, microphones, guitars/strings, keys/wind/percussion,
        // speakers/amps, radios, and a few odds and ends. One is picked at
        // random whenever the player first appears, and swapped for a
        // different random one each time the station/track changes.
        const playerNoteIcons = [
            // --- Cassette tapes ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="4" width="21" height="16" rx="1.8"/><circle cx="7" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="17" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="7" cy="12" r="0.90"/><circle cx="17" cy="12" r="0.90"/><rect x="9" y="16.6" width="6" height="1.9" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="4" width="21" height="16" rx="1.8"/><circle cx="7" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="17" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="7" cy="12" r="0.9"/><circle cx="17" cy="12" r="0.9"/><rect x="9" y="16.6" width="6" height="1.9" rx="0.5" fill="var(--bg-tertiary)"/><path d="M4 8.5h16" stroke="var(--bg-tertiary)" stroke-width="0.7" stroke-dasharray="1 1.2"/></svg>`,
            // --- Boomboxes ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="7" width="22" height="13" rx="1.6"/><path d="M3.5 7 L6 1.5 M20.5 7 L18 1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="6.5" cy="14" r="3.6" fill="var(--bg-tertiary)"/><circle cx="17.5" cy="14" r="3.6" fill="var(--bg-tertiary)"/><circle cx="6.5" cy="14" r="1.4"/><circle cx="17.5" cy="14" r="1.4"/><rect x="10.3" y="8.4" width="3.4" height="1.5" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="6.5" width="22" height="14" rx="1.6"/><path d="M12 6.5 L12 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="5.8" cy="13.5" r="2.8" fill="var(--bg-tertiary)"/><circle cx="18.2" cy="13.5" r="2.8" fill="var(--bg-tertiary)"/><circle cx="5.8" cy="13.5" r="1.1"/><circle cx="18.2" cy="13.5" r="1.1"/><rect x="9.5" y="11.5" width="2.4" height="4" rx="0.4" fill="var(--bg-tertiary)"/><rect x="12.1" y="11.5" width="2.4" height="4" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="6" width="22" height="15" rx="1.6"/><path d="M18 6 L21.5 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="6" cy="13.6" r="3.4" fill="var(--bg-tertiary)"/><circle cx="6" cy="13.6" r="1.3"/><rect x="10.5" y="10" width="9" height="7" rx="0.7" fill="var(--bg-tertiary)"/><rect x="12" y="11.5" width="1.4" height="4" fill="currentColor"/><rect x="14.2" y="12.4" width="1.4" height="3.1" fill="currentColor"/><rect x="16.4" y="11" width="1.4" height="4.5" fill="currentColor"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="4.5" width="22" height="16.5" rx="1.8"/><circle cx="7" cy="14.5" r="4" fill="var(--bg-tertiary)"/><circle cx="17" cy="14.5" r="4" fill="var(--bg-tertiary)"/><circle cx="7" cy="14.5" r="1.6"/><circle cx="17" cy="14.5" r="1.6"/><rect x="2.4" y="6.4" width="19.2" height="4" rx="0.6" fill="var(--bg-tertiary)"/><rect x="4" y="7.6" width="1.2" height="1.6"/><rect x="6" y="7" width="1.2" height="2.2"/><rect x="8" y="7.9" width="1.2" height="1.3"/><rect x="10" y="7.3" width="1.2" height="1.9"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="20" height="12" rx="1.6"/><circle cx="7" cy="13" r="3.2" fill="var(--bg-tertiary)"/><circle cx="17" cy="13" r="3.2" fill="var(--bg-tertiary)"/><circle cx="7" cy="13" r="1.4"/><circle cx="17" cy="13" r="1.4"/><rect x="10.5" y="8.2" width="3" height="1.4" rx="0.4" fill="var(--bg-tertiary)"/><rect x="4" y="3.5" width="2" height="4" rx="0.6"/><rect x="18" y="3.5" width="2" height="4" rx="0.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="8" width="20" height="11" rx="1.6"/><circle cx="6.5" cy="13.5" r="2.6" fill="var(--bg-tertiary)"/><circle cx="17.5" cy="13.5" r="2.6" fill="var(--bg-tertiary)"/><rect x="10" y="10.5" width="4" height="1" fill="var(--bg-tertiary)"/><rect x="10" y="12.3" width="4" height="1" fill="var(--bg-tertiary)"/><rect x="10" y="14.1" width="2.6" height="1" fill="var(--bg-tertiary)"/><path d="M5 8V5.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 5.5V8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.8" y="7.5" width="20.4" height="12" rx="1.8"/><circle cx="7" cy="13.5" r="3" fill="var(--bg-tertiary)"/><circle cx="17" cy="13.5" r="3" fill="var(--bg-tertiary)"/><rect x="9.6" y="9" width="4.8" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><rect x="9.6" y="10.6" width="3.2" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><circle cx="3.6" cy="4.5" r="1.1"/><circle cx="20.4" cy="4.5" r="1.1"/><path d="M3.6 4.5V7M20.4 4.5V7" stroke="currentColor" stroke-width="1.3"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="7.5" width="19" height="11.5" rx="1.6"/><circle cx="7.2" cy="13" r="2.8" fill="var(--bg-tertiary)"/><circle cx="16.8" cy="13" r="2.8" fill="var(--bg-tertiary)"/><rect x="10.6" y="8.6" width="2.8" height="1.1" rx="0.4" fill="var(--bg-tertiary)"/><path d="M5.5 7.5 4 3.5M18.5 7.5 20 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="8.5" width="20" height="10.5" rx="1.4"/><rect x="4" y="10.4" width="1.6" height="6.6" fill="var(--bg-tertiary)"/><rect x="6.4" y="11.6" width="1.6" height="4.2" fill="var(--bg-tertiary)"/><rect x="8.8" y="9.6" width="1.6" height="8.2" fill="var(--bg-tertiary)"/><circle cx="17.5" cy="13.7" r="3" fill="var(--bg-tertiary)"/><circle cx="17.5" cy="13.7" r="1" /></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="7.5" cy="14" r="3.4" fill="var(--bg-tertiary)"/><circle cx="16.5" cy="14" r="3.4" fill="var(--bg-tertiary)"/><circle cx="7.5" cy="14" r="1.1"/><circle cx="16.5" cy="14" r="1.1"/><path d="M8 8V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
            // --- CDs / vinyl ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="3.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="1"/><path d="M12 1A11 11 0 0 1 21.5 9" stroke="var(--bg-tertiary)" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="3.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="1"/><path d="M3.5 6A11 11 0 0 1 8.5 2" stroke="var(--bg-tertiary)" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M16.5 22A11 11 0 0 0 22 17" stroke="var(--bg-tertiary)" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="11" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.6" stroke="var(--bg-tertiary)"/><circle cx="12" cy="12" r="6.5" stroke="var(--bg-tertiary)"/><circle cx="12" cy="12" r="4.4" stroke="var(--bg-tertiary)"/><circle cx="12" cy="12" r="2.4" fill="var(--bg-tertiary)" stroke="none"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 1h14l6 6v16H2z"/><circle cx="17" cy="15" r="7" fill="var(--bg-tertiary)" stroke="currentColor" stroke-width="1.4"/><circle cx="17" cy="15" r="1.7"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="9" r="8" opacity="0.55"/><circle cx="15" cy="15" r="8"/><circle cx="15" cy="15" r="2.4" fill="var(--bg-tertiary)"/><circle cx="15" cy="15" r="0.8"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="3" width="21" height="18" rx="2"/><circle cx="12" cy="12" r="7.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="0.7" fill="var(--bg-tertiary)"/><rect x="2.5" y="18.8" width="6" height="1.2" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.6" stroke-dasharray="1.4 1.6"/><circle cx="12" cy="12" r="3" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="0.9"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="5.4"/><circle cx="12" cy="12" r="1.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="8.4" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.5"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.5"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.5"/><circle cx="12" cy="12" r="2.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="0.8"/></svg>`,
            // --- Portable players / walkman / MP3 / smart speaker ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="1" width="14" height="22" rx="2.8"/><rect x="6.8" y="3.2" width="10.4" height="8.6" rx="0.9" fill="var(--bg-tertiary)"/><circle cx="12" cy="18" r="4.5" fill="var(--bg-tertiary)"/><circle cx="12" cy="18" r="1.5"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="4.5" width="22" height="15" rx="2.2"/><rect x="5.5" y="7.3" width="13" height="7" rx="0.9" fill="var(--bg-tertiary)"/><circle cx="9.5" cy="10.8" r="1.9"/><circle cx="14.5" cy="10.8" r="1.9"/><rect x="3" y="16.6" width="3.4" height="1.6" rx="0.4" fill="var(--bg-tertiary)"/><rect x="7.4" y="16.6" width="3.4" height="1.6" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="1" width="18" height="22" rx="3"/><rect x="5.5" y="3.7" width="13" height="10.4" rx="1" fill="var(--bg-tertiary)"/><path d="M9.8 6.4 L15 9 L9.8 11.6Z"/><rect x="4.5" y="15.6" width="15" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="4.5" y="18" width="9" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4a6 6 0 0 1 12 0v14a6 6 0 0 1-12 0z"/><ellipse cx="12" cy="18" rx="6" ry="4" fill="var(--bg-tertiary)"/><circle cx="12" cy="6.2" r="1" fill="var(--bg-tertiary)"/><path d="M8 7.5a4 4 0 0 0 8 0" stroke="var(--bg-tertiary)" stroke-width="1" fill="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="2" width="10" height="20" rx="3.6"/><rect x="8.6" y="4" width="6.8" height="4.4" rx="0.7" fill="var(--bg-tertiary)"/><circle cx="12" cy="15" r="3.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="15" r="1.1"/><circle cx="12" cy="19.5" r="0.9" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6.5" width="20" height="12" rx="2"/><path d="M3.5 6.5 L4.5 2.5 M20.5 6.5 L19.5 2.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="7" cy="12.5" r="2.6" fill="var(--bg-tertiary)"/><rect x="11" y="10.2" width="9" height="4.6" rx="0.6" fill="var(--bg-tertiary)"/><rect x="12.4" y="11.4" width="1.2" height="2.2"/><rect x="14.4" y="11.9" width="1.2" height="1.7"/><rect x="16.4" y="11" width="1.2" height="2.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="2" width="16" height="20" rx="2.4"/><rect x="6" y="4.2" width="12" height="7.4" rx="0.8" fill="var(--bg-tertiary)"/><rect x="7.4" y="8.2" width="1.4" height="2.4" fill="currentColor"/><rect x="9.6" y="6.8" width="1.4" height="3.8" fill="currentColor"/><rect x="11.8" y="7.6" width="1.4" height="3" fill="currentColor"/><rect x="14" y="6" width="1.4" height="4.6" fill="currentColor"/><rect x="16.2" y="8.6" width="1.4" height="2" fill="currentColor"/><circle cx="12" cy="16.5" r="2.6" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="20" height="18" rx="2"/><rect x="4" y="5" width="16" height="9" rx="0.8" fill="var(--bg-tertiary)"/><path d="M6 12l2-3 2 2 3-4 2 3 3-2 2 4" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="16.5" width="6" height="2.2" rx="1" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="2" width="12" height="20" rx="2.4"/><rect x="8" y="4.4" width="8" height="6.2" rx="0.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="16.6" r="2.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="16.6" r="0.8"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="1.5" width="10" height="21" rx="3"/><circle cx="12" cy="14.5" r="4.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="14.5" r="1.2"/><rect x="9.5" y="4" width="5" height="4.4" rx="0.6" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="8" y="3" width="8" height="18" rx="4"/><circle cx="12" cy="9" r="2.6" fill="var(--bg-tertiary)"/><rect x="10.2" y="14" width="3.6" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><rect x="10.2" y="16" width="3.6" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="17" r="1.4" fill="var(--bg-tertiary)"/><rect x="7" y="5.4" width="10" height="8" rx="0.6" fill="var(--bg-tertiary)"/><path d="M9.5 8.5l2 1.6-2 1.6z"/></svg>`,
            // --- Headphones / earbuds ---
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 16v-4a9 9 0 0 1 18 0v4"/><rect x="1" y="15" width="4.6" height="7.4" rx="2.1" fill="currentColor" stroke="none"/><rect x="18.4" y="15" width="4.6" height="7.4" rx="2.1" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4.5 15v-2.5a7.5 7.5 0 0 1 15 0v2.5"/><circle cx="4" cy="17" r="3" fill="currentColor" stroke="none"/><circle cx="20" cy="17" r="3" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><path d="M5.5 8.5 C 5.5 16, 9.5 17, 9.5 22" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M18.5 8.5 C 18.5 16, 14 17, 12 18.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
            
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 13.5v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2.5" y="12.5" width="4" height="6.4" rx="1.6"/><rect x="17.5" y="12.5" width="4" height="6.4" rx="1.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6" cy="12" rx="2.6" ry="4.4"/><ellipse cx="18" cy="12" rx="2.6" ry="4.4"/><path d="M6 8V6.5A6 6 0 0 1 18 6.5V8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
            
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a7.5 7.5 0 0 0-7.5 7.5V17a2 2 0 0 0 2 2H8a1 1 0 0 0 1-1v-4.5a1 1 0 0 0-1-1H6.1V10.5a5.9 5.9 0 0 1 11.8 0V12.5H16a1 1 0 0 0-1 1V18a1 1 0 0 0 1 1h1.5a2 2 0 0 0 2-2v-6.5A7.5 7.5 0 0 0 12 3z"/></svg>`,
            // --- Microphones ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="8.5" y="1.5" width="7" height="13" rx="3.5"/><path d="M7.5 6.5h9M7.5 9.5h9M7.5 12.5h9" stroke="var(--bg-tertiary)" stroke-width="1"/><path d="M5.5 12.5a6.5 6.5 0 0 0 13 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="1.8"/><line x1="7.5" y1="23" x2="16.5" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M6 12a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" stroke-width="1.8"/><path d="M17 5 L21.5 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M17 8 L22 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="6" y="21.5" width="12" height="1.8" rx="0.8"/></svg>`,
            // --- Keys / wind / percussion ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="5" width="22" height="15" rx="1.2"/><rect x="3.9" y="5" width="2" height="9.4"/><rect x="10" y="5" width="2" height="9.4"/><rect x="16.1" y="5" width="2" height="9.4"/><rect x="1.4" y="14.4" width="3" height="5.4" fill="var(--bg-tertiary)"/><rect x="7.5" y="14.4" width="3" height="5.4" fill="var(--bg-tertiary)"/><rect x="13.6" y="14.4" width="3" height="5.4" fill="var(--bg-tertiary)"/><rect x="19.7" y="14.4" width="2.3" height="5.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="8" width="22" height="9" rx="4.5"/><circle cx="6.5" cy="12.5" r="2" fill="var(--bg-tertiary)"/><circle cx="12" cy="12.5" r="2" fill="var(--bg-tertiary)"/><circle cx="17.5" cy="12.5" r="2" fill="var(--bg-tertiary)"/><path d="M4 6.5h4M10 6.5h4M16 6.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h5l1.5-6 2 12 2-9 1.5 4h8"/><circle cx="4" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6" width="20" height="12" rx="1"/><rect x="2" y="6" width="2.85" height="8" fill="var(--bg-tertiary)"/><rect x="6" y="6" width="2.85" height="8" fill="var(--bg-tertiary)"/><rect x="10" y="6" width="2.85" height="8" fill="var(--bg-tertiary)"/><rect x="14" y="6" width="2.85" height="8" fill="var(--bg-tertiary)"/><rect x="18" y="6" width="2.85" height="8" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="14" rx="1.2"/><rect x="3" y="5" width="2.6" height="9" fill="var(--bg-tertiary)"/><rect x="6.4" y="5" width="2.6" height="9" fill="var(--bg-tertiary)"/><rect x="9.8" y="5" width="2.6" height="9" fill="var(--bg-tertiary)"/><rect x="13.2" y="5" width="2.6" height="9" fill="var(--bg-tertiary)"/><rect x="16.6" y="5" width="2.6" height="9" fill="var(--bg-tertiary)"/><rect x="5" y="5" width="1.4" height="6" fill="currentColor"/><rect x="11.4" y="5" width="1.4" height="6" fill="currentColor"/></svg>`,
            // --- Speakers / amps ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="1" width="12" height="22" rx="1.6"/><circle cx="12" cy="7.5" r="3.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="12" cy="17" r="4.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="17" r="1.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="9.5" height="20" rx="1.4"/><circle cx="6.7" cy="7" r="2.6" fill="var(--bg-tertiary)"/><circle cx="6.7" cy="15" r="3.2" fill="var(--bg-tertiary)"/><rect x="12.5" y="2" width="9.5" height="20" rx="1.4"/><circle cx="17.2" cy="7" r="2.6" fill="var(--bg-tertiary)"/><circle cx="17.2" cy="15" r="3.2" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="20" height="18" rx="1.6"/><rect x="4" y="5" width="16" height="7" rx="0.9" fill="var(--bg-tertiary)"/><path d="M6 10l1.4-2.4 1.6 3 1.6-4 1.6 3.4 1.6-2.4 1.6 2.4 1.6-1.6" stroke="currentColor" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="16.4" r="1.4"/><circle cx="10" cy="16.4" r="1.4"/><circle cx="14" cy="16.4" r="1.4"/><circle cx="18" cy="16.4" r="1.4"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="4" width="21" height="16" rx="1.6"/><circle cx="12" cy="12" r="8.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.1"/><circle cx="12" cy="12" r="1.3"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="1.5" width="12" height="21" rx="1.6"/><circle cx="12" cy="7" r="2.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="7" r="0.8"/><circle cx="12" cy="15.5" r="4" fill="var(--bg-tertiary)"/><circle cx="12" cy="15.5" r="1.3"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="16" rx="1.6"/><circle cx="8" cy="12" r="3.4" fill="var(--bg-tertiary)"/><circle cx="8" cy="12" r="1.1"/><circle cx="17" cy="7.5" r="1" fill="var(--bg-tertiary)"/><rect x="13.5" y="10.2" width="6.5" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><rect x="13.5" y="12.4" width="6.5" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><rect x="13.5" y="14.6" width="4.2" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="2" width="6" height="20" rx="1.4"/><circle cx="12" cy="6" r="1.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="13" r="2.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="13" r="0.8"/><circle cx="12" cy="19" r="1" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="3" width="16" height="18" rx="1.6"/><rect x="6.5" y="5.5" width="11" height="6.5" rx="0.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="16.5" r="2.8" fill="var(--bg-tertiary)"/><circle cx="12" cy="16.5" r="0.9"/></svg>`,
            // --- Radios ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="7.5" width="22" height="14.5" rx="1.6"/><path d="M17.5 7.5 L21 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="7" cy="14.7" r="3.6" fill="var(--bg-tertiary)"/><circle cx="7" cy="14.7" r="1.2"/><rect x="12.5" y="11.6" width="8.5" height="2.2" rx="0.7" fill="var(--bg-tertiary)"/><rect x="12.5" y="16" width="8.5" height="2.2" rx="0.7" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="18" rx="1.4"/><rect x="6" y="1" width="1.2" height="4"/><circle cx="12" cy="10" r="4.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="10" r="1.3"/><rect x="7" y="16.4" width="10" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="7" y="18.6" width="10" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="6" width="22" height="16" rx="1.6"/><circle cx="12" cy="13.6" r="6.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="13.6" r="1.5"/><line x1="12" y1="13.6" x2="16" y2="10.4" stroke="currentColor" stroke-width="1.3"/><circle cx="4.8" cy="9" r="0.7" fill="var(--bg-tertiary)"/><circle cx="19.2" cy="9" r="0.7" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="9" width="21" height="12" rx="1.5"/><rect x="6" y="9" width="12" height="6" rx="0.8" fill="var(--bg-tertiary)"/><path d="M4 9c0-4.5 3.5-8 8-8s8 3.5 8 8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="18" r="1.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="18" r="1.6" fill="var(--bg-tertiary)"/><circle cx="18" cy="18" r="1.6" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="8" width="19" height="12" rx="1.8"/><circle cx="7" cy="14" r="2.6" fill="var(--bg-tertiary)"/><rect x="12" y="11" width="7" height="1" rx="0.4" fill="var(--bg-tertiary)"/><rect x="12" y="13.2" width="7" height="1" rx="0.4" fill="var(--bg-tertiary)"/><path d="M17 8 20 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="7" width="18" height="13" rx="1.6"/><circle cx="8" cy="13.5" r="3.2" fill="var(--bg-tertiary)"/><circle cx="8" cy="13.5" r="1"/><rect x="13" y="10.6" width="6" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><rect x="13" y="12.6" width="4.4" height="0.9" rx="0.4" fill="var(--bg-tertiary)"/><path d="M6 7V4.5a2 2 0 0 1 4 0V7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="6" width="19" height="14" rx="1.8"/><circle cx="7.5" cy="13" r="3.6" fill="var(--bg-tertiary)"/><circle cx="7.5" cy="13" r="1.1"/><rect x="13" y="9.4" width="6.5" height="1" rx="0.4" fill="var(--bg-tertiary)"/><rect x="13" y="11.6" width="6.5" height="1" rx="0.4" fill="var(--bg-tertiary)"/><rect x="13" y="13.8" width="4" height="1" rx="0.4" fill="var(--bg-tertiary)"/><rect x="5" y="3.5" width="14" height="2.5" rx="1" fill="var(--bg-tertiary)"/></svg>`,
            // --- DJ / mixing ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="3" width="22" height="18" rx="1.4"/><rect x="3" y="5.5" width="3" height="13" rx="1" fill="var(--bg-tertiary)"/><rect x="7.4" y="5.5" width="3" height="13" rx="1" fill="var(--bg-tertiary)"/><rect x="11.8" y="5.5" width="3" height="13" rx="1" fill="var(--bg-tertiary)"/><rect x="16.2" y="5.5" width="3" height="13" rx="1" fill="var(--bg-tertiary)"/><rect x="2.4" y="9" width="2.2" height="1.6"/><rect x="6.8" y="13" width="2.2" height="1.6"/><rect x="11.2" y="7" width="2.2" height="1.6"/><rect x="15.6" y="15" width="2.2" height="1.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="1.6"/><circle cx="12" cy="11" r="7" fill="var(--bg-tertiary)"/><circle cx="12" cy="11" r="2.2"/><rect x="4" y="18.4" width="16" height="1.8" rx="0.6" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="9" width="9.4" height="9" rx="1.2"/><rect x="12.6" y="9" width="9.4" height="9" rx="1.2"/><circle cx="6.7" cy="13.5" r="2" fill="var(--bg-tertiary)"/><circle cx="17.3" cy="13.5" r="2" fill="var(--bg-tertiary)"/><rect x="11" y="6" width="2" height="12" rx="0.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="1.4"/><rect x="4.5" y="6.5" width="4" height="11" rx="1.2" fill="var(--bg-tertiary)"/><rect x="10" y="6.5" width="4" height="11" rx="1.2" fill="var(--bg-tertiary)"/><circle cx="18.5" cy="9.5" r="2.3" fill="var(--bg-tertiary)"/><circle cx="18.5" cy="9.5" r="0.7"/><circle cx="18.5" cy="15" r="1.6" fill="var(--bg-tertiary)"/></svg>`,
            // --- Misc / accessories ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="8" width="3.4" height="14" rx="1.2"/><rect x="6.7" y="2" width="3.4" height="20" rx="1.2"/><rect x="12.4" y="5.5" width="3.4" height="16.5" rx="1.2"/><rect x="18.1" y="0.5" width="3.4" height="21.5" rx="1.2"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M1 12h2.4M6 6v12M11 1.5v21M16 6v12M20.6 9v6M23 12h0"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="4.5" width="19" height="15" rx="1.6"/><rect x="4.3" y="12.3" width="2.3" height="2.3" fill="var(--bg-tertiary)"/><rect x="4.3" y="9" width="2.3" height="2.3" fill="var(--bg-tertiary)"/><rect x="4.3" y="15.6" width="2.3" height="2.3" fill="var(--bg-tertiary)"/><rect x="9" y="7.5" width="10.5" height="1.4" rx="0.4" fill="var(--bg-tertiary)"/><rect x="9" y="10.3" width="10.5" height="1.4" rx="0.4" fill="var(--bg-tertiary)"/><rect x="9" y="13.1" width="10.5" height="1.4" rx="0.4" fill="var(--bg-tertiary)"/><rect x="9" y="15.9" width="7" height="1.4" rx="0.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 5a2 2 0 0 1 2-2h5l1.5 2H20a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><circle cx="12" cy="13.5" r="4.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="13.5" r="1.2"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 3h13l4 4v14H2z"/><path d="M13.5 3v4.5H18" fill="none" stroke="var(--bg-tertiary)" stroke-width="1"/><rect x="5" y="9" width="14" height="1.4" fill="var(--bg-tertiary)"/><rect x="5" y="12" width="14" height="1.4" fill="var(--bg-tertiary)"/><rect x="5" y="15" width="9" height="1.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="16" width="2.4" height="5" rx="0.6"/><rect x="7.2" y="12" width="2.4" height="9" rx="0.6"/><rect x="11.4" y="8" width="2.4" height="13" rx="0.6"/><rect x="15.6" y="11" width="2.4" height="10" rx="0.6"/><rect x="19.8" y="5" width="2.4" height="16" rx="0.6"/></svg>`,
            // --- Cassette / boombox extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="4" width="21" height="16" rx="1.8"/><circle cx="7" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="17" cy="12" r="2.8" fill="var(--bg-tertiary)"/><circle cx="7" cy="12" r="0.9"/><circle cx="17" cy="12" r="0.9"/><rect x="3" y="6.4" width="6" height="2.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="9" y="16.6" width="6" height="1.9" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            // --- CD / vinyl extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.9"/><circle cx="12" cy="12" r="3" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="1" /></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="1.6"/><circle cx="12" cy="12" r="7" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="6.9" fill="none" stroke="currentColor" stroke-width="0.4"/><circle cx="12" cy="12" r="1.9"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11"/><path d="M4 8a9 9 0 0 1 8-5" stroke="var(--bg-tertiary)" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M4.5 16.5a9 9 0 0 0 13 3" stroke="var(--bg-tertiary)" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="var(--bg-tertiary)"/><circle cx="12" cy="12" r="0.8"/></svg>`,
            // --- Portable player extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="1.5" width="16" height="21" rx="2.6"/><rect x="5.8" y="3.6" width="12.4" height="10" rx="0.9" fill="var(--bg-tertiary)"/><rect x="7.5" y="16.6" width="9" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="7.5" y="19" width="6" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="12" r="4.4" fill="var(--bg-tertiary)"/><circle cx="8" cy="12" r="1.3"/><rect x="14.5" y="7" width="5.5" height="2" rx="0.5" fill="var(--bg-tertiary)"/><rect x="14.5" y="10.5" width="5.5" height="2" rx="0.5" fill="var(--bg-tertiary)"/><rect x="14.5" y="14" width="3.5" height="2" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            // --- Headphone extras ---
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M4 20c-1 0-2-1-2-2v-3c0-1 1-2 2-2"/><path d="M20 20c1 0 2-1 2-2v-3c0-1-1-2-2-2"/><rect x="2" y="13" width="4" height="8" rx="1.6" fill="currentColor" stroke="none"/><rect x="18" y="13" width="4" height="8" rx="1.6" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="6" height="9" rx="3"/><rect x="15" y="4" width="6" height="9" rx="3"/><path d="M6 13v3a6 6 0 0 0 12 0v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 12a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="2.5" y="11.5" width="4.2" height="7.5" rx="2.1"/><rect x="17.3" y="11.5" width="4.2" height="7.5" rx="2.1"/><circle cx="4.6" cy="10" r="1" fill="var(--bg-tertiary)"/></svg>`,
            // --- Keys / wind / percussion extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 15c0-3 2-5 5-5h10c3 0 5 2 5 5v1c0 3-2 5-5 5H7c-3 0-5-2-5-5z"/><path d="M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="16" r="1.6" fill="var(--bg-tertiary)"/><circle cx="15.5" cy="16" r="1.6" fill="var(--bg-tertiary)"/></svg>`,
            // --- Speaker / amp extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="1.6"/><circle cx="8" cy="12" r="4.4" fill="var(--bg-tertiary)"/><circle cx="8" cy="12" r="1.5"/><rect x="15" y="7" width="4.5" height="2" rx="0.6" fill="var(--bg-tertiary)"/><rect x="15" y="10.5" width="4.5" height="2" rx="0.6" fill="var(--bg-tertiary)"/><rect x="15" y="14" width="4.5" height="2" rx="0.6" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 1 10 10v6a2 2 0 0 1-2 2h-3v-8h3a8 8 0 0 0-16 0h3v8H4a2 2 0 0 1-2-2v-6A10 10 0 0 1 12 2z"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="5" width="16" height="14" rx="2"/><rect x="6" y="7" width="12" height="4" rx="0.7" fill="var(--bg-tertiary)"/><circle cx="8" cy="14.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="16" cy="14.5" r="1.6"/></svg>`,
            // --- Radio extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="8" width="22" height="12" rx="1.6"/><circle cx="6" cy="14" r="3" fill="var(--bg-tertiary)"/><circle cx="6" cy="14" r="1"/><path d="M11 11h9M11 14h9M11 17h5" stroke="var(--bg-tertiary)" stroke-width="1.4" stroke-linecap="round"/><path d="M18 8 L20 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="6" width="18" height="13" rx="1.5"/><rect x="3" y="6" width="18" height="13" rx="1.5" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.5"/><rect x="5.5" y="8.3" width="8" height="4.4" rx="0.5" fill="var(--bg-tertiary)"/><line x1="9.5" y1="8.3" x2="9.5" y2="12.7" stroke="currentColor" stroke-width="0.8"/><circle cx="17.5" cy="10.5" r="2" fill="var(--bg-tertiary)"/><rect x="5.5" y="14.5" width="13" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            // --- DJ / mixing extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="4" width="22" height="16" rx="1.6"/><rect x="3" y="6.5" width="4" height="11" rx="1" fill="var(--bg-tertiary)"/><rect x="8.5" y="6.5" width="4" height="11" rx="1" fill="var(--bg-tertiary)"/><rect x="14" y="6.5" width="4" height="11" rx="1" fill="var(--bg-tertiary)"/><rect x="19.5" y="6.5" width="2.5" height="11" rx="1" fill="var(--bg-tertiary)"/><circle cx="5" cy="10" r="1.3"/><circle cx="10.5" cy="14" r="1.3"/><circle cx="16" cy="9" r="1.3"/></svg>`,
            // --- Misc extras ---
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 15l2.5-6 2 4 2-8 2 6 2-2" fill="none" stroke="var(--bg-tertiary)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h5l1.5 2H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="7" y="9" width="10" height="1.4" fill="var(--bg-tertiary)"/><rect x="7" y="12" width="10" height="1.4" fill="var(--bg-tertiary)"/><rect x="7" y="15" width="6" height="1.4" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3v11.5a3 3 0 1 0 2 2.8V7h8v6.5a3 3 0 1 0 2 2.8V3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="9" width="3.6" height="6"/><rect x="6.4" y="4" width="3.6" height="16"/><rect x="11.8" y="12" width="3.6" height="3"/><rect x="17.2" y="7" width="3.6" height="11"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="6" width="2" height="12" rx="1"/><rect x="5" y="9" width="2" height="6" rx="1"/><rect x="13" y="9" width="2" height="6" rx="1"/><rect x="17" y="4" width="2" height="16" rx="1"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 14c2-8 4-8 6 0s4 8 6 0 4-8 6 0"/><path d="M2 10c2 8 4 8 6 0s4-8 6 0 4 8 6 0" opacity="0.55"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="9" r="3.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="9" r="1.2"/><path d="M9 16l3 3 3-3z" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="9" width="21" height="11" rx="1.6"/><path d="M5 9V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="14" r="2.7" fill="var(--bg-tertiary)"/><circle cx="7" cy="14" r="0.9"/><rect x="11.5" y="11.6" width="7" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="11.5" y="14" width="5.4" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/><rect x="11.5" y="16.4" width="7.4" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="4" width="19" height="16" rx="1.6"/><rect x="5" y="6.5" width="14" height="6" rx="0.7" fill="var(--bg-tertiary)"/><circle cx="7" cy="17" r="1.6" fill="var(--bg-tertiary)"/><circle cx="17" cy="17" r="1.6" fill="var(--bg-tertiary)"/><circle cx="7" cy="17" r="0.5"/><circle cx="17" cy="17" r="0.5"/><rect x="10" y="15.4" width="4" height="1.4" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 13c0-5 4-9 9-9s9 4 9 9"/><path d="M6 13c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M9 13c0-1.7 1.3-3 3-3s3 1.3 3 3"/><circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="1.5" width="12" height="21" rx="1.6"/><circle cx="12" cy="8" r="3.4" fill="var(--bg-tertiary)"/><circle cx="12" cy="8" r="1.2"/><circle cx="12" cy="17" r="4" fill="var(--bg-tertiary)"/><circle cx="12" cy="17" r="1.5"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="8" y="3" width="8" height="18" rx="2"/><circle cx="12" cy="8.5" r="2.2" fill="var(--bg-tertiary)"/><circle cx="12" cy="8.5" r="0.8"/><circle cx="12" cy="15.5" r="3" fill="var(--bg-tertiary)"/><circle cx="12" cy="15.5" r="1"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="3" width="8.5" height="18" rx="1.4"/><circle cx="6.2" cy="8" r="2.4" fill="var(--bg-tertiary)"/><circle cx="6.2" cy="8" r="0.8"/><circle cx="6.2" cy="15" r="3" fill="var(--bg-tertiary)"/><circle cx="6.2" cy="15" r="1"/><rect x="13.5" y="3" width="8.5" height="18" rx="1.4"/><circle cx="17.8" cy="8" r="2.4" fill="var(--bg-tertiary)"/><circle cx="17.8" cy="8" r="0.8"/><circle cx="17.8" cy="15" r="3" fill="var(--bg-tertiary)"/><circle cx="17.8" cy="15" r="1"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="2" width="18" height="20" rx="1.6"/><rect x="5.4" y="4.2" width="13.2" height="5.4" rx="0.8" fill="var(--bg-tertiary)"/><rect x="5.4" y="11.4" width="13.2" height="5.4" rx="0.8" fill="var(--bg-tertiary)"/><circle cx="12" cy="20.2" r="1" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="3" width="22" height="18" rx="1.4"/><rect x="3" y="5.5" width="18" height="3" rx="0.5" fill="var(--bg-tertiary)"/><rect x="3" y="10" width="3" height="9" rx="0.6" fill="var(--bg-tertiary)"/><rect x="7.5" y="10" width="3" height="9" rx="0.6" fill="var(--bg-tertiary)"/><rect x="12" y="10" width="3" height="9" rx="0.6" fill="var(--bg-tertiary)"/><rect x="16.5" y="10" width="3" height="9" rx="0.6" fill="var(--bg-tertiary)"/><rect x="2.4" y="8.5" width="4.2" height="1.2" fill="currentColor"/><rect x="6.9" y="8.5" width="4.2" height="1.2" fill="currentColor"/><rect x="11.4" y="8.5" width="4.2" height="1.2" fill="currentColor"/><rect x="15.9" y="8.5" width="4.2" height="1.2" fill="currentColor"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="5" width="22" height="15" rx="1.4"/><rect x="2.8" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="5.6" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="8.4" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="11.2" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="14" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="16.8" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="19.6" y="7" width="1.8" height="11" fill="var(--bg-tertiary)"/><rect x="2.3" y="12.5" width="2.8" height="1.3" fill="currentColor"/><rect x="8.9" y="9" width="2.8" height="1.3" fill="currentColor"/><rect x="15.5" y="15" width="2.8" height="1.3" fill="currentColor"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="8" width="4" height="8" rx="1"/><rect x="7" y="3" width="4" height="18" rx="1"/><rect x="13" y="10" width="4" height="4" rx="1"/><rect x="19" y="5" width="4" height="14" rx="1"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="11" width="3" height="2" rx="0.6"/><rect x="7" y="7" width="3" height="10" rx="0.6"/><rect x="12" y="4" width="3" height="16" rx="0.6"/><rect x="17" y="10" width="3" height="4" rx="0.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 16c1-6 3-9 4-6s3 8 4 4 3-6 4-2 3 4 4 1 3 2 4-2" fill="none"/><path d="M2 10c1 6 3 9 4 6s3-8 4-4 3 6 4 2 3-4 4 0 3-1 4-3" opacity="0.55" fill="none"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 12h4l2-6 3 12 2-8 2 4h5"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="3" height="14" rx="0.6"/><rect x="7" y="9" width="3" height="6" rx="0.6"/><rect x="12" y="2" width="3" height="20" rx="0.6"/><rect x="17" y="10" width="3" height="4" rx="0.6"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 2v13.5a3 3 0 1 0 2 2.8V7h8v8.5a3 3 0 1 0 2 2.8V2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v12a4 4 0 1 0 2 3.5V8h6v6a4 4 0 1 0 2 3.5V3z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.5" cy="18" rx="4" ry="2.6"/><ellipse cx="17.5" cy="18" rx="4" ry="2.6"/><path d="M6.5 15.4V5M17.5 15.4V5" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 5h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4.5" cy="16.5" r="2"/><circle cx="4.5" cy="16.5" r="2" fill="none" stroke="var(--bg-tertiary)" stroke-width="0.5"/><path d="M6.5 16.5V4M17 16.5V4" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 4h10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="16.5" r="2"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="2" width="18" height="20" rx="2"/><rect x="5.4" y="4.2" width="13.2" height="12.4" rx="0.8" fill="var(--bg-tertiary)"/><path d="M7.5 10.5l3-2 3 4 3-3 2 2" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="9.5" y="18" width="5" height="2" rx="0.5" fill="var(--bg-tertiary)"/></svg>`,
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3v12a4 4 0 1 0 2 3.5V7h5v3a2 2 0 1 0 1 1.7V3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
        
            ,`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="1.6"/><path d="M6 8h12v2H6z" fill="var(--bg-tertiary)"/><path d="M6 12.5h8v1.5H6z" fill="var(--bg-tertiary)"/><path d="M9 15.5h5v1.5H9z" fill="var(--bg-tertiary)"/></svg>`,];
        let currentPlayerNoteIndex = -1;
        function pickPlayerNoteIcon() {
            if (playerNoteIcons.length <= 1) return playerNoteIcons[0] || "";
            let idx;
            do {
                idx = Math.floor(Math.random() * playerNoteIcons.length);
            } while (idx === currentPlayerNoteIndex);
            currentPlayerNoteIndex = idx;
            return playerNoteIcons[idx];
        }
        // Tapping the big music glyph above the player swaps it for a
        // different random one, but only while audio is actually playing.
        function wirePlayerIconTap(scope) {
            const iconEl = scope.querySelector(".audio-icon");
            const audioEl = scope.querySelector("audio");
            if (!iconEl || !audioEl) return;
            iconEl.style.cursor = "pointer";
            iconEl.addEventListener("click", () => {
                if (audioEl.paused) return;
                iconEl.innerHTML = pickPlayerNoteIcon();
            });
        }
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
            const savedVolume = parseFloat(localStorage.getItem("playerVolume"));
            if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) currentVolume = savedVolume;
            useNativePlayer = localStorage.getItem("useNativePlayer") === "1";
            const nativeToggle = document.getElementById("nativePlayerToggle");
            if (nativeToggle) nativeToggle.checked = useNativePlayer;
            document.body.classList.toggle("native-player-mode", useNativePlayer);
            const compactDensity = localStorage.getItem("compactDensity") === "1";
            document.body.classList.toggle("compact-density", compactDensity);
            const compactToggle = document.getElementById("compactDensityToggle");
            if (compactToggle) compactToggle.checked = compactDensity;
            const zebraOn = localStorage.getItem("zebraStriping") !== "0";
            document.documentElement.classList.toggle("no-zebra", !zebraOn);
            const zebraToggle = document.getElementById("zebraStripingToggle");
            if (zebraToggle) zebraToggle.checked = zebraOn;
            const storedDepth = parseInt(localStorage.getItem(DEPTH_KEY), 10);
            uiDepth = [1, 2, 3, 4, 5].includes(storedDepth) ? storedDepth : 1;
            applyDepth(uiDepth, false);
            loadPinnedFolders();
            loadFavoriteFiles();
            initThemeColor();
            updateThemeButtons();
            syncHljsTheme();
        }
        // Picks a highlight.js theme (github-dark or github light) based on
        // the effective theme so code previews don't clash with the app's
        // own light/dark mode. Only the token colors come from hljs — the
        // background is overridden by CSS to stay consistent with the app.
        function isLightTheme() {
            const t = document.documentElement.getAttribute("data-theme");
            if (t === "light" || t === "hc-light") return true;
            if (t === "dark" || t === "hc-dark") return false;
            return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
        }
        function syncHljsTheme() {
            const link = document.getElementById("hljsTheme");
            if (!link) return;
            const href = isLightTheme()
                ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"
                : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css";
            if (link.href !== href) link.href = href;
        }
        // Announces a short message to screen readers via the hidden
        // aria-live region, without visually changing anything. Clearing
        // first forces re-announcement even if the same text is set twice
        // in a row (e.g. repeated "Buffering..." on rapid track skips).
        function announce(text) {
            const el = document.getElementById("srAnnouncer");
            if (!el) return;
            el.textContent = "";
            requestAnimationFrame(() => {
                el.textContent = text;
            });
        }
        function saveTheme(e) {
            e === "auto"
                ? (localStorage.removeItem("theme"), document.documentElement.removeAttribute("data-theme"))
                : (localStorage.setItem("theme", e), document.documentElement.setAttribute("data-theme", e)),
                updateThemeButtons();
            if (vividColor) applyCustomColor();
            syncHljsTheme();
        }
        function setupDropdown(btnId, menuId, dropdownId) {
            const btn = document.getElementById(btnId),
                menu = document.getElementById(menuId);
            const closeMenu = () => {
                menu.classList.remove("active");
                btn.setAttribute("aria-expanded", "false");
            };
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
            const closeBtn = menu.querySelector(".settings-menu-close");
            if (closeBtn) closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeMenu(); });
            document.addEventListener("click", (e) => {
                if (!e.target.closest("#" + dropdownId)) {
                    closeMenu();
                }
            });
        }

        /* ---------------------------------------------------------------
           Base Color engine
           Whatever color you pick, its exact hue and saturation are used
           everywhere — untouched, no clamping, no reshaping. Each surface
           (main panel, secondary panel, hover state, border) keeps its own
           original lightness so the app still has visible depth/layering;
           the accent itself is your picked color exactly, byte-for-byte.

           The only intervention is on TEXT, and only when it's reactive:
           a theme's own text color is left alone unless it would actually
           fail contrast against the new background, in which case it's
           inverted; if inverting still isn't enough, it falls back to
           plain black/white so text is never actually unreadable.

           "Color intensity" is a 5-step bar (100/80/60/40/20%) for people
           who find fully-saturated colors hard to look at. 100% is your
           picked color exactly, byte-for-byte. Each step down blends more
           of a calmer, desaturated, lightness-settled version of the same
           hue in, until 20% is almost entirely that calmer version — just
           a tint of your original color remains. Defaults to 60%.
           --------------------------------------------------------------- */
        const CUSTOM_COLOR_KEY = "themeCustomColor";
        const MUTED_COLORS_KEY = "themeMutedColors";
        const COLOR_INTENSITY_KEY = "themeColorIntensity";
        const DEFAULT_COLOR_INTENSITY = 60;
        const DEPTH_KEY = "uiDepth";
        const THEME_BASE = {
            dark: {
                "--bg-primary": "#0d1117", "--bg-secondary": "#161b22", "--bg-tertiary": "#21262d",
                "--bg-hover": "#30363d", "--border-color": "#30363d", "--text-primary": "#e6edf3",
                "--text-secondary": "#8b949e", "--text-muted": "#6e7681", "--accent": "#5858ff",
                "--accent-hover": "#7979ff", "--success": "#3fb950", "--warning": "#d29922", "--danger": "#f85149"
            },
            light: {
                "--bg-primary": "#ffffff", "--bg-secondary": "#f6f8fa", "--bg-tertiary": "#eaeef2",
                "--bg-hover": "#d0d7de", "--border-color": "#d0d7de", "--text-primary": "#1f2328",
                "--text-secondary": "#656d76", "--text-muted": "#8c959f", "--accent": "#0909da",
                "--accent-hover": "#0505ae"
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
        function clampNum(v, min, max) {
            return Math.max(min, Math.min(max, v));
        }
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
        function hexToRgb(hex) {
            hex = hex.replace("#", "");
            if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
            return {
                r: parseInt(hex.substr(0, 2), 16),
                g: parseInt(hex.substr(2, 2), 16),
                b: parseInt(hex.substr(4, 2), 16),
            };
        }
        // WCAG 2.x relative luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
        function relLuminance(hex) {
            const { r, g, b } = hexToRgb(hex);
            const chan = (c) => {
                c /= 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
        }
        function contrastRatio(hexA, hexB) {
            const l1 = relLuminance(hexA), l2 = relLuminance(hexB);
            const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
        }
        function invertHex(hex) {
            const { r, g, b } = hexToRgb(hex);
            const inv = (n) => clampNum(255 - n, 0, 255).toString(16).padStart(2, "0");
            return `#${inv(r)}${inv(g)}${inv(b)}`;
        }
        // Leaves baseHex alone unless it fails contrast against bgHex. If so,
        // try inverting it first; if even that isn't enough (a genuinely
        // awkward pairing), fall back to whichever of pure black/white is
        // more visible, guaranteeing text is never actually unreadable.
        function readableTextColor(baseHex, bgHex, minRatio) {
            if (contrastRatio(baseHex, bgHex) >= minRatio) return baseHex;
            const inverted = invertHex(baseHex);
            if (contrastRatio(inverted, bgHex) >= minRatio) return inverted;
            return contrastRatio("#ffffff", bgHex) >= contrastRatio("#000000", bgHex) ? "#ffffff" : "#000000";
        }
        // Nudges hex's LIGHTNESS ONLY (hue & saturation untouched — still
        // unmistakably the same color) just far enough that it's visible
        // against bgHex. Used only for borders/hover states, which are
        // useless if they're literally identical to the flat fill behind
        // them.
        function visibleVariant(hex, bgHex, targetRatio, maxShift) {
            if (contrastRatio(hex, bgHex) >= targetRatio) return hex;
            const { h, s, l } = hexToHsl(hex);
            const dir = relLuminance(bgHex) < 0.5 ? 1 : -1;
            let best = hex, bestRatio = contrastRatio(hex, bgHex);
            for (let step = 1; step <= (maxShift || 40); step++) {
                const nl = clampNum(l + dir * step, 0, 100);
                const candidate = hslToHex(h, s, nl);
                const ratio = contrastRatio(candidate, bgHex);
                if (ratio > bestRatio) { bestRatio = ratio; best = candidate; }
                if (ratio >= targetRatio) return candidate;
                if (nl <= 0 || nl >= 100) break;
            }
            return best;
        }
        // Blends the picked color toward a calm, desaturated, settled-
        // lightness target as intensity is lowered. hue never moves.
        // intensityPct is one of 100/80/60/40/20 — at 100 this returns hex
        // completely unchanged (blend 0); at 20 it's mostly the muted
        // target (blend 1), leaving just a tint of the original color.
        function muteColorAtIntensity(hex, intensityPct) {
            const { h, s, l } = hexToHsl(hex);
            const mutedS = clampNum(s * 0.12, 3, 15);
            const mutedL = clampNum(l + (l < 50 ? 22 : -22), 12, 88);
            const blend = clampNum((100 - intensityPct) / 80, 0, 1);
            const newS = s + (mutedS - s) * blend;
            const newL = l + (mutedL - l) * blend;
            return hslToHex(h, newS, newL);
        }
        function getActivePaletteKey() {
            const attr = document.documentElement.getAttribute("data-theme");
            if (attr === "light" || attr === "hc-dark" || attr === "hc-light") return attr;
            if (attr === "dark") return "dark";
            const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
            return dark ? "dark" : "light";
        }
        function applyCustomColor() {
            if (!vividColor) return;
            const root = document.documentElement.style;
            const base = THEME_BASE[getActivePaletteKey()];
            const newVals = {};
            // At 100% intensity: your color exactly as picked, no changes.
            // Below that: the one deliberate exception — your color is
            // blended toward a calmer, desaturated version of itself first,
            // then applied the exact same way below.
            const activeColor = muteColorAtIntensity(vividColor, colorIntensity);
            // Every surface is your color, byte-for-byte — no hue shift, no
            // saturation change, no lightness substitution. Backgrounds,
            // hover fill, and the accent are all the literal same hex.
            newVals["--bg-primary"] = activeColor;
            newVals["--bg-secondary"] = activeColor;
            newVals["--bg-tertiary"] = activeColor;
            newVals["--bg-hover"] = activeColor;
            newVals["--accent"] = activeColor;
            // Borders and the hover state are the ONE necessary exception:
            // if they were literally identical to the fill behind them,
            // they'd be invisible. Each gets the smallest possible lightness
            // nudge (hue & saturation still untouched) needed to be seeable.
            newVals["--border-color"] = visibleVariant(activeColor, activeColor, 2.2, 50);
            newVals["--accent-hover"] = visibleVariant(activeColor, activeColor, 1.6, 30);
            // Guaranteed-visible surface for icon-only interactive controls
            // (play button, player controls, info/copy buttons). Flattening
            // every panel to the exact picked color (by design, above)
            // means a button whose fill is also that exact color can vanish
            // into the panel behind it. This shifts far enough in lightness
            // (hue & saturation untouched) to always read as a distinct,
            // clickable surface, then guarantees a genuinely legible icon
            // color on top of it.
            const { h: ctrlH, s: ctrlS, l: ctrlL } = hexToHsl(activeColor);
            const shiftedL = clampNum(ctrlL + (ctrlL < 55 ? 22 : -22), 6, 94);
            const controlSurface = visibleVariant(hslToHex(ctrlH, ctrlS, shiftedL), activeColor, 2.5, 70);
            newVals["--control-surface"] = controlSurface;
            newVals["--control-surface-hover"] = visibleVariant(controlSurface, controlSurface, 1.3, 25);
            newVals["--on-control"] = contrastRatio("#ffffff", controlSurface) >= contrastRatio("#000000", controlSurface) ? "#ffffff" : "#000000";
            // Skeleton loading shimmer: normally this animates between
            // --bg-tertiary and --bg-hover, but this theme flattens both to
            // the exact same activeColor (by design, above), which would
            // make the shimmer invisible. Reuse the same guaranteed-visible
            // control-surface pair so the loading animation still reads.
            newVals["--skeleton-base"] = controlSurface;
            newVals["--skeleton-shine"] = newVals["--control-surface-hover"];
            // Dedicated fill color for proportional bar visualizations (e.g.
            // the Library Stats category bars). A subtle lightness-only
            // variant of the flat color (like --control-surface above) isn't
            // enough here - two same-hue, close-lightness tones sitting right
            // next to each other in a thin bar read as "the same color" even
            // when they technically differ. So this starts from a vivid,
            // fully-saturated version of the theme hue, then is nudged with
            // visibleVariant until it's guaranteed to contrast against the
            // track (--control-surface) it's rendered inside of, not just
            // against the flat background.
            const vividFill = hslToHex(ctrlH, 85, 55);
            newVals["--stat-fill"] = visibleVariant(vividFill, controlSurface, 3, 80);
            // The accent is intentionally the exact same flat color as every
            // panel background (see above), which means anywhere it's used
            // as TEXT (e.g. breadcrumb links sitting on the header, which is
            // --bg-secondary === --accent) it would be completely invisible.
            // This gives a same-hue, lightness-nudged variant that's
            // guaranteed legible on top of the flat panels, without
            // touching --accent itself (still used correctly as a flat
            // background/border color elsewhere).
            newVals["--accent-text"] = visibleVariant(activeColor, activeColor, 4.5, 100);
            for (const key of Object.keys(base)) {
                if (!(key in newVals)) newVals[key] = base[key];
            }
            for (const [textKey, minRatio] of [["--text-primary", 4.5], ["--text-secondary", 4.5], ["--text-muted", 3]]) {
                if (!base[textKey]) continue;
                newVals[textKey] = readableTextColor(base[textKey], newVals["--bg-primary"], minRatio);
            }
            for (const [varName, value] of Object.entries(newVals)) root.setProperty(varName, value);
            const onAccent = contrastRatio("#ffffff", newVals["--accent"]) >= contrastRatio("#000000", newVals["--accent"]) ? "#ffffff" : "#000000";
            root.setProperty("--on-accent", onAccent);
            const rgb = hexToRgb(newVals["--accent"]);
            root.setProperty("--accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
            markActiveSwatch(hexToHsl(activeColor).h);
        }
        function setCustomColor(hex) {
            vividColor = hex;
            localStorage.setItem(CUSTOM_COLOR_KEY, hex);
            document.documentElement.style.setProperty("--custom-theme-swatch", hex);
            applyCustomColor();
            renderIntensityBar();
            updateThemeButtons();
        }
        function clearCustomVars() {
            const root = document.documentElement.style;
            const keys = [
                "--bg-primary", "--bg-secondary", "--bg-tertiary", "--bg-hover", "--border-color",
                "--text-primary", "--text-secondary", "--text-muted",
                "--accent", "--accent-hover", "--accent-text", "--on-accent", "--accent-glow",
                "--control-surface", "--control-surface-hover", "--on-control", "--stat-fill",
                "--skeleton-base", "--skeleton-shine",
            ];
            for (const key of keys) root.removeProperty(key);
        }
        function resetCustomColor() {
            vividColor = null;
            localStorage.removeItem(CUSTOM_COLOR_KEY);
            clearCustomVars();
            document.documentElement.style.removeProperty("--custom-theme-swatch");
            markActiveSwatch(null);
            renderIntensityBar();
            updateThemeButtons();
        }
        // Paints each segment of the intensity bar with what that step
        // actually looks like for the currently picked color (or a neutral
        // default hue if none is picked yet), so the bar always shows a
        // real vivid-on-the-left, muted-on-the-right gradient rather than
        // a plain slider.
        function renderIntensityBar() {
            const wrap = document.getElementById("colorIntensityControl");
            if (!wrap) return;
            const baseHex = vividColor || "#5858ff";
            wrap.querySelectorAll(".intensity-seg").forEach((seg) => {
                const pct = parseInt(seg.dataset.intensity, 10);
                seg.style.background = muteColorAtIntensity(baseHex, pct);
            });
        }
        function setColorIntensity(pct) {
            colorIntensity = pct;
            localStorage.setItem(COLOR_INTENSITY_KEY, String(pct));
            updateColorIntensityUI();
            if (vividColor) applyCustomColor();
        }
        function updateColorIntensityUI() {
            const wrap = document.getElementById("colorIntensityControl");
            if (!wrap) return;
            wrap.querySelectorAll("button[data-intensity]").forEach((btn) => {
                btn.classList.toggle("active", parseInt(btn.dataset.intensity, 10) === colorIntensity);
            });
        }
        // Interface corner rounding: square (1, default) through round (5).
        // Purely a data-depth attribute on <html> — every visual consequence
        // lives in CSS (corner radius variables only), this just persists the
        // choice and keeps the segmented bar's active state in sync.
        function applyDepth(level, persist) {
            uiDepth = level;
            if (level === 1) document.documentElement.removeAttribute("data-depth");
            else document.documentElement.setAttribute("data-depth", String(level));
            if (persist !== false) localStorage.setItem(DEPTH_KEY, String(level));
            updateDepthUI();
        }
        function updateDepthUI() {
            const wrap = document.getElementById("depthControl");
            if (!wrap) return;
            wrap.querySelectorAll("button[data-depth]").forEach((btn) => {
                btn.classList.toggle("active", parseInt(btn.dataset.depth, 10) === uiDepth);
            });
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
                const swatchColor = hslToHex(p.hue, 100, 55);
                return `<button type="button" class="theme-swatch" data-hue="${p.hue}" title="${p.name}" style="background:${swatchColor}"></button>`;
            }).join("");
        }
        function wireThemeColorPicker() {
            const input = document.getElementById("themeColorInput"),
                resetBtn = document.getElementById("themeResetBtn"),
                swatches = document.getElementById("themeSwatches"),
                intensityControl = document.getElementById("colorIntensityControl");
            if (input) input.addEventListener("input", (e) => setCustomColor(e.target.value));
            if (resetBtn) resetBtn.addEventListener("click", () => resetCustomColor());
            if (swatches) swatches.addEventListener("click", (e) => {
                const sw = e.target.closest(".theme-swatch");
                if (!sw) return;
                const hue = parseFloat(sw.dataset.hue);
                const hex = hslToHex(hue, 100, 55);
                setCustomColor(hex);
                if (input) input.value = hex;
            });
            if (intensityControl) intensityControl.addEventListener("click", (e) => {
                const btn = e.target.closest("button[data-intensity]");
                if (!btn) return;
                setColorIntensity(parseInt(btn.dataset.intensity, 10));
            });
            if (window.matchMedia) {
                window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
                    if (vividColor) applyCustomColor();
                });
            }
        }
        function initThemeColor() {
            renderThemeSwatches();
            const input = document.getElementById("themeColorInput");
            let storedIntensity = localStorage.getItem(COLOR_INTENSITY_KEY);
            if (storedIntensity == null) {
                // Migrate the old binary "Muted colors" toggle if it was set;
                // otherwise fall back to the new default of 60%.
                storedIntensity = localStorage.getItem(MUTED_COLORS_KEY) === "1" ? "20" : String(DEFAULT_COLOR_INTENSITY);
            }
            const parsedIntensity = parseInt(storedIntensity, 10);
            colorIntensity = [20, 40, 60, 80, 100].includes(parsedIntensity) ? parsedIntensity : DEFAULT_COLOR_INTENSITY;
            updateColorIntensityUI();
            renderIntensityBar();
            const storedColor = localStorage.getItem(CUSTOM_COLOR_KEY);
            if (storedColor) {
                vividColor = storedColor;
                applyCustomColor();
                if (input) input.value = storedColor;
                return;
            }
            markActiveSwatch(null);
        }
        function updateThemeButtons() {
            const e = localStorage.getItem("theme") || "auto";
            const customActive = !!vividColor;
            document.querySelectorAll(".theme-btn").forEach((t) => {
                t.classList.toggle("active", t.dataset.theme === "custom" ? customActive : !customActive && t.dataset.theme === e);
            });
            const toggle = document.getElementById("themeToggle");
            if (toggle) toggle.classList.toggle("custom-color-active", customActive);
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

                // Parse each item's modified date exactly once (instead of on
                // every render/sort) and cache the Date so the column cells and
                // date sorts never re-construct a Date for the same item.
                let dateObj = null;
                if (node.type === "file") {
                    try { dateObj = getItemDate(node); } catch (err) { dateObj = null; }
                }
                allFiles.push({
                    ...node,
                    fullPath: currentPathStr,
                    navPath: navPath,
                    searchKey: searchKey,
                    normalizedKey: normalizedKey,
                    compactKey: compactKey,
                    boundarySet: boundarySet,
                    parentPath: pathPrefix.toLowerCase(),
                    dateObj: dateObj
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

        // Media Session API: surfaces play/pause/prev/next on the lock screen,
        // hardware media keys, and OS media overlays. Set up once per element
        // (alongside setupAudioNormalization) regardless of whether the custom
        // control bar or native controls are in use.
        function setupMediaSession(mediaEl, title) {
            if (!("mediaSession" in navigator)) return;
            updateMediaSessionTitle(title);
            navigator.mediaSession.setActionHandler("play", () => {
                mediaEl.muted = false;
                mediaEl.play().catch(() => {});
            });
            navigator.mediaSession.setActionHandler("pause", () => mediaEl.pause());
            navigator.mediaSession.setActionHandler("previoustrack", goToPrevTrack);
            navigator.mediaSession.setActionHandler("nexttrack", goToNextTrack);
            const syncPlaybackState = () => {
                navigator.mediaSession.playbackState = mediaEl.paused ? "paused" : "playing";
            };
            mediaEl.addEventListener("play", syncPlaybackState);
            mediaEl.addEventListener("pause", syncPlaybackState);
            syncPlaybackState();
        }
        function updateMediaSessionTitle(title) {
            if (!("mediaSession" in navigator)) return;
            navigator.mediaSession.metadata = new MediaMetadata({ title: title || "" });
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
            <input type="range" class="player-seek" id="playerSeek" min="0" max="1000" value="0" step="1" aria-label="Seek" aria-valuetext="0:00" disabled />
            <span class="player-time" id="playerDurTime">--:--</span>
          </div>
          <div class="player-controls-row">
            <button class="playlist-btn prev-btn" id="playlistPrev" title="Previous track" aria-label="Previous track" disabled>${icons.prevCtl}</button>
            <button class="playlist-btn player-play-btn" id="playPauseBtn" title="Play" aria-label="Play">${icons.playCtl}</button>
            <button class="playlist-btn next-btn" id="playlistNext" title="Next track" aria-label="Next track" disabled>${icons.nextCtl}</button>
            <button class="playlist-btn shuffle-btn" id="playlistShuffle" title="Shuffle" aria-label="Toggle shuffle" aria-pressed="false" disabled>${icons.shuffleCtl}</button>
            <span class="player-divider"></span>
            <button class="playlist-btn" id="volDownBtn" title="Volume down" aria-label="Decrease volume">${icons.volDownCtl}</button>
            <span class="player-vol" id="playerVolLabel" aria-live="polite">50%</span>
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
                    seek.setAttribute("aria-valuetext", `${formatTime(mediaEl.currentTime)} of ${formatTime(dur)}`);
                    return;
                }
                const range = getSeekableRange();
                if (range) {
                    seek.disabled = false;
                    durTimeEl.textContent = "LIVE";
                    const ratio = (mediaEl.currentTime - range.start) / (range.end - range.start);
                    seek.value = Math.round(Math.max(0, Math.min(1, ratio)) * 1000);
                    seek.setAttribute("aria-valuetext", `${formatTime(mediaEl.currentTime)}, live`);
                } else {
                    seek.disabled = true;
                    seek.value = 1000;
                    durTimeEl.textContent = "LIVE";
                    seek.setAttribute("aria-valuetext", "live");
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
                const target = getSeekTarget(seek.value);
                curTimeEl.textContent = formatTime(target);
                seek.setAttribute("aria-valuetext", formatTime(target));
            });
            seek.addEventListener("change", () => {
                mediaEl.currentTime = getSeekTarget(seek.value);
                seeking = false;
            });

            const updateVolLabel = () => (volLabel.textContent = Math.round(mediaEl.volume * 100) + "%");
            volDownBtn.addEventListener("click", () => {
                mediaEl.muted = false;
                mediaEl.volume = Math.max(0, +(mediaEl.volume - 0.1).toFixed(2));
            });
            volUpBtn.addEventListener("click", () => {
                mediaEl.muted = false;
                mediaEl.volume = Math.min(1, +(mediaEl.volume + 0.1).toFixed(2));
            });
            // Covers every path that can change volume (these buttons, the
            // element's own onvolumechange set in openFile/playPlaylistTrack,
            // or any future source) so the label can never drift out of sync.
            mediaEl.addEventListener("volumechange", updateVolLabel);
            updateVolLabel();

            // Now that the buttons actually exist in the DOM, sync their
            // enabled/disabled and shuffle-active state.
            updatePlaylistUI();
        }
        async function init() {
            loadSettings();
            try {
                const response = await fetch("./file_index.json", { cache: "no-store" });
                if (!response.ok) throw new Error("Failed to load file index");
                fileIndex = await response.json();
                preprocessFiles(fileIndex.root);
                setupEventListeners();
                setupIntersectionObserver();
                navigateTo(hashToPath());
            } catch (err) {
                console.error(err);
                document.getElementById("main").innerHTML = `
          <div class="empty-state">
            ${emptyStateIllustrations.error}
            <h2>Could not load files</h2>
            <p>Make sure file_index.json exists.</p>
          </div>
        `;
            }
        }
        function updateSearchClearVisibility() {
            const input = document.getElementById("search");
            const btn = document.getElementById("searchClearBtn");
            if (input && btn) btn.classList.toggle("visible", input.value.length > 0);
        }
        function clearSearch() {
            const input = document.getElementById("search");
            input.value = "";
            input.focus();
            searchQuery = "";
            searchResultLimit = 100;
            updateSearchClearVisibility();
            render();
            document.getElementById("main").scrollTop = 0;
        }
        // Cached so updateListHeaderStuck (called on every scroll frame) doesn't
        // force a synchronous style/layout read each time — padding only
        // changes on resize/density toggle, both of which invalidate it below.
        let cachedMainPadTop = null;
        function invalidateMainPadTopCache() {
            cachedMainPadTop = null;
        }
        function updateListHeaderStuck() {
            const mainEl = document.getElementById("main");
            const listHeader = document.querySelector(".file-list-header");
            if (!mainEl || !listHeader) return;
            if (cachedMainPadTop === null) {
                cachedMainPadTop = parseFloat(getComputedStyle(mainEl).paddingTop) || 0;
            }
            const padTop = cachedMainPadTop;
            if (listHeader.classList.contains("stuck")) {
                if (mainEl.scrollTop < padTop) listHeader.classList.remove("stuck");
            } else {
                const mainTop = mainEl.getBoundingClientRect().top;
                if (listHeader.getBoundingClientRect().top <= mainTop + padTop) listHeader.classList.add("stuck");
            }
        }
        function setupEventListeners() {
            const mainEl = document.getElementById("main");
            const headerEl = document.querySelector(".header");
            let scrollRafPending = false;
            mainEl.addEventListener("scroll", () => {
                if (scrollRafPending) return;
                scrollRafPending = true;
                requestAnimationFrame(() => {
                    scrollRafPending = false;
                    headerEl.classList.toggle("scrolled", mainEl.scrollTop > 2);
                    updateListHeaderStuck();
                });
            }, { passive: true });
            window.addEventListener("resize", invalidateMainPadTopCache, { passive: true });

            const searchInput = document.getElementById("search");
            let searchDebounceTimer;
            searchInput.addEventListener("input", (e) => {
                updateSearchClearVisibility();
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    searchResultLimit = 100;
                    render();
                    document.getElementById("main").scrollTop = 0;
                }, 150);
            });
            document.getElementById("searchClearBtn").addEventListener("click", clearSearch);
            document.getElementById("logoHome").addEventListener("click", () => navigateTo([]));
            document.getElementById("logoHome").addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigateTo([]);
                }
            });
            document.querySelectorAll(".view-btn").forEach((btn) => {
                btn.addEventListener("click", () => setView(btn.dataset.view));
            });
            document.getElementById("closeBtn").addEventListener("click", closeModal);
            document.getElementById("modal").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) closeModal();
            });
            document.getElementById("modalContent").addEventListener("click", (e) => e.stopPropagation());
            document.getElementById("modal").addEventListener("keydown", trapModalFocus);
            document.getElementById("shortcutsBtn").addEventListener("click", openShortcutsModal);
            document.getElementById("shortcutsCloseBtn").addEventListener("click", closeShortcutsModal);
            document.getElementById("shortcutsModal").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) closeShortcutsModal();
            });
            document.getElementById("shortcutsModal").addEventListener("keydown", (e) => trapModalFocus(e, "shortcutsModalContent"));
            document.getElementById("statsBtn").addEventListener("click", openStatsModal);
            document.getElementById("statsCloseBtn").addEventListener("click", closeStatsModal);
            document.getElementById("statsModal").addEventListener("click", (e) => {
                if (e.target === e.currentTarget) closeStatsModal();
            });
            document.getElementById("statsModal").addEventListener("keydown", (e) => trapModalFocus(e, "statsModalContent"));
            window.addEventListener("hashchange", handleHashChange);
            document.getElementById("treePinned").addEventListener("click", handlePinnedFoldersClick);
            document.getElementById("treePinned").addEventListener("keydown", handlePinnedFoldersKeydown);
            document.getElementById("treeFavorites").addEventListener("click", handleFavoriteFilesClick);
            document.getElementById("treeFavorites").addEventListener("keydown", handleFavoriteFilesKeydown);
            document.addEventListener("keydown", (e) => {
                const shortcutsOpen = document.getElementById("shortcutsModal").classList.contains("active");
                const statsOpen = document.getElementById("statsModal").classList.contains("active");
                if (e.key === "Escape") {
                    const settingsMenuEl = document.getElementById("settingsMenu");
                    const themeMenuEl = document.getElementById("themeColorMenu");
                    if (settingsMenuEl.classList.contains("active")) {
                        settingsMenuEl.classList.remove("active");
                        document.getElementById("settingsBtn").setAttribute("aria-expanded", "false");
                        return;
                    }
                    if (themeMenuEl.classList.contains("active")) {
                        themeMenuEl.classList.remove("active");
                        document.getElementById("themeColorBtn").setAttribute("aria-expanded", "false");
                        return;
                    }
                    if (statsOpen) closeStatsModal();
                    else if (shortcutsOpen) closeShortcutsModal();
                    else closeModal();
                    return;
                }
                if (e.key === "?" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) && !shortcutsOpen && !statsOpen) {
                    e.preventDefault();
                    openShortcutsModal();
                    return;
                }
                if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
                    e.preventDefault();
                    document.getElementById("search").focus();
                }
                if (e.key === " ") {
                    const modalOpen = document.getElementById("modal").classList.contains("active");
                    const activeEl = document.activeElement;
                    // Skip when a button (e.g. the focused play button itself, or the
                    // close button) or form field already owns the spacebar — letting
                    // the browser's native activation fire avoids a double-toggle.
                    const ownsSpace = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(activeEl.tagName);
                    if (modalOpen && !ownsSpace) {
                        e.preventDefault();
                        toggleModalPlayback();
                        return;
                    }
                }
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
                        if (e.key === "ArrowLeft" && panel && panel.classList.contains("visible")) focusTreePanel();
                        else focusMainPanel();
                    }
                }
            });
            document.getElementById("main").addEventListener("click", handleStarButtonClick);
            document.getElementById("main").addEventListener("click", handleCardClick);
            document.getElementById("main").addEventListener("click", handleSortHeaderClick);
            document.getElementById("main").addEventListener("keydown", handleGridKeydown);
            document.getElementById("treeContent").addEventListener("click", handleTreeClick);
            document.getElementById("treeContent").addEventListener("keydown", handleTreeKeydown);

            setupDropdown("settingsBtn", "settingsMenu", "settingsDropdown");
            setupDropdown("themeColorBtn", "themeColorMenu", "themeColorDropdown");
            document.querySelectorAll(".theme-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    if (btn.dataset.theme === "custom") {
                        if (vividColor) return; // already the active look, nothing to do
                        const input = document.getElementById("themeColorInput");
                        setCustomColor((input && input.value) || "#8080ff");
                    } else {
                        if (vividColor) resetCustomColor(); // switching to a stock theme drops the custom color
                        saveTheme(btn.dataset.theme);
                    }
                });
            });
            document.getElementById("fontDecrease").addEventListener("click", () => changeFontSize(-1));
            document.getElementById("fontIncrease").addEventListener("click", () => changeFontSize(1));
            document.getElementById("sortSelect").addEventListener("change", (e) => setSortBy(e.target.value));
            document.getElementById("nativePlayerToggle").addEventListener("change", (e) => {
                useNativePlayer = e.target.checked;
                localStorage.setItem("useNativePlayer", useNativePlayer ? "1" : "0");
                document.body.classList.toggle("native-player-mode", useNativePlayer);
            });
            document.getElementById("compactDensityToggle").addEventListener("change", (e) => {
                document.body.classList.toggle("compact-density", e.target.checked);
                localStorage.setItem("compactDensity", e.target.checked ? "1" : "0");
            });
            document.getElementById("zebraStripingToggle").addEventListener("change", (e) => {
                document.documentElement.classList.toggle("no-zebra", !e.target.checked);
                localStorage.setItem("zebraStriping", e.target.checked ? "1" : "0");
            });
            const depthControl = document.getElementById("depthControl");
            if (depthControl) depthControl.addEventListener("click", (e) => {
                const btn = e.target.closest("button[data-depth]");
                if (!btn) return;
                applyDepth(parseInt(btn.dataset.depth, 10));
            });
            wireThemeColorPicker();
            document.getElementById("topPrevBtn").addEventListener("click", goToPrevTrack);
            document.getElementById("topNextBtn").addEventListener("click", goToNextTrack);
            document.getElementById("topShuffleBtn").addEventListener("click", toggleShuffle);
            document.getElementById("copyLinkBtn").addEventListener("click", copyRawLink);
            document.getElementById("favoriteBtn").addEventListener("click", () => toggleFavoriteFile(currentFilePath));
            document.getElementById("playlistStop").addEventListener("click", stopPlaylist);
            document.getElementById("playPlaylistBtn").addEventListener("click", startPlaylistMode);
            setupGotoStepper();
        }
        function copyRawLink() {
            const btn = document.getElementById("copyLinkBtn");
            const url = new URL(`./${encodePathForUrl(currentFilePath)}`, window.location.href).href;
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
                text = new URL(`./${encodePathForUrl(currentFilePath)}`, window.location.href).href;
            } else {
                return;
            }
            text += "\n";
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
            if (e.target.closest(".card-star-btn")) return;
            const t = e.target.closest(".file-card");
            if (!t) return;
            if (t.dataset.directory) {
                const path = safeJsonParse(t.dataset.path, null);
                if (path) navigateTo(path);
            } else t.dataset.file && openFile(t.dataset.file, t.dataset.category, t.dataset.name);
        }
        // Toggles the star/pin state for a card without opening the folder
        // or file underneath it. Updates just this button in place (rather
        // than a full re-render) for a snappy response; the sidebar lists
        // (Pinned/Favorites) and breadcrumb pin icon are refreshed by the
        // underlying toggle functions themselves.
        function handleStarButtonClick(e) {
            const btn = e.target.closest(".card-star-btn");
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const type = btn.dataset.starType;
            const rawPath = btn.dataset.starPath;
            let starred, label;
            if (type === "folder") {
                const pathArr = safeJsonParse(rawPath, null);
                if (!pathArr) return;
                toggleFolderPin(pathArr);
                starred = isPinned(pathArr);
                label = starred ? "Unpin this folder" : "Pin this folder";
            } else {
                toggleFavoriteFile(rawPath);
                starred = isFavoriteFile(rawPath);
                label = starred ? "Remove from favorites" : "Add to favorites";
            }
            btn.classList.toggle("starred", starred);
            btn.setAttribute("aria-pressed", String(starred));
            btn.title = label;
            btn.setAttribute("aria-label", label);
            btn.innerHTML = starred ? icons.starFilled : icons.starOutline;
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
                                (t.onerror = () => t.remove()),
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
                e === "tree" &&
                    (truncatePinnedLabels(document.getElementById("treePinned")),
                    truncatePinnedLabels(document.getElementById("treeFavorites"))),
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
            if (item.dateStr !== undefined) return item.dateStr;
            const d = item.dateObj ?? getItemDate(item);
            if (!d) { item.dateStr = "—"; return item.dateStr; }
            const day = String(d.getDate()).padStart(2, "0");
            item.dateStr = `${d.getFullYear()}/${MONTH_ABBR[d.getMonth()]}/${day}`;
            return item.dateStr;
        }
        function formatItemTime(item) {
            if (item.timeStr !== undefined) return item.timeStr;
            const d = item.dateObj ?? getItemDate(item);
            item.timeStr = d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
            return item.timeStr;
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
                        return (a.dateObj?.getTime() ?? 0) - (b.dateObj?.getTime() ?? 0);
                    case "date-desc":
                        return (b.dateObj?.getTime() ?? 0) - (a.dateObj?.getTime() ?? 0);
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
        // Turns a folder path array into a "#/segment/segment" hash, with each
        // segment percent-encoded individually so folder names containing /,
        // #, or % round-trip correctly. Root/home is just "#/".
        function pathToHash(pathArr) {
            return "#/" + pathArr.map(encodeURIComponent).join("/");
        }
        // Inverse of pathToHash: reads location.hash back into a path array.
        function hashToPath() {
            const raw = location.hash.replace(/^#\/?/, "");
            if (!raw) return [];
            return raw.split("/").filter(Boolean).map(decodeURIComponent);
        }
        // Keeps the URL hash in sync with currentPath so folders are
        // linkable/bookmarkable and the browser back/forward buttons retrace
        // navigation history. Guards against re-triggering navigateTo when
        // the hash change was caused by this same assignment.
        function syncHashWithPath() {
            const newHash = pathToHash(currentPath);
            if (location.hash !== newHash) {
                suppressHashSync = true;
                location.hash = newHash;
            }
        }
        function handleHashChange() {
            if (suppressHashSync) {
                suppressHashSync = false;
                return;
            }
            navigateTo(hashToPath());
        }
        function navigateTo(pathArr) {
            currentPath = pathArr;
            searchQuery = "";
            document.getElementById("search").value = "";
            folderResultLimit = 300;
            updateSearchClearVisibility();
            let accumulated = "";
            for (const segment of pathArr) {
                accumulated += (accumulated ? "/" : "") + segment;
                expandedFolders.add(accumulated);
            }
            render();
            renderPinnedFolders();
            renderFavoriteFiles();
            document.getElementById("main").scrollTop = 0;
            syncHashWithPath();
        }
        // --- Pinned folders ---------------------------------------------
        // Stored as an array of path arrays, e.g. [["Music","Ambient"], []].
        // A plain JSON.stringify comparison is used throughout to check
        // whether two paths refer to the same folder — simple and correct
        // here since path arrays only ever contain strings.
        const PINNED_FOLDERS_KEY = "pinnedFolders";
        function loadPinnedFolders() {
            try {
                const stored = JSON.parse(localStorage.getItem(PINNED_FOLDERS_KEY) || "[]");
                pinnedFolders = Array.isArray(stored) ? stored : [];
            } catch {
                pinnedFolders = [];
            }
        }
        function savePinnedFolders() {
            localStorage.setItem(PINNED_FOLDERS_KEY, JSON.stringify(pinnedFolders));
        }
        function isPinned(pathArr) {
            const target = JSON.stringify(pathArr);
            return pinnedFolders.some((p) => JSON.stringify(p) === target);
        }
        function toggleFolderPin(pathArr) {
            if (isPinned(pathArr)) {
                const target = JSON.stringify(pathArr);
                pinnedFolders = pinnedFolders.filter((p) => JSON.stringify(p) !== target);
            } else {
                pinnedFolders.push(pathArr);
            }
            savePinnedFolders();
            renderPinnedFolders();
            renderBreadcrumb();
        }
        function togglePinCurrentFolder() {
            toggleFolderPin(currentPath);
        }
        function unpinFolder(pathArr) {
            const target = JSON.stringify(pathArr);
            pinnedFolders = pinnedFolders.filter((p) => JSON.stringify(p) !== target);
            savePinnedFolders();
            renderPinnedFolders();
            renderBreadcrumb();
        }
        // Truncates long pinned/favorite labels from the *start* (keeping the
        // tail, e.g. "…9/00s.m3u", visible) so the more distinguishing end of
        // a path/filename stays readable. This is done with real text
        // measurement rather than a CSS direction:rtl trick, because that
        // trick corrupts strings with symmetric punctuation at the edges
        // (e.g. "+checked+") and can shuffle a trailing file extension.
        function measurePinnedTextWidth(text, font) {
            const canvas = measurePinnedTextWidth._canvas || (measurePinnedTextWidth._canvas = document.createElement("canvas"));
            const ctx = canvas.getContext("2d");
            ctx.font = font;
            return ctx.measureText(text).width;
        }
        function truncatePinnedLabels(container) {
            if (!container) return;
            const els = container.querySelectorAll(".tree-pinned-name-stack[data-full]");
            els.forEach((el) => {
                const fullText = el.dataset.full;
                const availWidth = el.clientWidth;
                if (!availWidth) {
                    el.textContent = fullText;
                    return;
                }
                const style = getComputedStyle(el);
                const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                if (measurePinnedTextWidth(fullText, font) <= availWidth) {
                    el.textContent = fullText;
                    return;
                }
                const ellipsis = "\u2026";
                let lo = 0, hi = fullText.length;
                while (lo < hi) {
                    const mid = Math.ceil((lo + hi) / 2);
                    const candidate = ellipsis + fullText.slice(fullText.length - mid);
                    if (measurePinnedTextWidth(candidate, font) <= availWidth) {
                        lo = mid;
                    } else {
                        hi = mid - 1;
                    }
                }
                el.textContent = lo > 0 ? ellipsis + fullText.slice(fullText.length - lo) : ellipsis;
            });
        }
        let pinnedTruncateResizeTimer = null;
        window.addEventListener("resize", () => {
            clearTimeout(pinnedTruncateResizeTimer);
            pinnedTruncateResizeTimer = setTimeout(() => {
                truncatePinnedLabels(document.getElementById("treePinned"));
                truncatePinnedLabels(document.getElementById("treeFavorites"));
            }, 150);
        });
        function renderPinnedFolders() {
            const container = document.getElementById("treePinned");
            if (!container) return;
            if (pinnedFolders.length === 0) {
                container.innerHTML = "";
                return;
            }
            const rows = pinnedFolders.map((pathArr) => {
                const isActive = JSON.stringify(pathArr) === JSON.stringify(currentPath);
                const pathAttr = escapeHtml(JSON.stringify(pathArr));
                const label = pathArr.length ? pathArr.join(" / ") : "Home";
                const name = pathArr.length ? pathArr[pathArr.length - 1] : "Home";
                const folderLabel = pathArr.length > 1 ? pathArr[pathArr.length - 2] : "";
                const displayLabel = folderLabel ? `${folderLabel}/${name}` : name;
                return `
            <div class="tree-pinned-item${isActive ? " active" : ""}" data-path="${pathAttr}" tabindex="0" role="button" aria-label="Go to pinned folder ${escapeHtml(label)}" title="${escapeHtml(label)}">
              ${icons.folder}
              <span class="tree-pinned-name-stack" data-full="${escapeHtml(displayLabel)}"></span>
              <button type="button" class="tree-pinned-unpin" data-unpin-path="${pathAttr}" title="Unpin" aria-label="Unpin ${escapeHtml(label)}">${icons.starFilled}</button>
            </div>
          `;
            }).join("");
            container.innerHTML = `<div class="tree-pinned-header">Pinned</div>${rows}`;
            truncatePinnedLabels(container);
        }
        // Individual file favorites/stars, toggled from the top-right of the
        // preview window. Unlike pinned folders (which need a path array),
        // files already have a single unique string path, so this is a flat
        // array of those path strings.
        const FAVORITE_FILES_KEY = "favoriteFiles";
        function loadFavoriteFiles() {
            try {
                const stored = JSON.parse(localStorage.getItem(FAVORITE_FILES_KEY) || "[]");
                favoriteFiles = Array.isArray(stored) ? stored : [];
            } catch {
                favoriteFiles = [];
            }
        }
        function saveFavoriteFiles() {
            localStorage.setItem(FAVORITE_FILES_KEY, JSON.stringify(favoriteFiles));
        }
        function isFavoriteFile(path) {
            return favoriteFiles.includes(path);
        }
        function toggleFavoriteFile(path) {
            if (!path) return;
            if (isFavoriteFile(path)) {
                favoriteFiles = favoriteFiles.filter((p) => p !== path);
            } else {
                favoriteFiles.push(path);
            }
            saveFavoriteFiles();
            syncFavoriteBtn(path);
            renderFavoriteFiles();
        }
        // Updates the preview window's star button to reflect whether the
        // given path (normally the currently open file) is favorited.
        function syncFavoriteBtn(path) {
            const btn = document.getElementById("favoriteBtn");
            if (!btn) return;
            const favorited = isFavoriteFile(path);
            btn.classList.toggle("favorited", favorited);
            btn.setAttribute("aria-pressed", String(favorited));
            btn.title = favorited ? "Remove from favorites" : "Add to favorites";
            btn.setAttribute("aria-label", favorited ? "Remove file from favorites" : "Add file to favorites");
            btn.innerHTML = favorited ? icons.starFilled : icons.starOutline;
        }
        // Renders the "Favorites" list at the top left of the sidebar, right
        // below Pinned folders. Only the file path is persisted, so the
        // current allFiles list is consulted for a display name/icon; if a
        // favorited file can no longer be found (moved/deleted), it still
        // shows using its stored path so it isn't silently dropped.
        function renderFavoriteFiles() {
            const container = document.getElementById("treeFavorites");
            if (!container) return;
            if (favoriteFiles.length === 0) {
                container.innerHTML = "";
                return;
            }
            const rows = favoriteFiles.map((path) => {
                const item = allFiles.find((f) => f.type === "file" && f.fullPath === path);
                const name = item ? item.name : path.substring(path.lastIndexOf("/") + 1);
                const iconType = item ? (getFileIconType(item.name) || item.category || "other") : "other";
                const pathAttr = escapeHtml(path);
                const parentSegments = path.split("/").slice(0, -1);
                const folderLabel = parentSegments.length ? parentSegments[parentSegments.length - 1] : "";
                const displayLabel = folderLabel ? `${folderLabel}/${name}` : name;
                return `
            <div class="tree-pinned-item" data-file-path="${pathAttr}" tabindex="0" role="button" aria-label="Open favorite file ${escapeHtml(name)}${folderLabel ? ` in ${escapeHtml(folderLabel)}` : ""}" title="${escapeHtml(path)}">
              ${icons[iconType] || icons.other}
              <span class="tree-pinned-name-stack" data-full="${escapeHtml(displayLabel)}"></span>
              <button type="button" class="tree-pinned-unpin" data-unfavorite-path="${pathAttr}" title="Remove from favorites" aria-label="Remove ${escapeHtml(name)} from favorites">${icons.starFilled}</button>
            </div>
          `;
            }).join("");
            container.innerHTML = `<div class="tree-pinned-header">Favorites</div>${rows}`;
            truncatePinnedLabels(container);
        }
        // Pinned folders and favorite files render as visually identical
        // "tree-pinned" strips (see renderPinnedFolders/renderFavoriteFiles)
        // and share the same interaction shape: click/keydown opens the row,
        // clicking the small unpin button removes it instead. The two lists
        // differ only in how a path is read off the row's dataset (folders
        // store a JSON-encoded path array; files store a plain string) and
        // what "open" and "unpin" actually do, so those four bits are the
        // only things each caller needs to supply.
        function makePinnedListHandlers({ getPath, onOpen, getUnpinPath, onUnpin }) {
            function onClick(e) {
                const unpinBtn = e.target.closest(".tree-pinned-unpin");
                if (unpinBtn) {
                    e.stopPropagation();
                    const path = getUnpinPath(unpinBtn);
                    if (path) onUnpin(path);
                    return;
                }
                const item = e.target.closest(".tree-pinned-item");
                if (item) {
                    const path = getPath(item);
                    if (path) onOpen(path);
                }
            }
            function onKeydown(e) {
                if (e.key !== "Enter" && e.key !== " ") return;
                const item = e.target.closest(".tree-pinned-item");
                if (!item) return;
                e.preventDefault();
                const path = getPath(item);
                if (path) onOpen(path);
            }
            return { onClick, onKeydown };
        }
        function openFavoriteFile(path) {
            const fileItem = allFiles.find((f) => f.type === "file" && f.fullPath === path);
            openFile(path, fileItem ? fileItem.category : "", fileItem ? fileItem.name : path.substring(path.lastIndexOf("/") + 1));
        }
        const favoriteFilesHandlers = makePinnedListHandlers({
            getPath: (item) => item.dataset.filePath,
            onOpen: openFavoriteFile,
            getUnpinPath: (btn) => btn.dataset.unfavoritePath,
            onUnpin: (path) => toggleFavoriteFile(path),
        });
        const handleFavoriteFilesClick = favoriteFilesHandlers.onClick;
        const handleFavoriteFilesKeydown = favoriteFilesHandlers.onKeydown;
        const pinnedFoldersHandlers = makePinnedListHandlers({
            getPath: (item) => safeJsonParse(item.dataset.path, null),
            onOpen: (path) => navigateTo(path),
            getUnpinPath: (btn) => safeJsonParse(btn.dataset.unpinPath, null),
            onUnpin: (path) => unpinFolder(path),
        });
        const handlePinnedFoldersClick = pinnedFoldersHandlers.onClick;
        const handlePinnedFoldersKeydown = pinnedFoldersHandlers.onKeydown;
        let lastBreadcrumbPathKey = null;
        function renderBreadcrumb() {
            const breadcrumbEl = document.getElementById("breadcrumb");
            let html = `<span class="breadcrumb-item${currentPath.length === 0 ? " current" : ""}" data-path="[]">Home</span>`;
            currentPath.forEach((segment, i) => {
                const isCurrent = i === currentPath.length - 1;
                const pathAttr = escapeHtml(JSON.stringify(currentPath.slice(0, i + 1)));
                html += `<span class="breadcrumb-separator">/</span>`;
                html += `<span class="breadcrumb-item${isCurrent ? " current" : ""}" data-path="${pathAttr}">${escapeHtml(segment)}</span>`;
            });
            const pinned = isPinned(currentPath);
            html += `<button type="button" class="breadcrumb-pin-btn${pinned ? " pinned" : ""}" id="pinFolderBtn" title="${pinned ? "Unpin this folder" : "Pin this folder"}" aria-label="${pinned ? "Unpin this folder" : "Pin this folder"}" aria-pressed="${pinned}">${pinned ? icons.starFilled : icons.starOutline}</button>`;
            breadcrumbEl.innerHTML = html;
            breadcrumbEl.querySelectorAll(".breadcrumb-item:not(.current)").forEach((el) => {
                el.addEventListener("click", () => {
                    const path = safeJsonParse(el.dataset.path, null);
                    if (path) navigateTo(path);
                });
            });
            const pinBtnEl = document.getElementById("pinFolderBtn");
            if (pinBtnEl) pinBtnEl.addEventListener("click", togglePinCurrentFolder);
            const currentCrumb = breadcrumbEl.querySelector(".breadcrumb-item.current");
            // scrollIntoView forces a synchronous layout flush; only do it when
            // the actual folder path changed (e.g. on navigation), not on every
            // render (view toggles, star clicks, search keystrokes, etc.).
            const pathKey = currentPath.join("/");
            if (currentCrumb && pathKey !== lastBreadcrumbPathKey) {
                currentCrumb.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
            lastBreadcrumbPathKey = pathKey;
        }
        function renderTree() {
            const treeEl = document.getElementById("treeContent");

            function countFolders(items) {
                let count = 0;
                for (const item of items) {
                    if (item.type === "directory") {
                        count++;
                        if (item.children) count += countFolders(item.children);
                    }
                }
                return count;
            }

            function renderFolderList(items, parentPath = "", depth = 0) {
                let html = "";
                const folders = items.filter((item) => item.type === "directory");
                for (const folder of folders) {
                    const folderPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
                    const pathArr = folderPath.split("/").filter(Boolean);
                    const isExpanded = expandedFolders.has(folderPath);
                    const isActive = JSON.stringify(pathArr) === JSON.stringify(currentPath);
                    const hasSubfolders = folder.children?.some((child) => child.type === "directory");
                    html += `
            <div class="tree-item${isActive ? " active" : ""}" data-path="${escapeHtml(JSON.stringify(pathArr))}" style="padding-left: ${depth * 12 + 8}px" tabindex="0" role="treeitem" aria-label="Folder ${escapeHtml(folder.name)}">
              <span class="tree-toggle${hasSubfolders ? (isExpanded ? " expanded" : "") : " empty"}" data-path="${escapeHtml(folderPath)}">
                ${icons.chevron}
              </span>
              ${icons.folder}
              <span class="tree-item-name">${escapeHtml(folder.name)}</span>
            </div>
          `;
                    if (isExpanded && folder.children) {
                        html += `<div class="tree-children">${renderFolderList(folder.children, folderPath, depth + 1)}</div>`;
                    }
                }
                return html;
            }

            const isAtRoot = currentPath.length === 0;
            const rootHasSubfolders = fileIndex.root.some((item) => item.type === "directory");
            let html = `
        <div class="tree-item${isAtRoot ? " active" : ""}" data-path="[]" style="padding-left: 8px" tabindex="0" role="treeitem" aria-label="Root folder">
          <span class="tree-toggle${rootHasSubfolders ? " expanded" : " empty"}" data-path="">
            ${icons.chevron}
          </span>
          ${icons.folder}
          <span class="tree-item-name">Root</span>
        </div>
      `;
            html += renderFolderList(fileIndex.root);
            treeEl.innerHTML = html;

            const totalRows = countFolders(fileIndex.root) + 1;
            const availableHeight = treeEl.parentElement.clientHeight - 32;
            const neededHeight = totalRows * 28;
            treeEl.classList.toggle("needs-scroll", neededHeight > availableHeight);
        }
        function getFileIconType(e) {
            return isPlaylistExtension(e) ? "playlist" : null;
        }
        // Builds the star/pin toggle shown directly on a card in grid, list,
        // and tree view — folders get pinned (same mechanism as the
        // breadcrumb pin button), files get favorited (same mechanism as the
        // preview modal's favorite button). Kept as one shared button so
        // both concepts read the same way to the user: a star.
        function renderStarButton(type, pathValue) {
            const isFolder = type === "folder";
            const starred = isFolder ? isPinned(pathValue) : isFavoriteFile(pathValue);
            const pathAttr = escapeHtml(isFolder ? JSON.stringify(pathValue) : pathValue);
            const label = isFolder
                ? starred ? "Unpin this folder" : "Pin this folder"
                : starred ? "Remove from favorites" : "Add to favorites";
            return `<button type="button" class="card-star-btn${starred ? " starred" : ""}" data-star-type="${type}" data-star-path="${pathAttr}" title="${label}" aria-label="${label}" aria-pressed="${starred}">${starred ? icons.starFilled : icons.starOutline}</button>`;
        }
        // The four right-hand columns (ext/size/date/time) shown in list/tree
        // view are built the same way for the parent-dir row, directories,
        // and files — only the four values differ (directories leave ext
        // blank and show "DIR" for size; the parent-dir row leaves all four
        // blank).
        function renderColumnCells(ext, size, date, time) {
            return `
                <span class="col-ext">${ext}</span>
                <span class="col-size">${size}</span>
                <span class="col-date">${date}</span>
                <span class="col-time">${time}</span>
              `;
        }
        function render() {
            renderBreadcrumb();
            if (currentView === "tree") renderTree();
            const mainEl = document.getElementById("main");

            let all = [];
            if (searchQuery) {
                // Ranked by relevance (with a bonus for the current folder) —
                // don't re-sort by name/date, that would destroy the ranking.
                all = searchFiles(searchQuery);
            } else {
                all = sortItems(getCurrentItems());
            }
            const activeLimit = searchQuery ? searchResultLimit : folderResultLimit;
            const visibleItems = all.slice(0, activeLimit);

            if (searchQuery) {
                announce(all.length === 0 ? `No results for "${searchQuery}"` : `${all.length} result${all.length === 1 ? "" : "s"} for "${searchQuery}"`);
            }

            if (visibleItems.length === 0) {
                mainEl.innerHTML = `
          <div class="empty-state">
            ${searchQuery ? emptyStateIllustrations.search : emptyStateIllustrations.folder}
            <h2>${searchQuery ? "No results" : "Empty folder"}</h2>
            <p>${searchQuery ? "Try different terms" : "No files here"}</p>
          </div>
        `;
                return;
            }
            const isColumnView = currentView === "list" || currentView === "tree";
            const listClass = isColumnView ? "file-list list-columns" : "file-grid";

            const fileCount = all.filter((i) => i.type === "file").length;
            const folderCount = all.filter((i) => i.type === "directory").length;

            let html = `
        <div class="stats-bar">
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6z"/></svg>
            ${fileCount} files ${all.length > visibleItems.length ? `(showing ${visibleItems.length} of ${all.length})` : ""}
          </span>
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            ${folderCount} folders
          </span>
        </div>
        <div class="main-content">
          <div class="${listClass}" id="fileItems" role="grid">
          ${
              isColumnView && !searchQuery
                  ? `
            <div class="file-list-header" role="row">
              <span class="col-star-spacer" aria-hidden="true"></span>
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
                html += `
            <div class="file-card directory parent-dir" data-directory="true" data-path="${escapeHtml(JSON.stringify(currentPath.slice(0, -1)))}" tabindex="0" role="button" aria-label="Go to parent folder">
              ${isColumnView ? `<span class="card-star-spacer" aria-hidden="true"></span>` : ""}
              <div class="file-icon folder">${icons.folder}</div>
              <div class="file-info">
                <span class="file-name">..</span>
                <span class="file-meta"></span>
              </div>
              ${isColumnView ? renderColumnCells("", "", "", "") : ""}
            </div>
          `;
            }
            for (const item of visibleItems) {
                const iconType = item.type === "directory" ? "folder" : getFileIconType(item.name) || item.category || "other";
                const iconSvg = icons[iconType] || icons.other;

                let clickPath, fullDisplayPath, parentDisplayPath, parentPathArr;

                if (searchQuery) {
                    clickPath = item.fullPath;
                    fullDisplayPath = item.fullPath;
                    parentPathArr = item.navPath;
                    // Search results can come from anywhere in the tree, so a
                    // location hint is useful — but showing the *full* path
                    // (including the filename we just showed above it) is
                    // redundant, and for root-level results it duplicates the
                    // filename outright. Show only the containing folder, and
                    // only when there is one.
                    parentDisplayPath = parentPathArr.slice(0, -1).join("/");
                } else {
                    fullDisplayPath = (currentPath.length ? currentPath.join("/") + "/" : "") + item.name;
                    clickPath = fullDisplayPath;
                    parentPathArr = [...currentPath, item.name];
                }

                if (item.type === "directory") {
                    html += `
            <div class="file-card directory" data-directory="true" data-path="${escapeHtml(JSON.stringify(parentPathArr))}" tabindex="0" role="button" aria-label="Open folder ${escapeHtml(item.name)}">
              ${renderStarButton("folder", parentPathArr)}
              <div class="file-icon folder">${icons.folder}</div>
              <div class="file-info">
                <span class="file-name">${searchQuery ? highlightMatch(item.name, searchQuery) : escapeHtml(item.name)}</span>
                <span class="file-meta">
                    ${isColumnView && !searchQuery ? "" : `${item.children?.length || 0} items`}
                    ${searchQuery && parentDisplayPath ? `<span class="file-path">${escapeHtml(parentDisplayPath)}</span>` : ""}
                </span>
              </div>
              ${
                  isColumnView && !searchQuery
                      ? renderColumnCells("", "DIR", escapeHtml(formatItemDate(item)), escapeHtml(formatItemTime(item)))
                      : ""
              }
            </div>
          `;
                } else {
                    let thumbnailHtml = "";
                    if (item.category === "image") {
                        // Both the URL (for the actual request) and the surrounding
                        // HTML attribute need to be safe: encode special URL chars
                        // (#, ?, %) first, then escape for the attribute context.
                        const thumbSrc = escapeHtml(encodePathForUrl(clickPath));
                        thumbnailHtml = currentView === "grid"
                            ? `<img class="file-thumbnail lazy" data-src="./${thumbSrc}" alt="" loading="lazy" decoding="async">`
                            : `<img class="file-thumbnail file-thumbnail-inline lazy" data-src="./${thumbSrc}" alt="" loading="lazy" decoding="async">`;
                    }
                    html += `
            <div class="file-card" data-file="${escapeHtml(clickPath)}" data-category="${item.category}" data-name="${escapeHtml(item.name)}" tabindex="0" role="button" aria-label="Open file ${escapeHtml(item.name)}">
              ${renderStarButton("file", clickPath)}
              ${thumbnailHtml}
              <div class="file-icon ${iconType}">${iconSvg}</div>
              <div class="file-info">
                <span class="file-name">${searchQuery ? highlightMatch(item.name, searchQuery) : escapeHtml(item.name)}</span>
                <span class="file-meta">
                    ${isColumnView && !searchQuery ? "" : item.sizeFormatted}
                    ${searchQuery && parentDisplayPath ? `<span class="file-path">${escapeHtml(parentDisplayPath)}</span>` : ""}
                </span>
              </div>
              ${
                  isColumnView && !searchQuery
                      ? renderColumnCells(escapeHtml(getFileExtension(item.name)), item.sizeFormatted, escapeHtml(formatItemDate(item)), escapeHtml(formatItemTime(item)))
                      : currentView !== "grid" && !searchQuery
                        ? `<span class="file-size">${item.sizeFormatted}</span>`
                        : ""
              }
            </div>
          `;
                }
            }
            html += "</div>";
            if (all.length > visibleItems.length) {
                html += `<button class="load-more-btn" id="loadMoreBtn">Show more (${all.length - visibleItems.length} remaining)</button>`;
            }
            html += "</div>";
            mainEl.innerHTML = html;
            document.querySelectorAll(".file-thumbnail.lazy").forEach((img) => {
                intersectionObserver.observe(img);
            });
            const loadMoreBtn = document.getElementById("loadMoreBtn");
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener("click", () => {
                    if (searchQuery) searchResultLimit += 100;
                    else folderResultLimit += 300;
                    render();
                });
            }
            syncSortUI();
            updateListHeaderStuck();
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
            const e = `./${encodePathForUrl(currentFilePath)}`,
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
            destroyHls();
            clearStreamTimeout();
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
        // Maps common file extensions to highlight.js language aliases.
        // Falls back to hljs's own auto-detection if the extension isn't
        // recognized, and to plain escaped text if hljs isn't available at all.
        const EXT_TO_HLJS_LANG = {
            js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
            ts: "typescript", tsx: "typescript",
            py: "python", rb: "ruby", php: "php", go: "go", rs: "rust",
            java: "java", kt: "kotlin", swift: "swift", c: "c", h: "c",
            cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp",
            sh: "bash", bash: "bash", zsh: "bash", ps1: "powershell",
            html: "xml", htm: "xml", xml: "xml", svg: "xml",
            css: "css", scss: "scss", less: "less",
            json: "json", jsonc: "json", yml: "yaml", yaml: "yaml",
            toml: "ini", ini: "ini", md: "markdown", markdown: "markdown",
            sql: "sql", dockerfile: "dockerfile", makefile: "makefile",
            lua: "lua", r: "r", pl: "perl", diff: "diff", patch: "diff",
        };
        function guessHljsLanguage(fileName) {
            if (!window.hljs || !fileName) return null;
            const base = fileName.toLowerCase();
            const ext = base.includes(".") ? base.split(".").pop() : base;
            const lang = EXT_TO_HLJS_LANG[ext];
            return lang && hljs.getLanguage(lang) ? lang : null;
        }
        // highlight.js returns one HTML string for the whole file, with <span>
        // tags that can freely span multiple lines (e.g. a multi-line block
        // comment). Splitting that naively on "\n" would leave unclosed tags
        // dangling on every line but the first. This walks the markup and
        // reopens/closes span tags at each line boundary so every line is
        // independently valid HTML, which lets us keep wrapping each line in
        // its own <span class="line"> for the CSS-counter line numbers.
        function splitHighlightedHtml(html) {
            const rawLines = html.split("\n");
            const tagRegex = /<span class="([^"]*)">|<\/span>/g;
            let openTags = [];
            const result = [];
            for (const line of rawLines) {
                const prefix = openTags.map((cls) => `<span class="${cls}">`).join("");
                const stack = [...openTags];
                tagRegex.lastIndex = 0;
                let match;
                while ((match = tagRegex.exec(line))) {
                    if (match[0] === "</span>") stack.pop();
                    else stack.push(match[1]);
                }
                result.push(prefix + line + "</span>".repeat(stack.length));
                openTags = stack;
            }
            return result;
        }
        function renderTextPreview(container, text, fileName) {
            const MAX_LINES = 1e4;
            const allLines = text.split("\n");
            const lines = allLines.slice(0, MAX_LINES);
            const truncated = allLines.length > MAX_LINES;
            const lang = guessHljsLanguage(fileName);

            let highlightedLines;
            if (lang) {
                try {
                    highlightedLines = lines.map(escapeHtml);
                } catch (e) {
                    console.warn("Syntax highlighting failed, falling back to plain text:", e);
                    highlightedLines = lines.map(escapeHtml);
                }
            } else {
                highlightedLines = lines.map(escapeHtml);
            }

            const rendered = highlightedLines.map((l) => `<span class="line">${l}</span>`).join("\n");
            container.innerHTML = `
        ${truncated ? `<div class="truncation-notice">Showing first ${MAX_LINES.toLocaleString()} of ${allLines.length.toLocaleString()} lines — download the file to see the rest.</div>` : ""}
        <div class="preview-code line-numbers${lang ? " hljs" : ""}">
          <pre><code class="hljs">${rendered}</code></pre>
        </div>
      `;
        }
        async function showPlaylistAsText() {
            const e = `./${encodePathForUrl(currentFilePath)}`;
            try {
                const text = await fetchTextCached(e);
                renderTextPreview(document.getElementById("modalBody"), text, currentFileName);
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

        // Shared teardown helpers for the HLS instance / stream-timeout timer,
        // used across playlist stop/close/skip/retry paths so cleanup logic
        // only lives in one place.
        function destroyHls() {
            if (currentHls) { currentHls.destroy(); currentHls = null; }
        }
        function clearStreamTimeout() {
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        }

        function skipToNext() {
            console.debug("Stream invalid or timeout. Skipping...");
            clearStreamTimeout();
            if (currentPlaylist.length <= 1) {
                console.debug("End of playlist reached.");
                announce("Stream unavailable. End of playlist.");
                stopPlaylist();
                return;
            }
            announce("Stream unavailable, skipping to next track.");
            if (isShuffle) {
                const nextIdx = getNextShuffleIndex();
                shuffleHistory.push(nextIdx);
                playPlaylistTrack(nextIdx);
            } else if (currentPlaylistIndex < currentPlaylist.length - 1) {
                playPlaylistTrack(currentPlaylistIndex + 1);
            } else {
                console.debug("End of playlist reached.");
                stopPlaylist();
            }
        }

        // Shared by both the video and audio branches of playPlaylistTrack:
        // wires the "loaded/error/ended" handlers and picks HLS vs a plain
        // src, since that logic is identical regardless of which kind of
        // element is playing. Keeping it in one place means future playlist
        // features (a new fallback, a new HLS event, etc.) only need to be
        // written once.
        function attachPlaylistStream(mediaEl, finalUrl, urlLower) {
            mediaEl.onloadeddata = () => {
                clearStreamTimeout();
                setPlaylistBuffering(false);
            };
            mediaEl.onerror = () => skipToNext();
            mediaEl.onended = () => {
                clearStreamTimeout();
                goToNextTrack();
            };

            if (Hls.isSupported() && (urlLower.includes(".m3u8") || urlLower.includes("application/x-mpegurl"))) {
                currentHls = new Hls();
                currentHls.loadSource(finalUrl);
                currentHls.attachMedia(mediaEl);
                currentHls.on(Hls.Events.FRAG_LOADED, function () {
                    clearStreamTimeout();
                    setPlaylistBuffering(false);
                });
                currentHls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) skipToNext();
                });
            } else {
                mediaEl.src = finalUrl;
                mediaEl.load();
                mediaEl.play().catch(() => {});
            }
        }
        async function playPlaylistTrack(e) {
            if (e < 0 || e >= currentPlaylist.length) return;

            clearStreamTimeout();
            streamTimeout = setTimeout(() => {
                skipToNext();
            }, STREAM_TIMEOUT_MS);

            (currentPlaylistIndex = e), updatePlaylistUI();

            const item = currentPlaylist[currentPlaylistIndex];
            const s = item.title;
            document.getElementById("modalTitle").textContent = s;
            announce(`Loading: ${s}`);
            // New track: drop any in-flight metadata listener and clear
            // last track's live rows so nothing stale lingers in the panel.

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
                    destroyHls();
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
                    video.onvolumechange = (e) => { currentVolume = e.target.volume; localStorage.setItem("playerVolume", currentVolume); };
                    setupAudioNormalization(video);
                    setupMediaSession(video, s);
                    maybeWireMediaControls(video);
                    document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                } else if (currentHls) {
                    // Same element, but the previous track had its own HLS instance attached.
                    destroyHls();
                    updateMediaSessionTitle(s);
                } else {
                    updateMediaSessionTitle(s);
                }
                attachPlaylistStream(video, finalUrl, o);
            } else {
                let audio = n.querySelector("#audioPlayer");
                if (!audio) {
                    destroyHls();
                    document.getElementById("modalContent").classList.remove("video-modal");
                    n.innerHTML = `
                      <div class="preview-audio-container">
                        <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link &amp; header" aria-label="Copy stream link and header">${icons.info}</button>
                        <div class="audio-icon">${pickPlayerNoteIcon()}</div>
                        <div class="playlist-now-playing">${escapeHtml(s)}</div>
                        <audio id="audioPlayer" class="preview-audio" autoplay crossOrigin="anonymous" ${mediaTagAttrs()}>
                          Your browser does not support audio playback.
                        </audio>
                        ${mediaControlsMarkup()}
                      </div>
                    `;
                    audio = document.getElementById("audioPlayer");
                    audio.volume = currentVolume;
                    audio.onvolumechange = (e) => { currentVolume = e.target.volume; localStorage.setItem("playerVolume", currentVolume); };
                    setupAudioNormalization(audio);
                    setupMediaSession(audio, s);
                    maybeWireMediaControls(audio);
                    document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                } else {
                    destroyHls();
                    const titleEl = n.querySelector(".playlist-now-playing");
                    if (titleEl) titleEl.textContent = s;
                    const iconEl = n.querySelector(".audio-icon");
                    if (iconEl) iconEl.innerHTML = pickPlayerNoteIcon();
                    updateMediaSessionTitle(s);
                }
                wirePlayerIconTap(n);
                attachPlaylistStream(audio, finalUrl, o);
            }
        }

        async function openFile(filePath, fileType, fileName) {
            rememberModalFocus("modal");
            const modalEl = document.getElementById("modal"),
                titleEl = document.getElementById("modalTitle"),
                bodyEl = document.getElementById("modalBody"),
                downloadBtn = document.getElementById("downloadBtn"),
                rawLinkBtn = document.getElementById("rawBtn"),
                playlistBarEl = document.getElementById("playlistBar"),
                playPlaylistBtn = document.getElementById("playPlaylistBtn");

            currentFilePath = filePath;
            currentFileName = fileName;
            isPlaylistFile = isPlaylistExtension(fileName);

            // The actual request URL: percent-encode special chars (#, ?, %)
            // so filenames containing them resolve correctly instead of
            // getting truncated at a "fragment" or silently mangled.
            const fileUrl = `./${encodePathForUrl(filePath)}`;
            // The same URL, safe to drop into an HTML attribute string.
            const fileUrlAttr = escapeHtml(fileUrl);

            titleEl.textContent = fileName;
            downloadBtn.href = fileUrl;
            downloadBtn.download = fileName;
            rawLinkBtn.href = fileUrl;
            syncFavoriteBtn(filePath);
            bodyEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            bodyEl.classList.remove("scrollable");
            currentPlaylist = [];
            currentPlaylistIndex = 0;
            shuffleBag = [];
            shuffleHistory = [];
            closeGotoPopover();
            playlistBarEl.classList.remove("active");
            if (isPlaylistFile) playPlaylistBtn.classList.remove("hidden");
            else playPlaylistBtn.classList.add("hidden");
            document.getElementById("modalContent").classList.remove("video-modal", "compact-modal");
            modalEl.classList.add("active");
            requestAnimationFrame(() => document.getElementById("closeBtn").focus());
            const o = fileUrlAttr;
            try {
                switch (fileType) {
                    case "image":
                        bodyEl.innerHTML = `<img class="preview-image" src="${o}" alt="${escapeHtml(fileName)}">`;
                        break;
                    case "video":
                        document.getElementById("modalContent").classList.add("video-modal");
                        bodyEl.innerHTML = `
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
                        const singleVideo = bodyEl.querySelector('video');
                        if (singleVideo) {
                            singleVideo.volume = currentVolume;
                            singleVideo.onvolumechange = (e) => { currentVolume = e.target.volume; localStorage.setItem("playerVolume", currentVolume); };
                            setupAudioNormalization(singleVideo);
                            setupMediaSession(singleVideo, fileName);
                            maybeWireMediaControls(singleVideo);
                        }
                        document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                        break;
                    case "audio":
                        document.getElementById("modalContent").classList.add("compact-modal");
                        bodyEl.innerHTML = `
              <div class="preview-audio-container">
                <button class="player-info-btn" id="streamInfoBtn" title="Copy stream link" aria-label="Copy stream link">${icons.info}</button>
                <div class="audio-icon">${pickPlayerNoteIcon()}</div>
                <div class="playlist-now-playing">${escapeHtml(fileName)}</div>
                <audio class="preview-audio" autoplay crossOrigin="anonymous" ${mediaTagAttrs()}>
                  <source src="${o}">
                  Your browser does not support audio playback.
                </audio>
                ${mediaControlsMarkup()}
              </div>
            `;
                        // Apply volume and normalization to single files too
                        const singleAudio = bodyEl.querySelector('audio');
                        if (singleAudio) {
                            singleAudio.volume = currentVolume;
                            singleAudio.onvolumechange = (e) => { currentVolume = e.target.volume; localStorage.setItem("playerVolume", currentVolume); };
                            setupAudioNormalization(singleAudio);
                            setupMediaSession(singleAudio, fileName);
                            maybeWireMediaControls(singleAudio);
                        }
                        wirePlayerIconTap(bodyEl);
                        document.getElementById("streamInfoBtn").addEventListener("click", copyStreamInfo);
                        break;
                    case "document":
                        if (fileName.toLowerCase().endsWith(".pdf")) {
                            bodyEl.innerHTML = `<iframe class="preview-pdf" src="${o}"></iframe>`;
                        } else {
                            showUnavailable(bodyEl, fileName, fileUrl);
                        }
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
                            const text = await fetchTextCached(fileUrl);
                            renderTextPreview(bodyEl, text, fileName);
                            bodyEl.classList.add("scrollable");
                        } catch (err) {
                            showUnavailable(bodyEl, fileName, fileUrl, err);
                        }
                        break;
                    case "font": {
                        const fontFamily = "PreviewFont" + Date.now();
                        const fontFace = new FontFace(fontFamily, `url("${fileUrl}")`);
                        await fontFace.load();
                        document.fonts.add(fontFace);
                        bodyEl.innerHTML = `
              <div style="padding: 1.5rem; text-align: center; font-family: '${fontFamily}', sans-serif;">
                <p style="font-size: 2rem; margin-bottom: 0.75rem;">The quick brown fox jumps over the lazy dog</p>
                <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
                <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">abcdefghijklmnopqrstuvwxyz</p>
                <p style="font-size: 1.5rem;">0123456789!@#$%^&*()</p>
              </div>
            `;
                        break;
                    }
                    default:
                        showUnavailable(bodyEl, fileName, fileUrl);
                }
            } catch (err) {
                console.error(err);
                showUnavailable(bodyEl, fileName, fileUrl);
            }
        }
        function showUnavailable(containerEl, fileName, fileUrl, err) {
            let reason = "This file cannot be previewed.";
            if (err && err.status === 404) reason = "This file could not be found (404).";
            else if (err && err.status) reason = `The server returned an error (HTTP ${err.status}).`;
            else if (err) reason = "This file couldn't be loaded — it may be blocked by CORS or a network issue.";
            containerEl.innerHTML = `
        <div class="preview-unavailable">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
          </svg>
          <h3>Preview not available</h3>
          <p>${reason}</p>
          <a class="download-btn" href="${escapeHtml(fileUrl)}" download="${escapeHtml(fileName)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Download
          </a>
        </div>
      `;
        }
        // Spacebar play/pause for the currently open preview, mirroring what
        // native <video>/<audio> controls give you for free — needed now that
        // the custom control bar replaces them.
        function toggleModalPlayback() {
            const media = document.getElementById("modalBody").querySelector("audio, video");
            if (!media) return;
            media.muted = false;
            media.paused ? media.play().catch(() => {}) : media.pause();
        }
        function handleModalKeydown(key) {
            const modalBody = document.getElementById("modalBody");
            switch (key) {
                case "ArrowUp":
                    modalBody.scrollBy({ top: -120, behavior: "auto" });
                    break;
                case "ArrowDown":
                    modalBody.scrollBy({ top: 120, behavior: "auto" });
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
            const modalEl = document.getElementById("modal");
            modalEl.classList.remove("active");

            destroyHls();
            clearStreamTimeout();

            const videoEl = modalEl.querySelector("video");
            const audioEl = modalEl.querySelector("audio");
            if (videoEl) videoEl.pause();
            if (audioEl) audioEl.pause();
            currentPlaylist = [];
            currentPlaylistIndex = 0;
            shuffleBag = [];
            shuffleHistory = [];
            currentFilePath = "";
            currentFileName = "";
            isPlaylistFile = false;
            closeGotoPopover();
            document.getElementById("playlistBar").classList.remove("active");
            document.getElementById("playPlaylistBtn").classList.add("hidden");
            restoreModalFocus("modal");
        }
        // Shared focus save/restore for all three modals (file preview,
        // shortcuts, stats), keyed by modal element id so a single Map
        // replaces what used to be a separate lastFocusedElement* variable
        // per modal.
        function rememberModalFocus(modalId) {
            modalFocusReturn.set(modalId, document.activeElement);
        }
        function restoreModalFocus(modalId) {
            const el = modalFocusReturn.get(modalId);
            if (el && typeof el.focus === "function") el.focus();
            modalFocusReturn.delete(modalId);
        }
        function trapModalFocus(e, containerId = "modalContent") {
            if (e.key !== "Tab") return;
            const modal = document.getElementById(containerId);
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
        function openShortcutsModal() {
            rememberModalFocus("shortcutsModal");
            document.getElementById("shortcutsModal").classList.add("active");
            document.getElementById("shortcutsCloseBtn").focus();
        }
        function closeShortcutsModal() {
            document.getElementById("shortcutsModal").classList.remove("active");
            restoreModalFocus("shortcutsModal");
        }
        // Human-readable byte size, matching the units getItemSize() already
        // parses (powers of 1024) so the two stay consistent with each other.
        function formatBytes(bytes) {
            if (!bytes) return "0 B";
            const units = ["B", "KB", "MB", "GB", "TB"];
            let n = bytes, i = 0;
            while (n >= 1024 && i < units.length - 1) {
                n /= 1024;
                i++;
            }
            return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
        }
        // Walks the already-flattened allFiles list (built once by
        // preprocessFiles) rather than re-walking fileIndex.root, so this
        // stays cheap even for a library with thousands of entries.
        function computeLibraryStats() {
            let fileCount = 0, folderCount = 0, totalSize = 0, playlistCount = 0;
            const byCategory = {};
            for (const item of allFiles) {
                if (item.type === "directory") {
                    folderCount++;
                } else {
                    fileCount++;
                    totalSize += getItemSize(item);
                    const cat = item.category || "other";
                    byCategory[cat] = (byCategory[cat] || 0) + 1;
                    // Counted by extension (not item.category) so this stays
                    // accurate regardless of how the index JSON classifies
                    // m3u/m3u8 files elsewhere.
                    if (isPlaylistExtension(item.name || "")) playlistCount++;
                }
            }
            return { fileCount, folderCount, totalSize, byCategory, playlistCount };
        }
        function renderLibraryStats() {
            const body = document.getElementById("statsBody");
            const { fileCount, folderCount, totalSize, byCategory, playlistCount } = computeLibraryStats();
            // Merge in a dedicated, accurately-counted m3u/m3u8 row alongside
            // the generic category breakdown (replacing whatever count the
            // generic classification would have given "playlist"), so it's
            // guaranteed to appear and reads as one more row in the same
            // list - same icon/label/bar treatment as everything else.
            const mergedCategories = { ...byCategory };
            if (playlistCount > 0) mergedCategories.playlist = playlistCount;
            else delete mergedCategories.playlist;
            const categories = Object.entries(mergedCategories).sort((a, b) => b[1] - a[1]);
            const maxCount = categories.length ? categories[0][1] : 1;
            const rows = categories.map(([cat, count]) => {
                const pct = Math.round((count / maxCount) * 100);
                const isPlaylistRow = cat === "playlist";
                const label = isPlaylistRow ? "M3U / M3U8" : escapeHtml(cat);
                return `
          <div class="stats-row">
            <span class="stats-row-icon">${icons[cat] || icons.other}</span>
            <span class="stats-row-label"${isPlaylistRow ? ' style="text-transform:none"' : ""}>${label}</span>
            <span class="stats-row-bar-track"><span class="stats-row-bar-fill" style="width: ${pct}%"></span></span>
            <span class="stats-row-count">${count.toLocaleString()}</span>
          </div>
        `;
            }).join("");
            body.innerHTML = `
        <div class="stats-summary-grid">
          <div class="stats-summary-item">
            <span class="stats-summary-value">${fileCount.toLocaleString()}</span>
            <span class="stats-summary-label">Files</span>
          </div>
          <div class="stats-summary-item">
            <span class="stats-summary-value">${folderCount.toLocaleString()}</span>
            <span class="stats-summary-label">Folders</span>
          </div>
          <div class="stats-summary-item">
            <span class="stats-summary-value">${formatBytes(totalSize)}</span>
            <span class="stats-summary-label">Total Size</span>
          </div>
        </div>
        ${categories.length ? `<div class="stats-breakdown-title">By Category</div><div class="stats-breakdown">${rows}</div>` : ""}
      `;
        }
        function openStatsModal() {
            rememberModalFocus("statsModal");
            renderLibraryStats();
            document.getElementById("statsModal").classList.add("active");
            document.getElementById("statsCloseBtn").focus();
        }
        function closeStatsModal() {
            document.getElementById("statsModal").classList.remove("active");
            restoreModalFocus("statsModal");
        }
        // Percent-encodes a repo-relative path one segment at a time so "/"
        // is preserved as a directory separator while everything else goes
        // through encodeURIComponent. Without this, a filename containing
        // #, ?, or % breaks the request outright: fetch(), <img src>, and
        // `new URL()` all parse the string as a URL first, so a literal "#"
        // is read as a fragment marker and everything after it is silently
        // dropped rather than sent to the server.
        function encodePathForUrl(path) {
            return String(path).split("/").map(encodeURIComponent).join("/");
        }
        // Escapes a string for safe use in BOTH HTML text content and HTML
        // attribute values. The textContent/innerHTML round-trip alone only
        // escapes &, <, > — it leaves quote characters untouched, which is
        // fine for text nodes but breaks any attribute value wrapped in that
        // quote character (e.g. a filename containing a literal ' or ").
        // Escaping quotes here too makes every existing call site safe for
        // attribute use for free, since browsers decode entities in
        // attribute values before JS ever reads them back out.
        function escapeHtml(e) {
            const t = document.createElement("div");
            t.textContent = e;
            return t.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }

        // Wraps the parts of `name` that matched `rawQuery` in <mark> tags for
        // display in search results. Mirrors scoreSearchItem's own match tiers
        // (exact substring -> per-token substrings -> fuzzy subsequence) purely
        // for highlighting purposes; it doesn't affect ranking.
        function highlightMatch(name, rawQuery) {
            if (!rawQuery) return escapeHtml(name);
            const query = rawQuery.toLowerCase();
            const lowerName = name.toLowerCase();

            const buildFromMask = (mask) => {
                let out = "", i = 0;
                while (i < name.length) {
                    let j = i;
                    if (mask[i]) {
                        while (j < name.length && mask[j]) j++;
                        out += `<mark class="search-highlight">${escapeHtml(name.slice(i, j))}</mark>`;
                    } else {
                        while (j < name.length && !mask[j]) j++;
                        out += escapeHtml(name.slice(i, j));
                    }
                    i = j;
                }
                return out;
            };

            const exactIdx = lowerName.indexOf(query);
            if (exactIdx !== -1) {
                const mask = new Array(name.length).fill(false);
                for (let k = exactIdx; k < exactIdx + query.length; k++) mask[k] = true;
                return buildFromMask(mask);
            }

            const tokens = query.split(/[\s/]+/).filter(Boolean);
            if (tokens.length > 1) {
                const mask = new Array(name.length).fill(false);
                let any = false;
                for (const tok of tokens) {
                    const idx = lowerName.indexOf(tok);
                    if (idx !== -1) {
                        any = true;
                        for (let k = idx; k < idx + tok.length; k++) mask[k] = true;
                    }
                }
                if (any) return buildFromMask(mask);
            }

            const compact = query.replace(/[^a-z0-9]/g, "");
            if (compact) {
                const mask = new Array(name.length).fill(false);
                let qi = 0;
                for (let i = 0; i < name.length && qi < compact.length; i++) {
                    if (lowerName[i] === compact[qi]) {
                        mask[i] = true;
                        qi++;
                    }
                }
                if (qi === compact.length) return buildFromMask(mask);
            }

            return escapeHtml(name);
        }
        init();
